// ============================================================================
// continuation.js — H1 CONTINUATION STRATEGY (NEO MATRIX PRO CLEAN)
// - Structure-safe version
// - ✅ slopeH1MinAbs / dslopeH1MaxAbs calibrés par asset via SlopeConfig
// - Compatible TopOpportunities router
// - Compatible SignalFilters
// ============================================================================

import { getSignalConfig }       from "../config/SignalConfig.js";
import { getSlopeConfig }        from "../config/SlopeConfig";
import { detectContinuationPhase } from "./SignalPhaseDetector";
import { scoreContinuationBuy, scoreContinuationSell } from "./ScoreEngine";

const ContinuationStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function getCfg(symbol) {
    const assetCfg = getSignalConfig(symbol);
    return assetCfg?.h1Continuation ?? {};
  }

  const PHASE_BONUS = {
    EXPANSION_ACCELERATING: 40,
    EXPANSION:              20,
    EARLY_TREND:            15,
    MATURE_CONTINUATION:     5,
  };

  // ============================================================================
  // SLOPE LIMITS — calibrés par asset via SlopeConfig
  //
  // slopeMin = frontière flat/weak (P60 buy, P40 sell en valeur absolue)
  //          → remplace cfg.slopeH1MinAbs ?? 1.25
  // slopeMax = frontière strong/extreme (P95)
  //          → remplace cfg.dslopeH1MaxAbs
  // ============================================================================
  function getSlopeLimits(side, symbol) {
    const slopeCfg = getSlopeConfig(symbol);

    if (side === "BUY") {
      return {
        slopeMin: slopeCfg.up_weak.min,
        slopeMax: slopeCfg.up_extreme.min,
      };
    } else {
      return {
        slopeMin: Math.abs(slopeCfg.down_weak.max),
        slopeMax: Math.abs(slopeCfg.down_extreme.max),
      };
    }
  }

  // =========================================================
  // BUY DETECTION
  // =========================================================
  function detectBuy(row, cfg, symbol) {

    const slope_h1  = num(row?.slope_h1);
    const dslope_h1 = num(row?.dslope_h1);
    const rsi_h1    = num(row?.rsi_h1);
    const zscore_h1 = num(row?.zscore_h1);
    const dz_h1     = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null)
      return null;

    if (zscore_h1 !== null && Math.abs(zscore_h1) < 0.3) return null;

    const { slopeMin, slopeMax } = getSlopeLimits("BUY", symbol);

    // ✅ STRUCTURE FILTER — slope minimum requis (flat/weak boundary)
    if (Math.abs(slope_h1) < slopeMin)
      return null;

    const phase = detectContinuationPhase(slope_h1, dslope_h1, "BUY", cfg);
    if (!phase) return null;

    // ✅ Anti spike — slope trop violent (strong/extreme boundary)
    if (Math.abs(slope_h1) > slopeMax)
      return null;

if (zscore_h1 !== null && zscore_h1 > (cfg.zscoreH1BuyMax ?? 1.8)) return null;


    // RSI zone continuation
    if (rsi_h1 < (cfg.rsiContMin ?? 35) ||
        rsi_h1 > (cfg.rsiContMax ?? 65))
      return null;

// =========================================================
// ✅ MATURITY BLOCK — fin d'expansion haussière
// Bloque BUY si déjà trop étiré vers le haut
// =========================================================

if (
  zscore_h1 !== null &&
  dz_h1 !== null &&
  dslope_h1 !== null &&
  zscore_h1 > 1.8 &&
  dz_h1 > 0.3 &&
  dslope_h1 > 0
)
  return null;

    return phase;
  }

  // =========================================================
  // SELL DETECTION
  // =========================================================
  function detectSell(row, cfg, symbol) {

    const slope_h1  = num(row?.slope_h1);
    const dslope_h1 = num(row?.dslope_h1);
    const rsi_h1    = num(row?.rsi_h1);
    const zscore_h1 = num(row?.zscore_h1);
    const dz_h1     = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null)
      return null;

    if (zscore_h1 !== null && Math.abs(zscore_h1) < 0.3) return null;

    const { slopeMin, slopeMax } = getSlopeLimits("SELL", symbol);

// ✅ STRUCTURE FILTER — slope minimum requis (flat/weak boundary)
if (Math.abs(slope_h1) < slopeMin)
  return null;

const phase = detectContinuationPhase(slope_h1, dslope_h1, "SELL", cfg);
if (!phase) return null;

// ✅ Anti spike — slope trop violent (strong/extreme boundary)
if (Math.abs(slope_h1) > slopeMax)
  return null;

if (zscore_h1 !== null && zscore_h1 < -(cfg.zscoreH1BuyMax ?? 1.8)) return null;

// ✅ RSI zone continuation
if (rsi_h1 < (cfg.rsiContMin ?? 35) ||
    rsi_h1 > (cfg.rsiContMax ?? 65))
  return null;

// =========================================================
// ✅ MATURITY BLOCK — fin d'expansion baissière
// Bloque SELL si déjà trop étiré vers le bas
// =========================================================

if (
  zscore_h1 !== null &&
  dz_h1 !== null &&
  dslope_h1 !== null &&
  zscore_h1 < -1.8 &&
  dz_h1 < -0.3 &&
  dslope_h1 < 0
)
  return null;

return phase;
  }

  // =========================================================
  // MAIN
  // =========================================================
  function evaluate(marketData = [], opts = {}) {

    if (!Array.isArray(marketData) || !marketData.length)
      return [];

    const symbol = marketData[0]?.symbol;
    if (!symbol) return [];

    const cfg      = getCfg(symbol);
    const scoreMin = num(opts.scoreMin) ?? 0;

    const opportunities = [];

    for (let i = 0; i < marketData.length; i++) {

      const row = marketData[i];

      // ✅ symbol passé pour calibration per-asset
      const phaseBuy  = detectBuy(row, cfg, symbol);
      const phaseSell = phaseBuy ? null : detectSell(row, cfg, symbol);

      const phase = phaseBuy ?? phaseSell;
      if (!phase) continue;

      const side = phaseBuy ? "BUY" : "SELL";

      const opp = {
        type:        "CONTINUATION",
        regime:      "CONTINUATION",
        index:       i,
        timestamp:   row.timestamp,
        symbol,
        side,
        signalType:  side,
        signalPhase: phase,

        rsi_h1:      num(row?.rsi_h1),
        rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
        slope_h1:    num(row?.slope_h1),
        dslope_h1:   num(row?.dslope_h1),
        dz_h1:       num(row?.dz_h1),
        zscore_h1:   num(row?.zscore_h1),

        intraday_change: num(row?.intraday_change),

        atr_m15:  num(row?.atr_m15),
        atr_h1:   num(row?.atr_h1),
        close:    num(row?.close),

        rsi_m1:    num(row?.rsi_m1),
        slope_m1:  num(row?.slope_m1),
        drsi_m1:   num(row?.drsi_m1),
        dslope_m1: num(row?.dslope_m1),

        rsi_m5:    num(row?.rsi_m5),
        slope_m5:  num(row?.slope_m5),
        drsi_m5:   num(row?.drsi_m5),
        dslope_m5: num(row?.dslope_m5),
        zscore_m5: num(row?.zscore_m5),
      };

      const scoreFn = side === "BUY" ? scoreContinuationBuy : scoreContinuationSell;
      const { total: score, breakdown } = scoreFn(opp);
      if (score < scoreMin) continue;

      opp.score     = score;
      opp.raw_score = score;
      opp.breakdown = breakdown;
      opportunities.push(opp);
    }

    return opportunities;
  }

  return { evaluate };

})();

export default ContinuationStrategy;
