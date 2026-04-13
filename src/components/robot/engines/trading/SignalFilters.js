// ============================================================================
// SignalFilters.js — v5 (s0 M5 intégré)
//
// Chain: Score → Weekend → Hours → Volatility → M5 Contrary → M5 Overextended → VALID
//
// v6: M5 s0 only
//   - isM5Contrary    : rsi_m5_s0, slope_m5_s0, drsi_m5_s0
//   - isM5Overextended: slope_m5_s0, zscore_m5_s0
//   - m5Confidence    : dslope_m5 (s1) + slope_m5_s0 concordants
// ============================================================================

import { getVolatilityRegime } from "../config/VolatilityConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";

const SignalFilters = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // M5 THRESHOLDS — 3 niveaux selon contexte intraday/type
  //
  // relaxed : CONTINUATION dans le sens du trend fort
  // normal  : STANDARD / NEUTRE (défaut historique)
  // strict  : REVERSAL contre le trend
  // =========================================================
  const M5_THRESHOLDS = {
    relaxed: {
      contrary:     { rsi: 68, slopeAbs: 7, drsiAbs: 4, dslopeAbs: 4 },
      overextended: { slopeAbs: 4.5, zscoreAbs: 2.3 },
    },
    normal: {
      contrary:     { rsi: 65, slopeAbs: 5, drsiAbs: 2, dslopeAbs: 2 },
      overextended: { slopeAbs: 3.5, zscoreAbs: 1.8 },
    },
    strict: {
      contrary:     { rsi: 55, slopeAbs: 3, drsiAbs: 1.5, dslopeAbs: 1.5 },
      overextended: { slopeAbs: 2.5, zscoreAbs: 1.6 },
    },
  };

  function resolveM5Level(opp) {
    const type  = String(opp?.type ?? "").toUpperCase();
    const level = String(opp?.intradayLevel ?? "").toUpperCase();

    const isCont = type === "CONTINUATION";
    const isRev  = type === "REVERSAL";
    const side   = opp?.side;

    const strongWithTrend =
      (side === "BUY"  && (level === "STRONG_UP"   || level === "EXPLOSIVE_UP"))   ||
      (side === "SELL" && (level === "STRONG_DOWN"  || level === "EXPLOSIVE_DOWN"));

    const strongAgainst =
      (side === "BUY"  && (level === "STRONG_DOWN"  || level === "EXPLOSIVE_DOWN" || level === "DOWN")) ||
      (side === "SELL" && (level === "STRONG_UP"    || level === "EXPLOSIVE_UP"   || level === "UP"));

    if (isCont && strongWithTrend) return "relaxed";
    if (isRev  && strongAgainst)   return "strict";
    return "normal";
  }

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
  function isM5Contrary(opp, side, th) {
    const slope_s0 = num(opp?.slope_m5_s0);
    const rsi_s0   = num(opp?.rsi_m5_s0);
    const drsi_s0  = num(opp?.drsi_m5_s0);

    if (side === "BUY") {
      if (rsi_s0   !== null && rsi_s0   > th.rsi)        return true;
      if (slope_s0 !== null && slope_s0 < -th.slopeAbs)  return true;
      if (drsi_s0  !== null && drsi_s0  < -th.drsiAbs)   return true;
    }

    if (side === "SELL") {
      if (rsi_s0   !== null && rsi_s0   < (100 - th.rsi)) return true;
      if (slope_s0 !== null && slope_s0 > th.slopeAbs)    return true;
      if (drsi_s0  !== null && drsi_s0  > th.drsiAbs)     return true;
    }

    return false;
  }

  // =========================================================
  // M5 OVEREXTENDED — prix/momentum trop étiré
  // Utilise s1 ET s0 pour détecter l'extension en cours
  // =========================================================
  function isM5Overextended(opp, side, th) {
    const slope_s0 = num(opp?.slope_m5_s0);
    const zm5_s0   = num(opp?.zscore_m5_s0);

    if (side === "BUY") {
      if (slope_s0 !== null && slope_s0 > th.slopeAbs)  return true;
      if (zm5_s0   !== null && zm5_s0   > th.zscoreAbs) return true;
    }

    if (side === "SELL") {
      if (slope_s0 !== null && slope_s0 < -th.slopeAbs)  return true;
      if (zm5_s0   !== null && zm5_s0   < -th.zscoreAbs) return true;
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

      // 4. M5 contrary — seuils adaptés au contexte intraday
      const m5Level = resolveM5Level(opp);
      const m5Th    = M5_THRESHOLDS[m5Level];

      if (isM5Contrary(opp, side, m5Th.contrary)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY", m5Level });
        continue;
      }

      // 5. M5 overextended — seuils adaptés au contexte intraday
      if (isM5Overextended(opp, side, m5Th.overextended)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED", m5Level });
        continue;
      }

      // 6. M5 dslope — accélération M5 contraire = news/spike en cours
      // CONT/EARLY seulement : pour REV l'impulsion est souvent le setup
      const sigType    = String(opp?.type ?? "").toUpperCase();
      const dslope_m5  = num(opp?.dslope_m5);
      if (dslope_m5 !== null && sigType !== "REVERSAL") {
        const dslopeThr = 2.0;
        if (side === "BUY"  && dslope_m5 < -dslopeThr) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_ACCEL", m5Level });
          continue;
        }
        if (side === "SELL" && dslope_m5 >  dslopeThr) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_ACCEL", m5Level });
          continue;
        }
      }

      // 7. M5 confidence — calculé sur les opportunités valides
      const m5Confidence = getM5Confidence(opp, side);

      validOpportunities.push({
        ...opp,
        state:           "VALID",
        volatilityRegime: regime ?? null,
        m5Confidence,    // "strong" | "normal"
        m5Level,         // "relaxed" | "normal" | "strict"
      });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;