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
  // 3D RESOLUTION : intradayLevel x slopeH4Level x dslopeH4 => { type, mode }
  // dslopeH4 = slope_h4_s0 - slope_h4 (accélération H4 live)
  // H1 → timing seulement (route RSI Gate 2)
  // ============================================================================
  function resolve3D(intradayLevel, slopeH4Level, dslopeH4, side, thr = 0.5) {
    const h4Up   = slopeH4Level === "SOFT_UP"   || slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP";
    const h4Down = slopeH4Level === "SOFT_DOWN" || slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";

    const dh4Up   = dslopeH4 !== null && dslopeH4 >=  thr;
    const dh4Down = dslopeH4 !== null && dslopeH4 <= -thr;
    const dh4OkBuy  = dh4Up || (!dh4Up && !dh4Down);
    const dh4OkSell = dh4Down || (!dh4Up && !dh4Down);

    const isUpIC   = intradayLevel === "SOFT_UP"   || intradayLevel === "STRONG_UP"   || intradayLevel === "EXPLOSIVE_UP";
    const isDownIC = intradayLevel === "SOFT_DOWN" || intradayLevel === "STRONG_DOWN" || intradayLevel === "EXPLOSIVE_DOWN";

    if (side === "BUY") {
      if (intradayLevel === "NEUTRE")     return dh4Up ? { type: "EARLY" } : null;
      if (intradayLevel === "SPIKE_DOWN") return h4Up && dh4OkBuy ? { type: "REVERSAL", mode: "spike" } : null;
      if (intradayLevel === "SPIKE_UP")   return null;
      if (!h4Up) return null;
      if (isUpIC)   return dh4OkBuy ? { type: "CONTINUATION" } : null;
      if (isDownIC) return dh4OkBuy ? { type: "REVERSAL" } : null;
      return null;
    }

    if (side === "SELL") {
      if (intradayLevel === "NEUTRE")     return dh4Down ? { type: "EARLY" } : null;
      if (intradayLevel === "SPIKE_UP")   return h4Down && dh4OkSell ? { type: "REVERSAL", mode: "spike" } : null;
      if (intradayLevel === "SPIKE_DOWN") return null;
      if (!h4Down) return null;
      if (isDownIC) return dh4OkSell ? { type: "CONTINUATION" } : null;
      if (isUpIC)   return dh4OkSell ? { type: "REVERSAL" } : null;
      return null;
    }

    return null;
  }

  // ============================================================================
  // MODE — qualité du setup (IC × slopeH4 × drsiH4S0)
  //   conf=3 → relaxed | conf=2 → soft | conf=1 → normal | conf=0 → strict
  // ============================================================================
  const STRONG_UP_LEVELS   = ["STRONG_UP","EXPLOSIVE_UP","SPIKE_UP"];
  const STRONG_DOWN_LEVELS = ["STRONG_DOWN","EXPLOSIVE_DOWN","SPIKE_DOWN"];

  function computeMode(type, side, intradayLevel, slopeH4Level, drsiH4S0, thr) {
    const dh4Confirm = side === "BUY"
      ? (drsiH4S0 !== null && drsiH4S0 >= thr)
      : (drsiH4S0 !== null && drsiH4S0 <= -thr);

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
        drsiH1Min: 0.3, drsiRev: 0.1, zRev: 99,
        drsi: 0.3,
        z3050: 1.8, z5070: 1.8,
        drsiH4Sum: null,
        antiSpike,
      };
    }

    if (mode === "spike") {
      return {
        drsiH1Min: 0, drsiRev: 0, zRev: 99,
        drsi: 0,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      };
    }

    if (mode === "relaxed") {
      return isRev ? {
        drsiH1Min: 0, drsiRev: 0, zRev: 99,
        drsi: 0,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      } : {
        drsiH1Min: 0, drsiRev: 0, zRev: 99,
        drsi: 0,
        z3050: 2.3, z5070: 2.3,
        drsiH4Sum: null,
        antiSpike,
      };
    }

    if (mode === "soft") {
      return isRev ? {
        drsiH1Min: 0.2, drsiRev: 0.1, zRev: 99,
        drsi: 0.2,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      } : {
        drsiH1Min: 0.2, drsiRev: 0.1, zRev: 99,
        drsi: 0.2,
        z3050: 1.8, z5070: 1.8,
        drsiH4Sum: 0,
        antiSpike,
      };
    }

    if (mode === "normal") {
      return isRev ? {
        drsiH1Min: 0.3, drsiRev: 0.2, zRev: 99,
        drsi: 0.3,
        z3050: 99, z5070: 99,
        drsiH4Sum: null,
        antiSpike,
      } : {
        drsiH1Min: 0.3, drsiRev: 0.2, zRev: 99,
        drsi: 0.3,
        z3050: 1.8, z5070: 1.8,
        drsiH4Sum: 0,
        antiSpike,
      };
    }

    // STRICT
    return isRev ? {
      drsiH1Min: 0.5, drsiRev: 0.3, zRev: 99,
      drsi: 0.5,
      z3050: 99, z5070: 99,
      drsiH4Sum: null,
      antiSpike,
    } : {
      drsiH1Min: 0.5, drsiRev: 0.3, zRev: 99,
      drsi: 0.5,
      z3050: 1.6, z5070: 1.6,
      drsiH4Sum: 0,
      antiSpike,
    };
  }

  // ============================================================================
  // GATE UNIVERSEL DRSI
  // ============================================================================
  function drsiContextGate(side, type, intradayLevel, drsi_h1_s0, drsi_h4_s0, symbol) {
    const cfg = getDrsiConfig(symbol, intradayLevel);

    if (cfg?.h1) {
      const isRev = (type === "REVERSAL" || type === "EARLY");
      const h1 = cfg.h1;
      const h4 = cfg.h4;

      if (side === "BUY") {
        const h1Thr = isRev ? h1.p50 : h1.p25;
        if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Thr) return false;
        if (h4 && drsi_h4_s0 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p25;
          if (drsi_h4_s0 < h4Thr) return false;
        }
      } else {
        const h1Thr = isRev ? h1.p50 : h1.p75;
        if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Thr) return false;
        if (h4 && drsi_h4_s0 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p75;
          if (drsi_h4_s0 > h4Thr) return false;
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
      if (drsi_h4_s0 !== null && drsi_h4_s0 > h4Min) return false;
    } else {
      const BUY_CEIL = {
        SOFT_DOWN:[0.20,0.10], STRONG_DOWN:[0.50,0.30], EXPLOSIVE_DOWN:[1.00,0.50],
        NEUTRE:[0.40,0], SOFT_UP:[0.35,0], STRONG_UP:[0.25,0], EXPLOSIVE_UP:[0.20,0],
      };
      const [h1Max, h4Max] = BUY_CEIL[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Max) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 < h4Max) return false;
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
  // drsi_h1_s0 = indicateur live de momentum H1
  // g.antiSpike = seuil drsiSafe configurable par asset
  // ============================================================================
  function matchBuyRoute(
    rsi_s1, slope_h1, drsi_h1, zscore_h1,
    zscore_h1_min3, zscore_h1_max3,
    slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
    drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
    rsi_h1_s0,
    g
  ) {
    const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
    if (rsi === null || drsi_h1_s0 === null || zscore_h1 === null) return null;

    const zscore    = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
    const drsi_live = drsi_h1_s0;

    const drsiSafe = Math.abs(drsi_live) < g.antiSpike;
    const h4BuyOk  = drsi_h4_s0 === null || drsi_h4_s0 > -0.3;
    const drsiH4Ok = drsi_h4_s0 !== null && drsi_h4_s0 > 0;

    // BUY [0-28] — extreme oversold
    if (rsi < 28
     && drsi_live > g.drsiH1Min
     && drsiH4Ok
     && drsi_live > g.drsiRev
     && zscore < g.zRev)
      return { route: "BUY-[0-28]", side: "BUY" };

    // BUY [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && zscore < g.z3050
     && drsi_live > g.drsi
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[28-50]", side: "BUY" };

    // BUY [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && zscore < g.z5070
     && drsi_live > g.drsi
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[50-72]", side: "BUY" };

    return null;
  }

  // ============================================================================
  // SELL ROUTES (miroir)
  // ============================================================================
  function matchSellRoute(
    rsi_s1, slope_h1, drsi_h1, zscore_h1,
    zscore_h1_min3, zscore_h1_max3,
    slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
    drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
    rsi_h1_s0,
    g
  ) {
    const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
    if (rsi === null || drsi_h1_s0 === null || zscore_h1 === null) return null;

    const zscore    = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
    const drsi_live = drsi_h1_s0;

    const drsiSafe  = Math.abs(drsi_live) < g.antiSpike;
    const h4SellOk  = drsi_h4_s0 === null || drsi_h4_s0 < 0.3;
    const drsiH4Ok  = drsi_h4_s0 !== null && drsi_h4_s0 < 0;

    // SELL [72-100] — extreme overbought
    if (rsi >= 72
     && drsi_live < -g.drsiH1Min
     && drsiH4Ok
     && drsi_live < -g.drsiRev
     && zscore > -g.zRev)
      return { route: "SELL-[72-100]", side: "SELL" };

    // SELL [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && zscore > -g.z3050
     && drsi_live < -g.drsi
     && drsiSafe && h4SellOk)
      return { route: "SELL-[50-72]", side: "SELL" };

    // SELL [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && zscore > -g.z5070
     && drsi_live < -g.drsi
     && drsiSafe && h4SellOk)
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
      const _drsi_h1    = num(row?.drsi_h1);
      const _drsi_h1_s0 = num(row?.drsi_h1_s0);
      const _drsi_h4_s0 = num(row?.drsi_h4_s0);
      if (_drsi_h1    !== null && Math.abs(_drsi_h1)    >= 8)              continue;
      if (_drsi_h1_s0 !== null && Math.abs(_drsi_h1_s0) >= antiSpikeH1S0) continue;

      const intra = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      const slope_h4_raw = num(row?.slope_h4_s0) !== null
        ? num(row.slope_h4_s0) : num(row?.slope_h4);
      const slopeH4Level = getSlopeLevel(slope_h4_raw, symbol);

      const _sh4s0  = num(row?.slope_h4_s0);
      const _sh4s1  = num(row?.slope_h4);
      const dslopeH4 = (_sh4s0 !== null && _sh4s1 !== null) ? _sh4s0 - _sh4s1 : null;

      const args = [
        num(row?.rsi_h1), num(row?.slope_h1),
        num(row?.drsi_h1), num(row?.zscore_h1),
        num(row?.zscore_h1_min3), num(row?.zscore_h1_max3),
        num(row?.slope_h1_s0), num(row?.drsi_h1_s0), num(row?.zscore_h1_s0),
        num(row?.drsi_h4), num(row?.drsi_h4_s0),
        num(row?.slope_h4), num(row?.slope_h4_s0),
        num(row?.rsi_h1_s0),
      ];

      let match = null;
      let signalType = null;
      let signalMode = null;

      const buyRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "BUY");
      if (buyRes) {
        const buyMode = buyRes.mode ?? computeMode(
          buyRes.type, "BUY", intradayLevel, slopeH4Level, dslopeH4, drsiH4Thr);
        const gBuy = buildGates("BUY", buyMode, buyRes.type, antiSpikeH1S0);
        match = matchBuyRoute(...args, gBuy);
        if (match) { signalType = buyRes.type; signalMode = buyMode; }
      }

      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "SELL");
        if (sellRes) {
          const sellMode = sellRes.mode ?? computeMode(
            sellRes.type, "SELL", intradayLevel, slopeH4Level, dslopeH4, drsiH4Thr);
          const gSell = buildGates("SELL", sellMode, sellRes.type, antiSpikeH1S0);
          match = matchSellRoute(...args, gSell);
          if (match) { signalType = sellRes.type; signalMode = sellMode; }
        }
      }

      if (!match) continue;

      if (signalMode !== "spike" && !drsiContextGate(match.side, signalType, intradayLevel, _drsi_h1_s0, _drsi_h4_s0, symbol)) continue;

      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const scoreRow = {
        symbol,
        type: signalType, side: match.side,
        slope_h1:             num(row?.slope_h1),
        dslope_h1:            num(row?.dslope_h1),
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

        // H4
        slope_h4:    num(row?.slope_h4),
        dslope_h4:   num(row?.dslope_h4),
        drsi_h4:     num(row?.drsi_h4),
        rsi_h4_s0:   num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        drsi_h4_s0:  num(row?.drsi_h4_s0),

        // H1 s1
        rsi_h1:         num(row?.rsi_h1),
        slope_h1:       num(row?.slope_h1),
        dslope_h1:      num(row?.dslope_h1),
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

        const buyRes  = resolve3D(intradayLevel, slopeH4Level, _dsh4, "BUY");
        const sellRes = resolve3D(intradayLevel, slopeH4Level, _dsh4, "SELL");
        if (!buyRes && !sellRes) continue;
        cResolve++;

        const _drsi_h4_s0 = num(row?.drsi_h4_s0);
        const activeRes   = buyRes ?? sellRes;
        const activeSide  = buyRes ? "BUY" : "SELL";
        const activeMode  = activeRes.mode ?? computeMode(activeRes.type, activeSide, intradayLevel, slopeH4Level, drsiH4S0, _drsiH4Thr);
        if (activeMode !== "spike" && !drsiContextGate(activeSide, activeRes.type, intradayLevel, _drsi_h1_s0, _drsi_h4_s0, sym)) continue;
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

        const args = [
          num(row?.rsi_h1), num(row?.slope_h1),
          num(row?.drsi_h1), num(row?.zscore_h1),
          num(row?.zscore_h1_min3), num(row?.zscore_h1_max3),
          num(row?.slope_h1_s0), num(row?.drsi_h1_s0), num(row?.zscore_h1_s0),
          num(row?.drsi_h4), num(row?.drsi_h4_s0),
          num(row?.slope_h4), num(row?.slope_h4_s0),
          num(row?.rsi_h1_s0),
        ];
        const g = buildGates(activeSide, activeMode, activeRes.type, _antiSpike);
        const routeMatch = activeSide === "BUY"
          ? matchBuyRoute(...args, g)
          : matchSellRoute(...args, g);

        if (!routeMatch) {
          const rsi    = num(row?.rsi_h1_s0) ?? num(row?.rsi_h1);
          const zscore = num(row?.zscore_h1_s0) ?? num(row?.zscore_h1);
          const drsi   = num(row?.drsi_h1_s0);
          const zone   = rsi < 28 ? "0-28" : rsi < 50 ? "28-50" : rsi < 72 ? "50-72" : "72+";
          console.log(`[g7 FAIL] mode=${activeMode} type=${activeRes.type} side=${activeSide} zone=${zone} | rsi=${rsi?.toFixed(1)} z=${zscore?.toFixed(2)} drsi_h1_s0=${drsi?.toFixed(2)}`);
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
        const br  = resolve3D(il, sh4, dsh4, "BUY");
        const sr  = resolve3D(il, sh4, dsh4, "SELL");
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