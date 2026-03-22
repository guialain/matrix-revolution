// ============================================================================
// ZmidStrategy.js — ZMID reversal autour de la bande milieu Bollinger
// Détecte les retournements en zone zscore ~0 avec amplitude récente
// Type routing : RSI 35–65 → CONTINUATION, hors → REVERSAL, 48–52 → null
// ============================================================================

import { scoreReversalBuy, scoreReversalSell } from "./ScoreEngine";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

const ZmidStrategy = (() => {

  // ============================================================================
  // DETECT
  // ============================================================================
  function detectZmid(row, dyn) {
    const zscore = num(dyn?.zscore);
    const slope  = num(dyn?.slope);
    const dslope = num(dyn?.dslope);
    const rsi    = num(row?.rsi_h1);
    const zMin3  = num(row?.zscore_h1_min3);
    const zMax3  = num(row?.zscore_h1_max3);

    const dbbz = num(dyn?.dbbz);  // dz_h1

    if (zscore === null || slope === null || dslope === null ||
        rsi === null || zMin3 === null || zMax3 === null || dbbz === null) return null;

    const amplitude = zMax3 - zMin3;

    // SELL_ZMID — venait d'en bas, cloche, momentum s'effondre
    // dslope < -1.0 (was -0.5) + dz_h1 < 0 (BB derivative aligned)
    if (Math.abs(zscore) < 0.5 && zMin3 < -0.7 && amplitude > 0.5 &&
        dslope < -1.0 && slope < 2.5 && dbbz < 0)
      return { side: "SELL", signalType: "SELL_ZMID" };

    // BUY_ZMID — venait d'en haut, cloche inversée, momentum repart
    // dslope > 1.0 (was 0.5) + dz_h1 > 0 (BB derivative aligned)
    if (Math.abs(zscore) < 0.5 && zMax3 > 0.7 && amplitude > 0.5 &&
        dslope > 1.0 && slope > -2.5 && dbbz > 0)
      return { side: "BUY", signalType: "BUY_ZMID" };

    return null;
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
  // TYPE ROUTING — RSI zone determines type
  // ============================================================================
  function getZmidType(rsi) {
    if (rsi === null) return null;
    if (rsi >= 48 && rsi <= 52) return null;        // NEUTRAL → WAIT
    if (rsi >= 35 && rsi <= 65) return "CONTINUATION";
    return "REVERSAL";
  }

  // ============================================================================
  // MAIN EVALUATE
  // ============================================================================
  function evaluate(rows = [], opts = {}) {
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) return [];

    const symbol   = data[0]?.symbol;
    if (!symbol) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;
    const opps = [];

    for (let i = 0; i < data.length; i++) {
      const dyn = getH1Dynamics(data[i]);
      if (!dyn) continue;

      const zmidResult = detectZmid(data[i], dyn);
      if (!zmidResult) continue;

      const rsi  = num(data[i]?.rsi_h1);
      const type = getZmidType(rsi);
      if (!type) continue; // NEUTRAL → skip

      const { side, signalType } = zmidResult;

      const opp = {
        type,
        regime: type === "REVERSAL"
          ? (side === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL")
          : "CONTINUATION",
        index:      i,
        timestamp:  data[i]?.timestamp,
        symbol,
        side,
        signalType,

        rsi_h1:      rsi,
        rsi_h1_previouslow3:  num(data[i]?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(data[i]?.rsi_h1_previoushigh3),
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

        rsi_m1:    num(data[i]?.rsi_m1),
        drsi_m1:   num(data[i]?.drsi_m1),
      };

      const scoreFn = side === "BUY" ? scoreReversalBuy : scoreReversalSell;
      let zmidScore;
      try {
        const result = scoreFn(opp);
        zmidScore = result?.total ?? Math.round(Math.abs(dyn.dslope) * 100 + Math.abs(dyn.dbbz) * 50);
      } catch {
        zmidScore = Math.round(Math.abs(dyn.dslope) * 100 + Math.abs(dyn.dbbz) * 50);
      }

      if (zmidScore < scoreMin) continue;

      opp.score = zmidScore;
      opps.push(opp);
    }

    return opps;
  }

  return { evaluate };

})();

export default ZmidStrategy;
