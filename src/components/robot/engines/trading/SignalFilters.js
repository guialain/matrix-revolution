// ============================================================================
// SignalFilters.js — v3 (aligned with Neo-Backtest)
//
// Chain: Score → Weekend → Volatility → M5 Contrary → M5 Overextended → M1 Contrary → VALID
// Unified path (no separate continuation/reversal branches)
// ============================================================================

import { getVolatilityRegime } from "../config/VolatilityConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";

const SignalFilters = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // WEEKEND — live mode (system time)
  // =========================================================
  function isWeekendRisk() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return (day === 6 || day === 0) || (day === 5 && hour >= TIMING_CONFIG.weekendFridayHour);
  }

  // =========================================================
  // VOLATILITY REGIME
  // =========================================================
  function getRegime(opp) {
    return getVolatilityRegime(opp?.symbol, opp?.atr_m15, opp?.close);
  }

  function isBlockedVolatility(regime) {
    if (!regime) return false;
    if (regime === "low") return true;
    return false;
  }

  // =========================================================
  // M5 CONTRARY — RSI zone + dslope momentum
  // =========================================================
  function isM5Contrary(opp, side, isContinuation) {
    const rsi    = num(opp?.rsi_m5);
    const dslope = num(opp?.dslope_m5);

    const rsiTh = isContinuation ? 67 : 65;

    if (side === "BUY") {
      if (rsi !== null && rsi > rsiTh) return true;
      if (dslope !== null && dslope < -2) return true;
    }

    if (side === "SELL") {
      if (rsi !== null && rsi < (100 - rsiTh)) return true;
      if (dslope !== null && dslope > 2) return true;
    }

    return false;
  }

  // =========================================================
  // M5 OVEREXTENDED — slope spike + zscore extension
  // =========================================================
  function isM5Overextended(opp, side) {
    const slope = num(opp?.slope_m5);
    const zm5   = num(opp?.zscore_m5);

    if (side === "BUY") {
      if (slope !== null && slope > 6.5) return true;
      if (zm5   !== null && zm5   > 1.9) return true;
    }

    if (side === "SELL") {
      if (slope !== null && slope < -6.5) return true;
      if (zm5   !== null && zm5   < -1.9) return true;
    }

    return false;
  }

  // =========================================================
  // M1 CONTRARY — RSI zone gate
  // =========================================================
  function isM1Contrary(opp, side) {
    const rsi = num(opp?.rsi_m1);

    if (side === "BUY"  && rsi !== null && rsi > 50) return true;
    if (side === "SELL" && rsi !== null && rsi < 50) return true;

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

      // Score gate
      if ((opp?.score ?? 0) < 0) {
        waitOpportunities.push({ ...opp, state: "LOW_SCORE" });
        continue;
      }

      // Weekend
      if (isWeekendRisk()) {
        waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND" });
        continue;
      }

      // Volatility
      const regime = getRegime(opp);
      if (isBlockedVolatility(regime)) {
        waitOpportunities.push({ ...opp, state: `WAIT_VOL_${regime}` });
        continue;
      }

      // M5 contrary
      if (isM5Contrary(opp, side, isContinuation)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY" });
        continue;
      }

      // M5 overextended
      if (isM5Overextended(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
        continue;
      }

      // M1 contrary
      if (isM1Contrary(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M1_CONTRARY" });
        continue;
      }

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
