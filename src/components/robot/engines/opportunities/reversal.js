// ============================================================================
// reversal.js — H1 REVERSAL STRATEGY
// - Compatible TopOpportunities RSI Router (index numeric + regime added)
// - Logging gated by opts.debug
// - ✅ slopeMin / slopeMax calibrés par asset via SlopeConfig (P40/P60/P95)
// ============================================================================

import { getSignalConfig }     from "../config/SignalConfig.js";
import { getSlopeConfig }      from "../config/SlopeConfig";
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
  function getMinMaxRSI_H1(rows, i, bars = 3) {
    const row = rows[i];

    // ── MODE LIVE : champs pré-calculés par MQL5 ──────────────────────────
    const preMin  = num(row?.rsi_h1_previouslow3);
    const preMax  = num(row?.rsi_h1_previoushigh3);
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
  // Reversal = direction OPPOSÉE à la continuation
  // BUY reversal : prix baisse → slope négatif → seuils down_*
  // SELL reversal : prix monte → slope positif → seuils up_*
  function getSlopeLimits(side, symbol) {
    const slopeCfg = getSlopeConfig(symbol);

    if (side === "BUY") {
      return {
        slopeMin: Math.abs(slopeCfg.down_weak.max),
        slopeMax: Math.abs(slopeCfg.down_extreme.max),
      };
    } else {
      return {
        slopeMin: slopeCfg.up_weak.min,
        slopeMax: slopeCfg.up_extreme.min,
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

    // Zone EXTREME BUY (0–20)
    if (rsi < 20) return dslope > 1.0;

    // Zone EXTREME SELL (80–100)
    if (rsi > 80) return dslope < -1.0;

    // Spike filter — slope trop violent
    if (Math.abs(slope) > slopeMax) return false;

    // BUY REVERSAL
    if (side === "BUY") {
      // Zone DEEP (RSI 20–30) — slope doit avoir une amplitude minimale
      if (rsi < 30) return dslope > dslopeMin && Math.abs(slope) >= slopeMin;
      // Zone SEMI (RSI 30–35) — transition basse
      if (rsi < 35) return slope >= slopeMin && dslope > dslopeMin;
      return false;
    }

    // SELL REVERSAL
    if (side === "SELL") {
      // Zone DEEP (RSI 70–80) — slope doit avoir une amplitude minimale
      if (rsi > 70) return dslope < -dslopeMin && Math.abs(slope) >= slopeMin;
      // Zone SEMI (RSI 65–70) — transition haute
      if (rsi > 65) return slope <= -slopeMin && dslope < -dslopeMin;
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
    if (z === null || z > -1.6) return null;

    // =========================================================
    // MATURITY BLOCK — encore en accélération baissière (strict AND)
    // =========================================================
    if (dyn.zscore < -1.8 && dyn.dbbz < -0.2 && dyn.dslope < -3.0) return null;

    return isEarlyBuyConfirmed(dyn, cfg) ? "BUY_EARLY" : "BUY";
  }

  function detectSell(rsiStats, dyn, cfg) {
    if (rsiStats.maxRSI < cfg.rsiSellMin) return null;

    // Position extrême requise
    const z = num(dyn?.zscore);
    if (z === null || z < 1.6) return null;

    // =========================================================
    // MATURITY BLOCK — encore en accélération haussière (strict AND)
    // =========================================================
    if (dyn.zscore > 1.8 && dyn.dbbz > 0.2 && dyn.dslope > 3.0) return null;

    return isEarlySellConfirmed(dyn, cfg) ? "SELL_EARLY" : "SELL";
  }

  // ============================================================================
  // ZMID DETECTION — zscore mid-zone reversal (regime 3)
  // Uses zscore_h1_min3 / max3 amplitude to detect bell-shaped reversals
  // ============================================================================
  function detectZmid(row, dyn) {
    const zscore = num(dyn?.zscore);
    const slope  = num(dyn?.slope);
    const dslope = num(dyn?.dslope);
    const rsi    = num(row?.rsi_h1);
    const zMin3  = num(row?.zscore_h1_min3);
    const zMax3  = num(row?.zscore_h1_max3);

    if (zscore === null || slope === null || dslope === null ||
        rsi === null || zMin3 === null || zMax3 === null) return null;

    const amplitude = zMax3 - zMin3;

    // SELL_ZMID — venait d'en bas, cloche, momentum s'effondre
    if (Math.abs(zscore) < 0.5 && zMin3 < -1.0 && amplitude > 0.5 &&
        dslope < -1.0 && slope < 3.0 && rsi < 55)
      return { side: "SELL", signalType: "SELL_ZMID" };

    // BUY_ZMID — venait d'en haut, cloche inversée, momentum repart
    if (Math.abs(zscore) < 0.5 && zMax3 > 1.0 && amplitude > 0.5 &&
        dslope > 1.0 && slope > -2.0 && rsi > 45)
      return { side: "BUY", signalType: "BUY_ZMID" };

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

    const d = {
      total:             0,
      structureFiltered: 0,
      scoreFiltered:     0,
      signals:           0
    };

    for (let i = 0; i < data.length; i++) {
      d.total++;

      const dyn = getH1Dynamics(data[i]);
      if (!dyn) continue;

      // ── ZMID check (regime 2) — before RSI stats ──────────────
      if (dyn) {
        const zmidSignal = detectZmid(data[i], dyn);
        if (zmidSignal) {
          const zmidSide = zmidSignal.side;
          const zmidOpp = {
            type:        "REVERSAL",
            regime:      zmidSide === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL",
            index:       i,
            timestamp:   data[i]?.timestamp,
            symbol,
            side:        zmidSide,
            signalType:  zmidSignal.signalType,

            rsi_h1:      num(data[i]?.rsi_h1),
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

          const scoreFn = zmidSide === "BUY" ? scoreReversalBuy : scoreReversalSell;
          let zmidScore;
          try {
            const result = scoreFn(zmidOpp);
            zmidScore = result?.total ?? Math.round(Math.abs(dyn.dslope) * 100 + Math.abs(dyn.dbbz) * 50);
          } catch {
            zmidScore = Math.round(Math.abs(dyn.dslope) * 100 + Math.abs(dyn.dbbz) * 50);
          }

          if (zmidScore >= scoreMin) {
            zmidOpp.score = zmidScore;
            d.signals++;
            opps.push(zmidOpp);
          }
          continue;
        }
      }

      const rsiStats = getMinMaxRSI_H1(data, i, cfg.rsiWindowH1);
      if (!rsiStats) continue;

      const signalType =
        detectBuy(rsiStats, dyn, cfg)   ??
        detectSell(rsiStats, dyn, cfg);

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
        rsi_h1_previouslow3:  rsiStats.minRSI,
        rsi_h1_previoushigh3: rsiStats.maxRSI,
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
