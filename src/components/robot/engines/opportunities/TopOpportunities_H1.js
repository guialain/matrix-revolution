// ============================================================================
// TopOpportunities_H1.js — H1 ROUTER v4 — Intraday-Driven Type System
// LIVE MODE — ported from Neo-Backtest v4
//
// 10 routes RSI (5 BUY + 5 SELL miroir)
// Type REVERSAL/CONTINUATION déterminé par contexte intraday
// 4 niveaux de gates: STRICT / NORMAL / SOUPLE / RELAXED
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";
import { scoreReversalBuy, scoreReversalSell, scoreContinuationBuy, scoreContinuationSell } from "./ScoreEngine";
import { ALLOWED_SYMBOLS } from "../trading/AssetEligibility";
import { INTRADAY_CONFIG } from "../config/IntradayConfig";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ============================================================================
// NIVEAU 1 — INTRADAY LEVEL + TYPE RESOLUTION
// ============================================================================
function getIntradayLevel(intra, cfg) {
  if (intra === null) return "NEUTRE";
  if (intra >= cfg.explosiveUp)  return "EXPLOSIVE_UP";
  if (intra >= cfg.strongUp)     return "STRONG_UP";
  if (intra >= cfg.dailyUp)      return "UP";
  if (intra > cfg.dailyDown)     return "NEUTRE";
  if (intra > cfg.strongDown)    return "DOWN";
  if (intra > cfg.explosiveDown) return "STRONG_DOWN";
  return "EXPLOSIVE_DOWN";
}

const INTRADAY_TABLE = {
  EXPLOSIVE_DOWN: { BUY: { type: "REVERSAL",      mode: "relaxed" }, SELL: null },
  STRONG_DOWN:    { BUY: { type: "REVERSAL",      mode: "normal"  }, SELL: { type: "CONTINUATION", mode: "relaxed" } },
  DOWN:           { BUY: { type: "REVERSAL",      mode: "normal"  }, SELL: { type: "CONTINUATION", mode: "normal"  } },
  NEUTRE:         { BUY: { type: "STANDARD",      mode: "normal"  }, SELL: { type: "STANDARD",     mode: "normal"  } },
  UP:             { BUY: { type: "CONTINUATION",  mode: "normal"  }, SELL: { type: "REVERSAL",     mode: "normal"  } },
  STRONG_UP:      { BUY: { type: "CONTINUATION",  mode: "relaxed" }, SELL: { type: "REVERSAL",     mode: "normal"  } },
  EXPLOSIVE_UP:   { BUY: null,                                        SELL: { type: "REVERSAL",     mode: "relaxed" } },
};

function resolveType(level, side) {
  return INTRADAY_TABLE[level]?.[side] ?? null;
}

// ============================================================================
// GATE PRESETS — 4 niveaux calibrés sur données historiques
// ============================================================================
function buildGates(side, mode, type) {
  const isRev = (type === "REVERSAL");
  const isRelaxed = (mode === "relaxed");

  if (isRev && isRelaxed) {
    return {
      slopeH4Min: -5, slopeH4Max: 6,
      drsiH1S0Required: false,
      h1AccelRequired: false, h1DecelRequired: false,
      drsiH1Min: 0, dslopeRev: 0, zRev: -0.5,
      slopeEff: 0, dslope: 0.5,
      z3050: -1.5, z5070: -1.0,
      slopeEff7075: 0.5, dslope7075: 0, z7075: 2.5,
      drsiH4Sum: null,
    };
  }

  if (isRev && !isRelaxed) {
    return {
      slopeH4Min: -3, slopeH4Max: 3,
      drsiH1S0Required: true,
      h1AccelRequired: false, h1DecelRequired: false,
      drsiH1Min: 0.5, dslopeRev: 0.25, zRev: -0.3,
      slopeEff: 0.5, dslope: 1.0,
      z3050: -1.3, z5070: 0.5,
      slopeEff7075: 1.0, dslope7075: 0.3, z7075: 2.0,
      drsiH4Sum: null,
    };
  }

  if (!isRev && isRelaxed) {
    return {
      slopeH4Min: -3, slopeH4Max: 3,
      drsiH1S0Required: true,
      h1AccelRequired: false, h1DecelRequired: false,
      drsiH1Min: 0, dslopeRev: 0.25, zRev: -0.3,
      slopeEff: 0, dslope: 0,
      z3050: 2.0, z5070: 2.5,
      slopeEff7075: 0.5, dslope7075: 0, z7075: 2.5,
      drsiH4Sum: 0,
    };
  }

  if (type === "STANDARD") {
    return {
      slopeH4Min: -3, slopeH4Max: 3,
      drsiH1S0Required: true,
      h1AccelRequired: true, h1DecelRequired: true,
      drsiH1Min: 1.0, dslopeRev: 0.5, zRev: -1.0,
      slopeEff: 1.0, dslope: 0.3,
      z3050: 0.5, z5070: 1.5,
      slopeEff7075: 0.5, dslope7075: 0.3, z7075: 2.0,
      drsiH4Sum: 0.5,
    };
  }

  return {
    slopeH4Min: -3, slopeH4Max: 3,
    drsiH1S0Required: true,
    h1AccelRequired: true, h1DecelRequired: true,
    drsiH1Min: 0.5, dslopeRev: 0.25, zRev: -0.3,
    slopeEff: 0.5, dslope: 0,
    z3050: 1.5, z5070: 1.8,
    slopeEff7075: 0.5, dslope7075: 0, z7075: 2.3,
    drsiH4Sum: 0,
  };
}

// ============================================================================
// BUY ROUTES
// ============================================================================
function matchBuyRoute(
  rsi_s1, slope_h1, dslope_h1, drsi_h1, zscore_h1,
  prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3,
  slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
  drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
  rsi_h1_s0, g
) {
  const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
  if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

  const slope_eff = slope_h1_s0 !== null ? slope_h1_s0 : slope_h1;
  const zscore    = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
  const drsi_h1_live = (rsi_h1_s0 !== null && rsi_s1 !== null)
    ? rsi_h1_s0 - rsi_s1 : drsi_h1;

  const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null)
    ? slope_h1_s0 - slope_h1 : null;
  const h1SlopeAccel = g.h1AccelRequired
    ? (dslope_h1_live === null || dslope_h1_live > 0.1) : true;

  const slope_h4_eff = slope_h4_s0 !== null ? slope_h4_s0 : slope_h4;
  const dslope_h4_live = (slope_h4_s0 !== null && slope_h4 !== null)
    ? slope_h4_s0 - slope_h4 : null;
  const h4SlopeAccel = g.h1AccelRequired
    ? ((dslope_h4_live === null || dslope_h4_live > 0.20)
       && (slope_h4_eff === null || slope_h4_eff > -5.0)) : true;

  const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
  const h4BuyOk = drsi_h4_eff === null || drsi_h4_eff >= -0.3;

  const slopeH4Ok = slope_h4_eff !== null && slope_h4_eff > g.slopeH4Min;
  const drsiH4Ok  = drsi_h4_s0 !== null && drsi_h4_s0 > 0;

  const drsiSafe = drsi_h1_live === null || Math.abs(drsi_h1_live) < 8;

  if (rsi < 25
   && drsi_h1_live !== null && drsi_h1_live > g.drsiH1Min
   && slopeH4Ok && drsiH4Ok
   && (dslope_h1_live ?? dslope_h1) > g.dslopeRev && zscore < g.zRev)
    return { route: "BUY-[0-25]", side: "BUY" };

  if (rsi >= 25 && rsi < 30
   && drsi_h1_live !== null && drsi_h1_live > g.drsiH1Min
   && slopeH4Ok && drsiH4Ok
   && (dslope_h1_live ?? dslope_h1) > g.dslopeRev && zscore < g.zRev)
    return { route: "BUY-[25-30]", side: "BUY" };

  if (rsi >= 30 && rsi < 50
   && slope_eff !== null && slope_eff > g.slopeEff
   && h1SlopeAccel && h4SlopeAccel
   && zscore < g.z3050 && (dslope_h1_live ?? dslope_h1) > g.dslope
   && drsiSafe && h4BuyOk)
    return { route: "BUY-[30-50]", side: "BUY" };

  if (rsi >= 50 && rsi < 70
   && slope_eff !== null && slope_eff > g.slopeEff
   && h1SlopeAccel && h4SlopeAccel
   && zscore < g.z5070 && (dslope_h1_live ?? dslope_h1) > g.dslope
   && drsiSafe && h4BuyOk)
    return { route: "BUY-[50-70]", side: "BUY" };

  if (rsi >= 70 && rsi < 72
   && slope_eff !== null && slope_eff > g.slopeEff7075
   && h1SlopeAccel && h4SlopeAccel
   && zscore > 0.3 && zscore < g.z7075
   && (dslope_h1_live ?? dslope_h1) > g.dslope7075
   && drsiSafe && h4BuyOk)
    return { route: "BUY-[70-75]", side: "BUY" };

  return null;
}

// ============================================================================
// SELL ROUTES (miroir)
// ============================================================================
function matchSellRoute(
  rsi_s1, slope_h1, dslope_h1, drsi_h1, zscore_h1,
  prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3,
  slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
  drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
  rsi_h1_s0, g
) {
  const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
  if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

  const slope_eff = slope_h1_s0 !== null ? slope_h1_s0 : slope_h1;
  const zscore    = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
  const drsi_h1_live = (rsi_h1_s0 !== null && rsi_s1 !== null)
    ? rsi_h1_s0 - rsi_s1 : drsi_h1;

  const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null)
    ? slope_h1_s0 - slope_h1 : null;
  const h1SlopeDecel = g.h1DecelRequired
    ? (dslope_h1_live === null || dslope_h1_live < -0.1) : true;

  const slope_h4_eff = slope_h4_s0 !== null ? slope_h4_s0 : slope_h4;
  const dslope_h4_live = (slope_h4_s0 !== null && slope_h4 !== null)
    ? slope_h4_s0 - slope_h4 : null;
  const h4SlopeDecel = g.h1DecelRequired
    ? ((dslope_h4_live === null || dslope_h4_live < -0.20)
       && (slope_h4_eff === null || slope_h4_eff < 5.0)) : true;

  const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
  const h4SellOk = drsi_h4_eff === null || drsi_h4_eff <= 0.3;

  const slopeH4Ok = slope_h4_eff !== null && slope_h4_eff < g.slopeH4Max;
  const drsiH4Ok  = drsi_h4_s0 !== null && drsi_h4_s0 < 0;

  const drsiSafe = drsi_h1_live === null || Math.abs(drsi_h1_live) < 8;

  if (rsi >= 75
   && drsi_h1_live !== null && drsi_h1_live < -g.drsiH1Min
   && slopeH4Ok && drsiH4Ok
   && (dslope_h1_live ?? dslope_h1) < -g.dslopeRev && zscore > -g.zRev)
    return { route: "SELL-[75-100]", side: "SELL" };

  if (rsi >= 70 && rsi < 75
   && drsi_h1_live !== null && drsi_h1_live < -g.drsiH1Min
   && slopeH4Ok && drsiH4Ok
   && (dslope_h1_live ?? dslope_h1) < -g.dslopeRev && zscore > -g.zRev)
    return { route: "SELL-[70-75]", side: "SELL" };

  if (rsi >= 50 && rsi < 70
   && slope_eff !== null && slope_eff < -g.slopeEff
   && h1SlopeDecel && h4SlopeDecel
   && zscore > -g.z3050 && (dslope_h1_live ?? dslope_h1) < -g.dslope
   && drsiSafe && h4SellOk)
    return { route: "SELL-[50-70]", side: "SELL" };

  if (rsi >= 30 && rsi < 50
   && slope_eff !== null && slope_eff < -g.slopeEff
   && h1SlopeDecel && h4SlopeDecel
   && zscore > -g.z5070 && (dslope_h1_live ?? dslope_h1) < -g.dslope
   && drsiSafe && h4SellOk)
    return { route: "SELL-[30-50]", side: "SELL" };

  if (rsi >= 28 && rsi < 30
   && slope_eff !== null && slope_eff < -g.slopeEff7075
   && h1SlopeDecel && h4SlopeDecel
   && zscore < -0.3 && zscore > -g.z7075
   && (dslope_h1_live ?? dslope_h1) < -g.dslope7075
   && drsiSafe && h4SellOk)
    return { route: "SELL-[25-30]", side: "SELL" };

  return null;
}

// ============================================================================
// ROUTE → SIGNAL PHASE
// ============================================================================
const ROUTE_PHASE = {
  "BUY-[0-25]":     "EXTREME_LOW",
  "BUY-[25-30]":    "OVERSOLD",
  "BUY-[30-50]":    "LOW_MID",
  "BUY-[50-70]":    "MID_HIGH",
  "BUY-[70-75]":    "HIGH",
  "SELL-[75-100]":  "EXTREME_HIGH",
  "SELL-[70-75]":   "OVERBOUGHT",
  "SELL-[50-70]":   "MID_HIGH",
  "SELL-[30-50]":   "LOW_MID",
  "SELL-[25-30]":   "LOW",
};

// ============================================================================
// MAIN — live mode (1 row per symbol)
// ============================================================================
export function evaluateTopOpportunities_H1(marketData = []) {
  if (!Array.isArray(marketData) || !marketData.length) return [];

  const best = new Map();

  for (const row of marketData) {
    const symbol = row?.symbol;
    if (!symbol) continue;
    if (!ALLOWED_SYMBOLS.includes(symbol)) continue;

    const riskCfg = getRiskConfig(symbol);
    const intCfg  = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;

    const atrH1Cap = num(riskCfg?.atrH1Cap);
    const atrH1 = num(row?.atr_h1);
    if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

    // ── Niveau 1 : contexte intraday ────────────────────────────────
    const intra = num(row?.intraday_change);
    const intradayLevel = getIntradayLevel(intra, intCfg);

    const args = [
      num(row?.rsi_h1), num(row?.slope_h1), num(row?.dslope_h1),
      num(row?.drsi_h1), num(row?.zscore_h1),
      num(row?.rsi_h1_previouslow3), num(row?.rsi_h1_previoushigh3),
      num(row?.zscore_h1_min3), num(row?.zscore_h1_max3),
      num(row?.slope_h1_s0), num(row?.drsi_h1_s0), num(row?.zscore_h1_s0),
      num(row?.drsi_h4), num(row?.drsi_h4_s0),
      num(row?.slope_h4), num(row?.slope_h4_s0),
      num(row?.rsi_h1_s0),
    ];

    // ── Try BUY ─────────────────────────────────────────────────────
    let match = null;
    let signalType = null;
    let signalMode = null;
    let gates = null;

    const buyRes = resolveType(intradayLevel, "BUY");
    if (buyRes) {
      const gBuy = buildGates("BUY", buyRes.mode, buyRes.type);
      match = matchBuyRoute(...args, gBuy);
      if (match) { signalType = buyRes.type; signalMode = buyRes.mode; gates = gBuy; }
    }

    if (!match) {
      const sellRes = resolveType(intradayLevel, "SELL");
      if (sellRes) {
        const gSell = buildGates("SELL", sellRes.mode, sellRes.type);
        match = matchSellRoute(...args, gSell);
        if (match) { signalType = sellRes.type; signalMode = sellRes.mode; gates = gSell; }
      }
    }

    if (!match) continue;

    // ── Post-matchRoute gates ─────────────────────────────────────
    const _drsi_h1_s0 = num(row?.drsi_h1_s0);
    const _drsi_h4_s0 = num(row?.drsi_h4_s0);

    // Anti-spike (s0 only — s1 stale bar excluded)
    if (_drsi_h1_s0 !== null && Math.abs(_drsi_h1_s0) >= 8) continue;

    // Gate universel drsi H1 s0
    if (match.side === "SELL" && _drsi_h1_s0 !== null && _drsi_h1_s0 > 0) continue;
    if (match.side === "BUY"  && _drsi_h1_s0 !== null && _drsi_h1_s0 < 0) continue;

    // Gate CONT/STANDARD
    if (signalType === "CONTINUATION" || signalType === "STANDARD") {
      const _sl_h1_s0 = num(row?.slope_h1_s0);
      const _sl_h4_s0 = num(row?.slope_h4_s0);
      if (match.side === "BUY"  && ((_sl_h1_s0 !== null && _sl_h1_s0 <= 0) || (_sl_h4_s0 !== null && _sl_h4_s0 <= 0))) continue;
      if (match.side === "SELL" && ((_sl_h1_s0 !== null && _sl_h1_s0 >= 0) || (_sl_h4_s0 !== null && _sl_h4_s0 >= 0))) continue;
      if (gates.drsiH4Sum !== null) {
        if (match.side === "BUY"  && (_drsi_h4_s0 === null || _drsi_h4_s0 < 1)) continue;
        if (match.side === "SELL" && (_drsi_h4_s0 === null || _drsi_h4_s0 > -1)) continue;
      }
    }

    // Gate STANDARD slope H1 s0 (live only)
    if (signalType === "STANDARD") {
      const _slH1s0 = num(row?.slope_h1_s0);
      if (match.side === "BUY"  && (_slH1s0 === null || _slH1s0 <= 0)) continue;
      if (match.side === "SELL" && (_slH1s0 === null || _slH1s0 >= 0)) continue;
    }

    // Gate [50-70] slope H4 s0 (live only)
    if (match.route === "SELL-[50-70]" || match.route === "BUY-[50-70]") {
      const _slH4s0 = num(row?.slope_h4_s0);
      if (match.side === "SELL" && (_slH4s0 === null || _slH4s0 >= 0)) continue;
      if (match.side === "BUY"  && (_slH4s0 === null || _slH4s0 <= 0)) continue;
    }

    // Gate REVERSAL slope H1 s0
    if (signalType === "REVERSAL") {
      const _sl_h1_s0 = num(row?.slope_h1_s0);
      if (match.side === "BUY"  && (_sl_h1_s0 === null || _sl_h1_s0 <= 0)) continue;
      if (match.side === "SELL" && (_sl_h1_s0 === null || _sl_h1_s0 >= 0)) continue;
    }

    if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

    // ── Score via ScoreEngine ─────────────────────────────────────
    const scoreRow = {
      symbol,
      rsi_h1:               num(row?.rsi_h1),
      rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
      zscore_h1:            num(row?.zscore_h1),
      slope_h1:             num(row?.slope_h1),
      dslope_h1:            num(row?.dslope_h1),
      atr_m15:              num(row?.atr_m15),
      close:                num(row?.close),
      intraday_change:      intra,
    };

    const scored =
      signalType === "REVERSAL"     && match.side === "BUY"  ? scoreReversalBuy(scoreRow) :
      signalType === "REVERSAL"     && match.side === "SELL" ? scoreReversalSell(scoreRow) :
      (signalType === "CONTINUATION" || signalType === "STANDARD") && match.side === "BUY"  ? scoreContinuationBuy(scoreRow) :
      (signalType === "CONTINUATION" || signalType === "STANDARD") && match.side === "SELL" ? scoreContinuationSell(scoreRow) :
      { total: 0, breakdown: {} };

    const score     = Math.round(scored.total);
    const breakdown = scored.breakdown;

    const opp = {
      type:        signalType,
      mode:        signalMode,
      regime:      `${signalType}_${match.side}`,
      route:       match.route,
      timestamp:   row?.timestamp,
      symbol,
      side:        match.side,
      signalType:  match.side,
      signalPhase: ROUTE_PHASE[match.route] ?? match.route,
      engine:      "H1",
      score,
      breakdown,
      intradayLevel,

      // H4
      slope_h4:    num(row?.slope_h4),
      slope_h4_s0: num(row?.slope_h4_s0),
      dslope_h4:   num(row?.dslope_h4),
      drsi_h4:     num(row?.drsi_h4),
      rsi_h4_s0:   num(row?.rsi_h4_s0),
      drsi_h4_s0:  num(row?.drsi_h4_s0),

      // H1 s1
      rsi_h1:      num(row?.rsi_h1),
      slope_h1:    num(row?.slope_h1),
      dslope_h1:   num(row?.dslope_h1),
      drsi_h1:     num(row?.drsi_h1),
      dz_h1:       num(row?.dz_h1),
      zscore_h1:   num(row?.zscore_h1),
      atr_h1:      num(row?.atr_h1),
      rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
      zscore_h1_min3: num(row?.zscore_h1_min3),
      zscore_h1_max3: num(row?.zscore_h1_max3),

      // H1 s0
      rsi_h1_s0:    num(row?.rsi_h1_s0),
      slope_h1_s0:  num(row?.slope_h1_s0),
      drsi_h1_s0:   num(row?.drsi_h1_s0),
      zscore_h1_s0: num(row?.zscore_h1_s0),

      // M15
      atr_m15:     num(row?.atr_m15),

      // M5 s1
      rsi_m5:      num(row?.rsi_m5),
      slope_m5:    num(row?.slope_m5),
      dslope_m5:   num(row?.dslope_m5),
      drsi_m5:     num(row?.drsi_m5),
      zscore_m5:   num(row?.zscore_m5),

      // M5 s0
      rsi_m5_s0:   num(row?.rsi_m5_s0),
      slope_m5_s0: num(row?.slope_m5_s0),
      drsi_m5_s0:  num(row?.drsi_m5_s0),
      zscore_m5_s0:num(row?.zscore_m5_s0),

      close:           num(row?.close),
      intraday_change: intra,
    };

    const existing = best.get(symbol);
    if (!existing || opp.score > existing.score) {
      best.set(symbol, opp);
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}
