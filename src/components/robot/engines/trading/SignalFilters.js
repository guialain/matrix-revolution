// ============================================================================
// SignalFilters.js — M5 MICRO CONTRARY FILTER (v2.5)
// ✅ Compatible VolatilityConfig.js
// Régimes : low | med | high | explo
//
// Politique recommandée :
//   BLOCK : low, explo
//   ALLOW : med, high
// ============================================================================

import { getVolatilityRegime } from "../config/VolatilityConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";
import { TradeCooldown } from "./SignalCooldown";

const SCORE_MIN_TRADE = 25;

const SignalFilters = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // TRADING HOURS FILTER
  // =========================================================
  function isOutsideTradingHours(opp) {
    const now      = new Date();
    const timePart = now.toTimeString().slice(0, 5); // "HH:MM"

    const symbol = String(opp?.symbol ?? "").toUpperCase();
    const hours  = TIMING_CONFIG.tradingHours?.[symbol]
                ?? TIMING_CONFIG.tradingHours?.default;
    if (!hours) return false;

    return timePart < hours.start || timePart >= hours.end;
  }

  // =========================================================
  // WEEKEND FILTER
  // =========================================================
  function isWeekendRisk(opp) {
    const now  = new Date();
    const day  = now.getDay();
    const hour = now.getHours();

    if (day === 6 || day === 0) return true;
    if (day === 5 && hour >= TIMING_CONFIG.weekendFridayHour) return true;

    return false;
  }

  // =========================================================
  // VOLATILITY FILTER — MATCH VolatilityConfig
  // =========================================================
  function getRegime(opp) {
    return getVolatilityRegime(
      opp?.symbol,
      opp?.atr_m15,
      opp?.close
    ); // null | low | med | high | explo
  }

  function isBlockedVolatility(regime) {
    if (!regime) return false;
    if (regime === "low") return true;
    return false;
  }


  // =========================================================
  // M5 is contrary to H1 signal
  // =========================================================
function isM5Contrary(opp, side) {

  const rsi    = num(opp?.rsi_m5);
  const drsi   = num(opp?.drsi_m5);
  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);

  const zh1 = num(opp?.zscore_h1);
  const zm5 = num(opp?.zscore_m5);

const TH = TIMING_CONFIG.M5.slopeThreshold;

  if (rsi === null || drsi === null || slope === null || dslope === null)
    return false;

  // =====================================================
  // BUY
  // =====================================================
  if (side === "BUY") {

    // MTF extension block (trop tard)
    if (zh1 !== null && zm5 !== null && zh1 > 1.9 && zm5 > 0.8)
      return true;

    // spike terminal (RSI)
    if (rsi > 65 && drsi > 5)
      return true;

    // pullback actif confirmé
    if (slope < 0 && dslope < 0 && drsi < 0)
      return true;

    // retournement momentum M5 (dslope ET drsi négatifs)
    if (dslope < 0 && drsi < 0)
      return true;

    // continuation timing insuffisant
const slopeWeak = slope < TH;
const microWeak = dslope < 0 || drsi < 0;

if (slopeWeak && microWeak) {
  return true;
}

  }

  // =====================================================
  // SELL
  // =====================================================
  if (side === "SELL") {

    // MTF extension block (trop tard)
    if (zh1 !== null && zm5 !== null && zh1 < -1.9 && zm5 < -0.8)
      return true;

    if (rsi < 35 && drsi < -5)
      return true;

    if (slope > 0 && dslope > 0 && drsi > 0)
      return true;

    // retournement momentum M5 (dslope ET drsi positifs)
    if (dslope > 0 && drsi > 0)
      return true;

const slopeWeak = slope > -TH;
const microWeak = dslope > 0 || drsi > 0;

if (slopeWeak && microWeak) {
  return true;
}

  }

  return false;
}
// =========================================================
// M5 OVEREXTENDED
// Bloque les entrées continuation trop tardives
// =========================================================

function isM5Overextended(opp, side) {

  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);
  const drsi   = num(opp?.drsi_m5);
  const rsi    = num(opp?.rsi_m5);

  if (
    slope === null ||
    dslope === null ||
    drsi === null ||
    rsi === null
  )
    return false;

  const oe = TIMING_CONFIG.M5.overextended;

  // =====================================================
  // BUY — spike terminal haussier
  // =====================================================

  if (side === "BUY") {

    let score = 0;

    if (rsi   > oe.rsiMax)     score++;
    if (slope > oe.slopeAbs)   score++;
    if (dslope > oe.dslopeAbs) score++;
    if (drsi > oe.drsiAbs)     score++;

    if (score >= 2) return true;

  }

  // =====================================================
  // SELL — spike terminal baissier
  // =====================================================

  if (side === "SELL") {

    let score = 0;

    if (rsi   < oe.rsiMin)      score++;
    if (slope < -oe.slopeAbs)   score++;
    if (dslope < -oe.dslopeAbs) score++;
    if (drsi < -oe.drsiAbs)     score++;

    if (score >= 2) return true;

  }

  return false;

}

  // =========================================================
  // M1 CONTRARY — CLEAN RSI ONLY
  // =========================================================
  function isM1Contrary(opp, side) {
    const rsi  = num(opp?.rsi_m1);
    const drsi = num(opp?.drsi_m1);

    if (rsi === null || drsi === null) return false;

    // BUY: micro spike haussier terminal (trop tard pour BUY)
    if (side === "BUY" && rsi > 65 && drsi > 0.5) return true;

    // SELL: micro spike baissier terminal (trop tard pour SELL)
    if (side === "SELL" && rsi < 35 && drsi < -0.5) return true;

    return false;
  }

  // =========================================================
  // MAIN
  // =========================================================
  function evaluate({ opportunities } = {}) {
    const opps = Array.isArray(opportunities) ? opportunities : [];

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {
      const side = opp?.side;
      if (!side) continue;

      const type = String(opp?.type ?? "").toUpperCase();
      const isContinuation = type === "CONTINUATION";
      // reversal = everything else (REVERSAL, empty, legacy "reversal", etc.)


      const now = Date.now();

      // 0. score minimum
      if ((opp?.score ?? 0) < SCORE_MIN_TRADE) {
        waitOpportunities.push({ ...opp, state: "LOW_SCORE", debugInfo: `score=${opp.score}` });
        continue;
      }

      // 0b. cooldown M5 candle
      if (!TradeCooldown.canEmit(opp.symbol, now)) {
        waitOpportunities.push({ ...opp, state: "WAIT_COOLDOWN", debugInfo: "cooldown_m5" });
        continue;
      }

      // 1. trading hours — EN PREMIER
      if (isOutsideTradingHours(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_OUTSIDE_HOURS", debugInfo: "hours" });
        continue;
      }

      // 2. weekend
      if (isWeekendRisk(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND", debugInfo: "weekend" });
        continue;
      }

      // volatility
      const regime = getRegime(opp);
      if (isBlockedVolatility(regime)) {
        waitOpportunities.push({ ...opp, state: `WAIT_VOL_${regime}`, debugInfo: `volatility_${regime}` });
        continue;
      }

     // continuation path
if (isContinuation) {

  // M5 is contrary to H1 signal
const m5Block = isM5Contrary(opp, side);
if (m5Block) {
  waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY", debugInfo: "m5contrary_cont" });
  continue;
}

// M5 is overextended
  if (isM5Overextended(opp, side)) {

    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_OVEREXTENDED",
      debugInfo: "m5overextended_cont"
    });

    continue;

  }

}

// =========================================================
// REVERSAL PATH
// =========================================================
else {

  const TH   = TIMING_CONFIG.M5.slopeThreshold;
  const sm5  = num(opp?.slope_m5);
  const dsm5 = num(opp?.dslope_m5);
  const zm5  = num(opp?.zscore_m5);   // ← zscore_m5, pas zscore_h1

  // =====================================================
  // ZM5 EXTENSION — bloque reversal si M5 déjà trop étiré
  // =====================================================
  if (side === "BUY"  && zm5 !== null && zm5 > 0.7) {
    waitOpportunities.push({ ...opp, state: "WAIT_ZM5_EXTENDED", debugInfo: `zm5_extended_buy(zm5=${zm5})` });
    continue;
  }
  if (side === "SELL" && zm5 !== null && zm5 < -0.7) {
    waitOpportunities.push({ ...opp, state: "WAIT_ZM5_EXTENDED", debugInfo: `zm5_extended_sell(zm5=${zm5})` });
    continue;
  }

  // =====================================================
  // M5 CONFIRMATION — transition gate
  // =====================================================
  if (sm5 !== null && dsm5 !== null) {

    // ===== BUY REVERSAL =====
    const slopeTooBearish = sm5 < -TH;  // franchement négatif
    const noMicroTurn     = dsm5 <= 0;    // pas d'amélioration

    if (side === "BUY" && slopeTooBearish && noMicroTurn) {
      waitOpportunities.push({
        ...opp,
        state: "WAIT_M5_CONFIRMATION",
        debugInfo: `m5confirm_buy(sm5=${sm5},dsm5=${dsm5})`
      });
      continue;
    }

    // ===== SELL REVERSAL =====
    const slopeTooBullish = sm5 > TH;   // franchement positif
    const noMicroTurnSell = dsm5 >= 0;    // pas de retournement

    if (side === "SELL" && slopeTooBullish && noMicroTurnSell) {
      waitOpportunities.push({
        ...opp,
        state: "WAIT_M5_CONFIRMATION",
        debugInfo: `m5confirm_sell(sm5=${sm5},dsm5=${dsm5})`
      });
      continue;
    }
  }

  // =====================================================
  // MICRO CONTRARY
  // =====================================================
  if (isM5Contrary(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_MICRO",
      debugInfo: "m5contrary_rev"
    });
    continue;
  }

  // =====================================================
  // OVEREXTENDED
  // =====================================================
  if (isM5Overextended(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_OVEREXTENDED",
      debugInfo: "m5overextended_rev"
    });
    continue;
  }

  // =====================================================
  // M1 MICRO SPIKE
  // =====================================================
  if (isM1Contrary(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_M1_CONTRARY",
      debugInfo: "m1contrary"
    });
    continue;
  }
}

      TradeCooldown.register(opp.symbol, now);
      validOpportunities.push({
  ...opp,
  state: "VALID",
  volatilityRegime: regime ?? null
});
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;
