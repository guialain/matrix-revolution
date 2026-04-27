// ============================================================================
// SignalFilters.js — v7 (Gate 1 + Gate 2 refondus, 4 modes V8R, CONT/V-shape)
//
// Chain: Weekend → Hours → Volatility → M5 Overextended → M5 SetupOK → VALID
//
// v7:
//   - Gate 1 (isM5Overextended) : 4 modes alignes V8R, recalibration seuils
//     2-of-3 sur slope_m5_s0 / zscore_m5_s0 / rsi_m5_s0 (RSI side-aware)
//   - Gate 2 (isM5SetupOK) : detection CONT vs V-shape selon slope_m5 (s1)
//     4 tables de seuils (CONT_BUY, VSHAPE_BUY, CONT_SELL, VSHAPE_SELL)
//     3 conditions AND : slope_m5_s0 (range), dslope_m5, slope_m5 (s1, conditionnel)
//     RSI retire (capte en Gate 1)
//   - Mode V8R (strict/normal/soft/relaxed) propage directement, sans remapping
// ============================================================================

import { getVolatilityRegime } from "../config/VolatilityConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";
import * as funnel from "../../../../utils/funnelDebug";

const SignalFilters = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // GATE 1 — overextended (2-of-3 sur slope/zscore/rsi)
  // 4 modes alignes V8R
  // =========================================================
  const GATE1_THRESHOLDS = {
    strict:  { slopeAbs: 3.5, zscoreAbs: 1.6, rsi: 65 },
    normal:  { slopeAbs: 4.5, zscoreAbs: 1.9, rsi: 68 },
    soft:    { slopeAbs: 5.5, zscoreAbs: 2.2, rsi: 70 },
    relaxed: { slopeAbs: 6.5, zscoreAbs: 2.5, rsi: 72 },
  };

  // =========================================================
  // GATE 2 — setup CONT vs V-shape (4 tables × 4 modes)
  // V-shape detecte si slope_m5 (s1) contre le sens du trade
  // =========================================================
  const CONT_BUY = {
    relaxed: { s0_min: -5.0, s0_max:  7.0, dslope_min: -4.0, s1_min: null },
    soft:    { s0_min: -3.0, s0_max:  6.0, dslope_min: -2.5, s1_min: null },
    normal:  { s0_min: -1.0, s0_max:  5.0, dslope_min: -1.0, s1_min: -1.5 },
    strict:  { s0_min:  0.5, s0_max:  4.0, dslope_min:  0.0, s1_min:  0.0 },
  };

  const VSHAPE_BUY = {
    relaxed: { s0_min: -4.5, s0_max: 5.0, dslope_min: 0.0, s1_min: -5.0 },
    soft:    { s0_min: -3.0, s0_max: 4.0, dslope_min: 0.5, s1_min: -4.0 },
    normal:  { s0_min: -1.5, s0_max: 3.5, dslope_min: 1.0, s1_min: -3.0 },
    strict:  { s0_min:  0.0, s0_max: 3.0, dslope_min: 1.5, s1_min: -2.5 },
  };

  const CONT_SELL = {
    relaxed: { s0_min: -7.0, s0_max:  5.0, dslope_max:  4.0, s1_max: null },
    soft:    { s0_min: -6.0, s0_max:  3.0, dslope_max:  2.5, s1_max: null },
    normal:  { s0_min: -5.0, s0_max:  1.0, dslope_max:  1.0, s1_max:  1.5 },
    strict:  { s0_min: -4.0, s0_max: -0.5, dslope_max:  0.0, s1_max:  0.0 },
  };

  const VSHAPE_SELL = {
    relaxed: { s0_min: -5.0, s0_max: 4.5, dslope_max:  0.0, s1_max: 5.0 },
    soft:    { s0_min: -4.0, s0_max: 3.0, dslope_max: -0.5, s1_max: 4.0 },
    normal:  { s0_min: -3.5, s0_max: 1.5, dslope_max: -1.0, s1_max: 3.0 },
    strict:  { s0_min: -3.0, s0_max: 0.0, dslope_max: -1.5, s1_max: 2.5 },
  };

  // =========================================================
  // WEEKEND — live mode (system time)
  // =========================================================
  function isWeekendRisk() {
    const now = new Date();
    const day = now.getUTCDay();
    const hourDec = now.getUTCHours() + now.getUTCMinutes() / 60;
    // Vendredi >= weekendFridayHour (22h UTC)
    if (day === 5 && hourDec >= TIMING_CONFIG.weekendFridayHour) return true;
    // Samedi : toute la journee
    if (day === 6) return true;
    // Dimanche < weekendSundayEndHour (23h UTC)
    if (day === 0 && hourDec < TIMING_CONFIG.weekendSundayEndHour) return true;
    return false;
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
    return getVolatilityRegime(opp?.symbol, opp?.atr_m15, opp?.close_m5_s1);
  }

  function isBlockedVolatility(regime) {
    if (!regime) return false;
    return regime === "low";
  }

  // =========================================================
  // GATE 1 — M5 Overextended (2-of-3)
  //
  // Bloque si au moins 2 critères convergent :
  //   - slope_m5_s0 extrême (pente RSI M5)
  //   - zscore_m5_s0 extrême (position vs Bollinger)
  //   - rsi_m5_s0 extrême (side-aware)
  // =========================================================
  function isM5Overextended(opp, side, mode) {
    const th = GATE1_THRESHOLDS[mode];
    if (!th) return false;

    const slope_s0 = num(opp?.slope_m5_s0);
    const zm5_s0   = num(opp?.zscore_m5_s0);
    const rsi_s0   = num(opp?.rsi_m5_s0);

    let triggers = 0;

    if (side === "BUY") {
      if (slope_s0 !== null && slope_s0 > th.slopeAbs)    triggers++;
      if (zm5_s0   !== null && zm5_s0   > th.zscoreAbs)   triggers++;
      if (rsi_s0   !== null && rsi_s0   > th.rsi)         triggers++;
    }

    if (side === "SELL") {
      if (slope_s0 !== null && slope_s0 < -th.slopeAbs)   triggers++;
      if (zm5_s0   !== null && zm5_s0   < -th.zscoreAbs)  triggers++;
      if (rsi_s0   !== null && rsi_s0   < (100 - th.rsi)) triggers++;
    }

    return triggers >= 2;
  }

  // =========================================================
  // GATE 2 — M5 SetupOK (CONT vs V-shape)
  //
  // Detecte CONT vs V-shape selon slope_m5 (s1) :
  //   BUY  : V-shape si slope_m5 < 0, sinon CONT
  //   SELL : V-shape si slope_m5 > 0, sinon CONT
  //
  // 3 conditions AND :
  //   1. slope_m5_s0 dans [s0_min, s0_max]
  //   2. dslope_m5 ≥ dslope_min (BUY) ou ≤ dslope_max (SELL)
  //   3. slope_m5 (s1) ≥ s1_min (BUY) ou ≤ s1_max (SELL), si pas null
  // =========================================================
  function isM5SetupOK(slope_m5, slope_m5_s0, dslope_m5, side, mode) {
    const isVShape = (side === 'BUY')
      ? slope_m5 !== null && slope_m5 < 0
      : slope_m5 !== null && slope_m5 > 0;

    const table = (side === 'BUY')
      ? (isVShape ? VSHAPE_BUY[mode] : CONT_BUY[mode])
      : (isVShape ? VSHAPE_SELL[mode] : CONT_SELL[mode]);

    if (!table) return false; // mode inconnu

    // Condition 1 : slope_s0 dans range
    if (slope_m5_s0 === null) return false;
    if (slope_m5_s0 < table.s0_min || slope_m5_s0 > table.s0_max) return false;

    // Condition 2 : dslope
    if (dslope_m5 === null) return false;
    if (side === 'BUY') {
      if (dslope_m5 < table.dslope_min) return false;
    } else {
      if (dslope_m5 > table.dslope_max) return false;
    }

    // Condition 3 : slope_m5 (s1) — conditionnel selon table
    if (side === 'BUY' && table.s1_min !== null) {
      if (slope_m5 === null || slope_m5 < table.s1_min) return false;
    }
    if (side === 'SELL' && table.s1_max !== null) {
      if (slope_m5 === null || slope_m5 > table.s1_max) return false;
    }

    return true;
  }

  // =========================================================
  // M5 CONFIDENCE — concordance s1 + s0
  //
  // "strong" : s1 et s0 pointent dans la même direction
  //            → signal M5 haute confiance
  // "normal" : s1 seul ou contradiction s1/s0
  // =========================================================
  function getM5Confidence(opp, side) {
    const slope_s0 = num(opp?.slope_m5_s0);
    const slope_s1 = num(opp?.slope_m5);
    const rsi_s0   = num(opp?.rsi_m5_s0);
    const dslope   = (slope_s0 !== null && slope_s1 !== null)
      ? slope_s0 - slope_s1
      : null;

    if (dslope === null || slope_s0 === null) return "normal";

    if (side === "BUY") {
      if (dslope > 0 && slope_s0 > 0 && (rsi_s0 === null || rsi_s0 < 65))
        return "strong";
    }

    if (side === "SELL") {
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
    const tradableOpps = opps.filter(o => o?.side && !o?.isWait && o?.route !== 'WAIT' && o?.type !== 'WAIT');
    funnel.inc('signalFiltersIn', tradableOpps.length);

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {
      const side = opp?.side;
      if (!side) continue;
      const isTradable = !opp?.isWait && opp?.route !== 'WAIT' && opp?.type !== 'WAIT';

      // Pre-calc M5 V-shape detection (sert pour wait_reason + payload)
      const _slope_m5    = num(opp?.slope_m5);
      const _slope_m5_s0 = num(opp?.slope_m5_s0);
      const _dslope_m5   = (_slope_m5 !== null && _slope_m5_s0 !== null)
        ? _slope_m5_s0 - _slope_m5
        : null;
      const is_vshape_m5 = (side === 'BUY')
        ? _slope_m5 !== null && _slope_m5 < 0
        : _slope_m5 !== null && _slope_m5 > 0;

      // 1. Weekend
      if (isWeekendRisk()) {
        waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND", wait_reason: "WEEKEND", is_vshape_m5 });
        continue;
      }

      // 2. Trading hours
      if (isOutsideTradingHours()) {
        waitOpportunities.push({ ...opp, state: "WAIT_HOURS", wait_reason: "OUTSIDE_HOURS", is_vshape_m5 });
        continue;
      }

      // 3. Volatility
      const regime = getRegime(opp);
      if (isBlockedVolatility(regime)) {
        waitOpportunities.push({ ...opp, state: `WAIT_VOL_${regime}`, wait_reason: `VOLATILITY_${regime?.toUpperCase()}`, is_vshape_m5 });
        continue;
      }

      // 4. Mode V8R propage directement (strict/normal/soft/relaxed)
      const mode = opp?.mode;

      // 5. M5 Overextended — 2-of-3 sur slope/zscore/rsi
      if (isM5Overextended(opp, side, mode)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED", wait_reason: "M5_GATE1", m5Level: mode, is_vshape_m5 });
        continue;
      }
      if (isTradable) funnel.inc('gate1Pass');

      // 6. M5 SetupOK — CONT vs V-shape, 3 conditions AND
      if (!isM5SetupOK(_slope_m5, _slope_m5_s0, _dslope_m5, side, mode)) {
        const wait_reason = is_vshape_m5 ? "M5_GATE2_VSHAPE" : "M5_GATE2_CONT";
        waitOpportunities.push({ ...opp, state: "WAIT_M5_SETUP", wait_reason, m5Level: mode, is_vshape_m5 });
        continue;
      }
      if (isTradable) funnel.inc('gate2Pass');

      // 7. M5 confidence — calculé sur les opportunités valides
      const m5Confidence = getM5Confidence(opp, side);

      validOpportunities.push({
        ...opp,
        state:           "VALID",
        volatilityRegime: regime ?? null,
        m5Confidence,    // "strong" | "normal"
        m5Level:          mode,         // "relaxed" | "soft" | "normal" | "strict"
        is_vshape_m5,
      });
      if (isTradable) funnel.inc('validOut');
    }

    funnel.inc('waitOut', waitOpportunities.length);

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;
