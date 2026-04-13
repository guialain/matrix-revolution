// ============================================================================
// TopOpportunities_V8R.js — H1 ROUTER V8R (live mode, Matrix-Revolution)
//
// Adapté de Neo-Backtest/TopOpportunities_V8R.js (engine V9)
//
// ARCHI
// resolve3D (macro)
// ↓
// type (CONT / REV / EARLY)
// ↓
// mode (strict → relaxed)
// ↓
// Zscore gate
// ↓
// RSI + drsi (timing)
//
// REVERSAL logic:
//   REV SELL = slopeH4 S1 (stale) UP   + IC UP   + dslope_h4 (live) < -0.3 + dslope_h1 (live) < -1
//   REV BUY  = slopeH4 S1 (stale) DOWN + IC DOWN + dslope_h4 (live) > +0.3 + dslope_h1 (live) > +1
//
// Configs Matrix-Revolution :
//   IntradayConfig : neutral / dailyUp/Down / strongUp/Down / explosiveUp/Down
//   SlopeConfig    : flat / up_weak / up_strong / up_extreme / down_weak / down_strong / down_extreme
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";
import { INTRADAY_CONFIG } from "../config/IntradayConfig";
import { getSlopeConfig } from "../config/SlopeConfig";

const TopOpportunities_V8R = (() => {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // NIVEAU 1 — REGIME FUNCTIONS
  // ============================================================================

  // Adapté pour IntradayConfig Matrix-Revolution — 9 régimes
  // (spikeDown / explosiveDown / strongDown / softDown / softUp / strongUp / explosiveUp / spikeUp)
  function getIntradayLevel(intra, cfg) {
    if (intra === null || !cfg) return "NEUTRE";
    if (intra > cfg.spikeUp)       return "SPIKE_UP";
    if (intra >= cfg.explosiveUp)  return "EXPLOSIVE_UP";
    if (intra >= cfg.strongUp)     return "STRONG_UP";
    if (intra >= cfg.softUp)       return "SOFT_UP";
    if (intra > cfg.softDown)      return "NEUTRE";
    if (intra > cfg.strongDown)    return "SOFT_DOWN";
    if (intra > cfg.explosiveDown) return "STRONG_DOWN";
    if (intra > cfg.spikeDown)     return "EXPLOSIVE_DOWN";
    return "SPIKE_DOWN";
  }

  // Adapté pour SlopeConfig Matrix-Revolution
  // (flat / up_weak / up_strong / up_extreme / down_weak / down_strong / down_extreme)
  function getSlopeRegime(slope, cfg) {
    if (slope === null || !cfg) return "NEUTRE";
    if (slope >= cfg.up_extreme.min)  return "EXPLOSIVE_UP";
    if (slope >= cfg.up_strong.min)   return "STRONG_UP";
    if (slope >= cfg.up_weak.min)     return "SOFT_UP";
    if (slope >= cfg.flat.min)        return "NEUTRE";
    if (slope >= cfg.down_weak.min)   return "SOFT_DOWN";
    if (slope >= cfg.down_strong.min) return "STRONG_DOWN";
    return "EXPLOSIVE_DOWN";
  }

  // ============================================================================
  // 3D RESOLUTION
  //
  // CONT/EARLY : slopeH4Level (s0 live)
  // REVERSAL   : slopeH4LevelS1 (s1 stale) + dslope_h4 live + dslope_h1 live
  //
  //   CONT BUY  : slopeH4 live UP   + IC UP
  //   CONT SELL : slopeH4 live DOWN + IC DOWN
  //   REV BUY   : slopeH4 stale DOWN + IC DOWN + dslope_h4 > +0.3 + dslope_h1 > +1
  //   REV SELL  : slopeH4 stale UP   + IC UP   + dslope_h4 < -0.3 + dslope_h1 < -1
  //   EARLY BUY : IC NEUTRE + H4 ∈ SOFT_UP|STRONG_UP|EXPLOSIVE_UP + H1 idem
  //   EARLY SELL: IC NEUTRE + H4 ∈ SOFT_DOWN|STRONG_DOWN|EXPLOSIVE_DOWN + H1 idem
  // ============================================================================
  function resolve3D(intradayLevel, slopeH4Level, slopeH4LevelS1, slopeH1Level, drsiH4S0, dslopeH4Live, dslopeH1Live, side, thr = 0.3) {

    const h4Up =
      slopeH4Level === "SOFT_UP" ||
      slopeH4Level === "STRONG_UP" ||
      slopeH4Level === "EXPLOSIVE_UP";

    const h4Down =
      slopeH4Level === "SOFT_DOWN" ||
      slopeH4Level === "STRONG_DOWN" ||
      slopeH4Level === "EXPLOSIVE_DOWN";

    const h4UpS1 =
      slopeH4LevelS1 === "SOFT_UP" ||
      slopeH4LevelS1 === "STRONG_UP" ||
      slopeH4LevelS1 === "EXPLOSIVE_UP";

    const h4DownS1 =
      slopeH4LevelS1 === "SOFT_DOWN" ||
      slopeH4LevelS1 === "STRONG_DOWN" ||
      slopeH4LevelS1 === "EXPLOSIVE_DOWN";

    const dh4Up   = drsiH4S0 !== null && drsiH4S0 >=  thr;
    const dh4Down = drsiH4S0 !== null && drsiH4S0 <= -thr;
    const dh4OkBuy  = dh4Up  || (!dh4Up && !dh4Down);
    const dh4OkSell = dh4Down || (!dh4Up && !dh4Down);

    const isUpIC =
      intradayLevel === "SOFT_UP" ||
      intradayLevel === "STRONG_UP" ||
      intradayLevel === "EXPLOSIVE_UP";

    const isDownIC =
      intradayLevel === "SOFT_DOWN" ||
      intradayLevel === "STRONG_DOWN" ||
      intradayLevel === "EXPLOSIVE_DOWN";

    const h1Up =
      slopeH1Level === "SOFT_UP" ||
      slopeH1Level === "STRONG_UP" ||
      slopeH1Level === "EXPLOSIVE_UP";

    const h1Down =
      slopeH1Level === "SOFT_DOWN" ||
      slopeH1Level === "STRONG_DOWN" ||
      slopeH1Level === "EXPLOSIVE_DOWN";

    if (side === "BUY") {
      if (intradayLevel === "NEUTRE") {
        const dslopeH1Ok = dslopeH1Live !== null && dslopeH1Live > 0.5;
        return (h4Up && h1Up && dslopeH1Ok) ? { type: "EARLY" } : null;
      }

      // CONT BUY — slopeH4 live UP + IC UP
      if (h4Up && isUpIC) return dh4OkBuy ? { type: "CONTINUATION" } : null;

      // REV BUY — slopeH4 stale DOWN + IC DOWN + dslope_h4 live remonte + dslope_h1 live remonte
      if (h4DownS1 && isDownIC) {
        const revConfirm =
          (dslopeH4Live !== null && dslopeH4Live >  0.3) &&
          (dslopeH1Live !== null && dslopeH1Live >  1);
        return revConfirm ? { type: "REVERSAL" } : null;
      }

      return null;
    }

    if (side === "SELL") {
      if (intradayLevel === "NEUTRE") {
        const dslopeH1Ok = dslopeH1Live !== null && dslopeH1Live < -0.5;
        return (h4Down && h1Down && dslopeH1Ok) ? { type: "EARLY" } : null;
      }

      // CONT SELL — slopeH4 live DOWN + IC DOWN
      if (h4Down && isDownIC) return dh4OkSell ? { type: "CONTINUATION" } : null;

      // REV SELL — slopeH4 stale UP + IC UP + dslope_h4 live fléchit + dslope_h1 live fléchit
      if (h4UpS1 && isUpIC) {
        const revConfirm =
          (dslopeH4Live !== null && dslopeH4Live < -0.3) &&
          (dslopeH1Live !== null && dslopeH1Live < -1);
        return revConfirm ? { type: "REVERSAL" } : null;
      }

      return null;
    }

    return null;
  }

  // ============================================================================
  // MODE — qualité du setup
  // ============================================================================
  const STRONG_UP_LEVELS   = ["STRONG_UP", "EXPLOSIVE_UP"];
  const STRONG_DOWN_LEVELS = ["STRONG_DOWN", "EXPLOSIVE_DOWN"];

  function computeMode(type, side, intradayLevel, slopeH4Level, drsiH4S0, thr) {
    const dh4Confirm =
      side === "BUY"
        ? drsiH4S0 !== null && drsiH4S0 >= thr
        : drsiH4S0 !== null && drsiH4S0 <= -thr;

    const icStrong =
      side === "BUY"
        ? type === "REVERSAL"
          ? STRONG_DOWN_LEVELS.includes(intradayLevel)
          : STRONG_UP_LEVELS.includes(intradayLevel)
        : type === "REVERSAL"
          ? STRONG_UP_LEVELS.includes(intradayLevel)
          : STRONG_DOWN_LEVELS.includes(intradayLevel);

    const h4Strong =
      side === "BUY"
        ? slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP"
        : slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";

    const conf = [icStrong, h4Strong, dh4Confirm].filter(Boolean).length;
    if (conf === 3) return "relaxed";
    if (conf === 2) return "soft";
    if (conf >= 1)  return "normal";
    return "strict";
  }

  // ============================================================================
  // ZSCORE THRESHOLDS
  // ============================================================================
  function getZscoreThresholds(mode) {
    const CONT  = { strict: 2.0, normal: 2.2, soft: 2.5, relaxed: 2.8 };
    const REV   = { strict: 1.5, normal: 1.2, soft: 1.0, relaxed: 0.8 };
    const EARLY = { strict: 1.8, normal: 2.0, soft: 2.2, relaxed: 2.5 };
    return {
      cont:  CONT[mode]  ?? 1.5,
      rev:   REV[mode]   ?? 1.2,
      early: EARLY[mode] ?? 1.0,
    };
  }

  function passZscoreGate({ side, type, mode, zscore, dz, zscoreH4 }) {
    if (zscore === null) return false;
    if (type !== "CONTINUATION" && Math.abs(zscore) > 3) return false;

    if (zscoreH4 !== null) {
      if (side === "BUY"  && zscoreH4 >  1.95) return false;
      if (side === "SELL" && zscoreH4 < -1.95) return false;
    }

    const { cont, rev, early } = getZscoreThresholds(mode);
    const dzOkBuy  = dz === null || dz >= 0;
    const dzOkSell = dz === null || dz <= 0;

    if (type === "CONTINUATION") {
      if (side === "BUY")  return zscore < cont  && dzOkBuy;
      if (side === "SELL") return zscore > -cont && dzOkSell;
    }
    if (type === "REVERSAL") {
      if (side === "BUY")  return zscore < -rev && dzOkBuy;
      if (side === "SELL") return zscore > rev  && dzOkSell;
    }
    if (type === "EARLY") {
      if (side === "BUY")  return zscore < early  && dzOkBuy;
      if (side === "SELL") return zscore > -early && dzOkSell;
    }
    return false;
  }

  // ============================================================================
  // DRSI CONTEXT GATE (simplified — pas de DrsiConfig dans Matrix-Revolution)
  // ============================================================================
  function drsiContextGate(side, type, intradayLevel, drsi_h1_s0, drsi_h4_s0) {
    if (side === "SELL") {
      const SELL_FLOOR = {
        SOFT_UP:       [-0.20, -0.10],
        STRONG_UP:     [-0.50, -0.30],
        EXPLOSIVE_UP:  [-1.00, -0.50],
        NEUTRE:        [-0.40, 0],
        SOFT_DOWN:     [-0.35, 0],
        STRONG_DOWN:   [-0.25, 0],
        EXPLOSIVE_DOWN:[-0.20, 0],
      };
      const [h1Min, h4Min] = SELL_FLOOR[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Min) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 > h4Min) return false;
    } else {
      const BUY_CEIL = {
        SOFT_DOWN:     [0.20, 0.10],
        STRONG_DOWN:   [0.50, 0.30],
        EXPLOSIVE_DOWN:[1.00, 0.50],
        NEUTRE:        [0.40, 0],
        SOFT_UP:       [0.35, 0],
        STRONG_UP:     [0.25, 0],
        EXPLOSIVE_UP:  [0.20, 0],
      };
      const [h1Max, h4Max] = BUY_CEIL[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Max) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 < h4Max) return false;
    }
    return true;
  }

  // ============================================================================
  // RSI + DRSI TIMING
  // ============================================================================
  function matchBuyRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, type) {
    if (rsi_h1_s0 === null || drsi_h1_s0 === null) return null;
    const dslopeOk = dslope_h1_live === null || dslope_h1_live > -1;

    if (type === "CONTINUATION") {
      if (rsi_h1_s0 >= 28 && rsi_h1_s0 < 50 && drsi_h1_s0 > 0.3 && dslopeOk)
        return { route: "BUY-[28-50]", side: "BUY" };
      if (rsi_h1_s0 >= 50 && rsi_h1_s0 < 72 && drsi_h1_s0 > 0.3 && dslopeOk)
        return { route: "BUY-[50-72]", side: "BUY" };
      return null;
    }
    if (type === "REVERSAL") {
      if (rsi_h1_s0 < 35 && drsi_h1_s0 > 0 && dslopeOk)
        return { route: "BUY-REV-[0-35]", side: "BUY" };
      return null;
    }
    if (type === "EARLY") {
      if (rsi_h1_s0 >= 35 && rsi_h1_s0 < 60 && drsi_h1_s0 > 0.2 && dslopeOk)
        return { route: "BUY-EARLY-[35-60]", side: "BUY" };
      return null;
    }
    return null;
  }

  function matchSellRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, type) {
    if (rsi_h1_s0 === null || drsi_h1_s0 === null) return null;
    const dslopeOk = dslope_h1_live === null || dslope_h1_live < 1;

    if (type === "CONTINUATION") {
      if (rsi_h1_s0 >= 50 && rsi_h1_s0 < 72 && drsi_h1_s0 < -0.3 && dslopeOk)
        return { route: "SELL-[50-72]", side: "SELL" };
      if (rsi_h1_s0 >= 28 && rsi_h1_s0 < 50 && drsi_h1_s0 < -0.3 && dslopeOk)
        return { route: "SELL-[28-50]", side: "SELL" };
      return null;
    }
    if (type === "REVERSAL") {
      if (rsi_h1_s0 > 65 && drsi_h1_s0 < 0 && dslopeOk)
        return { route: "SELL-REV-[65-100]", side: "SELL" };
      return null;
    }
    if (type === "EARLY") {
      if (rsi_h1_s0 > 40 && rsi_h1_s0 <= 65 && drsi_h1_s0 < -0.2 && dslopeOk)
        return { route: "SELL-EARLY-[40-65]", side: "SELL" };
      return null;
    }
    return null;
  }

  const ROUTE_PHASE = {
    "BUY-[28-50]":        "LOW_MID",
    "BUY-[50-72]":        "MID_HIGH",
    "BUY-REV-[0-35]":     "REV_LOW",
    "BUY-EARLY-[35-60]":  "EARLY_LOW",
    "SELL-[50-72]":       "MID_HIGH",
    "SELL-[28-50]":       "LOW_MID",
    "SELL-REV-[65-100]":  "REV_HIGH",
    "SELL-EARLY-[40-65]": "EARLY_HIGH",
  };

  // ============================================================================
  // MAIN — live mode (1 row per symbol, marketWatch array)
  // ============================================================================
  function evaluate(marketData = []) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const opps = [];

    for (const row of rows) {
      const symbol = row?.symbol;
      if (!symbol) continue;

      const riskCfg  = getRiskConfig(symbol);
      const intCfg   = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
      const slopeCfg = getSlopeConfig(symbol);

      const drsiH4Thr    = 0.3;
      const antiSpikeH1S0 = 8;
      const atrH1Cap     = num(riskCfg?.atrH1Cap);

      // Veto anti-spike : ATR H1 > 2× cap → skip
      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

      const drsi_h1    = num(row?.drsi_h1);
      const drsi_h1_s0 = num(row?.drsi_h1_s0);
      const drsi_h4_s0 = num(row?.drsi_h4_s0);

      if (drsi_h1    !== null && Math.abs(drsi_h1)    >= 8)              continue;
      if (drsi_h1_s0 !== null && Math.abs(drsi_h1_s0) >= antiSpikeH1S0) continue;

      const intra         = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      // slope H4 s1 (stale) — tendance établie, pour REVERSAL
      const slope_h4_s1_val = num(row?.slope_h4);
      // slope H4 s0 (live) prioritaire — pour CONT/EARLY
      const slope_h4_s0_val = num(row?.slope_h4_s0);
      const slope_h4_raw    = slope_h4_s0_val !== null ? slope_h4_s0_val : slope_h4_s1_val;

      const slopeH4Level   = getSlopeRegime(slope_h4_raw,    slopeCfg); // live — CONT/EARLY
      const slopeH4LevelS1 = getSlopeRegime(slope_h4_s1_val, slopeCfg); // stale — REVERSAL

      const slope_h1_raw   = num(row?.slope_h1_s0) ?? num(row?.slope_h1);
      const slopeH1Level   = getSlopeRegime(slope_h1_raw, slopeCfg);    // live — EARLY gate

      const dslopeH4Live = num(row?.dslope_h4);
      const dslopeH1Live = num(row?.dslope_h1);

      const zscore_h4    = num(row?.zscore_h4_s0) ?? num(row?.zscore_h4);
      const zscore_h1    = num(row?.zscore_h1_s0) ?? num(row?.zscore_h1);
      const zscore_h1_s1 = num(row?.zscore_h1);
      const dz_h1_live   = (zscore_h1 !== null && zscore_h1_s1 !== null)
        ? zscore_h1 - zscore_h1_s1 : null;

      const rsi_h1_s0       = num(row?.rsi_h1_s0) ?? num(row?.rsi_h1);
      const slope_h1_s0_val = num(row?.slope_h1_s0);
      const slope_h1_s1_val = num(row?.slope_h1);
      const dslope_h1_live  = (slope_h1_s0_val !== null && slope_h1_s1_val !== null)
        ? slope_h1_s0_val - slope_h1_s1_val : null;

      let match      = null;
      let signalType = null;
      let signalMode = null;

      // Try BUY first
      const buyRes = resolve3D(intradayLevel, slopeH4Level, slopeH4LevelS1, slopeH1Level, drsi_h4_s0, dslopeH4Live, dslopeH1Live, "BUY", drsiH4Thr);
      if (buyRes) {
        const buyMode = computeMode(buyRes.type, "BUY", intradayLevel, slopeH4Level, drsi_h4_s0, drsiH4Thr);
        if (passZscoreGate({ side: "BUY", type: buyRes.type, mode: buyMode, zscore: zscore_h1, dz: dz_h1_live, zscoreH4: zscore_h4 })) {
          match = matchBuyRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, buyRes.type);
          if (match) { signalType = buyRes.type; signalMode = buyMode; }
        }
      }

      // Try SELL if no BUY match
      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, slopeH4LevelS1, slopeH1Level, drsi_h4_s0, dslopeH4Live, dslopeH1Live, "SELL", drsiH4Thr);
        if (sellRes) {
          const sellMode = computeMode(sellRes.type, "SELL", intradayLevel, slopeH4Level, drsi_h4_s0, drsiH4Thr);
          if (passZscoreGate({ side: "SELL", type: sellRes.type, mode: sellMode, zscore: zscore_h1, dz: dz_h1_live, zscoreH4: zscore_h4 })) {
            match = matchSellRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, sellRes.type);
            if (match) { signalType = sellRes.type; signalMode = sellMode; }
          }
        }
      }

      if (!match) continue;

      if (!drsiContextGate(match.side, signalType, intradayLevel, drsi_h1_s0, drsi_h4_s0)) continue;
      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const score =
        signalType === "REVERSAL" ? 80 :
        signalType === "EARLY"    ? 70 :
        Math.max(0, Math.round(
          Math.abs(num(row?.slope_h1) ?? 0) * 50 +
          Math.abs((num(row?.rsi_h1)  ?? 50) - 50) * 2
        ));

      opps.push({
        type:        signalType,
        mode:        signalMode,
        regime:      `${signalType}_${match.side}`,
        route:       match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine:      "V8R",
        symbol,
        side:        match.side,
        signalType,
        score,
        intradayLevel,
        slopeH4Level,
        slopeH4LevelS1,

        // H4
        slope_h4:    num(row?.slope_h4),
        dslope_h4:   num(row?.dslope_h4),
        drsi_h4:     num(row?.drsi_h4),
        rsi_h4_s0:   num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        drsi_h4_s0:  num(row?.drsi_h4_s0),

        // H1
        rsi_h1:      num(row?.rsi_h1),
        slope_h1:    num(row?.slope_h1),
        dslope_h1:   num(row?.dslope_h1),
        drsi_h1:     num(row?.drsi_h1),
        zscore_h1:   num(row?.zscore_h1),
        dz_h1:       num(row?.dz_h1),
        atr_h1:      num(row?.atr_h1),

        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        drsi_h1_s0:   num(row?.drsi_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        // M15
        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        // M5 (pour SignalFilters)
        rsi_m5:      num(row?.rsi_m5),
        slope_m5:    num(row?.slope_m5),
        dslope_m5:   num(row?.dslope_m5),
        drsi_m5:     num(row?.drsi_m5),
        zscore_m5:   num(row?.zscore_m5),
        rsi_m5_s0:   num(row?.rsi_m5_s0),
        slope_m5_s0: num(row?.slope_m5_s0),
        drsi_m5_s0:  num(row?.drsi_m5_s0),
        zscore_m5_s0:num(row?.zscore_m5_s0),

        close:           num(row?.close),
        intraday_change: intra,
      });
    }

    opps.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return opps;
  }

  return { evaluate };
})();

export default TopOpportunities_V8R;
