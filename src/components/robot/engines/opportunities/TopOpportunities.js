// ============================================================================
// TopOpportunities.js — 10-ROUTE H4+H1 MATCHER v7.1 (live mode)
//
// Detection: dslope_h4 (H4 acceleration), dslope_h1 (H1 acceleration), rsi_h1 (zone),
//            zscore_h1 (BB position), rsi_h1_previouslow3/high3 (context)
// Filtering M5: delegated to SignalFilters.js
//
// 10 routes RSI-first (v7.1 — extreme reversals removed):
//   REVERSAL  BUY  [25-30]  [30-35]
//   CONT      SELL [30-35] [35-50]  |  BUY [35-50]
//   CONT      BUY  [50-65] |  SELL [50-65]
//   CONT      BUY  [65-70]
//   REVERSAL  SELL [65-70]  [70-75]
//
// Each row = 1 symbol snapshot (live). Returns 1 opp max per symbol.
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ============================================================================
// 10-ROUTE MATCHER (v7.1)
// Uses: rsi_h1, dslope_h4, dslope_h1, zscore_h1, rsi_h1_previouslow3/high3
// ============================================================================
function matchRoute(rsi, dslope_h4, dslope_h1, zscore_h1, prevLow3, prevHigh3) {
  if (rsi === null || dslope_h4 === null || dslope_h1 === null || zscore_h1 === null)
    return null;

  // ── REVERSAL BUY (bas) ──────────────────────────────────────────────
  // [25-30] Oversold: H4 baissier, H1 accélère vers le haut, creux récent profond
  if (rsi >= 25 && rsi < 30
   && dslope_h4 <= -1
   && dslope_h1 > 0
   && zscore_h1 < -1.2
   && prevLow3 !== null && prevLow3 < 20)
    return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

  // [30-35] Reversal confirmed: H4 baissier, H1 accélère, vient d'un vrai creux
  if (rsi >= 30 && rsi < 35
   && dslope_h4 <= -1
   && dslope_h1 > 0
   && zscore_h1 < -0.8
   && prevLow3 !== null && prevLow3 < 25)
    return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

  // ── CONTINUATION SELL (zone basse) ────────────────────────────────
  // [30-35] Trend baissier H4 établi, H1 décélère, venait de plus haut
  if (rsi >= 30 && rsi < 35
   && dslope_h4 <= -1
   && dslope_h1 < 0
   && zscore_h1 < -0.5
   && prevHigh3 !== null && prevHigh3 > 40)
    return { route: "SELL-C-[30-35]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION zone médiane [35-50] ─────────────────────────────
  // BUY: H4 haussier, H1 accélère, RSI vient d'un creux
  if (rsi >= 35 && rsi < 50
   && dslope_h4 >= 1
   && dslope_h1 > 0
   && zscore_h1 < 0.5
   && prevLow3 !== null && prevLow3 < 35)
    return { route: "BUY-C-[35-50]", side: "BUY", type: "CONTINUATION" };

  // SELL: H4 baissier, H1 décélère, venait de plus haut
  if (rsi >= 35 && rsi < 50
   && dslope_h4 <= -1
   && dslope_h1 < 0
   && zscore_h1 > -0.5
   && prevHigh3 !== null && prevHigh3 > 45)
    return { route: "SELL-C-[35-50]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION zone médiane [50-65] ─────────────────────────────
  // BUY: H4 haussier, H1 accélère
  if (rsi >= 50 && rsi < 65
   && dslope_h4 >= 1
   && dslope_h1 > 0
   && zscore_h1 < 1.5
   && prevLow3 !== null && prevLow3 < 45)
    return { route: "BUY-C-[50-65]", side: "BUY", type: "CONTINUATION" };

  // SELL: H4 baissier, H1 décélère
  if (rsi >= 50 && rsi < 65
   && dslope_h4 <= -1
   && dslope_h1 < 0
   && zscore_h1 > -1.5
   && prevHigh3 !== null && prevHigh3 > 55)
    return { route: "SELL-C-[50-65]", side: "SELL", type: "CONTINUATION" };

  // ── CONTINUATION zone haute [65-70] ───────────────────────────────
  // BUY: H4 haussier, H1 accélère, RSI monte encore
  if (rsi >= 65 && rsi < 70
   && dslope_h4 >= 1
   && dslope_h1 > 0
   && zscore_h1 < 1.5
   && prevLow3 !== null && prevLow3 < 65)
    return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

  // ── REVERSAL SELL (haut) ──────────────────────────────────────────
  // [65-70] Confirmed: H4 encore haussier, H1 décroche, pic récent élevé
  if (rsi >= 65 && rsi < 70
   && dslope_h4 >= 1
   && dslope_h1 < 0
   && zscore_h1 > 0.8
   && prevHigh3 !== null && prevHigh3 > 75)
    return { route: "SELL-R-[65-70]", side: "SELL", type: "REVERSAL" };

  // [70-75] Strong: H4 haussier, H1 retourne, pic récent très élevé
  if (rsi >= 70 && rsi < 75
   && dslope_h4 >= 1
   && dslope_h1 < 0
   && zscore_h1 > 1.2
   && prevHigh3 !== null && prevHigh3 > 75)
    return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };

  return null;
}

// ============================================================================
// ROUTE → SIGNAL PHASE
// ============================================================================
const ROUTE_PHASE = {
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
};

// ============================================================================
// MAIN — live mode (1 row per symbol)
// ============================================================================
export function evaluateTopOpportunities(marketData = []) {
  if (!Array.isArray(marketData) || !marketData.length) return [];

  const best = new Map();

  for (const row of marketData) {
    const symbol = row?.symbol;
    if (!symbol) continue;

    const riskCfg = getRiskConfig(symbol);

    const match = matchRoute(
      num(row?.rsi_h1),
      num(row?.dslope_h4),
      num(row?.dslope_h1),
      num(row?.zscore_h1),
      num(row?.rsi_h1_previouslow3),
      num(row?.rsi_h1_previoushigh3)
    );
    if (!match) continue;

    if (match.type === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

    // ── Score neutralisé (routing H4+H1 suffit) ───────────────────────
    const score = 50;
    const breakdown = {};

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

      // H4
      slope_h4:   num(row?.slope_h4),
      dslope_h4:  num(row?.dslope_h4),

      // H1
      rsi_h1:     num(row?.rsi_h1),
      slope_h1:   num(row?.slope_h1),
      dslope_h1:  num(row?.dslope_h1),
      dz_h1:      num(row?.dz_h1),
      zscore_h1:  num(row?.zscore_h1),
      atr_h1:     num(row?.atr_h1),
      rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),

      // M15 (for SignalFilters)
      atr_m15:    num(row?.atr_m15),

      // M5 (for SignalFilters)
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
