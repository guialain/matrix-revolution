// ============================================================================
// TopOpportunities.js — 12-ROUTE RSI MATCHER (live mode)
//
// RSI-first routing (per row, based on rsi_h1):
// - RSI ∈ [0..25)   → BUY-R-[0-25]     reversal
// - RSI ∈ [25..30)  → BUY-R-[25-30]    reversal
// - RSI ∈ [30..35)  → BUY-R-[30-35]    reversal  |  SELL-C-[30-35] continuation
// - RSI ∈ [35..48)  → BUY-C-[35-48]    cont      |  SELL-C-[35-48] cont
// - RSI ∈ [48..52)  → NEUTRAL (skip)
// - RSI ∈ [52..65)  → BUY-C-[52-65]    cont      |  SELL-C-[52-65] cont
// - RSI ∈ [65..70)  → BUY-C-[65-70]    cont      |  SELL-R-[65-70] reversal
// - RSI ∈ [70..75)  → SELL-R-[70-75]   reversal
// - RSI ∈ [75..100] → SELL-R-[75-100]  reversal
//
// Each row = 1 symbol snapshot (live). Returns 1 opp max per symbol.
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";
import {
  scoreReversalBuy, scoreReversalSell,
  scoreContinuationBuy, scoreContinuationSell
} from "./ScoreEngine";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ============================================================================
// 12-ROUTE MATCHER
// ============================================================================
function matchRoute(rsi, slope_h1, dslope_h1, zscore_h1) {
  if (rsi === null || slope_h1 === null || dslope_h1 === null)
    return null;

  // ── REVERSAL BUY (bas) ──────────────────────────────────────────────
  if (rsi < 25
   && slope_h1 < -6
   && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

  if (rsi >= 25 && rsi < 30
   && slope_h1 < -2
   && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

  if (rsi >= 30 && rsi < 35
   && slope_h1 > 1.0
   && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

  // ── CONTINUATION SELL (zone basse) ──────────────────────────────────
  if (rsi >= 30 && rsi < 35
   && slope_h1 <= -2.0
   && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-C-[30-35]", side: "SELL", type: "CONTINUATION" };

  if (rsi >= 35 && rsi < 48
   && slope_h1 <= -1.5
   && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-C-[35-48]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION BUY/SELL (zone centrale) ───────────────────────────
  if (rsi >= 35 && rsi < 48
   && slope_h1 >= 1.0
   && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-C-[35-48]", side: "BUY", type: "CONTINUATION" };

  if (rsi >= 52 && rsi < 65
   && slope_h1 >= 1.5
   && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-C-[52-65]", side: "BUY", type: "CONTINUATION" };

  if (rsi >= 52 && rsi < 65
   && slope_h1 <= -1.0
   && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-C-[52-65]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION BUY (zone haute) ───────────────────────────────────
  if (rsi >= 65 && rsi < 70
   && slope_h1 >= 2.0
   && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

  // ── REVERSAL SELL (haut) ────────────────────────────────────────────
  if (rsi >= 65 && rsi < 70
   && slope_h1 < -1.0
   && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-R-[65-70]", side: "SELL", type: "REVERSAL" };

  if (rsi >= 70 && rsi < 75
   && slope_h1 > 2.0
   && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };

  if (rsi >= 75
   && slope_h1 > 6.0
   && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
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
  "SELL-C-[35-48]":  "TREND_DOWN",
  "BUY-C-[35-48]":   "TREND_UP_LOW",
  "BUY-C-[52-65]":   "TREND_UP",
  "SELL-C-[52-65]":  "TREND_DOWN_HIGH",
  "BUY-C-[65-70]":   "TREND_UP_HIGH",
  "SELL-R-[65-70]":  "PULLBACK_HIGH",
  "SELL-R-[70-75]":  "OVERBOUGHT",
  "SELL-R-[75-100]": "EXTREME_HIGH",
};

// ============================================================================
// MAIN — live mode (1 row per symbol)
// ============================================================================
export function evaluateTopOpportunities(marketData = [], opts = {}) {
  if (!Array.isArray(marketData) || !marketData.length) return [];

  const scoreMin = num(opts?.scoreMin) ?? 0;
  const best = new Map();

  for (const row of marketData) {
    const symbol = row?.symbol;
    if (!symbol) continue;

    const riskCfg = getRiskConfig(symbol);

    const match = matchRoute(
      num(row?.rsi_h1),
      num(row?.slope_h1),
      num(row?.dslope_h1),
      num(row?.zscore_h1)
    );
    if (!match) continue;

    if (match.type === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

    // ── ScoreEngine dispatch ──────────────────────────────────────────
    const scoreRow = {
      symbol,
      rsi_h1:               num(row?.rsi_h1),
      rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
      slope_h1:             num(row?.slope_h1),
      dslope_h1:            num(row?.dslope_h1),
      zscore_h1:            num(row?.zscore_h1),
      atr_m15:              num(row?.atr_m15),
      close:                num(row?.close),
      intraday_change:      num(row?.intraday_change),
    };

    const scoreFn =
      match.type === "REVERSAL" && match.side === "BUY"  ? scoreReversalBuy :
      match.type === "REVERSAL" && match.side === "SELL" ? scoreReversalSell :
      match.type === "CONTINUATION" && match.side === "BUY"  ? scoreContinuationBuy :
      scoreContinuationSell;

    const { total, breakdown } = scoreFn(scoreRow);
    const score = Math.round(total);

    if (score < scoreMin) continue;

    const opp = {
      type:       match.type,
      regime:     `${match.type}_${match.side}`,
      route:      match.route,
      symbol,
      side:       match.side,
      signalType: match.side,
      signalPhase: ROUTE_PHASE[match.route] ?? match.route,
      score,
      breakdown,

      rsi_h1:     scoreRow.rsi_h1,
      slope_h1:   scoreRow.slope_h1,
      dslope_h1:  scoreRow.dslope_h1,
      dz_h1:      num(row?.dz_h1),
      zscore_h1:  scoreRow.zscore_h1,
      atr_h1:     num(row?.atr_h1),
      atr_m15:    scoreRow.atr_m15,
      close:      scoreRow.close,

      rsi_m5:     num(row?.rsi_m5),
      slope_m5:   num(row?.slope_m5),
      dslope_m5:  num(row?.dslope_m5),
      drsi_m5:    num(row?.drsi_m5),
      zscore_m5:  num(row?.zscore_m5),

      rsi_m1:     num(row?.rsi_m1),
      drsi_m1:    num(row?.drsi_m1),

      intraday_change: scoreRow.intraday_change,
    };

    const existing = best.get(symbol);
    if (!existing || opp.score > existing.score) {
      best.set(symbol, opp);
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}
