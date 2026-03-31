// ============================================================================
// SignalFilters.js — v5 (s0 M5 intégré)
//
// Chain: Score → Weekend → Hours → Volatility → M5 Contrary → M5 Overextended → VALID
//
// v5: intégration s0 M5 (bougie en cours)
//   - isM5Contrary    : utilise slope_m5_s0 en plus de slope_m5 (s1)
//   - isM5Overextended: utilise zscore_m5_s0 en plus de zscore_m5 (s1)
//   - m5Confidence    : "strong" si s1+s0 concordants, "normal" sinon
//     → exposé dans l'objet opp pour usage downstream (AutoTrader, logs)
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
    return regime === "low";
  }

  // =========================================================
  // M5 CONTRARY — momentum opposé au signal H1
  // Utilise s1 ET s0 : bloque si l'un OU l'autre est contraire
  // =========================================================
  function isM5Contrary(opp, side, isReversal) {
    const rsi      = num(opp?.rsi_m5);
    const slope    = num(opp?.slope_m5);
    const drsi     = num(opp?.drsi_m5);
    const dslope   = num(opp?.dslope_m5);

    // s0 — bougie M5 en cours
    const slope_s0 = num(opp?.slope_m5_s0);
    const rsi_s0   = num(opp?.rsi_m5_s0);

    const slopeTh = isReversal ? 5 : 5;

    if (side === "BUY") {
      // s1 — bougie fermée
      if (rsi    !== null && rsi    > 68)        return true;
      if (slope  !== null && slope  < -slopeTh)  return true;
      if (drsi   !== null && drsi   < -2)         return true;
      if (dslope !== null && dslope < -2.0)       return true;
      // s0 — bougie en cours : renforce la détection
      if (rsi_s0   !== null && rsi_s0   > 68)    return true;
      if (slope_s0 !== null && slope_s0 < -slopeTh) return true;
    }

    if (side === "SELL") {
      // s1
      if (rsi    !== null && rsi    < 32)        return true;
      if (slope  !== null && slope  > slopeTh)   return true;
      if (drsi   !== null && drsi   > 2)          return true;
      if (dslope !== null && dslope > 2.0)        return true;
      // s0
      if (rsi_s0   !== null && rsi_s0   < 32)   return true;
      if (slope_s0 !== null && slope_s0 > slopeTh) return true;
    }

    return false;
  }

  // =========================================================
  // M5 OVEREXTENDED — prix/momentum trop étiré
  // Utilise s1 ET s0 pour détecter l'extension en cours
  // =========================================================
  function isM5Overextended(opp, side) {
    const slope    = num(opp?.slope_m5);
    const zm5      = num(opp?.zscore_m5);

    // s0
    const slope_s0 = num(opp?.slope_m5_s0);
    const zm5_s0   = num(opp?.zscore_m5_s0);

    if (side === "BUY") {
      if (slope  !== null && slope  > 7)    return true;
      if (zm5    !== null && zm5    > 2.5)  return true;
      // s0 — capte l'extension qui se forme pendant la bougie
      if (slope_s0 !== null && slope_s0 > 7)   return true;
      if (zm5_s0   !== null && zm5_s0   > 2.5) return true;
    }

    if (side === "SELL") {
      if (slope  !== null && slope  < -7)   return true;
      if (zm5    !== null && zm5    < -2.5) return true;
      // s0
      if (slope_s0 !== null && slope_s0 < -7)   return true;
      if (zm5_s0   !== null && zm5_s0   < -2.5) return true;
    }

    return false;
  }

  // =========================================================
  // M5 CONFIDENCE — concordance s1 + s0
  //
  // "strong" : s1 et s0 pointent dans la même direction
  //            → signal M5 haute confiance
  // "normal" : s1 seul ou contradiction s1/s0
  //
  // Utilisé downstream pour sizing ou filtrage additionnel
  // =========================================================
  function getM5Confidence(opp, side) {
    const dslope   = num(opp?.dslope_m5);   // s1
    const rsi      = num(opp?.rsi_m5);      // s1
    const slope_s0 = num(opp?.slope_m5_s0); // s0
    const rsi_s0   = num(opp?.rsi_m5_s0);   // s0

    if (dslope === null || slope_s0 === null) return "normal";

    if (side === "BUY") {
      // s1 haussier ET s0 haussier ET rsi_s0 pas suracheté
      if (dslope > 0 && slope_s0 > 0 && (rsi_s0 === null || rsi_s0 < 65))
        return "strong";
    }

    if (side === "SELL") {
      // s1 baissier ET s0 baissier ET rsi_s0 pas survendu
      if (dslope < 0 && slope_s0 < 0 && (rsi_s0 === null || rsi_s0 > 35))
        return "strong";
    }

    return "normal";
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

      // 6. M5 confidence — calculé sur les opportunités valides
      const m5Confidence = getM5Confidence(opp, side);

      validOpportunities.push({
        ...opp,
        state:           "VALID",
        volatilityRegime: regime ?? null,
        m5Confidence,    // "strong" | "normal"
      });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;