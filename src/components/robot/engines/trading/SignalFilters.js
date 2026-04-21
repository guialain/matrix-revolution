// ============================================================================
// SignalFilters.js — v6 (Gate M5 repensé : Overextended + SetupOK)
//
// Chain: Weekend → Hours → Volatility → M5 Overextended → M5 SetupOK → VALID
//
// v6:
//   - Suppression de M5 Contrary (bloquait les pullback/charge valides)
//   - Suppression filtre M5 Accel hardcodé (absorbé dans SetupOK)
//   - Gate 1 Overextended : évite d'entrer trop tard (slope/zscore/rsi extrêmes)
//   - Gate 2 SetupOK : valide positivement l'entrée (pullback sain, anti-spike,
//     pas de chasing, RSI OK, dslope en retournement)
//   - Seuils adaptatifs par mode (relaxed / normal / strict)
//   - Calibrés empiriquement sur US_TECH100 M5 (74001 bougies)
//   - Anti-spike : slope_m5 limité à ±8/±7/±6 selon mode
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
      overextended: { slopeAbs: 5.5, zscoreAbs: 2.6, rsi: 72 },
      setup:        { slopeMaxUp: 3.0, slopeMinDown: -8, dslopeMin: -0.5, rsiMax: 65 },
    },
    normal: {
      overextended: { slopeAbs: 4.5, zscoreAbs: 2.1, rsi: 68 },
      setup:        { slopeMaxUp: 2.0, slopeMinDown: -7, dslopeMin:  0,   rsiMax: 60 },
    },
    strict: {
      overextended: { slopeAbs: 3.0, zscoreAbs: 1.8, rsi: 65 },
      setup:        { slopeMaxUp: 1.0, slopeMinDown: -6, dslopeMin: +0.5, rsiMax: 55 },
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
  // M5 OVEREXTENDED — prix/momentum trop étiré DANS le sens du trade
  // Bloque si on entre trop tard : slope, zscore ou RSI extrêmes.
  // =========================================================
  function isM5Overextended(opp, side, th) {
    const slope_s0 = num(opp?.slope_m5_s0);
    const zm5_s0   = num(opp?.zscore_m5_s0);
    const rsi_s0   = num(opp?.rsi_m5_s0);

    if (side === "BUY") {
      if (slope_s0 !== null && slope_s0 > th.slopeAbs)   return true;
      if (zm5_s0   !== null && zm5_s0   > th.zscoreAbs)  return true;
      if (rsi_s0   !== null && rsi_s0   > th.rsi)        return true;
    }

    if (side === "SELL") {
      if (slope_s0 !== null && slope_s0 < -th.slopeAbs)  return true;
      if (zm5_s0   !== null && zm5_s0   < -th.zscoreAbs) return true;
      if (rsi_s0   !== null && rsi_s0   < (100 - th.rsi)) return true;
    }

    return false;
  }

  // =========================================================
  // M5 SETUP OK — valide que le M5 est en config d'entrée propre
  //
  // BUY :
  //   - Anti-spike : slope M5 pas en chute libre extrême (slopeMinDown)
  //   - Pas de chasing : slope M5 pas trop positif (slopeMaxUp)
  //   - RSI M5 pas en zone haute (rsiMax)
  //   - dslope M5 pas en cascade baissière (dslopeMin)
  // SELL : symétrique miroir
  // =========================================================
  function isM5SetupOK(opp, side, th) {
    const slope_s0 = num(opp?.slope_m5_s0);
    const rsi_s0   = num(opp?.rsi_m5_s0);
    const dslope   = num(opp?.dslope_m5);

    if (side === "BUY") {
      if (slope_s0 !== null && slope_s0 < th.slopeMinDown) return false;
      if (slope_s0 !== null && slope_s0 > th.slopeMaxUp)   return false;
      if (rsi_s0   !== null && rsi_s0   > th.rsiMax)       return false;
      if (dslope   !== null && dslope   < th.dslopeMin)    return false;
      return true;
    }

    if (side === "SELL") {
      if (slope_s0 !== null && slope_s0 > -th.slopeMinDown) return false;
      if (slope_s0 !== null && slope_s0 < -th.slopeMaxUp)   return false;
      if (rsi_s0   !== null && rsi_s0   < (100 - th.rsiMax)) return false;
      if (dslope   !== null && dslope   > -th.dslopeMin)    return false;
      return true;
    }

    return true;
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

      // 4. M5 Overextended — ne pas entrer trop tard dans le sens
      const m5Level = resolveM5Level(opp);
      const m5Th    = M5_THRESHOLDS[m5Level];

      if (isM5Overextended(opp, side, m5Th.overextended)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED", m5Level });
        continue;
      }

      // 5. M5 SetupOK — valider config pullback/retournement sain
      if (!isM5SetupOK(opp, side, m5Th.setup)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_SETUP", m5Level });
        continue;
      }

      // 6. M5 confidence — calculé sur les opportunités valides
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
