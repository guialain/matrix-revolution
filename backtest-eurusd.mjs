// ============================================================================
// backtest-eurusd.mjs — Backtest EURUSD on 5min data
// Replicates: reversal + continuation engines + ScoreEngine + SignalFilters
// Simulates trades with ATR-based TP/SL grid
// ============================================================================

import { readFileSync } from 'fs';

// ── HELPERS ──────────────────────────────────────────────────────────────────
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ── CONFIGS (inlined for standalone) ─────────────────────────────────────────
const SLOPE_CFG_EURUSD = {
  flat:         { min: -0.8727, max:  0.7492 },
  up_weak:      { min:  0.7492, max:  2.9089 },
  up_strong:    { min:  2.9089, max:  5.2239 },
  up_extreme:   { min:  5.2239, max:  Infinity },
  down_weak:    { min: -2.9011, max: -0.8727 },
  down_strong:  { min: -5.3606, max: -2.9011 },
  down_extreme: { min: -Infinity, max: -5.3606 },
};

const H1_REVERSAL_CFG = {
  rsiWindowH1: 3,
  rsiBuyMax: 30, rsiSellMin: 70,
  rsiBuySemi: 35, rsiSellSemi: 65,
  dslopeH1ReversalMin: 0.5,
  flipSlopeMin: 1.0, flipDslopeMin: 1.0,
  dbbzBuyMin: 0.20, dbbzSellMax: -0.20,
  phaseExpansionSlopeMin: 1.5, phaseExpansionSlopeMax: 3.5,
  phaseMatureSlopeMax: 4.5, phaseAccelDslopeMin: 1.5,
};

const H1_CONTINUATION_CFG = {
  phaseExpansionSlopeMin: 1.5, phaseExpansionSlopeMax: 3.5,
  phaseMatureSlopeMax: 5.0, phaseAccelDslopeMin: 1.5,
  rsiContMin: 35, rsiContMax: 65,
  zscoreH1BuyMax: 1.8,
};

const VOL_CFG = { lowMax: 0.000369, medMax: 0.000715, highMax: 0.001175 };
const INTRADAY_STRONG_MAX = 0.41;

// ── VOLATILITY ───────────────────────────────────────────────────────────────
function getVolRegime(atr_m15, close) {
  if (!Number.isFinite(atr_m15) || !Number.isFinite(close) || close <= 0) return 'unknown';
  const ratio = atr_m15 / close;
  if (ratio < VOL_CFG.lowMax) return 'low';
  if (ratio < VOL_CFG.medMax) return 'med';
  if (ratio < VOL_CFG.highMax) return 'high';
  return 'explo';
}

function scoreVolatility(atr_m15, close) {
  const r = getVolRegime(atr_m15, close);
  if (r === 'high') return 7;
  if (r === 'med') return 3;
  if (r === 'explo') return -3;
  return 0;
}

// ── SLOPE LIMITS ─────────────────────────────────────────────────────────────
function getSlopeLimits(side) {
  if (side === "BUY") {
    return { slopeMin: SLOPE_CFG_EURUSD.up_weak.min, slopeMax: SLOPE_CFG_EURUSD.up_extreme.min };
  } else {
    return {
      slopeMin: Math.abs(SLOPE_CFG_EURUSD.down_weak.max),
      slopeMax: Math.abs(SLOPE_CFG_EURUSD.down_extreme.max) || Math.abs(SLOPE_CFG_EURUSD.up_extreme.min),
    };
  }
}

// ── PHASE DETECTORS ──────────────────────────────────────────────────────────
function detectContinuationPhase(slope_h1, dslope_h1, side, cfg) {
  if (!Number.isFinite(slope_h1) || !Number.isFinite(dslope_h1)) return null;
  const dir = side === "BUY" ? 1 : -1;
  const ss = slope_h1 * dir;
  const sd = dslope_h1 * dir;
  if (ss <= 0) return null;
  const { phaseExpansionSlopeMin: expMin, phaseExpansionSlopeMax: expMax,
          phaseMatureSlopeMax: matureMax, phaseAccelDslopeMin: accelMin } = cfg;
  if (ss < expMin) return sd >= accelMin ? "EARLY_TREND" : null;
  if (ss <= expMax) {
    if (sd >= accelMin) return "EXPANSION_ACCELERATING";
    if (sd > 0) return "EXPANSION";
    return null;
  }
  if (ss <= matureMax) return sd > 0 ? "MATURE_CONTINUATION" : null;
  return null;
}

function detectReversalPhase(slope_h1, dslope_h1, side, cfg) {
  if (!Number.isFinite(slope_h1) || !Number.isFinite(dslope_h1)) return null;
  const trendDir = side === "BUY" ? -1 : 1;
  const ss = slope_h1 * trendDir;
  const sd = dslope_h1 * (-trendDir);
  if (ss <= 0 || sd <= 0) return null;
  const { phaseExpansionSlopeMin: expMin, phaseExpansionSlopeMax: expMax,
          phaseMatureSlopeMax: matureMax, phaseAccelDslopeMin: accelMin } = cfg;
  const flexStrong = accelMin * 2;
  if (ss > matureMax) {
    if (sd > flexStrong) return "REVERSAL_START";
    if (sd >= accelMin) return "CLIMAX_SLOWING";
    return null;
  }
  if (ss >= expMax) return sd >= accelMin ? "MATURE_END" : null;
  if (ss >= expMin) return sd >= accelMin ? "EXPANSION_END" : null;
  return null;
}

// ── RSI WINDOW H1 (backtest mode) ───────────────────────────────────────────
function getMinMaxRSI_H1(rows, i, bars = 3) {
  let count = 0, min = Infinity, max = -Infinity, curr = null, lastHour = null;
  for (let k = i; k >= 0; k--) {
    const ts = rows[k]?.timestamp;
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

// ── REVERSAL ENGINE ──────────────────────────────────────────────────────────
function revPassesStructureGate(side, rsiStats, dyn) {
  const cfg = H1_REVERSAL_CFG;
  const rsi = rsiStats?.currentRSI;
  const slope = dyn?.slope;
  const dslope = dyn?.dslope;
  if (rsi === null || slope === null || dslope === null) return false;
  const { slopeMin, slopeMax } = getSlopeLimits(side);
  const dslopeMin = cfg.dslopeH1ReversalMin;
  if (Math.abs(slope) > slopeMax) return false;
  if (side === "SELL") {
    const deep = cfg.rsiSellMin, semi = cfg.rsiSellSemi;
    if (rsi > deep) return dslope < -dslopeMin;
    if (rsi > semi) return slope < 0.5 && dslope < -dslopeMin;
    return false;
  }
  if (side === "BUY") {
    const deep = cfg.rsiBuyMax, semi = cfg.rsiBuySemi;
    if (rsi < deep) return dslope > dslopeMin;
    if (rsi < semi) return slope > -0.5 && dslope > dslopeMin;
    return false;
  }
  return false;
}

function isEarlyBuyConfirmed(dyn) {
  const cfg = H1_REVERSAL_CFG;
  const slope1 = dyn.slope - dyn.dslope;
  return slope1 < 0 && dyn.slope > 0 && Math.abs(dyn.slope) >= cfg.flipSlopeMin && Math.abs(dyn.dslope) >= cfg.flipDslopeMin;
}

function isEarlySellConfirmed(dyn) {
  const cfg = H1_REVERSAL_CFG;
  const slope1 = dyn.slope - dyn.dslope;
  return slope1 > 0 && dyn.slope < 0 && Math.abs(dyn.slope) >= cfg.flipSlopeMin && Math.abs(dyn.dslope) >= cfg.flipDslopeMin;
}

function revDetectBuy(rsiStats, dyn) {
  const cfg = H1_REVERSAL_CFG;
  if (rsiStats.minRSI > cfg.rsiBuyMax) return null;
  const z = dyn?.zscore;
  if (z === null || z > -1.2) return null;
  let bp = 0;
  if (dyn.zscore !== null && dyn.zscore < -1.8) bp++;
  if (dyn.dbbz !== null && dyn.dbbz < -0.2) bp++;
  if (dyn.dslope !== null && dyn.dslope < -3.0) bp++;
  if (bp >= 2) return null;
  return isEarlyBuyConfirmed(dyn) ? "BUY_EARLY" : "BUY";
}

function revDetectSell(rsiStats, dyn) {
  const cfg = H1_REVERSAL_CFG;
  if (rsiStats.maxRSI < cfg.rsiSellMin) return null;
  const z = dyn?.zscore;
  if (z === null || z < 1.2) return null;
  let bp = 0;
  if (dyn.zscore !== null && dyn.zscore > 1.8) bp++;
  if (dyn.dbbz !== null && dyn.dbbz > 0.2) bp++;
  if (dyn.dslope !== null && dyn.dslope > 3.0) bp++;
  if (bp >= 2) return null;
  return isEarlySellConfirmed(dyn) ? "SELL_EARLY" : "SELL";
}

function revDetectBuyPhase(dyn) {
  const z = dyn?.zscore;
  if (z === null || z > -1.2) return null;
  const p = detectReversalPhase(dyn.slope, dyn.dslope, "BUY", H1_REVERSAL_CFG);
  return p ? `BUY_${p}` : null;
}

function revDetectSellPhase(dyn) {
  const z = dyn?.zscore;
  if (z === null || z < 1.2) return null;
  const p = detectReversalPhase(dyn.slope, dyn.dslope, "SELL", H1_REVERSAL_CFG);
  return p ? `SELL_${p}` : null;
}

// ── CONTINUATION ENGINE ──────────────────────────────────────────────────────
function contDetectBuy(row) {
  const cfg = H1_CONTINUATION_CFG;
  const slope_h1 = num(row?.slope_h1), dslope_h1 = num(row?.dslope_h1);
  const rsi_h1 = num(row?.rsi_h1), zscore_h1 = num(row?.zscore_h1), dz_h1 = num(row?.dz_h1);
  if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null) return null;
  if (zscore_h1 !== null && Math.abs(zscore_h1) < 0.3) return null;
  const { slopeMin, slopeMax } = getSlopeLimits("BUY");
  if (Math.abs(slope_h1) < slopeMin) return null;
  const phase = detectContinuationPhase(slope_h1, dslope_h1, "BUY", cfg);
  if (!phase) return null;
  if (Math.abs(slope_h1) > slopeMax) return null;
  if (zscore_h1 !== null && zscore_h1 > (cfg.zscoreH1BuyMax ?? 1.8)) return null;
  if (rsi_h1 < (cfg.rsiContMin ?? 35) || rsi_h1 > (cfg.rsiContMax ?? 65)) return null;
  if (zscore_h1 !== null && dz_h1 !== null && dslope_h1 !== null &&
      zscore_h1 > 1.8 && dz_h1 > 0.3 && dslope_h1 > 0) return null;
  return phase;
}

function contDetectSell(row) {
  const cfg = H1_CONTINUATION_CFG;
  const slope_h1 = num(row?.slope_h1), dslope_h1 = num(row?.dslope_h1);
  const rsi_h1 = num(row?.rsi_h1), zscore_h1 = num(row?.zscore_h1), dz_h1 = num(row?.dz_h1);
  if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null) return null;
  if (zscore_h1 !== null && Math.abs(zscore_h1) < 0.3) return null;
  const { slopeMin, slopeMax } = getSlopeLimits("SELL");
  if (Math.abs(slope_h1) < slopeMin) return null;
  const phase = detectContinuationPhase(slope_h1, dslope_h1, "SELL", cfg);
  if (!phase) return null;
  if (Math.abs(slope_h1) > slopeMax) return null;
  if (zscore_h1 !== null && zscore_h1 < -(cfg.zscoreH1BuyMax ?? 1.8)) return null;
  if (rsi_h1 < (cfg.rsiContMin ?? 35) || rsi_h1 > (cfg.rsiContMax ?? 65)) return null;
  if (zscore_h1 !== null && dz_h1 !== null && dslope_h1 !== null &&
      zscore_h1 < -1.8 && dz_h1 < -0.3 && dslope_h1 < 0) return null;
  return phase;
}

// ── SCORE ENGINE ─────────────────────────────────────────────────────────────
function scoreIntradayReversal(intraday_change) {
  const sMax = INTRADAY_STRONG_MAX;
  const ratio = intraday_change / sMax;
  const lobePos = Math.pow(clamp(ratio / 0.75, 0, 1), 0.8) * Math.pow(clamp((1.5 - ratio) / 0.75, 0, 1), 0.8) * 20;
  const lobeMinus = Math.pow(clamp(-ratio / 0.75, 0, 1), 0.8) * Math.pow(clamp((1.5 + ratio) / 0.75, 0, 1), 0.8) * 20;
  const penalty = -clamp((Math.abs(ratio) - 1.0) / 0.5, 0, 1) * 20;
  return Math.max(lobePos, lobeMinus) + penalty;
}

function scoreIntradayContinuation(intraday_change, side) {
  const sMax = INTRADAY_STRONG_MAX;
  const dir = side === 'BUY' ? 1 : -1;
  const ratio = (intraday_change * dir) / sMax;
  return clamp(ratio / 1.0, 0, 1) * 25 + (-clamp(-ratio / 1.0, 0, 1) * 25);
}

function scoreReversalBuy(opp) {
  const { rsi_h1_previouslow3, zscore_h1, slope_h1, dslope_h1, atr_m15, close, intraday_change } = opp;
  const rsiScore = Math.pow(clamp((35 - (rsi_h1_previouslow3 ?? 50)) / 25, 0, 1), 0.67) * 30;
  const lobeExtreme = Math.pow(clamp((-zscore_h1 - 1.8) / 0.7, 0, 1), 0.5) * 15;
  const lobeMid = Math.pow(clamp(-zscore_h1 / 1.0, 0, 1), 0.8) * Math.pow(clamp((1.5 + zscore_h1) / 0.5, 0, 1), 1.2) * 11;
  const zscoreScore = Math.max(lobeExtreme, lobeMid);
  const zWeight = clamp(-zscore_h1 / 2.0, 0, 1);
  const slopeScore = clamp(1 - Math.abs(slope_h1) / 5.0, 0, 1) * 20 * zWeight;
  const dslopeScore = clamp(dslope_h1 / 5.0, -1, 1) * 10;
  const volatilityScore = scoreVolatility(atr_m15, close);
  const intradayScore = scoreIntradayReversal(intraday_change);
  return rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;
}

function scoreReversalSell(opp) {
  const { rsi_h1_previoushigh3, zscore_h1, slope_h1, dslope_h1, atr_m15, close, intraday_change } = opp;
  const rsiScore = Math.pow(clamp(((rsi_h1_previoushigh3 ?? 50) - 65) / 25, 0, 1), 0.67) * 30;
  const lobeExtreme = Math.pow(clamp((zscore_h1 - 1.8) / 0.7, 0, 1), 0.5) * 15;
  const lobeMid = Math.pow(clamp(zscore_h1 / 1.0, 0, 1), 0.8) * Math.pow(clamp((1.5 - zscore_h1) / 0.5, 0, 1), 1.2) * 11;
  const zscoreScore = Math.max(lobeExtreme, lobeMid);
  const zWeight = clamp(zscore_h1 / 2.0, 0, 1);
  const slopeScore = clamp(1 - Math.abs(slope_h1) / 5.0, 0, 1) * 20 * zWeight;
  const dslopeScore = clamp(-dslope_h1 / 5.0, -1, 1) * 10;
  const volatilityScore = scoreVolatility(atr_m15, close);
  const intradayScore = scoreIntradayReversal(intraday_change);
  return rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;
}

function scoreContinuationBuy(opp) {
  const { rsi_h1, zscore_h1, slope_h1, dslope_h1, atr_m15, close, intraday_change } = opp;
  const lobeHigh = Math.pow(clamp((70 - rsi_h1) / 14, 0, 1), 0.4) * Math.pow(clamp((rsi_h1 - 56) / 7, 0, 1), 0.6) * 30;
  const lobeHighEntry = Math.pow(clamp((rsi_h1 - 56) / 10, 0, 1), 0.67) * 30;
  const neutral = clamp(1 - Math.abs(rsi_h1 - 50) / 5, 0, 1) * 5;
  const rsiScore = Math.max(lobeHigh, lobeHighEntry, neutral);
  const zW = clamp((Math.abs(zscore_h1) - 0.3) / 1.7, 0, 1);
  const lp = Math.pow(clamp(zscore_h1 / 1.0, 0, 1), 0.8) * Math.pow(clamp((2.0 - zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const lm = Math.pow(clamp(-zscore_h1 / 1.0, 0, 1), 0.8) * Math.pow(clamp((2.0 + zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const zscoreScore = Math.max(lp, lm) * zW;
  const slopeScore = clamp(slope_h1 / 5.0, -1, 1) * 20;
  const dslopeScore = clamp(dslope_h1 / 5.0, -1, 1) * 10;
  const volatilityScore = scoreVolatility(atr_m15, close);
  const intradayScore = scoreIntradayContinuation(intraday_change, 'BUY');
  return rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;
}

function scoreContinuationSell(opp) {
  const { rsi_h1, zscore_h1, slope_h1, dslope_h1, atr_m15, close, intraday_change } = opp;
  const lobeHigh = Math.pow(clamp((rsi_h1 - 55) / 10, 0, 1), 0.67) * 30;
  const lobeLow = Math.pow(clamp((70 - rsi_h1) / 14, 0, 1), 0.4) * Math.pow(clamp((44 - rsi_h1) / 7, 0, 1), 0.6) * 30;
  const neutral = clamp(1 - Math.abs(rsi_h1 - 50) / 5, 0, 1) * 5;
  const rsiScore = Math.max(lobeHigh, lobeLow, neutral);
  const zW = clamp((Math.abs(zscore_h1) - 0.3) / 1.7, 0, 1);
  const lp = Math.pow(clamp(zscore_h1 / 1.0, 0, 1), 0.8) * Math.pow(clamp((2.0 - zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const lm = Math.pow(clamp(-zscore_h1 / 1.0, 0, 1), 0.8) * Math.pow(clamp((2.0 + zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const zscoreScore = Math.max(lp, lm) * zW;
  const slopeScore = clamp(-slope_h1 / 5.0, -1, 1) * 20;
  const dslopeScore = clamp(-dslope_h1 / 5.0, -1, 1) * 10;
  const volatilityScore = scoreVolatility(atr_m15, close);
  const intradayScore = scoreIntradayContinuation(intraday_change, 'SELL');
  return rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;
}

// ── MARKET HOURS FILTER (NEO hours 9-21 GMT, weekday only) ───────────────────
function isMarketOpen(ts) {
  // ts format: "2025.12.04 13:20"
  const parts = ts.split(/[.\s:]/);
  const y = +parts[0], mo = +parts[1] - 1, d = +parts[2], h = +parts[3], m = +parts[4];
  const dt = new Date(Date.UTC(y, mo, d, h, m));
  const dow = dt.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const hourDec = h + m / 60;
  return hourDec >= 9 && hourDec < 21;
}

// ── LOAD CSV ─────────────────────────────────────────────────────────────────
const CSV_PATH = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/EURUSD_5min.csv";
const raw = readFileSync(CSV_PATH, 'utf-8');
const lines = raw.trim().split('\n');
const headers = lines[0].split(';');

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(';');
  const row = {};
  for (let j = 0; j < headers.length; j++) {
    const key = headers[j].trim();
    const v = vals[j]?.trim();
    row[key] = v;
  }
  // convert numerics
  for (const k of Object.keys(row)) {
    if (k !== 'symbol' && k !== 'assetclass' && k !== 'timestamp') {
      const n = Number(row[k]);
      if (Number.isFinite(n)) row[k] = n;
    }
  }
  rows.push(row);
}

console.log(`Loaded ${rows.length} rows, range: ${rows[0]?.timestamp} → ${rows[rows.length-1]?.timestamp}\n`);

// ── SIGNAL GENERATION ────────────────────────────────────────────────────────
const SCORE_MIN = 30;
const signals = [];

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!isMarketOpen(row.timestamp)) continue;

  const rsiStats = getMinMaxRSI_H1(rows, i, 3);
  const slope = num(row.slope_h1), dslope = num(row.dslope_h1);
  const dbbz = num(row.dz_h1), zscore = num(row.zscore_h1);
  if (slope === null || dslope === null || dbbz === null) continue;
  const dyn = { slope, dslope, dbbz, zscore };

  let type = null, side = null, signalType = null, score = 0;

  // Try reversal first
  if (rsiStats) {
    const revSig = revDetectBuy(rsiStats, dyn) ?? revDetectSell(rsiStats, dyn) ??
                   revDetectBuyPhase(dyn) ?? revDetectSellPhase(dyn);
    if (revSig) {
      side = revSig.startsWith("BUY") ? "BUY" : "SELL";
      if (revPassesStructureGate(side, rsiStats, dyn)) {
        type = "REVERSAL";
        signalType = revSig;
        const opp = {
          rsi_h1: rsiStats.currentRSI,
          rsi_h1_previouslow3: rsiStats.minRSI,
          rsi_h1_previoushigh3: rsiStats.maxRSI,
          slope_h1: slope, dslope_h1: dslope, zscore_h1: zscore,
          atr_m15: num(row.atr_m15), close: num(row.close),
          intraday_change: num(row.intraday_change) ?? 0,
        };
        score = side === "BUY" ? scoreReversalBuy(opp) : scoreReversalSell(opp);
      }
    }
  }

  // Try continuation if no reversal
  if (!type) {
    const contPhase = contDetectBuy(row) ?? contDetectSell(row);
    if (contPhase) {
      // Determine side from slope direction
      const s = num(row.slope_h1);
      side = s > 0 ? "BUY" : "SELL";
      type = "CONTINUATION";
      signalType = contPhase;
      const opp = {
        rsi_h1: num(row.rsi_h1), zscore_h1: num(row.zscore_h1),
        slope_h1: s, dslope_h1: num(row.dslope_h1),
        atr_m15: num(row.atr_m15), close: num(row.close),
        intraday_change: num(row.intraday_change) ?? 0,
      };
      score = side === "BUY" ? scoreContinuationBuy(opp) : scoreContinuationSell(opp);
    }
  }

  if (!type || score < SCORE_MIN) continue;

  signals.push({
    index: i,
    timestamp: row.timestamp,
    type, side, signalType, score,
    close: num(row.close),
    atr_h1: num(row.atr_h1),
  });
}

console.log(`Signals generated: ${signals.length} (scoreMin=${SCORE_MIN})`);
console.log(`  REVERSAL: ${signals.filter(s => s.type === "REVERSAL").length}`);
console.log(`  CONTINUATION: ${signals.filter(s => s.type === "CONTINUATION").length}`);
console.log(`  BUY: ${signals.filter(s => s.side === "BUY").length}  SELL: ${signals.filter(s => s.side === "SELL").length}\n`);

// ── BACKTEST SIMULATION ──────────────────────────────────────────────────────
// Cooldown: skip signals within 60 bars (5h) of last entry
const COOLDOWN_BARS = 60;
const SPREAD = 0.00008;

function simulate(tpMul, slMul) {
  const trades = [];
  let lastEntryIdx = -COOLDOWN_BARS - 1;

  for (const sig of signals) {
    if (sig.index - lastEntryIdx < COOLDOWN_BARS) continue;
    const atr = sig.atr_h1;
    if (!atr || atr <= 0) continue;

    const entry = sig.close + (sig.side === "BUY" ? SPREAD / 2 : -SPREAD / 2);
    const tpDist = atr * tpMul;
    const slDist = atr * slMul;

    let tp, sl;
    if (sig.side === "BUY") {
      tp = entry + tpDist;
      sl = entry - slDist;
    } else {
      tp = entry - tpDist;
      sl = entry + slDist;
    }

    // Walk forward to find exit
    let exitPrice = null, exitIdx = null, exitReason = null;
    for (let j = sig.index + 1; j < rows.length; j++) {
      const high = num(rows[j].high);
      const low = num(rows[j].low);
      const close = num(rows[j].close);
      if (high === null || low === null) continue;

      if (sig.side === "BUY") {
        // Check SL first (conservative)
        if (low <= sl) { exitPrice = sl; exitIdx = j; exitReason = "SL"; break; }
        if (high >= tp) { exitPrice = tp; exitIdx = j; exitReason = "TP"; break; }
      } else {
        if (high >= sl) { exitPrice = sl; exitIdx = j; exitReason = "SL"; break; }
        if (low <= tp) { exitPrice = tp; exitIdx = j; exitReason = "TP"; break; }
      }
    }

    if (!exitPrice) continue; // no exit found (end of data)

    const pnl = sig.side === "BUY" ? exitPrice - entry : entry - exitPrice;
    const holdBars = exitIdx - sig.index;
    const holdMinutes = holdBars * 5;

    trades.push({
      timestamp: sig.timestamp,
      type: sig.type,
      side: sig.side,
      score: sig.score,
      entry, tp, sl, exitPrice,
      pnl, exitReason,
      holdBars, holdMinutes,
    });

    lastEntryIdx = sig.index;
  }

  return trades;
}

// ── GRID SEARCH ──────────────────────────────────────────────────────────────
const TP_RANGE = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 1.00];
const SL_RANGE = [0.75, 1.00, 1.25, 1.50, 1.75, 2.00];

const results = [];

for (const tp of TP_RANGE) {
  for (const sl of SL_RANGE) {
    const trades = simulate(tp, sl);
    if (trades.length < 5) continue;

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const wr = wins.length / trades.length;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? grossProfit / grossLoss : Infinity;
    const netPnl = grossProfit - grossLoss;
    const avgHold = trades.reduce((s, t) => s + t.holdMinutes, 0) / trades.length;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    // Max drawdown (cumulative PnL)
    let peak = 0, maxDD = 0, cum = 0;
    for (const t of trades) {
      cum += t.pnl;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    }

    // By type breakdown
    const revTrades = trades.filter(t => t.type === "REVERSAL");
    const contTrades = trades.filter(t => t.type === "CONTINUATION");
    const revWR = revTrades.length > 0 ? revTrades.filter(t => t.pnl > 0).length / revTrades.length : 0;
    const contWR = contTrades.length > 0 ? contTrades.filter(t => t.pnl > 0).length / contTrades.length : 0;

    results.push({
      tp, sl, trades: trades.length,
      wr, pf, netPnl, avgHold,
      avgWin, avgLoss,
      maxDD, revCount: revTrades.length, contCount: contTrades.length,
      revWR, contWR,
    });
  }
}

// Sort by PF descending
results.sort((a, b) => b.pf - a.pf);

// ── PRINT RESULTS ────────────────────────────────────────────────────────────
console.log("=" .repeat(130));
console.log("TP/SL OPTIMIZATION GRID — EURUSD (5min, scoreMin=30, cooldown=5h)");
console.log("=" .repeat(130));
console.log(
  "TP×ATR".padEnd(8) +
  "SL×ATR".padEnd(8) +
  "#Trades".padEnd(9) +
  "WR%".padEnd(8) +
  "PF".padEnd(8) +
  "Net(pips)".padEnd(11) +
  "AvgHold".padEnd(10) +
  "AvgWin".padEnd(10) +
  "AvgLoss".padEnd(10) +
  "MaxDD".padEnd(10) +
  "#REV".padEnd(7) +
  "REV_WR".padEnd(9) +
  "#CONT".padEnd(7) +
  "CONT_WR".padEnd(9)
);
console.log("-".repeat(130));

for (const r of results.slice(0, 25)) {
  const pipFactor = 10000; // EURUSD
  console.log(
    `${r.tp.toFixed(2)}`.padEnd(8) +
    `${r.sl.toFixed(2)}`.padEnd(8) +
    `${r.trades}`.padEnd(9) +
    `${(r.wr * 100).toFixed(1)}%`.padEnd(8) +
    `${r.pf.toFixed(2)}`.padEnd(8) +
    `${(r.netPnl * pipFactor).toFixed(1)}`.padEnd(11) +
    `${Math.round(r.avgHold)}min`.padEnd(10) +
    `${(r.avgWin * pipFactor).toFixed(1)}p`.padEnd(10) +
    `${(r.avgLoss * pipFactor).toFixed(1)}p`.padEnd(10) +
    `${(r.maxDD * pipFactor).toFixed(1)}p`.padEnd(10) +
    `${r.revCount}`.padEnd(7) +
    `${(r.revWR * 100).toFixed(1)}%`.padEnd(9) +
    `${r.contCount}`.padEnd(7) +
    `${(r.contWR * 100).toFixed(1)}%`.padEnd(9)
  );
}

// ── BEST COMBO DETAIL ────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(80));
console.log("BEST COMBO DETAIL (highest PF with ≥10 trades)");
console.log("=".repeat(80));

const best = results.find(r => r.trades >= 10) ?? results[0];
if (best) {
  const trades = simulate(best.tp, best.sl);
  console.log(`\nTP=${best.tp}×ATR  SL=${best.sl}×ATR`);
  console.log(`Trades: ${best.trades}  WR: ${(best.wr*100).toFixed(1)}%  PF: ${best.pf.toFixed(2)}  Net: ${(best.netPnl*10000).toFixed(1)} pips`);
  console.log(`AvgHold: ${Math.round(best.avgHold)} min  AvgWin: ${(best.avgWin*10000).toFixed(1)}p  AvgLoss: ${(best.avgLoss*10000).toFixed(1)}p  MaxDD: ${(best.maxDD*10000).toFixed(1)}p`);
  console.log(`\nREVERSAL: ${best.revCount} trades (WR ${(best.revWR*100).toFixed(1)}%)`);
  console.log(`CONTINUATION: ${best.contCount} trades (WR ${(best.contWR*100).toFixed(1)}%)`);

  // Equity curve milestones
  console.log(`\nTrade log (first 20):`);
  console.log("Time".padEnd(18) + "Type".padEnd(6) + "Side".padEnd(6) + "Score".padEnd(7) + "PnL(p)".padEnd(9) + "Exit".padEnd(5) + "Hold".padEnd(8));
  console.log("-".repeat(60));
  for (const t of trades.slice(0, 20)) {
    console.log(
      t.timestamp.padEnd(18) +
      t.type.slice(0,4).padEnd(6) +
      t.side.padEnd(6) +
      t.score.toFixed(1).padEnd(7) +
      `${(t.pnl * 10000).toFixed(1)}`.padEnd(9) +
      t.exitReason.padEnd(5) +
      `${t.holdMinutes}m`.padEnd(8)
    );
  }
}

// Current config performance
console.log("\n" + "=".repeat(80));
console.log("CURRENT CONFIG: TP=0.60×ATR  SL=1.75×ATR");
console.log("=".repeat(80));
const currentR = results.find(r => r.tp === 0.60 && r.sl === 1.75);
if (currentR) {
  console.log(`Trades: ${currentR.trades}  WR: ${(currentR.wr*100).toFixed(1)}%  PF: ${currentR.pf.toFixed(2)}  Net: ${(currentR.netPnl*10000).toFixed(1)} pips`);
  console.log(`AvgHold: ${Math.round(currentR.avgHold)} min  AvgWin: ${(currentR.avgWin*10000).toFixed(1)}p  AvgLoss: ${(currentR.avgLoss*10000).toFixed(1)}p  MaxDD: ${(currentR.maxDD*10000).toFixed(1)}p`);
  console.log(`REVERSAL: ${currentR.revCount} (WR ${(currentR.revWR*100).toFixed(1)}%)  CONTINUATION: ${currentR.contCount} (WR ${(currentR.contWR*100).toFixed(1)}%)`);
} else {
  console.log("(not enough trades for this combo)");
}
