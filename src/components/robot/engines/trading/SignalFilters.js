// ============================================================================
// SignalFilters.js — v3.1 (aligned with Neo-Backtest v7.1)
//
// Chain: Score → Weekend → Volatility → M5 Contrary → M5 Overextended → VALID
// M1 removed (no longer in dataset). M5-only entry timing.
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
  function isM5Contrary(opp, side) {
    const rsi    = num(opp?.rsi_m5);
    const dslope = num(opp?.dslope_m5);

    if (side === "BUY") {
      if (rsi !== null && rsi > 65) return true;
      if (dslope !== null && dslope < -2.0) return true;
    }

    if (side === "SELL") {
      if (rsi !== null && rsi < 35) return true;
      if (dslope !== null && dslope > 2.0) return true;
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
      if (slope !== null && slope > 6) return true;
      if (zm5   !== null && zm5   > 1.8) return true;
    }

    if (side === "SELL") {
      if (slope !== null && slope < -6) return true;
      if (zm5   !== null && zm5   < -1.8) return true;
    }

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
      if (isM5Contrary(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY" });
        continue;
      }

      // M5 overextended
      if (isM5Overextended(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
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
