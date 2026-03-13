// ============================================================================
// reversal.js — H1 REVERSAL STRATEGY
// - Compatible TopOpportunities RSI Router (index numeric + regime added)
// - Logging gated by opts.debug
// - ✅ slopeMin / slopeMax calibrés par asset via SlopeConfig (P40/P60/P95)
// ============================================================================

import { getSignalConfig }     from "../config/SignalConfig.js";
import { getSlopeConfig }      from "../config/SlopeConfig";
import { detectReversalPhase } from "./SignalPhaseDetector";
import { scoreReversalBuy, scoreReversalSell } from "./ScoreEngine";

const ReversalStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // CONFIG VALIDATION
  // ============================================================================
  function isValidCfg(cfg) {
    if (!cfg) return false;

    const required = [
      "rsiWindowH1",
      "rsiBuyMax",
      "rsiSellMin",
      "flipSlopeMin",
      "flipDslopeMin",
      "dbbzBuyMin",
      "dbbzSellMax"
    ];

    return required.every(k => Number.isFinite(Number(cfg[k])));
  }

  // ============================================================================
  // RSI WINDOW H1
  // ============================================================================
  function getMinMaxRSI_H1(rows, i, bars = 5) {
    const row = rows[i];

    // ── MODE LIVE : champs pré-calculés par MQL5 ──────────────────────────
    const preMin  = num(row?.rsi_h1_min5);
    const preMax  = num(row?.rsi_h1_max5);
    const current = num(row?.rsi_h1);

    if (preMin !== null && preMax !== null && current !== null) {
      return { minRSI: preMin, maxRSI: preMax, currentRSI: current };
    }

    // ── MODE BACKTEST : parcourir les bougies précédentes ─────────────────
    let count    = 0;
    let min      = Infinity;
    let max      = -Infinity;
    let curr     = null;
    let lastHour = null;

    for (let k = i; k >= 0; k--) {
      const ts   = rows[k]?.timestamp;
      const hour = ts?.slice(0, 13);
      if (!hour || hour === lastHour) continue;
      lastHour = hour;

      const rsi = num(rows[k]?.rsi_h1);
      if (rsi === null) return null;

      if (curr === null) curr = rsi;
      if (rsi < min) min = rsi;
      if (rsi > max) max = rsi;

      count++;
      if (count >= bars) break;
    }

    if (count < bars) return null;

    return { minRSI: min, maxRSI: max, currentRSI: curr };
  }

  // ============================================================================
  // H1 DYNAMICS
  // ============================================================================
  function getH1Dynamics(row) {
    const slope  = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz   = num(row?.dz_h1);
    const zscore = num(row?.zscore_h1);

    if (slope === null || dslope === null || dbbz === null) return null;

    return { slope, dslope, dbbz, zscore };
  }

  // ============================================================================
  // SLOPE LIMITS — calibrés par asset via SlopeConfig
  //
  // slopeMin  = frontière flat/weak  (P40 côté sell, P60 côté buy)
  //           → minimum requis pour valider le retournement
  // slopeMax  = frontière strong/extreme (P95)
  //           → spike filter, au-delà le mouvement est trop violent
  // ============================================================================
  function getSlopeLimits(side, symbol) {
    const slopeCfg = getSlopeConfig(symbol);

    if (side === "BUY") {
      return {
        slopeMin: slopeCfg.up_weak.min,              // ex: 0.7492 EURUSD
        slopeMax: slopeCfg.up_extreme.min,            // ex: 5.2239 EURUSD
      };
    } else {
      return {
        slopeMin: Math.abs(slopeCfg.down_weak.max),   // ex: 0.8727 EURUSD
        slopeMax: Math.abs(slopeCfg.down_extreme.max) // ex: 5.3606 EURUSD
          || Math.abs(slopeCfg.up_extreme.min),
      };
    }
  }

  // ============================================================================
  // STRUCTURE GATE
  // - slopeMin : frontière flat/weak per asset (remplace cfg.slopeH1Min fixe)
  // - slopeMax : spike filter per asset        (remplace cfg.dslopeH1MaxAbs fixe)
  // ============================================================================
  function passesStructureGate(side, rsiStats, dyn, cfg, symbol) {
    const rsi    = num(rsiStats?.currentRSI);
    const slope  = num(dyn?.slope);
    const dslope = num(dyn?.dslope);

    if (rsi === null || slope === null || dslope === null) return false;

    const { slopeMin, slopeMax } = getSlopeLimits(side, symbol);
    const dslopeMin = cfg.dslopeH1ReversalMin ?? 0.5;

    // Spike filter — slope trop violent = mouvement non tradable
    if (Math.abs(slope) > slopeMax) return false;

    // BUY REVERSAL
    if (side === "BUY") {
      const deep = cfg.rsiBuyMax  ?? 30;
      const semi = cfg.rsiBuySemi ?? 35;

      if (rsi < deep) return slope >= 0 && dslope > dslopeMin;
      if (rsi < semi) return slope >=  slopeMin && dslope > dslopeMin;
      return false;
    }

    // SELL REVERSAL
    if (side === "SELL") {
      const deep = cfg.rsiSellMin  ?? 70;
      const semi = cfg.rsiSellSemi ?? 65;

      if (rsi > deep) return slope <= 0  && dslope < -dslopeMin;
      if (rsi > semi) return slope <= -slopeMin && dslope < -dslopeMin;
      return false;
    }

    return false;
  }

  // ============================================================================
  // EARLY DETECTION
  // ============================================================================
  function isEarlyBuyConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    return (
      slope1 < 0 &&
      dyn.slope > 0 &&
      Math.abs(dyn.slope)  >= cfg.flipSlopeMin &&
      Math.abs(dyn.dslope) >= cfg.flipDslopeMin
    );
  }

  function isEarlySellConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    return (
      slope1 > 0 &&
      dyn.slope < 0 &&
      Math.abs(dyn.slope)  >= cfg.flipSlopeMin &&
      Math.abs(dyn.dslope) >= cfg.flipDslopeMin
    );
  }

  // ============================================================================
  // RSI PATH
  // ============================================================================
  function detectBuy(rsiStats, dyn, cfg) {
    if (rsiStats.minRSI > cfg.rsiBuyMax) return null;

    // Position extrême requise
const z = num(dyn?.zscore);
if (z === null || z > -1.8) return null;

// =========================================================
// ✅ MATURITY BLOCK — encore en accélération baissière
// =========================================================

if (
  dyn.zscore !== null &&
  dyn.dbbz !== null &&
  dyn.dslope !== null &&
  dyn.zscore < -1.8 &&
  dyn.dbbz < -0.2 &&
  dyn.dslope < -3.0
)
  return null;

    return isEarlyBuyConfirmed(dyn, cfg) ? "BUY_EARLY" : "BUY";
  }

  function detectSell(rsiStats, dyn, cfg) {
    if (rsiStats.maxRSI < cfg.rsiSellMin) return null;

// Position extrême requise
const z = num(dyn?.zscore);
if (z === null || z < 1.8) return null;

// =========================================================
// ✅ MATURITY BLOCK — encore en accélération haussière
// =========================================================

if (
  dyn.zscore !== null &&
  dyn.dbbz !== null &&
  dyn.dslope !== null &&
  dyn.zscore > 1.8 &&
  dyn.dbbz > 0.2 &&
  dyn.dslope > 3.0
)
  return null;

    return isEarlySellConfirmed(dyn, cfg) ? "SELL_EARLY" : "SELL";
  }

  // ============================================================================
  // PHASE PATH
  // ============================================================================
  function detectBuyPhase(dyn, cfg) {
    const z = num(dyn?.zscore);
    if (z === null || z > -1.8) return null;  // même guard que detectBuy
    const p = detectReversalPhase(dyn.slope, dyn.dslope, "BUY", cfg);
    return p ? `BUY_${p}` : null;
  }

  function detectSellPhase(dyn, cfg) {
    const z = num(dyn?.zscore);
    if (z === null || z < 1.8) return null;   // même guard que detectSell
    const p = detectReversalPhase(dyn.slope, dyn.dslope, "SELL", cfg);
    return p ? `SELL_${p}` : null;
  }

  // ============================================================================
  // MAIN EVALUATE
  // ============================================================================
  function evaluate(rows = [], opts = {}) {
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) return [];

    const symbol = data[0]?.symbol;
    if (!symbol) return [];

    const cfg = getSignalConfig(symbol)?.h1Reversal;
    if (!isValidCfg(cfg)) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;
    const debug    = Boolean(opts.debug);

    const opps = [];

    const d = {
      total:             0,
      structureFiltered: 0,
      scoreFiltered:     0,
      signals:           0
    };

    for (let i = 0; i < data.length; i++) {
      d.total++;

      const rsiStats = getMinMaxRSI_H1(data, i, cfg.rsiWindowH1);
      if (!rsiStats) continue;

      const dyn = getH1Dynamics(data[i]);
      if (!dyn) continue;

      const signalType =
        detectBuy(rsiStats, dyn, cfg)   ??
        detectSell(rsiStats, dyn, cfg)  ??
        detectBuyPhase(dyn, cfg)        ??
        detectSellPhase(dyn, cfg);

      if (!signalType) continue;

      const side = signalType.startsWith("BUY") ? "BUY" : "SELL";

      // ✅ symbol passé pour calibration per-asset
      if (!passesStructureGate(side, rsiStats, dyn, cfg, symbol)) {
        d.structureFiltered++;
        continue;
      }

      const regime = side === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL";

      const opp = {
        type:        "REVERSAL",
        regime,
        index:       i,
        timestamp:   data[i]?.timestamp,
        symbol,
        side,
        signalType,

        rsi_h1:      rsiStats.currentRSI,
        rsi_h1_min5: rsiStats.minRSI,
        rsi_h1_max5: rsiStats.maxRSI,
        slope_h1:    dyn.slope,
        dslope_h1:   dyn.dslope,
        dz_h1:       dyn.dbbz,
        zscore_h1:   num(data[i]?.zscore_h1),

        intraday_change: num(data[i]?.intraday_change),

        atr_h1:  num(data[i]?.atr_h1),
        atr_m15: num(data[i]?.atr_m15),
        close:   num(data[i]?.close) ?? num(data[i]?.price),

        zscore_m5: num(data[i]?.zscore_m5),
        rsi_m5:    num(data[i]?.rsi_m5),
        slope_m5:  num(data[i]?.slope_m5),
        dslope_m5: num(data[i]?.dslope_m5),
        drsi_m5:   num(data[i]?.drsi_m5),
      };

      const scoreFn = side === "BUY" ? scoreReversalBuy : scoreReversalSell;
      const { total: score, breakdown } = scoreFn(opp);

      if (score < scoreMin) {
        d.scoreFiltered++;
        continue;
      }

      opp.score = score;
      opp.breakdown = breakdown;
      d.signals++;
      opps.push(opp);
    }

    if (debug) console.info("REVERSAL REPORT", d);

    return opps;
  }

  return { evaluate };

})();

export default ReversalStrategy;
