// ============================================================================
// SignalFilters.js — v4 (aligned with Neo-Backtest v8)
//
// Chain: Score → Weekend → Hours → Volatility → M5 Contrary → M5 Overextended → VALID
// M5-only entry timing.
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
    const day = now.getUTCDay();
    const hourDec = now.getUTCHours() + now.getUTCMinutes() / 60;
    return (day === 6 || day === 0) || (day === 5 && hourDec >= TIMING_CONFIG.weekendFridayHour);
  }

  // =========================================================
  // TRADING HOURS — UTC
  // =========================================================
  function isOutsideTradingHours() {
    const hours = TIMING_CONFIG.tradingHoursUTC;
    if (!hours) return false;

    const hourUTC = new Date().getUTCHours();
    return hourUTC < hours.open || hourUTC >= hours.close;
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
  // M5 CONTRARY — momentum opposé au signal H1
  // =========================================================
  function isM5Contrary(opp, side, isReversal) {
    const rsi    = num(opp?.rsi_m5);
    const slope  = num(opp?.slope_m5);
    const drsi   = num(opp?.drsi_m5);
    const dslope = num(opp?.dslope_m5);

    const slopeTh = isReversal ? 4 : 2;

    if (side === "BUY") {
      if (rsi !== null && rsi > 69) return true;
      if (slope !== null && slope < -slopeTh) return true;
      if (drsi !== null && drsi < -2) return true;
      if (dslope !== null && dslope < -2.0) return true;
    }

    if (side === "SELL") {
      if (rsi !== null && rsi < 31) return true;
      if (slope !== null && slope > slopeTh) return true;
      if (drsi !== null && drsi > 2) return true;
      if (dslope !== null && dslope > 2.0) return true;
    }

    return false;
  }

  // =========================================================
  // M5 OVEREXTENDED — prix/momentum trop étiré
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

      const type = String(opp?.type ?? "").toUpperCase();
      const isContinuation = type === "CONTINUATION";

      // 1. Weekend
      if (isWeekendRisk()) {
        waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND" });
        continue;
      }

      // 2. Trading hours
      if (isOutsideTradingHours()) {
        waitOpportunities.push({ ...opp, state: "WAIT_HOURS" });
        continue;
      }

      // 3. Volatility
      const regime = getRegime(opp);
      if (isBlockedVolatility(regime)) {
        waitOpportunities.push({ ...opp, state: `WAIT_VOL_${regime}` });
        continue;
      }

      // 4. M5 contrary
      if (isM5Contrary(opp, side, !isContinuation)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY" });
        continue;
      }

      // 5. M5 overextended
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
