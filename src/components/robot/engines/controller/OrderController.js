// ============================================================================
// OrderController.js — NEO MATRIX (TRINITY GATE)
// ---------------------------------------------------------------------------
// Rôle :
//  - Contrôle final avant SEND
//  - Enchaîne les validators (size, allocation, tpsl, margin, opscore)
//  - Retourne une décision canonique + patch + métriques UI
// ============================================================================

import ValidateSize from "./validators/ValidateSize";
import ValidateAllocation from "./validators/ValidateAllocation";
import ValidateTPSL from "./validators/ValidateTPSL";
import ValidateMargin from "./validators/ValidateMargin";
import { getRiskConfig } from "../config/RiskConfig";
import { getAssetClass } from "../../../classification/AssetClassification";

// ============================================================================
// UTILS
// ============================================================================

function mergePatches(base, patch) {
  if (!patch) return base;
  return { ...(base ?? {}), ...patch };
}

function summarize(issues) {
  const hasBlock = issues.some(i => i.level === "BLOCK");
  const hasWarn  = issues.some(i => i.level === "WARN");
  if (hasBlock) return "BLOCK";
  if (hasWarn)  return "WARN";
  return "OK";
}

function computeMaxLots({ allowedNotional, price, contractSize, baseToEUR, volumeStep, symbol }) {
  if (
    !Number.isFinite(allowedNotional) ||
    !Number.isFinite(price) ||
    !Number.isFinite(contractSize) ||
    !Number.isFinite(volumeStep)
  ) return null;

  const b2e = Number.isFinite(baseToEUR) && baseToEUR > 0 ? baseToEUR : 1;
  const isFX = getAssetClass(symbol) === "FX";
  const eurPerLot = isFX ? contractSize * b2e : price * contractSize * b2e;
  const rawLots = allowedNotional / eurPerLot;

  // broker-safe (arrondi vers le bas)
  return Math.floor(rawLots / volumeStep) * volumeStep;
}

// ============================================================================
// CONTROLLER
// ============================================================================

const OrderController = {

  evaluate(ctx) {
    /**
     * ctx attendu :
     * {
     *   draft: { symbol, side, lots, sl, tp, tf, opScore, notional_eur? },
     *   asset: { bid, ask, contract_size, volume_min, volume_max, volume_step, stops_level },
     *   account: { equity, marginUsed, marginLevel },
     *   openPositions: [{ symbol, notional_eur }]
     * }
     */

    const issues = [];
    let suggestedPatch = null;
    const metrics = {};

    // ------------------------------------------------------------------------
    // 1) SIZE — lots broker + notional
    // ------------------------------------------------------------------------
    const rSize = ValidateSize.run(ctx);
    issues.push(...rSize.issues);
    suggestedPatch = mergePatches(suggestedPatch, rSize.patch);
    metrics.size = rSize.metrics;

    // Recalculate notional_eur if lots changed
    const ctx2draft = { ...ctx.draft, ...(suggestedPatch ?? {}) };
    const price2 = ctx2draft.side === "BUY" ? Number(ctx.asset?.ask) : Number(ctx.asset?.bid);
    const cs2 = Number(ctx.asset?.contract_size);
    const b2e = getRiskConfig(ctx.draft?.symbol)?.baseToEUR ?? 1;
    if (Number.isFinite(price2) && Number.isFinite(cs2) && Number.isFinite(ctx2draft.lots)) {
      const isFX = getAssetClass(ctx.draft?.symbol) === "FX";
      const recalcNotional = isFX
        ? ctx2draft.lots * cs2 * b2e
        : ctx2draft.lots * price2 * cs2 * b2e;
      suggestedPatch = mergePatches(suggestedPatch, { notional_eur: recalcNotional });
    }

    const ctx2 = suggestedPatch
      ? { ...ctx, draft: { ...ctx.draft, ...suggestedPatch } }
      : ctx;

    // ------------------------------------------------------------------------
    // 2) ALLOCATION — diversification / equity / levier
    // ------------------------------------------------------------------------
    const rAlloc = ValidateAllocation.run(ctx2);
    issues.push(...rAlloc.issues);
    suggestedPatch = mergePatches(suggestedPatch, rAlloc.patch);
    metrics.allocation = rAlloc.metrics;

    // 🔥 Calcul MAX LOTS AUTORISÉS (si allocation réduite)
    if (rAlloc.metrics?.allocation?.reduced) {
      const alloc = rAlloc.metrics.allocation;

      const price =
        ctx2.draft.side === "BUY"
          ? Number(ctx.asset?.ask)
          : Number(ctx.asset?.bid);

      const maxLots = computeMaxLots({
        allowedNotional: alloc.allowedNotional,
        price,
        contractSize: ctx.asset?.contract_size,
        baseToEUR: b2e,
        volumeStep: ctx.asset?.volume_step,
        symbol: ctx.draft?.symbol
      });

      if (Number.isFinite(maxLots)) {
        metrics.maxLots = maxLots;

        issues.push({
          level: "WARN",
          code: "MAX_LOTS_LIMIT",
          message: `Max lots autorisés = ${maxLots}`
        });
      }
    }

    const ctx3 = suggestedPatch
      ? { ...ctx, draft: { ...ctx.draft, ...suggestedPatch } }
      : ctx;

    // ------------------------------------------------------------------------
    // 3) TP / SL — stops level, cohérence BUY/SELL
    // ------------------------------------------------------------------------
    const rTPSL = ValidateTPSL.run(ctx3);
    issues.push(...rTPSL.issues);
    suggestedPatch = mergePatches(suggestedPatch, rTPSL.patch);
    metrics.tpsl = rTPSL.metrics;

    const ctx4 = suggestedPatch
      ? { ...ctx, draft: { ...ctx.draft, ...suggestedPatch } }
      : ctx;

    // ------------------------------------------------------------------------
    // 4) MARGIN — santé du compte
    // ------------------------------------------------------------------------
    const rMargin = ValidateMargin.run(ctx4);
    issues.push(...rMargin.issues);
    suggestedPatch = mergePatches(suggestedPatch, rMargin.patch);
    metrics.margin = rMargin.metrics;

    // ------------------------------------------------------------------------
    // FINAL DECISION
    // ------------------------------------------------------------------------
    const status = summarize(issues);
    const canSend = status !== "BLOCK";

    return {
      canSend,
      status,         // OK | WARN | BLOCK
      issues,         // messages structurés
      suggestedPatch, // auto-fix possible
      metrics         // 🔥 contient maxLots
    };
  }
};

export default OrderController;
