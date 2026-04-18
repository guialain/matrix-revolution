// ============================================================================
// TopOpportunities_V8R.js — H1 ROUTER V8R
//
// RESOLVE = IC (intradayChange) + slopeH4 + drsiH4S0 → TYPE
//
// REVERSAL = trade CONTRE l'IC (pas un retournement de marché)
//   IC baissier + H4 haussier = pullback dans uptrend H4 → REV BUY
//   IC haussier + H4 baissier = rally dans downtrend H4  → REV SELL
//   IC haussier + H4 haussier = trend aligné             → CONT BUY
//   (miroir pour SELL)
//
//   IC                   slopeH4       drsiH4S0      => TYPE
//   ──────────────────────────────────────────────────────────
//   UP/STRONG/EXP_UP     UP/STRONG_UP  NEUTRE/UP+    => CONT  BUY
//   DOWN/STRONG/EXP_DOWN UP/STRONG_UP  NEUTRE/UP+    => REV   BUY  (IC dip, H4 tient)
//   SPIKE_DOWN           UP/STRONG_UP  NEUTRE/UP+    => REV   BUY  spike
//   DOWN/*               UP/STRONG_UP  DOWN-         => WAIT  (H4 perd momentum)
//   SPIKE_UP             DOWN/STR_DOWN NEUTRE/DOWN-  => REV   SELL spike
//   NEUTRE               *             UP+           => EARLY BUY
//   NEUTRE               *             DOWN-         => EARLY SELL
//   slopeH4 SPIKE/NEUTRE                            => WAIT
//
// H1 → timing seulement (route RSI Gate 2)
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";
import { getSlopeConfig, getSlopeClass } from "../config/SlopeConfig.js";
import { getDrsiConfig } from "../config/DrsiConfig.js";
import { scoreReversalBuy, scoreReversalSell, scoreContinuationBuy, scoreContinuationSell } from "./ScoreEngine.js";
import GlobalMarketHours from "../trading/GlobalMarketHours.js";
import { resolveMarket } from "../trading/AssetEligibility.js";

const TopOpportunities_V8R = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // NIVEAU 1 — REGIME FUNCTIONS
  // ============================================================================
  function getIntradayLevel(intra, cfg) {
    if (intra === null) return "NEUTRE";
    if (intra >  cfg.spikeUp)       return "SPIKE_UP";
    if (intra >= cfg.explosiveUp)   return "EXPLOSIVE_UP";
    if (intra >= cfg.strongUp)      return "STRONG_UP";
    if (intra >= cfg.softUp)        return "SOFT_UP";
    if (intra >  cfg.softDown)      return "NEUTRE";
    if (intra >  cfg.strongDown)    return "SOFT_DOWN";
    if (intra >  cfg.explosiveDown) return "STRONG_DOWN";
    if (intra >  cfg.spikeDown)     return "EXPLOSIVE_DOWN";
    return "SPIKE_DOWN";
  }

  const SLOPE_CLASS_TO_LEVEL = {
    up_extreme:   "EXPLOSIVE_UP",
    up_strong:    "STRONG_UP",
    up_weak:      "SOFT_UP",
    flat:         "NEUTRE",
    down_weak:    "SOFT_DOWN",
    down_strong:  "STRONG_DOWN",
    down_extreme: "EXPLOSIVE_DOWN",
  };

  function getSlopeLevel(slope, symbol) {
    if (slope === null) return "NEUTRE";
    return SLOPE_CLASS_TO_LEVEL[getSlopeClass(slope, symbol)] ?? "NEUTRE";
  }

  // ============================================================================
  // D1 STATE — matrice slope_d1_s0 × dslope_d1_s0
  // Seuils calibrés sur 8 assets (~159k bougies H1) :
  //   SLOPE_STRONG = 2.2 (≈ p80)  SLOPE_SOFT = 0.5 (≈ p40)
  //   DSLOPE_THR   = 0.5 (≈ p58)
  //
  //   slope \ dslope  ACCEL(≥0.5)    NEUTRE(-0.5,0.5)  DECEL(≤-0.5)
  //   STRONG_UP       STRONG_UP       STRONG_UP          FADING_UP
  //   SOFT_UP         FADING_UP       FADING_UP          FLAT
  //   FLAT            EMERGING_UP     FLAT               EMERGING_DOWN
  //   SOFT_DOWN       FLAT            FADING_DOWN        FADING_DOWN
  //   STRONG_DOWN     FADING_DOWN     STRONG_DOWN        STRONG_DOWN
  // ============================================================================
  const D1_SLOPE_STRONG = 2.2;
  const D1_SLOPE_SOFT   = 0.5;
  const D1_DSLOPE_THR   = 0.5;

  function getD1State(slope_d1_s0, dslope_d1_s0) {
    if (slope_d1_s0 === null || dslope_d1_s0 === null) return "D1_FLAT";

    const accel  = dslope_d1_s0 >=  D1_DSLOPE_THR;
    const decel  = dslope_d1_s0 <= -D1_DSLOPE_THR;

    if (slope_d1_s0 >= D1_SLOPE_STRONG) {
      if (decel)  return "D1_FADING_UP";
      return "D1_STRONG_UP";                          // accel ou neutre
    }
    if (slope_d1_s0 >= D1_SLOPE_SOFT) {
      if (decel)  return "D1_FLAT";
      return "D1_FADING_UP";                          // accel ou neutre
    }
    if (slope_d1_s0 > -D1_SLOPE_SOFT) {
      if (accel)  return "D1_EMERGING_UP";
      if (decel)  return "D1_EMERGING_DOWN";
      return "D1_FLAT";
    }
    if (slope_d1_s0 > -D1_SLOPE_STRONG) {
      if (accel)  return "D1_FLAT";
      return "D1_FADING_DOWN";                        // neutre ou decel
    }
    // STRONG_DOWN
    if (accel)  return "D1_FADING_DOWN";
    return "D1_STRONG_DOWN";                          // neutre ou decel
  }

  // ============================================================================
  // 3D RESOLUTION : intradayLevel x slopeH4Level x dslopeH4 => { type, mode }
  // dslopeH4 = slope_h4_s0 - slope_h4 (accélération H4 live)
  // d1State  = getD1State(slope_d1_s0, dslope_d1_s0) — croisé avec intradayLevel
  //   BUY  : matrice D1State × icGroup → { action, mode }
  //   SELL : miroir symétrique (D1State ignoré pour type, module mode uniquement)
  // H1 → timing seulement (route RSI Gate 2)
  // ============================================================================

  const D1_BUY_MATRIX = {
    D1_STRONG_UP: {
      IC_SPIKE_DOWN: { action: "REVERSAL",     mode: "relaxed" },
      IC_DOWN:       { action: "REVERSAL",     mode: "soft"    },
      IC_NEUTRE:     { action: "unchanged",    mode: "normal"  },
      IC_UP:         { action: "CONTINUATION", mode: "relaxed" },
      IC_SPIKE_UP:   { action: "block" },
    },
    D1_FADING_UP: {
      IC_SPIKE_DOWN: { action: "REVERSAL",     mode: "soft"    },
      IC_DOWN:       { action: "REVERSAL",     mode: "normal"  },
      IC_NEUTRE:     { action: "unchanged",    mode: "normal"  },
      IC_UP:         { action: "CONTINUATION", mode: "soft"    },
      IC_SPIKE_UP:   { action: "block" },
    },
    D1_EMERGING_UP: {
      IC_SPIKE_DOWN: { action: "REVERSAL",     mode: "normal"  },
      IC_DOWN:       { action: "REVERSAL",     mode: "strict"  },
      IC_NEUTRE:     { action: "EARLY",        mode: "relaxed" },
      IC_UP:         { action: "CONTINUATION", mode: "soft"    },
      IC_SPIKE_UP:   { action: "block" },
    },
    D1_FLAT: {
      IC_SPIKE_DOWN: { action: "REVERSAL",     mode: "normal"  },
      IC_DOWN:       { action: "unchanged",    mode: "normal"  },
      IC_NEUTRE:     { action: "unchanged",    mode: "normal"  },
      IC_UP:         { action: "unchanged",    mode: "normal"  },
      IC_SPIKE_UP:   { action: "block" },
    },
    D1_EMERGING_DOWN: {
      IC_SPIKE_DOWN: { action: "block" },
      IC_DOWN:       { action: "block" },
      IC_NEUTRE:     { action: "EARLY",        mode: "strict"  },
      IC_UP:         { action: "REVERSAL",     mode: "normal"  },
      IC_SPIKE_UP:   { action: "block" },
    },
    D1_FADING_DOWN: {
      IC_SPIKE_DOWN: { action: "block" },
      IC_DOWN:       { action: "block" },
      IC_NEUTRE:     { action: "block" },
      IC_UP:         { action: "REVERSAL",     mode: "strict"  },
      IC_SPIKE_UP:   { action: "block" },
    },
    D1_STRONG_DOWN: {
      IC_SPIKE_DOWN: { action: "block" },
      IC_DOWN:       { action: "block" },
      IC_NEUTRE:     { action: "block" },
      IC_UP:         { action: "REVERSAL",     mode: "strict"  },
      IC_SPIKE_UP:   { action: "block" },
    },
  };
  function resolve3D(intradayLevel, slopeH4Level, dslopeH4, side, thr = 1.0, d1State = "D1_FLAT") {
    const h4Up   = slopeH4Level === "SOFT_UP"   || slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP";
    const h4Down = slopeH4Level === "SOFT_DOWN" || slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";

    const dh4Up   = dslopeH4 !== null && dslopeH4 >=  thr;
    const dh4Down = dslopeH4 !== null && dslopeH4 <= -thr;
    const dh4OkBuy  = dh4Up || (!dh4Up && !dh4Down);
    const dh4OkSell = dh4Down || (!dh4Up && !dh4Down);

    const isUpIC   = intradayLevel === "SOFT_UP"   || intradayLevel === "STRONG_UP"   || intradayLevel === "EXPLOSIVE_UP";
    const isDownIC = intradayLevel === "SOFT_DOWN" || intradayLevel === "STRONG_DOWN" || intradayLevel === "EXPLOSIVE_DOWN";

    if (side === "BUY") {
      // IC group pour la matrice D1
      const icGroup =
        intradayLevel === "SPIKE_UP"                                                                       ? "IC_SPIKE_UP"  :
        (intradayLevel === "SOFT_UP" || intradayLevel === "STRONG_UP" || intradayLevel === "EXPLOSIVE_UP") ? "IC_UP"        :
        intradayLevel === "NEUTRE"                                                                         ? "IC_NEUTRE"    :
        (intradayLevel === "STRONG_DOWN" || intradayLevel === "SOFT_DOWN")                                 ? "IC_DOWN"      :
        "IC_SPIKE_DOWN"; // SPIKE_DOWN + EXPLOSIVE_DOWN

      const d1Entry = D1_BUY_MATRIX[d1State]?.[icGroup] ?? { action: "block" };
      if (d1Entry.action === "block") return null;

      // Spike mode préservé si SPIKE_DOWN + H4 aligné (jamais écrasé par la matrice)
      const baseIsSpike = intradayLevel === "SPIKE_DOWN" && h4Up && dh4OkBuy;

      if (d1Entry.action !== "unchanged") {
        // Type forcé par la matrice D1 × IC
        const finalMode = baseIsSpike ? "spike" : d1Entry.mode;
        return { type: d1Entry.action, ...(finalMode ? { mode: finalMode } : {}) };
      }

      // "unchanged" — logique H4 existante, mode de la matrice appliqué
      if (intradayLevel === "NEUTRE")
        return (dslopeH4 !== null && dslopeH4 >= 1.5) ? { type: "EARLY", mode: d1Entry.mode } : null;
      if (intradayLevel === "SPIKE_DOWN")
        return h4Up && dh4OkBuy ? { type: "REVERSAL", mode: "spike" } : null;
      if (!h4Up) return null;
      if (isUpIC)   return dh4OkBuy ? { type: "CONTINUATION", mode: d1Entry.mode } : null;
      if (isDownIC) return dh4OkBuy ? { type: "REVERSAL",     mode: d1Entry.mode } : null;
      return null;
    }

    if (side === "SELL") {
      // IC group pour la matrice D1 (miroir BUY)
      const icGroup =
        intradayLevel === "SPIKE_DOWN"                                                                          ? "IC_SPIKE_DOWN" :
        (intradayLevel === "SOFT_DOWN" || intradayLevel === "STRONG_DOWN" || intradayLevel === "EXPLOSIVE_DOWN") ? "IC_DOWN"       :
        intradayLevel === "NEUTRE"                                                                              ? "IC_NEUTRE"     :
        (intradayLevel === "STRONG_UP" || intradayLevel === "SOFT_UP")                                         ? "IC_UP"         :
        "IC_SPIKE_UP"; // SPIKE_UP + EXPLOSIVE_UP

      const D1_SELL_MATRIX = {
        D1_STRONG_DOWN: {
          IC_SPIKE_UP:   { action: "REVERSAL",     mode: "relaxed" },
          IC_UP:         { action: "REVERSAL",     mode: "soft"    },
          IC_NEUTRE:     { action: "unchanged",    mode: "normal"  },
          IC_DOWN:       { action: "CONTINUATION", mode: "relaxed" },
          IC_SPIKE_DOWN: { action: "block" },
        },
        D1_FADING_DOWN: {
          IC_SPIKE_UP:   { action: "REVERSAL",     mode: "soft"    },
          IC_UP:         { action: "REVERSAL",     mode: "normal"  },
          IC_NEUTRE:     { action: "unchanged",    mode: "normal"  },
          IC_DOWN:       { action: "CONTINUATION", mode: "soft"    },
          IC_SPIKE_DOWN: { action: "block" },
        },
        D1_EMERGING_DOWN: {
          IC_SPIKE_UP:   { action: "REVERSAL",     mode: "normal"  },
          IC_UP:         { action: "REVERSAL",     mode: "strict"  },
          IC_NEUTRE:     { action: "EARLY",        mode: "relaxed" },
          IC_DOWN:       { action: "CONTINUATION", mode: "soft"    },
          IC_SPIKE_DOWN: { action: "block" },
        },
        D1_FLAT: {
          IC_SPIKE_UP:   { action: "REVERSAL",     mode: "normal"  },
          IC_UP:         { action: "unchanged",    mode: "normal"  },
          IC_NEUTRE:     { action: "unchanged",    mode: "normal"  },
          IC_DOWN:       { action: "unchanged",    mode: "normal"  },
          IC_SPIKE_DOWN: { action: "block" },
        },
        D1_EMERGING_UP: {
          IC_SPIKE_UP:   { action: "block" },
          IC_UP:         { action: "block" },
          IC_NEUTRE:     { action: "EARLY",        mode: "strict"  },
          IC_DOWN:       { action: "REVERSAL",     mode: "normal"  },
          IC_SPIKE_DOWN: { action: "block" },
        },
        D1_FADING_UP: {
          IC_SPIKE_UP:   { action: "block" },
          IC_UP:         { action: "block" },
          IC_NEUTRE:     { action: "block" },
          IC_DOWN:       { action: "REVERSAL",     mode: "strict"  },
          IC_SPIKE_DOWN: { action: "block" },
        },
        D1_STRONG_UP: {
          IC_SPIKE_UP:   { action: "block" },
          IC_UP:         { action: "block" },
          IC_NEUTRE:     { action: "block" },
          IC_DOWN:       { action: "REVERSAL",     mode: "strict"  },
          IC_SPIKE_DOWN: { action: "block" },
        },
      };

      const d1Entry = D1_SELL_MATRIX[d1State]?.[icGroup] ?? { action: "block" };
      if (d1Entry.action === "block") return null;

      // Spike mode préservé si SPIKE_UP + H4 aligné (jamais écrasé par la matrice)
      const baseIsSpike = intradayLevel === "SPIKE_UP" && h4Down && dh4OkSell;

      if (d1Entry.action !== "unchanged") {
        // Type forcé par la matrice D1 × IC
        const finalMode = baseIsSpike ? "spike" : d1Entry.mode;
        return { type: d1Entry.action, ...(finalMode ? { mode: finalMode } : {}) };
      }

      // "unchanged" — logique H4 existante, mode de la matrice appliqué
      if (intradayLevel === "NEUTRE")
        return (dslopeH4 !== null && dslopeH4 <= -1.5) ? { type: "EARLY", mode: d1Entry.mode } : null;
      if (intradayLevel === "SPIKE_UP")
        return h4Down && dh4OkSell ? { type: "REVERSAL", mode: "spike" } : null;
      if (!h4Down) return null;
      if (isDownIC) return dh4OkSell ? { type: "CONTINUATION", mode: d1Entry.mode } : null;
      if (isUpIC)   return dh4OkSell ? { type: "REVERSAL",     mode: d1Entry.mode } : null;
      return null;
    }

    return null;
  }

  // ============================================================================
  // MODE — qualité du setup (IC × slopeH4 × dslopeH4)
  //   conf=3 → relaxed | conf=2 → soft | conf=1 → normal | conf=0 → strict
  // ============================================================================
  const STRONG_UP_LEVELS   = ["STRONG_UP","EXPLOSIVE_UP","SPIKE_UP"];
  const STRONG_DOWN_LEVELS = ["STRONG_DOWN","EXPLOSIVE_DOWN","SPIKE_DOWN"];

  function computeMode(type, side, intradayLevel, slopeH4Level, dslopeH4, thr) {
    const dh4Confirm = side === "BUY"
      ? (dslopeH4 !== null && dslopeH4 >= thr)
      : (dslopeH4 !== null && dslopeH4 <= -thr);

    const icStrong = side === "BUY"
      ? (type === "REVERSAL" ? STRONG_DOWN_LEVELS.includes(intradayLevel) : STRONG_UP_LEVELS.includes(intradayLevel))
      : (type === "REVERSAL" ? STRONG_UP_LEVELS.includes(intradayLevel)   : STRONG_DOWN_LEVELS.includes(intradayLevel));

    const h4Strong = side === "BUY"
      ? (slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP")
      : (slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN");

    const conf = [icStrong, h4Strong, dh4Confirm].filter(Boolean).length;
    if (conf === 3) return "relaxed";
    if (conf === 2) return "soft";
    if (conf >= 1)  return "normal";
    return "strict";
  }

  // ============================================================================
  // GATE PRESETS — spike > relaxed > soft > normal > strict
  // drsi / drsiRev = seuils sur drsi_h1_s0
  // antiSpike     = seuil drsiSafe par asset (slopeCfg.antiSpikeH1S0)
  // ============================================================================
  function buildGates(side, mode, type, antiSpike) {
    const isRev = (type === "REVERSAL");

    if (type === "EARLY") {
      return {
        dslopeMin: 0.3, dslopeRev: 0.1, zRev: 99,
        dslopeThr: 0.3,
        z3050: 1.8, z5070: 1.8,
        drsiH4Sum: null,
        slopeH1Min:  0.5,   // slope_h1_s0 dans le sens du trade
        dslopeH1Min: 0.3,   // dslope_h1 confirme accélération H1
        antiSpike,
      };
    }

    if (mode === "spike") {
      return {
        dslopeMin: 0, dslopeRev: 0, zRev: 99,
        dslopeThr: 0,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      };
    }

    if (mode === "relaxed") {
      return isRev ? {
        dslopeMin: 0, dslopeRev: 0, zRev: 99,
        dslopeThr: 0,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      } : {
        dslopeMin: 0, dslopeRev: 0, zRev: 99,
        dslopeThr: 0,
        z3050: 2.3, z5070: 2.3,
        drsiH4Sum: null,
        antiSpike,
      };
    }

    if (mode === "soft") {
      return isRev ? {
        dslopeMin: 0.2, dslopeRev: 0.1, zRev: 99,
        dslopeThr: 0.2,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      } : {
        dslopeMin: 0.2, dslopeRev: 0.1, zRev: 99,
        dslopeThr: 0.2,
        z3050: 1.8, z5070: 1.8,
        drsiH4Sum: 0,
        antiSpike,
      };
    }

    if (mode === "normal") {
      return isRev ? {
        dslopeMin: 0.3, dslopeRev: 0.2, zRev: 99,
        dslopeThr: 0.3,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      } : {
        dslopeMin: 0.3, dslopeRev: 0.2, zRev: 99,
        dslopeThr: 0.3,
        z3050: 1.8, z5070: 1.8,
        drsiH4Sum: 0,
        antiSpike,
      };
    }

    // STRICT
    return isRev ? {
      dslopeMin: 0.5, dslopeRev: 0.3, zRev: 99,
      dslopeThr: 0.5,
      z3050: 99, z5070: 99,
      drsiH4Sum: null,
      antiSpike,
    } : {
      dslopeMin: 0.5, dslopeRev: 0.3, zRev: 99,
      dslopeThr: 0.5,
      z3050: 1.6, z5070: 1.6,
      drsiH4Sum: 0,
      antiSpike,
    };
  }

  // ============================================================================
  // GATE ACCÉLÉRATION — drsi_h1_s0 (H1) + dslopeH4 (H4) vs percentiles calibrés
  // ============================================================================
  function accelContextGate(side, type, intradayLevel, drsi_h1_s0, dslopeH4, symbol) {
    const cfg = getDrsiConfig(symbol, intradayLevel);

    if (cfg?.h1) {
      const isRev = (type === "REVERSAL" || type === "EARLY");
      const h1 = cfg.h1;
      const h4 = cfg.h4;

      if (side === "BUY") {
        const h1Thr = isRev ? h1.p50 : h1.p25;
        if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Thr) return false;
        if (h4 && dslopeH4 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p25;
          if (dslopeH4 < h4Thr) return false;
        }
      } else {
        const h1Thr = isRev ? h1.p50 : h1.p75;
        if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Thr) return false;
        if (h4 && dslopeH4 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p75;
          if (dslopeH4 > h4Thr) return false;
        }
      }
      return true;
    }

    // Fallback seuils fixes
    if (side === "SELL") {
      const SELL_FLOOR = {
        SOFT_UP:[-0.20,-0.10], STRONG_UP:[-0.50,-0.30], EXPLOSIVE_UP:[-1.00,-0.50],
        NEUTRE:[-0.40,0], SOFT_DOWN:[-0.35,0], STRONG_DOWN:[-0.25,0], EXPLOSIVE_DOWN:[-0.20,0],
      };
      const [h1Min, h4Min] = SELL_FLOOR[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Min) return false;
      if (dslopeH4   !== null && dslopeH4   > h4Min) return false;
    } else {
      const BUY_CEIL = {
        SOFT_DOWN:[0.20,0.10], STRONG_DOWN:[0.50,0.30], EXPLOSIVE_DOWN:[1.00,0.50],
        NEUTRE:[0.40,0], SOFT_UP:[0.35,0], STRONG_UP:[0.25,0], EXPLOSIVE_UP:[0.20,0],
      };
      const [h1Max, h4Max] = BUY_CEIL[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Max) return false;
      if (dslopeH4   !== null && dslopeH4   < h4Max) return false;
    }
    return true;
  }

  // ============================================================================
  // SPACING / DEDUPE
  // ============================================================================
  function minutesBetween(tsA, tsB) {
    if (!tsA || !tsB) return null;
    const toDate = (ts) => {
      const [d, t] = String(ts).split(" ");
      if (!d || !t) return null;
      const dt = new Date(`${d.replace(/\./g, "-")}T${t}:00`);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const a = toDate(tsA), b = toDate(tsB);
    if (!a || !b) return null;
    return Math.abs((a.getTime() - b.getTime()) / 60000);
  }

  function makeKey(opp) {
    return [opp?.symbol ?? "", opp?.route ?? "", opp?.side ?? ""].join("|");
  }

  function applyDedupeAndSpacing(opps, cfg) {
    const out = [];
    const seen = new Map();
    const minSpacingMin = num(cfg?.minSignalSpacingMinutes) ?? 0;
    const maxSignals    = num(cfg?.maxSignals) ?? Infinity;

    for (const opp of opps) {
      if (out.length >= maxSignals) break;
      const key = makeKey(opp);
      const lastTs = seen.get(key);
      if (minSpacingMin > 0 && lastTs) {
        const dt = minutesBetween(opp.timestamp, lastTs);
        if (dt !== null && dt < minSpacingMin) continue;
      }
      seen.set(key, opp.timestamp);
      out.push(opp);
    }
    return out;
  }

  // ============================================================================
  // NIVEAU 2 — BUY ROUTES
  // dslope_h1   = momentum live H1
  // slope_h1_s0 = orientation H1 courante (EXHAUSTION + EARLY)
  // g.antiSpike = seuil |dslope_h1| max pour zones [28-72]
  // ============================================================================
  function matchBuyRoute(rsi_h1_s0, dslope_h1, zscore_h1_s0, slope_h1_s0, range_ratio_h1, g) {
    if (rsi_h1_s0 === null || dslope_h1 === null || zscore_h1_s0 === null) return null;

    const rsi    = rsi_h1_s0;
    const zscore = zscore_h1_s0;

    // Late entry gate — bougie H1 courante trop étendue vs ATR
    const LATE_ENTRY_THR = 0.8;
    const isLateEntry = range_ratio_h1 !== null && range_ratio_h1 > LATE_ENTRY_THR;

    // EARLY : slope_h1_s0 + dslope_h1 requis
    const slopeOk  = g.slopeH1Min  == null || (slope_h1_s0 !== null && slope_h1_s0 >  g.slopeH1Min);
    const dslopeOk = g.dslopeH1Min == null || (dslope_h1   !== null && dslope_h1   >  g.dslopeH1Min);

    // ── EXHAUSTION (priorité haute) ──────────────────────────────────────────
    // Tendance baissière installée (slope_h1_s0 < -0.5) qui s'épuise
    // (dslope_h1 > 1.5 = forte accélération en sens inverse)

    // BUY [0-28] EXHAUSTION
    if (rsi < 28
     && slope_h1_s0 !== null && slope_h1_s0 < -0.5
     && dslope_h1 > 1.5
     && zscore < g.zRev)
      return { route: "BUY-[0-28]-EXHAUSTION", side: "BUY", modeOverride: "relaxed" };

    // BUY [28-50] EXHAUSTION
    if (rsi >= 28 && rsi < 50
     && slope_h1_s0 !== null && slope_h1_s0 < -0.5
     && dslope_h1 > 1.5
     && zscore < g.z3050)
      return { route: "BUY-[28-50]-EXHAUSTION", side: "BUY", modeOverride: "normal" };

    // BUY [50-72] EXHAUSTION
    if (rsi >= 50 && rsi < 72
     && slope_h1_s0 !== null && slope_h1_s0 < -0.5
     && dslope_h1 > 1.5
     && zscore < g.z5070)
      return { route: "BUY-[50-72]-EXHAUSTION", side: "BUY", modeOverride: "strict" };

    // ── CONT-RESUME (après EXHAUSTION, avant routes normales) ────────────────
    // Reprise continuation H1 dans le sens du trade — dslope_h1 seul suffit,
    // pas de contrainte slope_h1_s0.

    // BUY [28-50] CONT-RESUME — reprise continuation, H1 repart
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && dslope_h1 > 1.5
     && zscore < g.z3050)
      return { route: "BUY-[28-50]-CONT-RESUME", side: "BUY", modeOverride: "relaxed" };

    // BUY [50-72] CONT-RESUME
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && dslope_h1 > 1.5
     && zscore < g.z5070)
      return { route: "BUY-[50-72]-CONT-RESUME", side: "BUY", modeOverride: "soft" };

    // ── ROUTES NORMALES ──────────────────────────────────────────────────────

    // BUY [0-28] — extreme oversold
    if (rsi < 28
     && dslope_h1 > g.dslopeMin
     && dslope_h1 > g.dslopeRev
     && zscore < g.zRev
     && slopeOk && dslopeOk)
      return { route: "BUY-[0-28]", side: "BUY" };

    // BUY [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && zscore < g.z3050
     && dslope_h1 > g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "BUY-[28-50]", side: "BUY" };

    // BUY [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && zscore < g.z5070
     && dslope_h1 > g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "BUY-[50-72]", side: "BUY" };

    return null;
  }

  // ============================================================================
  // SELL ROUTES (miroir)
  // ============================================================================
  function matchSellRoute(rsi_h1_s0, dslope_h1, zscore_h1_s0, slope_h1_s0, range_ratio_h1, g) {
    if (rsi_h1_s0 === null || dslope_h1 === null || zscore_h1_s0 === null) return null;

    const rsi    = rsi_h1_s0;
    const zscore = zscore_h1_s0;

    // Late entry gate — bougie H1 courante trop étendue vs ATR
    const LATE_ENTRY_THR = 0.8;
    const isLateEntry = range_ratio_h1 !== null && range_ratio_h1 > LATE_ENTRY_THR;

    // EARLY : slope_h1_s0 + dslope_h1 requis
    const slopeOk  = g.slopeH1Min  == null || (slope_h1_s0 !== null && slope_h1_s0 < -g.slopeH1Min);
    const dslopeOk = g.dslopeH1Min == null || (dslope_h1   !== null && dslope_h1   < -g.dslopeH1Min);

    // ── EXHAUSTION (priorité haute) ──────────────────────────────────────────
    // Tendance haussière installée (slope_h1_s0 > 0.5) qui s'épuise
    // (dslope_h1 < -1.5 = forte accélération en sens inverse)

    // SELL [72-100] EXHAUSTION
    if (rsi >= 72
     && slope_h1_s0 !== null && slope_h1_s0 > 0.5
     && dslope_h1 < -1.5
     && zscore > -g.zRev)
      return { route: "SELL-[72-100]-EXHAUSTION", side: "SELL", modeOverride: "relaxed" };

    // SELL [50-72] EXHAUSTION
    if (rsi >= 50 && rsi < 72
     && slope_h1_s0 !== null && slope_h1_s0 > 0.5
     && dslope_h1 < -1.5
     && zscore > -g.z3050)
      return { route: "SELL-[50-72]-EXHAUSTION", side: "SELL", modeOverride: "normal" };

    // SELL [28-50] EXHAUSTION
    if (rsi >= 28 && rsi < 50
     && slope_h1_s0 !== null && slope_h1_s0 > 0.5
     && dslope_h1 < -1.5
     && zscore > -g.z5070)
      return { route: "SELL-[28-50]-EXHAUSTION", side: "SELL", modeOverride: "strict" };

    // ── CONT-RESUME (après EXHAUSTION, avant routes normales) ────────────────
    // Reprise continuation baissière H1 — dslope_h1 seul suffit,
    // pas de contrainte slope_h1_s0.

    // SELL [50-72] CONT-RESUME — reprise continuation baissière
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && dslope_h1 < -1.5
     && zscore > -g.z3050)
      return { route: "SELL-[50-72]-CONT-RESUME", side: "SELL", modeOverride: "relaxed" };

    // SELL [28-50] CONT-RESUME
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && dslope_h1 < -1.5
     && zscore > -g.z5070)
      return { route: "SELL-[28-50]-CONT-RESUME", side: "SELL", modeOverride: "soft" };

    // SELL [0-28] CONT-RESUME — continuation baissière extrême (ex: GBPJPY rsi<28)
    if (rsi < 28
     && !isLateEntry
     && dslope_h1 < -1.5
     && zscore > -g.z5070)
      return { route: "SELL-[0-28]-CONT-RESUME", side: "SELL", modeOverride: "strict" };

    // ── ROUTES NORMALES ──────────────────────────────────────────────────────

    // SELL [72-100] — extreme overbought
    if (rsi >= 72
     && dslope_h1 < -g.dslopeMin
     && dslope_h1 < -g.dslopeRev
     && zscore > -g.zRev
     && slopeOk && dslopeOk)
      return { route: "SELL-[72-100]", side: "SELL" };

    // SELL [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && zscore > -g.z3050
     && dslope_h1 < -g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "SELL-[50-72]", side: "SELL" };

    // SELL [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && zscore > -g.z5070
     && dslope_h1 < -g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "SELL-[28-50]", side: "SELL" };

    return null;
  }

  // ============================================================================
  // ROUTE => SIGNAL PHASE
  // ============================================================================
  const ROUTE_PHASE = {
    "BUY-[0-28]":    "EXTREME_LOW",
    "BUY-[28-50]":   "LOW_MID",
    "BUY-[50-72]":   "MID_HIGH",
    "SELL-[72-100]": "EXTREME_HIGH",
    "SELL-[50-72]":  "MID_HIGH",
    "SELL-[28-50]":  "LOW_MID",
    // EXHAUSTION
    "BUY-[0-28]-EXHAUSTION":    "EXTREME_LOW",
    "BUY-[28-50]-EXHAUSTION":   "LOW_MID",
    "BUY-[50-72]-EXHAUSTION":   "MID_HIGH",
    "SELL-[72-100]-EXHAUSTION": "EXTREME_HIGH",
    "SELL-[50-72]-EXHAUSTION":  "MID_HIGH",
    "SELL-[28-50]-EXHAUSTION":  "LOW_MID",
    // CONT-RESUME
    "BUY-[28-50]-CONT-RESUME":  "LOW_MID",
    "BUY-[50-72]-CONT-RESUME":  "MID_HIGH",
    "SELL-[50-72]-CONT-RESUME": "MID_HIGH",
    "SELL-[28-50]-CONT-RESUME": "LOW_MID",
    "SELL-[0-28]-CONT-RESUME":  "EXTREME_LOW",
  };

  // ============================================================================
  // MAIN
  // ============================================================================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const TOP_CFG = {
      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals:              num(opts?.maxSignals) ?? Infinity,
      scoreMin: num(opts?.scoreMin) ?? 0,
      debug: Boolean(opts?.debug),
    };

    let opps = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const symbol   = row?.symbol;
      if (!symbol) continue;

      // Gate horaire — filtre marché fermé (inclus symbolOverrides ex: WHEAT)
      const marketKey = resolveMarket(row?.assetclass);
      if (!GlobalMarketHours.check(marketKey, new Date(), symbol).allowed) continue;

      const riskCfg  = getRiskConfig(symbol);
      const intCfg   = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
      const slopeCfg = getSlopeConfig(symbol);
      const drsiH4Thr     = slopeCfg.dslopeH4Thr ?? 0.3;
      const antiSpikeH1S0 = num(slopeCfg?.antiSpikeH1S0) ?? 8;
      const atrH1Cap      = num(riskCfg?.atrH1Cap);

      // Gate ATR — filtre volatilité extrême (> 4x cap)
      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 4 * atrH1Cap) continue;

      // Anti-spike AVANT resolve3D
      // drsi_h1    = bougie H1 précédente (fermée, >1h) → ne bloque pas
      // drsi_h1_s0 = bougie H1 courante (en cours)      → bloque si spike
      const _drsi_h1_s0 = num(row?.drsi_h1_s0);
      if (_drsi_h1_s0 !== null && Math.abs(_drsi_h1_s0) >= antiSpikeH1S0) continue;

      const intra = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      const slope_h4_raw = num(row?.slope_h4_s0) !== null
        ? num(row.slope_h4_s0) : num(row?.slope_h4);
      const slopeH4Level = getSlopeLevel(slope_h4_raw, symbol);

      const _sh4s0  = num(row?.slope_h4_s0);
      const _sh4s1  = num(row?.slope_h4);
      const dslopeH4 = (_sh4s0 !== null && _sh4s1 !== null) ? _sh4s0 - _sh4s1 : null;

      // D1 state — module la résolution BUY + SELL (miroir)
      // dslope_d1_live = slope_d1_s0 - slope_d1 (s0 vs s1 fermée)
      // La colonne dslope_d1_s0 n'existe pas dans le CSV
      // Même approche que dslope_h1_live
      const _sd1s0          = num(row?.slope_d1_s0);
      const _slope_d1       = num(row?.slope_d1);
      const _dslope_d1_live = (_sd1s0 !== null && _slope_d1 !== null)
        ? _sd1s0 - _slope_d1
        : null;
      const d1State = (_sd1s0 !== null && _dslope_d1_live !== null)
        ? getD1State(_sd1s0, _dslope_d1_live)
        : "D1_FLAT";

      const range_ratio_h1 = num(row?.range_ratio_h1);

      // dslope_h1 live = slope_h1_s0 - slope_h1 (s0 vs s1 fermée)
      // Plus réactif que la colonne CSV (s1-s2 = deux bougies fermées)
      // Avance le timing d'entrée d'une bougie H1
      const _slope_h1_s0      = num(row?.slope_h1_s0);
      const _slope_h1         = num(row?.slope_h1);
      const _dslope_h1_live   = (_slope_h1_s0 !== null && _slope_h1 !== null)
        ? _slope_h1_s0 - _slope_h1
        : null;
      if (_dslope_h1_live !== null && Math.abs(_dslope_h1_live) >= antiSpikeH1S0) continue;

      const args = [
        num(row?.rsi_h1_s0),
        _dslope_h1_live,        // ← live au lieu du CSV
        num(row?.zscore_h1_s0),
        _slope_h1_s0,
        range_ratio_h1,
      ];

      let match = null;
      let signalType = null;
      let signalMode = null;

      const buyRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "BUY", 1.0, d1State);
      if (buyRes) {
        const buyMode = buyRes.mode ?? computeMode(
          buyRes.type, "BUY", intradayLevel, slopeH4Level, dslopeH4, drsiH4Thr);
        const gBuy = buildGates("BUY", buyMode, buyRes.type, antiSpikeH1S0);
        match = matchBuyRoute(...args, gBuy);
        if (match) { signalType = buyRes.type; signalMode = match.modeOverride ?? buyMode; }
      }

      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "SELL", 1.0, d1State);
        if (sellRes) {
          const sellMode = sellRes.mode ?? computeMode(
            sellRes.type, "SELL", intradayLevel, slopeH4Level, dslopeH4, drsiH4Thr);
          const gSell = buildGates("SELL", sellMode, sellRes.type, antiSpikeH1S0);
          match = matchSellRoute(...args, gSell);
          if (match) { signalType = sellRes.type; signalMode = match.modeOverride ?? sellMode; }
        }
      }

      if (!match) continue;

      if (TOP_CFG.debug) {
        console.log(`[D1] ${symbol} d1State=${d1State} slope_d1_s0=${_sd1s0?.toFixed(2)} dslope_d1_live=${_dslope_d1_live?.toFixed(2)} (csv=${num(row?.dslope_d1)?.toFixed(2)})`);
        if (match.route?.includes("EXHAUSTION")) {
          console.log(`[EXHAUSTION] ${symbol} route=${match.route} mode=${signalMode} slope_h1_s0=${_slope_h1_s0?.toFixed(2)} dslope_h1_live=${_dslope_h1_live?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)}`);
        }
        if (match.route?.includes("CONT-RESUME")) {
          console.log(`[CONT-RESUME] ${symbol} route=${match.route} mode=${signalMode} dslope_h1_live=${_dslope_h1_live?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)} zscore_h1_s0=${num(row?.zscore_h1_s0)?.toFixed(2)}`);
        }
        if (range_ratio_h1 !== null && range_ratio_h1 > 0.8) {
          console.log(`[LATE_ENTRY] ${symbol} range_ratio_h1=${range_ratio_h1?.toFixed(2)} isLateEntry=true`);
        }
      }

      if (signalMode !== "spike" && !accelContextGate(match.side, signalType, intradayLevel, _dslope_h1_live, dslopeH4, symbol)) continue;

      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const scoreRow = {
        symbol,
        type: signalType, side: match.side,
        slope_h1:             num(row?.slope_h1),
        dslope_h1:            _dslope_h1_live,
        zscore_h1:            num(row?.zscore_h1),
        rsi_h1:               num(row?.rsi_h1),
        rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
        zscore_h1_min3:       num(row?.zscore_h1_min3),
        zscore_h1_max3:       num(row?.zscore_h1_max3),
        intraday_change:      intra,
        atr_m15:              num(row?.atr_m15),
        close:                num(row?.close),
      };

      let scored;
      if      (signalType === "REVERSAL"     && match.side === "BUY")  scored = scoreReversalBuy(scoreRow);
      else if (signalType === "REVERSAL"     && match.side === "SELL") scored = scoreReversalSell(scoreRow);
      else if (signalType === "CONTINUATION" && match.side === "BUY")  scored = scoreContinuationBuy(scoreRow);
      else if (signalType === "CONTINUATION" && match.side === "SELL") scored = scoreContinuationSell(scoreRow);
      else scored = { total: signalType === "EARLY" ? 70 : 50, breakdown: {} };

      const score     = Math.round(scored.total ?? 0);
      const breakdown = scored.breakdown ?? {};

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type:        signalType,
        mode:        signalMode,
        regime:      `${signalType}_${match.side}`,
        route:       match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine:      "V8R",
        index:       i,
        timestamp:   row?.timestamp,
        symbol,
        side:        match.side,
        signalType,
        score,
        breakdown,
        intradayLevel,
        slopeH4Level,
        d1State,

        // D1
        slope_d1_s0:    _sd1s0,
        dslope_d1_live: _dslope_d1_live,   // live = slope_d1_s0 - slope_d1
        dslope_d1_csv:  num(row?.dslope_d1), // original CSV pour debug

        // H4
        slope_h4:    num(row?.slope_h4),
        dslope_h4:   num(row?.dslope_h4),
        drsi_h4:     num(row?.drsi_h4),
        rsi_h4_s0:   num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        dslopeH4:    dslopeH4,

        // H1 s1
        rsi_h1:         num(row?.rsi_h1),
        slope_h1:       num(row?.slope_h1),
        dslope_h1:      _dslope_h1_live,      // live = slope_h1_s0 - slope_h1
        dslope_h1_csv:  num(row?.dslope_h1),  // original CSV pour debug
        drsi_h1:        num(row?.drsi_h1),
        zscore_h1:      num(row?.zscore_h1),
        dz_h1:          num(row?.dz_h1),
        atr_h1:         num(row?.atr_h1),
        zscore_h1_min3: num(row?.zscore_h1_min3),
        zscore_h1_max3: num(row?.zscore_h1_max3),

        // H1 s0
        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        drsi_h1_s0:   num(row?.drsi_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        // M15
        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        // M5 s1
        rsi_m5:    num(row?.rsi_m5),
        slope_m5:  num(row?.slope_m5),
        dslope_m5: num(row?.dslope_m5),
        drsi_m5:   num(row?.drsi_m5),
        zscore_m5: num(row?.zscore_m5),

        // M5 s0
        rsi_m5_s0:    num(row?.rsi_m5_s0),
        slope_m5_s0:  num(row?.slope_m5_s0),
        drsi_m5_s0:   num(row?.drsi_m5_s0),
        zscore_m5_s0: num(row?.zscore_m5_s0),

        close:           num(row?.close),
        intraday_change: intra,
        exhaustion:      match.route?.includes("EXHAUSTION")   ?? false,
        contResume:      match.route?.includes("CONT-RESUME")  ?? false,
        range_ratio_h1,
      });
    }

    opps.sort((a, b) => {
      const sa = a.score ?? 0, sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    // ============================================================================
    // DEBUG PIPELINE
    // ============================================================================
    if (TOP_CFG.debug) {
      let cTotal = 0, cAntiSpike = 0, cResolve = 0, cDrsiGate = 0, cReversalKill = 0, cScore = 0, cFinal = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sym = row?.symbol;
        if (!sym) continue;
        cTotal++;

        const _riskCfg     = getRiskConfig(sym);
        const _intCfg      = INTRADAY_CONFIG[sym] ?? INTRADAY_CONFIG.default;
        const _slopeCfg    = getSlopeConfig(sym);
        const _drsiH4Thr   = _slopeCfg.dslopeH4Thr ?? 0.3;
        const _antiSpike   = num(_slopeCfg?.antiSpikeH1S0) ?? 8;

        const _drsi_h1    = num(row?.drsi_h1);
        const _drsi_h1_s0 = num(row?.drsi_h1_s0);
        if (_drsi_h1    !== null && Math.abs(_drsi_h1)    >= 8)          continue;
        if (_drsi_h1_s0 !== null && Math.abs(_drsi_h1_s0) >= _antiSpike) continue;
        cAntiSpike++;

        const intra         = num(row?.intraday_change);
        const intradayLevel = getIntradayLevel(intra, _intCfg);
        const slope_h4_raw  = num(row?.slope_h4_s0) !== null ? num(row.slope_h4_s0) : num(row?.slope_h4);
        const slopeH4Level  = getSlopeLevel(slope_h4_raw, sym);
        const _ds0 = num(row?.slope_h4_s0);
        const _ds1 = num(row?.slope_h4);
        const _dsh4 = (_ds0 !== null && _ds1 !== null) ? _ds0 - _ds1 : null;

        const _dbg_sd1s0    = num(row?.slope_d1_s0);
        const _dbg_slope_d1 = num(row?.slope_d1);
        const _dbg_dslope_d1 = (_dbg_sd1s0 !== null && _dbg_slope_d1 !== null)
          ? _dbg_sd1s0 - _dbg_slope_d1
          : null;
        const _dbg_d1State = (_dbg_sd1s0 !== null && _dbg_dslope_d1 !== null)
          ? getD1State(_dbg_sd1s0, _dbg_dslope_d1) : "D1_FLAT";

        const buyRes  = resolve3D(intradayLevel, slopeH4Level, _dsh4, "BUY",  1.0, _dbg_d1State);
        const sellRes = resolve3D(intradayLevel, slopeH4Level, _dsh4, "SELL", 1.0, _dbg_d1State);
        if (!buyRes && !sellRes) continue;
        cResolve++;

        const activeRes   = buyRes ?? sellRes;
        const activeSide  = buyRes ? "BUY" : "SELL";
        const activeMode  = activeRes.mode ?? computeMode(activeRes.type, activeSide, intradayLevel, slopeH4Level, _dsh4, _drsiH4Thr);
        if (activeMode !== "spike" && !accelContextGate(activeSide, activeRes.type, intradayLevel, _dslope_h1_dbg, _dsh4, sym)) continue;
        cDrsiGate++;

        if (activeRes.type === "REVERSAL" && _riskCfg.reversalEnabled === false) continue;
        cReversalKill++;

        const score = activeRes.type === "REVERSAL" ? 80
                    : activeRes.type === "EARLY"    ? 70
                    : Math.max(0, Math.round(
                        Math.abs(num(row?.slope_h1) ?? 0) * 50 +
                        Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
                      ));
        if (score < TOP_CFG.scoreMin) continue;
        cScore++;

        const _slope_h1_s0_dbg  = num(row?.slope_h1_s0);
        const _slope_h1_dbg     = num(row?.slope_h1);
        const _dslope_h1_dbg    = (_slope_h1_s0_dbg !== null && _slope_h1_dbg !== null)
          ? _slope_h1_s0_dbg - _slope_h1_dbg
          : null;

        const _dbg_args = [
          num(row?.rsi_h1_s0),
          _dslope_h1_dbg,
          num(row?.zscore_h1_s0),
          _slope_h1_s0_dbg,
          num(row?.range_ratio_h1),
        ];
        const g = buildGates(activeSide, activeMode, activeRes.type, _antiSpike);
        const routeMatch = activeSide === "BUY"
          ? matchBuyRoute(..._dbg_args, g)
          : matchSellRoute(..._dbg_args, g);

        if (!routeMatch) {
          const rsi      = num(row?.rsi_h1_s0);
          const zscore   = num(row?.zscore_h1_s0);
          const zone     = rsi < 28 ? "0-28" : rsi < 50 ? "28-50" : rsi < 72 ? "50-72" : "72+";
          console.log(`[g7 FAIL] mode=${activeMode} type=${activeRes.type} side=${activeSide} zone=${zone} | rsi=${rsi?.toFixed(1)} z=${zscore?.toFixed(2)} dslope_h1_live=${_dslope_h1_dbg?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)}`);
          continue;
        }

        cFinal++;
      }

      console.info("TOPOPP V8R", { total_rows: rows.length, signals: opps.length });

      console.table({
        "0 — total rows":         { count: cTotal,        pct: "100%" },
        "1 — after anti-spike":   { count: cAntiSpike,    pct: ((cAntiSpike/cTotal)*100).toFixed(1)+"%" },
        "2 — after resolve3D":    { count: cResolve,      pct: ((cResolve/cAntiSpike)*100).toFixed(1)+"%" },
        "3 — after drsiGate":     { count: cDrsiGate,     pct: ((cDrsiGate/cResolve)*100).toFixed(1)+"%" },
        "4 — after reversalKill": { count: cReversalKill, pct: ((cReversalKill/cDrsiGate)*100).toFixed(1)+"%" },
        "5 — after scoreMin":     { count: cScore,        pct: ((cScore/cReversalKill)*100).toFixed(1)+"%" },
        "6 — after matchRoute":   { count: cFinal,        pct: ((cFinal/cScore)*100).toFixed(1)+"%" },
      });

      const resolveBreakdown = {
        CONTINUATION_BUY: 0, CONTINUATION_SELL: 0,
        REVERSAL_BUY: 0,     REVERSAL_SELL: 0,
        EARLY_BUY: 0,        EARLY_SELL: 0,
      };
      for (const row of rows) {
        const _sym  = row?.symbol;
        const _ic   = INTRADAY_CONFIG[_sym] ?? INTRADAY_CONFIG.default;
        const _sc   = getSlopeConfig(_sym);
        const _thr  = _sc.dslopeH4Thr ?? 0.3;
        const intra = num(row?.intraday_change);
        const il  = getIntradayLevel(intra, _ic);
        const sh4  = getSlopeLevel(num(row?.slope_h4_s0) ?? num(row?.slope_h4), _sym);
        const _s0  = num(row?.slope_h4_s0), _s1 = num(row?.slope_h4);
        const dsh4 = (_s0 !== null && _s1 !== null) ? _s0 - _s1 : null;
        const _bk_sd1   = num(row?.slope_d1_s0);
        const _bk_sl_d1 = num(row?.slope_d1);
        const _bk_dsd1  = (_bk_sd1 !== null && _bk_sl_d1 !== null) ? _bk_sd1 - _bk_sl_d1 : null;
        const _bk_d1    = (_bk_sd1 !== null && _bk_dsd1 !== null) ? getD1State(_bk_sd1, _bk_dsd1) : "D1_FLAT";
        const br  = resolve3D(il, sh4, dsh4, "BUY",  1.0, _bk_d1);
        const sr  = resolve3D(il, sh4, dsh4, "SELL", 1.0, _bk_d1);
        if (br) resolveBreakdown[`${br.type}_BUY`]  = (resolveBreakdown[`${br.type}_BUY`]  ?? 0) + 1;
        if (sr) resolveBreakdown[`${sr.type}_SELL`] = (resolveBreakdown[`${sr.type}_SELL`] ?? 0) + 1;
      }
      console.log("resolve3D breakdown:", resolveBreakdown);
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_V8R;