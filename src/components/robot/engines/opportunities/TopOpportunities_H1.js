// ============================================================================
// TopOpportunities_H1.js — H1-ONLY ROUTER (no H4 dependency)
// Aligned with Neo-Backtest TopOpportunities_H1.js
//
// Detection: slope_h1, dslope_h1, drsi_h1, zscore_h1, prevLow3/High3 (reversal only)
// No drsi_h4, no slope_h4, no prevLow3/High3 on continuation
// Filtering M5: delegated to SignalFilters.js
//
// Each row = 1 symbol snapshot (live). Returns 1 opp max per symbol.
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";
import { scoreReversalBuy, scoreReversalSell, scoreContinuationBuy, scoreContinuationSell } from "./ScoreEngine";
import { ALLOWED_SYMBOLS } from "../trading/AssetEligibility";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ============================================================================
// 12-ROUTE MATCHER — H1 ONLY
// ============================================================================
function matchRoute(rsi, slope_h1, dslope_h1, drsi_h1, zscore_h1, prevLow3, prevHigh3) {
  if (rsi === null || dslope_h1 === null || zscore_h1 === null)
    return null;

  // ── REVERSAL BUY (bas) ──────────────────────────────────────────────
  if (rsi < 25
   && drsi_h1 !== null && drsi_h1 > 0
   && dslope_h1 > 0.25
   && zscore_h1 < -0.8)
    return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

  if (rsi >= 25 && rsi < 30
   && drsi_h1 !== null && drsi_h1 > 0.5
   && dslope_h1 > 0.25
   && zscore_h1 < -0.8)
    return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

  if (rsi >= 30 && rsi < 35
   && slope_h1 !== null && slope_h1 > -2
   && drsi_h1 !== null && drsi_h1 > 0.5
   && dslope_h1 > 0.25
   && zscore_h1 < -0.8
   && prevLow3 !== null && prevLow3 < 30)
    return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

  // ── CONTINUATION SELL [30-35] ─────────────────────────────────────
  if (rsi >= 30 && rsi < 35
   && slope_h1 !== null && slope_h1 < -2
   && drsi_h1 !== null && drsi_h1 < -1
   && dslope_h1 < -0.25
   && zscore_h1 > -1.8)
    return { route: "SELL-C-[30-35]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION [35-50] ──────────────────────────────────────────
  if (rsi >= 35 && rsi < 50
   && slope_h1 !== null && slope_h1 > 1
   && drsi_h1 !== null && drsi_h1 > 1
   && dslope_h1 > 0.25
   && zscore_h1 < 1.8)
    return { route: "BUY-C-[35-50]", side: "BUY", type: "CONTINUATION" };

  if (rsi >= 35 && rsi < 50
   && slope_h1 !== null && slope_h1 < -1.5
   && drsi_h1 !== null && drsi_h1 < -1
   && dslope_h1 < -0.25
   && zscore_h1 > -1.8)
    return { route: "SELL-C-[35-50]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION [50-65] ──────────────────────────────────────────
  if (rsi >= 50 && rsi < 65
   && slope_h1 !== null && slope_h1 > 1.5
   && drsi_h1 !== null && drsi_h1 > 1
   && dslope_h1 > 0.25
   && zscore_h1 < 1.8)
    return { route: "BUY-C-[50-65]", side: "BUY", type: "CONTINUATION" };

  if (rsi >= 50 && rsi < 65
   && slope_h1 !== null && slope_h1 < -1
   && drsi_h1 !== null && drsi_h1 < -1
   && dslope_h1 < -0.25
   && zscore_h1 > -1.8)
    return { route: "SELL-C-[50-65]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION [65-70] ──────────────────────────────────────────
  if (rsi >= 65 && rsi < 70
   && slope_h1 !== null && slope_h1 > 2
   && drsi_h1 !== null && drsi_h1 > 1
   && dslope_h1 > 0.25
   && zscore_h1 < 1.8)
    return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

  // ── REVERSAL SELL (haut) ──────────────────────────────────────────
  if (rsi >= 65 && rsi < 70
   && slope_h1 !== null && slope_h1 < 2
   && drsi_h1 !== null && drsi_h1 < -0.5
   && dslope_h1 < -0.25
   && zscore_h1 > 0.8
   && prevHigh3 !== null && prevHigh3 > 70)
    return { route: "SELL-R-[65-70]", side: "SELL", type: "REVERSAL" };

  if (rsi >= 70 && rsi < 75
   && drsi_h1 !== null && drsi_h1 < -0.5
   && dslope_h1 < -0.25
   && zscore_h1 > 0.8)
    return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };

  if (rsi >= 75
   && drsi_h1 !== null && drsi_h1 < 0
   && dslope_h1 < -0.25
   && zscore_h1 > 0.8)
    return { route: "SELL-R-[75-100]", side: "SELL", type: "REVERSAL" };

  return null;
}

// ============================================================================
// ROUTE → SIGNAL PHASE
// ============================================================================
const ROUTE_PHASE = {
  "BUY-R-[0-25]":    "EXTREME_LOW",
  "BUY-R-[25-30]":   "OVERSOLD",
  "BUY-R-[30-35]":   "PULLBACK_LOW",
  "SELL-C-[30-35]":  "TREND_DOWN_DEEP",
  "SELL-C-[35-50]":  "TREND_DOWN",
  "BUY-C-[35-50]":   "TREND_UP_LOW",
  "BUY-C-[50-65]":   "TREND_UP",
  "SELL-C-[50-65]":  "TREND_DOWN_HIGH",
  "BUY-C-[65-70]":   "TREND_UP_HIGH",
  "SELL-R-[65-70]":  "PULLBACK_HIGH",
  "SELL-R-[70-75]":  "OVERBOUGHT",
  "SELL-R-[75-100]": "EXTREME_HIGH",
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

    const atrH1Cap = num(riskCfg?.atrH1Cap);
    const atrH1 = num(row?.atr_h1);
    if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

    const match = matchRoute(
      num(row?.rsi_h1),
      num(row?.slope_h1),
      num(row?.dslope_h1),
      num(row?.drsi_h1),
      num(row?.zscore_h1),
      num(row?.rsi_h1_previouslow3),
      num(row?.rsi_h1_previoushigh3)
    );
    if (!match) continue;

    if (match.type === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

    const scoreRow = {
      symbol, rsi_h1: num(row?.rsi_h1), rsi_h1_previouslow3: num(row?.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
      zscore_h1: num(row?.zscore_h1), slope_h1: num(row?.slope_h1), dslope_h1: num(row?.dslope_h1),
      atr_m15: num(row?.atr_m15), close: num(row?.close), intraday_change: num(row?.intraday_change),
    };
    const scored =
      match.type === "REVERSAL" && match.side === "BUY"  ? scoreReversalBuy(scoreRow) :
      match.type === "REVERSAL" && match.side === "SELL" ? scoreReversalSell(scoreRow) :
      match.type === "CONTINUATION" && match.side === "BUY"  ? scoreContinuationBuy(scoreRow) :
      match.type === "CONTINUATION" && match.side === "SELL" ? scoreContinuationSell(scoreRow) :
      { total: 0, breakdown: {} };
    const score = Math.round(scored.total);
    const breakdown = scored.breakdown;

    const opp = {
      type:       match.type,
      regime:     `${match.type}_${match.side}`,
      route:      match.route,
      symbol,
      side:       match.side,
      signalType: match.side,
      signalPhase: ROUTE_PHASE[match.route] ?? match.route,
      engine:     "H1",
      score,
      breakdown,

      slope_h4:   num(row?.slope_h4),
      dslope_h4:  num(row?.dslope_h4),
      drsi_h4:    num(row?.drsi_h4),

      rsi_h1:     num(row?.rsi_h1),
      slope_h1:   num(row?.slope_h1),
      dslope_h1:  num(row?.dslope_h1),
      drsi_h1:    num(row?.drsi_h1),
      dz_h1:      num(row?.dz_h1),
      zscore_h1:  num(row?.zscore_h1),
      atr_h1:     num(row?.atr_h1),
      rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),

      atr_m15:    num(row?.atr_m15),

      rsi_m5:     num(row?.rsi_m5),
      slope_m5:   num(row?.slope_m5),
      dslope_m5:  num(row?.dslope_m5),
      drsi_m5:    num(row?.drsi_m5),
      zscore_m5:  num(row?.zscore_m5),

      close:      num(row?.close),
      intraday_change: num(row?.intraday_change),
    };

    const existing = best.get(symbol);
    if (!existing || opp.score > existing.score) {
      best.set(symbol, opp);
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}
