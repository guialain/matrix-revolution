// ============================================================================
// reversal.js — M15 REVERSAL STRATEGY
// - M15 detector: rsi_m15 extreme + dslope_m15 momentum + dslope_h1 context
// - H1 provides structural context (deceleration), M15 provides timing
// ============================================================================

import { getSignalConfig } from "../config/SignalConfig.js";

const ReversalStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // CONFIG VALIDATION
  // ============================================================================
  function isValidCfg(cfg) {
    return cfg != null;
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
  // M15 REVERSAL DETECTOR — H1 context + M15 timing
  // ============================================================================
  function detectBuyM15(row, dyn) {
    const rsi_m15    = num(row?.rsi_m15);
    const dslope_m15 = num(row?.dslope_m15);
    const dslope_h1  = num(dyn?.dslope);

    if (rsi_m15 === null || dslope_m15 === null || dslope_h1 === null) return null;

    if (rsi_m15 < 27 && dslope_m15 > 0.75 && dslope_h1 > 0) return "BUY";
    return null;
  }

  function detectSellM15(row, dyn) {
    const rsi_m15    = num(row?.rsi_m15);
    const dslope_m15 = num(row?.dslope_m15);
    const dslope_h1  = num(dyn?.dslope);

    if (rsi_m15 === null || dslope_m15 === null || dslope_h1 === null) return null;

    if (rsi_m15 > 73 && dslope_m15 < -0.75 && dslope_h1 < 0) return "SELL";
    return null;
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
    const d = { total: 0, signals: 0 };

    for (let i = 0; i < data.length; i++) {
      d.total++;

      const dyn = getH1Dynamics(data[i]);
      if (!dyn) continue;

      const signalType = detectBuyM15(data[i], dyn) ?? detectSellM15(data[i], dyn);
      if (!signalType) continue;

      const side = signalType.startsWith("BUY") ? "BUY" : "SELL";
      const score = 80;
      const breakdown = { source: "M15" };

      if (score < scoreMin) continue;

      d.signals++;

      opps.push({
        type:       "REVERSAL",
        regime:     side === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL",
        index:      i,
        timestamp:  data[i]?.timestamp,
        symbol,
        side,
        signalType,
        score,
        breakdown,

        rsi_h1:    num(data[i]?.rsi_h1),
        slope_h1:  dyn.slope,
        dslope_h1: dyn.dslope,
        dz_h1:     dyn.dbbz,
        zscore_h1: num(data[i]?.zscore_h1),

        intraday_change: num(data[i]?.intraday_change),

        atr_h1:  num(data[i]?.atr_h1),
        atr_m15: num(data[i]?.atr_m15),
        close:   num(data[i]?.close) ?? num(data[i]?.price),

        zscore_m5: num(data[i]?.zscore_m5),
        rsi_m5:    num(data[i]?.rsi_m5),
        slope_m5:  num(data[i]?.slope_m5),
        dslope_m5: num(data[i]?.dslope_m5),
        drsi_m5:   num(data[i]?.drsi_m5),

        rsi_m1:    num(data[i]?.rsi_m1),
        drsi_m1:   num(data[i]?.drsi_m1),
      });
    }

    if (debug) console.info("REVERSAL REPORT", d);

    return opps;
  }

  return { evaluate };

})();

export default ReversalStrategy;
