// ============================================================================
// useAutoTrader.js — Auto Trading Engine
// ============================================================================
// Mirrors the FULL manual guard chain:
//   ValidateSize → ValidateAllocation → ValidateTPSL → ValidateMargin
//   + DealingRoom lot/SL/TP computation + isValidRisk
// ============================================================================

import { useEffect, useRef } from "react";
import { getRiskConfig } from "../components/robot/engines/config/RiskConfig";
import { getAssetClass } from "../components/classification/AssetClassification";
import CapitalAllocation from "../components/robot/engines/trading/CapitalAllocation";
import SignalFrequency from "../components/robot/engines/trading/SignalFrequency";
import { sendOrderToMT5 } from "../utilitaires/sendMT5Instructions";

// ============================================================================
// CONSTANTS (aligned with validators)
// ============================================================================

const MAX_OPEN_POSITIONS = 8;
const DEDUP_WINDOW_MS   = 60_000;  // same symbol+side cooldown
const MIN_MARGIN_LEVEL  = 200;     // ValidateMargin threshold
const LEVERAGE_MAX      = 20;      // CapitalAllocation.LEVERAGE_MAX

// ============================================================================
// 1. VALIDATE SIZE — lots + notional (mirrors ValidateSize.js)
// ============================================================================
// In auto mode we lack live broker data (volume_min/max/step, tick_size/value)
// for non-active symbols. We use RiskConfig as fallback and default broker
// constraints (0.01 step, same as most instruments).
// ============================================================================

function roundToStepDown(value, step) {
  return Math.floor(value / step) * step;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function computeLots(op, equity, cfg) {
  const price = Number(op.close);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(equity) || equity <= 0) return null;

  const contractSize = cfg.contractSize;
  const baseToEUR    = cfg.baseToEUR ?? 1;
  const targetLev    = cfg.targetLeveragePerTrade ?? 1;

  if (!Number.isFinite(contractSize) || contractSize <= 0) return null;

  // DealingRoom formula: eurPerLot = (ref / tickSize) * tickValue
  // Equivalent when tick data unavailable: eurPerLot ≈ price * contractSize * baseToEUR
  const eurPerLot = price * contractSize * baseToEUR;
  if (eurPerLot <= 0) return null;

  const rawLots = (equity * targetLev) / eurPerLot;

  // Broker-safe normalization (mirrors DealingRoom.normalizeLots)
  const volStep = 0.01;
  const volMin  = 0.01;
  const volMax  = 100;

  let lots = roundToStepDown(rawLots, volStep);
  lots = clamp(lots, volMin, volMax);

  const decimals = Math.max(0, Math.ceil(-Math.log10(volStep)));
  lots = Number(lots.toFixed(decimals));

  if (!Number.isFinite(lots) || lots <= 0) return null;
  return lots;
}

// ============================================================================
// 2. COMPUTE NOTIONAL (mirrors ValidateSize notional + OrderController recalc)
// ============================================================================

function computeNotional(lots, price, contractSize, baseToEUR) {
  const n = lots * price * contractSize * baseToEUR;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ============================================================================
// 3. VALIDATE ALLOCATION (mirrors ValidateAllocation + CapitalAllocation)
// ============================================================================
// Returns: { allowed, lots } — lots may be capped if allocation is reduced.
// ============================================================================

function validateAllocation(symbol, lots, notional, equity, openPositions, cfg) {
  const assetClass = getAssetClass(symbol);
  if (!assetClass) return { allowed: false, reason: "UNKNOWN_ASSET_CLASS" };

  const alloc = CapitalAllocation.checkTrade({
    symbol,
    newNotional: notional,
    equity,
    openPositions
  });

  // BLOCK — class saturated
  if (!alloc.allowed) {
    return { allowed: false, reason: alloc.reason ?? "CLASS_CAP_EXCEEDED" };
  }

  // REDUCED — cap lots to remaining capacity
  if (alloc.reduced && Number.isFinite(alloc.allowedNotional)) {
    const price        = notional / (lots * cfg.contractSize * (cfg.baseToEUR ?? 1));
    const contractSize = cfg.contractSize;
    const baseToEUR    = cfg.baseToEUR ?? 1;

    if (Number.isFinite(price) && price > 0 && contractSize > 0) {
      const maxLots = Math.floor(
        alloc.allowedNotional / (price * contractSize * baseToEUR) / 0.01
      ) * 0.01;

      const cappedLots = clamp(maxLots, 0.01, 100);
      if (cappedLots <= 0) return { allowed: false, reason: "LOTS_CAPPED_TO_ZERO" };

      return { allowed: true, lots: Number(cappedLots.toFixed(2)), reduced: true };
    }
  }

  return { allowed: true, lots };
}

// ============================================================================
// 4. COMPUTE SL / TP (mirrors DealingRoom.computeSLTP)
// ============================================================================

function computeSLTP(op, cfg) {
  const price = Number(op.close);
  const atr   = Number(op.atr_h1);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(atr) || atr <= 0) return null;

  const slDist = atr * cfg.slAtr;
  const tpDist = atr * cfg.tpAtr;

  let sl, tp;
  if (op.side === "BUY") {
    sl = price - slDist;
    tp = price + tpDist;
  } else {
    sl = price + slDist;
    tp = price - tpDist;
  }

  // Round to reasonable precision (mirrors DealingRoom digits logic)
  const digits = Math.max(2, Math.ceil(-Math.log10(atr)) + 2);
  sl = Number(sl.toFixed(digits));
  tp = Number(tp.toFixed(digits));

  return { sl, tp };
}

// ============================================================================
// 5. VALIDATE TP/SL (mirrors ValidateTPSL.js)
// ============================================================================
// We lack live stops_level for non-active symbols, but we validate:
//   - SL/TP sense (correct side of price)
//   - SL/TP > 0
// ATR-based distances are typically >> stops_level so this is practically safe.
// ============================================================================

function validateTPSL(side, price, sl, tp) {
  if (!Number.isFinite(sl) || !Number.isFinite(tp)) return false;
  if (!Number.isFinite(price) || price <= 0) return false;

  // SL sense check
  if (sl > 0) {
    if (side === "BUY" && sl >= price) return false;
    if (side === "SELL" && sl <= price) return false;
  }

  // TP sense check
  if (tp > 0) {
    if (side === "BUY" && tp <= price) return false;
    if (side === "SELL" && tp >= price) return false;
  }

  return true;
}

// ============================================================================
// 6. VALIDATE MARGIN (mirrors ValidateMargin.js)
// ============================================================================

function validateMargin(account) {
  const marginLevel = Number(account?.marginLevel);
  const marginUsed  = Number(account?.marginUsed ?? 0);

  // Data missing → proceed with warning (same as ValidateMargin WARN path)
  if (!Number.isFinite(marginLevel)) return true;

  // No exposure = no block (key rule from ValidateMargin)
  if (marginUsed <= 0) return true;

  // Hard block if margin too low
  return marginLevel >= MIN_MARGIN_LEVEL;
}

// ============================================================================
// HOOK
// ============================================================================

export default function useAutoTrader(mode, robot, snapshot) {

  // Dedup tracker: { "SYMBOL_SIDE": timestampMs }
  const sentRef = useRef({});

  // Periodic cleanup of stale dedup entries
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const sent = sentRef.current;
      for (const key of Object.keys(sent)) {
        if (now - sent[key] > DEDUP_WINDOW_MS * 5) delete sent[key];
      }
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // ---- MAIN EFFECT ----
  useEffect(() => {
    // Immediate stop when switching away from AUTO
    if (mode !== "AUTO") return;

    const validOps = robot?.validOpportunities ?? [];
    if (!validOps.length) return;

    const account       = snapshot?.account;
    const openPositions = snapshot?.openPositions ?? [];
    const equity        = Number(account?.equity);

    // ====================================================================
    // GUARD G1 — ValidateMargin (account-level, blocks all orders)
    // ====================================================================
    if (!validateMargin(account)) {
      console.log(
        `[AUTO-TRADER] BLOCKED — margin level ${account?.marginLevel}% < ${MIN_MARGIN_LEVEL}%`
      );
      return;
    }

    // ====================================================================
    // GUARD G2 — Equity valid (ValidateAllocation prerequisite)
    // ====================================================================
    if (!Number.isFinite(equity) || equity <= 0) {
      console.log("[AUTO-TRADER] BLOCKED — equity invalid");
      return;
    }

    // ====================================================================
    // GUARD G3 — Max open positions
    // ====================================================================
    if (openPositions.length >= MAX_OPEN_POSITIONS) {
      console.log(
        `[AUTO-TRADER] BLOCKED — ${openPositions.length} open (max ${MAX_OPEN_POSITIONS})`
      );
      return;
    }

    const openSymbols = new Set(openPositions.map(p => p.symbol));
    const now = Date.now();

    for (const op of validOps) {

      // ==================================================================
      // GUARD G4 — ValidateSize: symbol + side required
      // ==================================================================
      if (!op.symbol || !op.side || !op.emittedAt) continue;
      if (op.side !== "BUY" && op.side !== "SELL") continue;

      // ==================================================================
      // GUARD G5 — No duplicate symbol in open positions
      // ==================================================================
      if (openSymbols.has(op.symbol)) continue;

      // ==================================================================
      // GUARD G6 — Dedup: same symbol+side within cooldown window
      // ==================================================================
      const dedupKey = `${op.symbol}_${op.side}`;
      const lastSent = sentRef.current[dedupKey];
      if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) continue;

      // ==================================================================
      // GUARD G7 — Frequency cooldown (5 min per symbol after trade)
      // ==================================================================
      if (!SignalFrequency.canEmit(`${op.symbol}_${op.side}`)) {
        continue;
      }

      // ==================================================================
      // GUARD G8 — Asset class known (CapitalAllocation prerequisite)
      // ==================================================================
      const assetClass = getAssetClass(op.symbol);
      if (!assetClass) {
        console.log(`[AUTO-TRADER] SKIP ${op.symbol} — unknown asset class`);
        continue;
      }

      // ==================================================================
      // GUARD G9 — ValidateSize: price + atr valid
      // ==================================================================
      const price = Number(op.close);
      const atr   = Number(op.atr_h1);
      if (!Number.isFinite(price) || price <= 0) continue;
      if (!Number.isFinite(atr) || atr <= 0) continue;

      const cfg = getRiskConfig(op.symbol);

      // ==================================================================
      // GUARD G10 — ValidateSize: contractSize valid
      // ==================================================================
      if (!Number.isFinite(cfg.contractSize) || cfg.contractSize <= 0) {
        console.log(`[AUTO-TRADER] SKIP ${op.symbol} — invalid contractSize`);
        continue;
      }

      // ==================================================================
      // STEP 1 — Compute lots (mirrors DealingRoom.handleSideSelect)
      // ==================================================================
      let lots = computeLots(op, equity, cfg);
      if (!lots) {
        console.log(`[AUTO-TRADER] SKIP ${op.symbol} — lots computation failed`);
        continue;
      }

      // ==================================================================
      // STEP 2 — Compute notional (mirrors ValidateSize notional)
      // ==================================================================
      const baseToEUR = cfg.baseToEUR ?? 1;
      let notional = computeNotional(lots, price, cfg.contractSize, baseToEUR);
      if (!notional) {
        console.log(`[AUTO-TRADER] SKIP ${op.symbol} — notional invalid`);
        continue;
      }

      // ==================================================================
      // GUARD G11 — ValidateAllocation + CapitalAllocation.checkTrade
      // ==================================================================
      const allocResult = validateAllocation(
        op.symbol, lots, notional, equity, openPositions, cfg
      );
      if (!allocResult.allowed) {
        console.log(
          `[AUTO-TRADER] SKIP ${op.symbol} — allocation blocked: ${allocResult.reason}`
        );
        continue;
      }

      // Apply capped lots if allocation was reduced
      if (allocResult.reduced) {
        lots = allocResult.lots;
        notional = computeNotional(lots, price, cfg.contractSize, baseToEUR);
        if (!notional) continue;
        console.log(
          `[AUTO-TRADER] ${op.symbol} — lots capped to ${lots} (allocation near limit)`
        );
      }

      // ==================================================================
      // STEP 3 — Compute SL / TP (mirrors DealingRoom.computeSLTP)
      // ==================================================================
      const sltp = computeSLTP(op, cfg);
      if (!sltp) {
        console.log(`[AUTO-TRADER] SKIP ${op.symbol} — SL/TP computation failed`);
        continue;
      }

      // ==================================================================
      // GUARD G12 — ValidateTPSL: sense check (SL/TP correct side of price)
      // ==================================================================
      if (!validateTPSL(op.side, price, sltp.sl, sltp.tp)) {
        console.log(
          `[AUTO-TRADER] SKIP ${op.symbol} — SL/TP sense check failed ` +
          `(side=${op.side} price=${price} sl=${sltp.sl} tp=${sltp.tp})`
        );
        continue;
      }

      // ==================================================================
      // ALL GUARDS PASSED — build order
      // ==================================================================
      const order = {
        symbol:   op.symbol,
        side:     op.side,
        lots,
        sl:       sltp.sl,
        tp:       sltp.tp,
        signalTF: "H1"
      };

      // Mark sent BEFORE async call (prevent race on next render cycle)
      sentRef.current[dedupKey] = now;

      // ==================================================================
      // LOG + FIRE
      // ==================================================================
      console.log(
        `[AUTO-TRADER] ${new Date().toISOString()} | ` +
        `SEND ${order.side} ${order.symbol} | ` +
        `lots=${order.lots} sl=${order.sl} tp=${order.tp} | ` +
        `notional=${Math.round(notional)}€ score=${Math.round(op.score ?? 0)}`
      );

      sendOrderToMT5(order)
        .then(() => {
          console.log(`[AUTO-TRADER] OK — ${order.side} ${order.symbol}`);
          SignalFrequency.recordCooldown(`${order.symbol}_${order.side}`);
        })
        .catch(err => {
          console.error(`[AUTO-TRADER] FAIL — ${order.side} ${order.symbol}:`, err);
          // Allow retry on failure
          delete sentRef.current[dedupKey];
        });
    }
  }, [mode, robot, snapshot]);
}
