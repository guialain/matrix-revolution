// Diagnostic V8R funnel - read live CSV + replay pipeline per asset
// Output: rejected rows at checkConditions dslope_h1 step + zscore_h1_s0 step
// Plus bonus: mode distribution + 3 relaxation scenarios

import fs from 'fs';
import {
  getAlignmentD1, getAlignmentD1Mode, getSignalTypeFromAlignment,
  D1_ALIGNMENTS_BUY, D1_ALIGNMENTS_SELL, getIntradayLevel,
} from '../src/utils/marketLevels.js';
import { INTRADAY_CONFIG } from '../src/components/robot/engines/config/IntradayConfig.js';
import { getSlopeClass } from '../src/components/robot/engines/config/SlopeConfig.js';
import { getRiskConfig } from '../src/components/robot/engines/config/RiskConfig.js';
import GlobalMarketHours from '../src/components/robot/engines/trading/GlobalMarketHours.js';
import { isTradable } from '../src/config/allowedSymbols.js';

// Inline replicas of AssetEligibility internals (to avoid extensionless imports)
const BLOCKED_SYMBOLS = ['JAPAN_225'];
function resolveMarket(assetclass) {
  switch (assetclass?.toUpperCase()) {
    case 'FX':     return 'FX';
    case 'INDEX':  return 'INDEX';
    case 'CRYPTO': return 'CRYPTO';
    case 'METAL':  return 'METAL';
    case 'ENERGY': case 'OIL_GAS': case 'GAS': return 'ENERGY';
    case 'AGRI':   case 'SOFT': return 'AGRI';
    default: return null;
  }
}

const CSV = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/neo_market_scan.csv";
const lines = fs.readFileSync(CSV, 'utf8').replace(/\0/g, '').trim().split('\n');
const headers = lines[0].split(';');
const rows = lines.slice(1).map(line => {
  const values = line.split(';');
  const obj = {};
  headers.forEach((h, i) => { obj[h] = values[i]; });
  return obj;
});

const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const ZONE_RANK = { 'down_extreme': -3, 'down_strong': -2, 'down_weak': -1, 'flat': 0, 'up_weak': 1, 'up_strong': 2, 'up_extreme': 3 };
const IC_BEARISH_BLOCK_BUY  = new Set(['SOFT_DOWN', 'STRONG_DOWN', 'EXPLOSIVE_DOWN', 'SPIKE_DOWN']);
const IC_BULLISH_BLOCK_SELL = new Set(['SOFT_UP', 'STRONG_UP', 'EXPLOSIVE_UP', 'SPIKE_UP']);
const SPIKE_H1_THRESHOLD = 8;

function detectSpike(slope_h1_s0, intradayLevel) {
  if (slope_h1_s0 !== null) {
    if (slope_h1_s0 >=  SPIKE_H1_THRESHOLD) return { isSpike: true, direction: 'up' };
    if (slope_h1_s0 <= -SPIKE_H1_THRESHOLD) return { isSpike: true, direction: 'down' };
  }
  if (intradayLevel === 'SPIKE_UP')   return { isSpike: true, direction: 'up' };
  if (intradayLevel === 'SPIKE_DOWN') return { isSpike: true, direction: 'down' };
  return { isSpike: false, direction: null };
}

function matchRoute(rsi, zscore) {
  if (rsi === null || zscore === null) return [];
  if (rsi < 28) {
    if (zscore < -2) return [{ route: "BUY-[0-28]-EXHAUSTION", side: "BUY", type: "EXHAUSTION" }];
    return [];
  }
  if (rsi >= 28 && rsi < 50) {
    if (zscore < -0.5) return [
      { route: "SELL-[28-50]-CONT", side: "SELL", type: "CONTINUATION" },
      { route: "BUY-[28-50]-EXHAUSTION", side: "BUY", type: "EXHAUSTION" },
    ];
    return [];
  }
  if (rsi >= 50 && rsi < 72) {
    if (zscore > 0.5) return [
      { route: "BUY-[50-72]-CONT", side: "BUY", type: "CONTINUATION" },
      { route: "SELL-[50-72]-EXHAUSTION", side: "SELL", type: "EXHAUSTION" },
    ];
    return [];
  }
  if (rsi >= 72) {
    if (zscore > 2) return [{ route: "SELL-[72-100]-EXHAUSTION", side: "SELL", type: "EXHAUSTION" }];
    return [];
  }
  return [];
}

function selectRoute(candidates, alignmentD1, intradayLevel) {
  if (!candidates || candidates.length === 0) return null;
  if (alignmentD1 === null) return null;
  for (const c of candidates) {
    if (c.side === 'BUY') {
      if (!D1_ALIGNMENTS_BUY.has(alignmentD1)) continue;
      if (IC_BEARISH_BLOCK_BUY.has(intradayLevel)) continue;
      return c;
    }
    if (c.side === 'SELL') {
      if (!D1_ALIGNMENTS_SELL.has(alignmentD1)) continue;
      if (IC_BULLISH_BLOCK_SELL.has(intradayLevel)) continue;
      return c;
    }
  }
  return null;
}

function getH1Conditions(side, mode, type) {
  if (type === 'CONTINUATION' && side === 'BUY') {
    if (mode === 'strict')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: -1.5, h1_dslope_max: 4.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 5,  zscoreCap: 1.75, zscoreFloor: null };
    if (mode === 'normal')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: -2.5, h1_dslope_max: 5.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 6,  zscoreCap: 2.0,  zscoreFloor: null };
    if (mode === 'soft')    return { h1_s0_min: 'flat',      h1_s0_max: null, h1_dslope_min: -3.5, h1_dslope_max: 7.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 8,  zscoreCap: 2.25, zscoreFloor: null };
    if (mode === 'relaxed') return { h1_s0_min: 'down_weak', h1_s0_max: null, h1_dslope_min: -4.5, h1_dslope_max: 8.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 10, zscoreCap: 2.75, zscoreFloor: null };
  }
  if (type === 'CONTINUATION' && side === 'SELL') {
    if (mode === 'strict')  return { h1_s0_min: null, h1_s0_max: 'down_weak', h1_dslope_min: -4.0, h1_dslope_max: 1.5,  h1_dslope_min_v_shape: -5,  h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.75 };
    if (mode === 'normal')  return { h1_s0_min: null, h1_s0_max: 'down_weak', h1_dslope_min: -5.0, h1_dslope_max: 2.5,  h1_dslope_min_v_shape: -6,  h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.0 };
    if (mode === 'soft')    return { h1_s0_min: null, h1_s0_max: 'flat',      h1_dslope_min: -7.0, h1_dslope_max: 3.5,  h1_dslope_min_v_shape: -8,  h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.25 };
    if (mode === 'relaxed') return { h1_s0_min: null, h1_s0_max: 'up_weak',   h1_dslope_min: -8.0, h1_dslope_max: 4.5,  h1_dslope_min_v_shape: -10, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.75 };
  }
  if (type === 'EXHAUSTION' && side === 'BUY') {
    if (mode === 'strict')  return { h1_s0_min: null, h1_s0_max: 'down_strong', h1_dslope_min: 1.5,  h1_dslope_max: 5,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.25 };
    if (mode === 'normal')  return { h1_s0_min: null, h1_s0_max: 'down_weak',   h1_dslope_min: 1.0,  h1_dslope_max: 6,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.75 };
    if (mode === 'soft')    return { h1_s0_min: null, h1_s0_max: 'flat',        h1_dslope_min: 0.5,  h1_dslope_max: 8,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.5 };
    if (mode === 'relaxed') return { h1_s0_min: null, h1_s0_max: 'up_weak',     h1_dslope_min: -0.5, h1_dslope_max: 10, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.25 };
  }
  if (type === 'EXHAUSTION' && side === 'SELL') {
    if (mode === 'strict')  return { h1_s0_min: 'up_strong', h1_s0_max: null, h1_dslope_min: -5,  h1_dslope_max: -1.5, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 2.25, zscoreFloor: null };
    if (mode === 'normal')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: -6,  h1_dslope_max: -1.0, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 1.75, zscoreFloor: null };
    if (mode === 'soft')    return { h1_s0_min: 'flat',      h1_s0_max: null, h1_dslope_min: -8,  h1_dslope_max: -0.5, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 1.5,  zscoreFloor: null };
    if (mode === 'relaxed') return { h1_s0_min: 'down_weak', h1_s0_max: null, h1_dslope_min: -10, h1_dslope_max: 0.5,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 1.25, zscoreFloor: null };
  }
  return { h1_s0_min: null, h1_s0_max: null, h1_dslope_min: null, h1_dslope_max: null, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: null };
}

function checkConditions(slope_h1, slope_h1_s0, dslope_h1, zscore_h1_s0, conditions, side, symbol) {
  if (slope_h1_s0 === null || dslope_h1 === null || zscore_h1_s0 === null) return { pass: false, reason: 'nullGuard' };
  const zone_s0 = getSlopeClass(slope_h1_s0, symbol);
  const zone_s0_rank = ZONE_RANK[zone_s0];
  if (zone_s0_rank === undefined) return { pass: false, reason: 'zoneUnknown', zone: zone_s0 };
  if (conditions.h1_s0_min !== null) {
    const min_rank = ZONE_RANK[conditions.h1_s0_min];
    if (zone_s0_rank < min_rank) return { pass: false, reason: 'slopeZone', detail: `${zone_s0}(${slope_h1_s0}) < ${conditions.h1_s0_min}` };
  }
  if (conditions.h1_s0_max !== null) {
    const max_rank = ZONE_RANK[conditions.h1_s0_max];
    if (zone_s0_rank > max_rank) return { pass: false, reason: 'slopeZone', detail: `${zone_s0}(${slope_h1_s0}) > ${conditions.h1_s0_max}` };
  }
  // dslope check
  const isVShape = (side === 'BUY' && slope_h1 !== null && slope_h1 < 0) || (side === 'SELL' && slope_h1 !== null && slope_h1 > 0);
  if (isVShape) {
    if (side === 'BUY') {
      const cap = conditions.h1_dslope_max_v_shape !== null ? conditions.h1_dslope_max_v_shape : conditions.h1_dslope_max;
      if (cap !== null && dslope_h1 > cap) return { pass: false, reason: 'dslope', detail: `vshape cap ${dslope_h1.toFixed(3)} > ${cap}`, vshape: true, dslope: dslope_h1, lo: conditions.h1_dslope_min, hi: cap };
      if (conditions.h1_dslope_min !== null && dslope_h1 < conditions.h1_dslope_min) return { pass: false, reason: 'dslope', detail: `vshape min ${dslope_h1.toFixed(3)} < ${conditions.h1_dslope_min}`, vshape: true, dslope: dslope_h1, lo: conditions.h1_dslope_min, hi: cap };
    } else {
      const floor = conditions.h1_dslope_min_v_shape !== null ? conditions.h1_dslope_min_v_shape : conditions.h1_dslope_min;
      if (floor !== null && dslope_h1 < floor) return { pass: false, reason: 'dslope', detail: `vshape floor ${dslope_h1.toFixed(3)} < ${floor}`, vshape: true, dslope: dslope_h1, lo: floor, hi: conditions.h1_dslope_max };
      if (conditions.h1_dslope_max !== null && dslope_h1 > conditions.h1_dslope_max) return { pass: false, reason: 'dslope', detail: `vshape max ${dslope_h1.toFixed(3)} > ${conditions.h1_dslope_max}`, vshape: true, dslope: dslope_h1, lo: floor, hi: conditions.h1_dslope_max };
    }
  } else {
    if (conditions.h1_dslope_min !== null && dslope_h1 < conditions.h1_dslope_min) return { pass: false, reason: 'dslope', detail: `${dslope_h1.toFixed(3)} < ${conditions.h1_dslope_min}`, vshape: false, dslope: dslope_h1, lo: conditions.h1_dslope_min, hi: conditions.h1_dslope_max };
    if (conditions.h1_dslope_max !== null && dslope_h1 > conditions.h1_dslope_max) return { pass: false, reason: 'dslope', detail: `${dslope_h1.toFixed(3)} > ${conditions.h1_dslope_max}`, vshape: false, dslope: dslope_h1, lo: conditions.h1_dslope_min, hi: conditions.h1_dslope_max };
  }
  // zscore check
  if (conditions.zscoreCap !== null && zscore_h1_s0 > conditions.zscoreCap) return { pass: false, reason: 'zscore', detail: `${zscore_h1_s0.toFixed(3)} > ${conditions.zscoreCap} (cap)`, zscore: zscore_h1_s0, cap: conditions.zscoreCap, floor: conditions.zscoreFloor };
  if (conditions.zscoreFloor !== null && zscore_h1_s0 < conditions.zscoreFloor) return { pass: false, reason: 'zscore', detail: `${zscore_h1_s0.toFixed(3)} < ${conditions.zscoreFloor} (floor)`, zscore: zscore_h1_s0, cap: conditions.zscoreCap, floor: conditions.zscoreFloor };
  return { pass: true };
}

// === Main pipeline per row ===
const dslopeRejects = [];
const zscoreRejects = [];
const passed = [];
let totalReached = 0;

const now = new Date();

for (const row of rows) {
  const symbol = row.symbol;
  if (!symbol) continue;

  // F0 — symbol allowed for trading
  if (!isTradable(symbol)) continue;
  if (BLOCKED_SYMBOLS.includes(symbol)) continue;

  // F1 — hours
  const marketKey = resolveMarket(row.assetclass);
  if (!GlobalMarketHours.check(marketKey, now, symbol).allowed) continue;

  // F2 — atr cap
  const riskCfg = getRiskConfig(symbol);
  const atrH1Cap = num(riskCfg?.atrH1Cap);
  const atrH1 = num(row.atr_h1);
  if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 4 * atrH1Cap) continue;

  // F3 — grey zone zscore
  const zscore_h1_s0 = num(row.zscore_h1_s0);
  if (zscore_h1_s0 === null || (zscore_h1_s0 > -0.5 && zscore_h1_s0 < 0.5)) continue;

  // intraday level
  const intra = num(row.intraday_change);
  const intCfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  const intradayLevel = getIntradayLevel(intra, intCfg);

  // F4 — spike
  const slope_h1_s0 = num(row.slope_h1_s0);
  const slope_h1 = num(row.slope_h1);
  const _spike = detectSpike(slope_h1_s0, intradayLevel);
  const _skipBuy = _spike.isSpike && _spike.direction === 'up';
  const _skipSell = _spike.isSpike && _spike.direction === 'down';

  // dslope live
  const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null) ? slope_h1_s0 - slope_h1 : null;

  // alignment D1
  const slope_d1 = num(row.slope_d1);
  const sd1s0 = num(row.slope_d1_s0);
  const dslope_d1_live = (sd1s0 !== null && slope_d1 !== null) ? sd1s0 - slope_d1 : null;
  const dslope_d1_stale = num(row.dslope_d1);
  const alignmentD1 = getAlignmentD1(slope_d1, dslope_d1_live);

  // F5 — matchRoute
  const rsi_h1_s0 = num(row.rsi_h1_s0);
  const allCandidates = matchRoute(rsi_h1_s0, zscore_h1_s0);
  const candidates = allCandidates.filter(c => {
    if (c.side === 'BUY' && _skipBuy) return false;
    if (c.side === 'SELL' && _skipSell) return false;
    return true;
  });

  // F7 — selectRoute
  const selected = selectRoute(candidates, alignmentD1, intradayLevel);
  if (!selected) continue;

  // F8 — mode
  const modeResult = getAlignmentD1Mode(alignmentD1, intradayLevel, selected.side, dslope_d1_live, dslope_d1_stale);
  const signalMode = modeResult.mode;
  const signalType = getSignalTypeFromAlignment(alignmentD1) ?? selected.type;
  if (signalMode === null) continue;

  // F9 — checkConditions
  totalReached++;
  const conditions = getH1Conditions(selected.side, signalMode, selected.type);
  const check = checkConditions(slope_h1, slope_h1_s0, dslope_h1_live, zscore_h1_s0, conditions, selected.side, symbol);

  const ctx = {
    symbol,
    side: selected.side,
    type: selected.type,
    alignment: alignmentD1,
    mode_base: modeResult.mode, // already modulated
    mode: signalMode,
    intradayLevel,
    rsi_h1_s0,
    slope_h1, slope_h1_s0, dslope_h1_live, zscore_h1_s0,
    conditions,
    check,
  };

  if (!check.pass) {
    if (check.reason === 'dslope') dslopeRejects.push(ctx);
    else if (check.reason === 'zscore') zscoreRejects.push(ctx);
    else passed.push({ ...ctx, _otherReject: check.reason });
  } else {
    passed.push(ctx);
  }
}

// === Report ===
console.log('\n=== FUNNEL SUMMARY ===');
console.log(`Reached F9 checkConditions : ${totalReached}`);
console.log(`Rejected at dslope step    : ${dslopeRejects.length}`);
console.log(`Rejected at zscore step    : ${zscoreRejects.length}`);
console.log(`Other rejects (slopeZone)  : ${passed.filter(p => p._otherReject).length}`);
console.log(`Passed checkConditions     : ${passed.filter(p => !p._otherReject).length}`);

console.log('\n=== TABLE 1 — REJETS DSLOPE ===');
for (const r of dslopeRejects) {
  console.log(`${r.symbol.padEnd(12)} ${r.side} ${r.type.padEnd(13)} | align=${r.alignment} mode=${r.mode} ic=${r.intradayLevel}`);
  console.log(`  dslope_h1_live=${r.dslope_h1_live.toFixed(3)} (slope_h1=${r.slope_h1?.toFixed(3)} → V-shape=${r.check.vshape})`);
  console.log(`  bornes : [${r.check.lo}, ${r.check.hi}]  → ${r.check.detail}`);
}

console.log('\n=== TABLE 2 — REJETS ZSCORE ===');
for (const r of zscoreRejects) {
  console.log(`${r.symbol.padEnd(12)} ${r.side} ${r.type.padEnd(13)} | align=${r.alignment} mode=${r.mode} ic=${r.intradayLevel}`);
  console.log(`  zscore_h1_s0=${r.zscore_h1_s0.toFixed(3)}  bornes : floor=${r.check.floor}, cap=${r.check.cap}  → ${r.check.detail}`);
}

// === Bonus ===
console.log('\n=== BONUS — DISTRIBUTION DES MODES ===');
const distribution = (arr) => {
  const dist = {};
  for (const r of arr) dist[r.mode] = (dist[r.mode] ?? 0) + 1;
  return dist;
};
console.log('dslope rejects :', distribution(dslopeRejects));
console.log('zscore rejects :', distribution(zscoreRejects));

// Scenario A: h1_dslope_min divisé par 2 (en valeur absolue)
console.log('\n=== SCENARIO A — h1_dslope_min /2 (relâcher la borne basse) ===');
let savedA = 0;
for (const r of dslopeRejects) {
  const c = r.conditions;
  // Use VShape thresholds if applicable
  const isVShape = r.check.vshape;
  let lo_new, hi = r.check.hi;
  if (isVShape) {
    if (r.side === 'SELL') lo_new = (c.h1_dslope_min_v_shape !== null) ? c.h1_dslope_min_v_shape * 2 : c.h1_dslope_min / 2; // /2 in abs = double in negative
    else lo_new = c.h1_dslope_min / 2;
  } else {
    lo_new = (c.h1_dslope_min !== null) ? c.h1_dslope_min / 2 : null; // halving relaxes (e.g. -3.5 → -1.75 is tighter, so for SELL we need * 2 toward more negative)
    // Actually for SELL CONT, h1_dslope_min is negative (-3.5). Dividing by 2 → -1.75 makes it tighter. To relax we need to multiply by 2 → -7.
    // Same logic for BUY EXH whose h1_dslope_min is positive (1.0). Dividing by 2 → 0.5 makes it more permissive (lower bar).
    if (c.h1_dslope_min !== null && c.h1_dslope_min < 0) lo_new = c.h1_dslope_min * 2; // relax negative
    else if (c.h1_dslope_min !== null && c.h1_dslope_min > 0) lo_new = c.h1_dslope_min / 2; // relax positive
  }
  // Re-test: would current dslope pass?
  const dslope = r.dslope_h1_live;
  const passLo = (lo_new === null) || (dslope >= lo_new);
  const passHi = (hi === null) || (dslope <= hi);
  if (passLo && passHi) savedA++;
}
console.log(`Sauvés si h1_dslope_min divisé par 2 : ${savedA} / ${dslopeRejects.length}`);

// Scenario B: zscoreFloor décalé de -0.25
console.log('\n=== SCENARIO B — zscoreFloor décalé de -0.25 ===');
let savedB = 0;
for (const r of zscoreRejects) {
  const c = r.conditions;
  const z = r.zscore_h1_s0;
  let savedThis = false;
  if (c.zscoreFloor !== null && z < c.zscoreFloor) {
    if (z >= c.zscoreFloor - 0.25) savedThis = true;
  }
  if (c.zscoreCap !== null && z > c.zscoreCap) {
    if (z <= c.zscoreCap + 0.25) savedThis = true;
  }
  if (savedThis) savedB++;
}
console.log(`Sauvés si zscore borne décalée de 0.25 : ${savedB} / ${zscoreRejects.length}`);

// Scenario C: zscoreFloor décalé de -0.5
console.log('\n=== SCENARIO C — zscoreFloor décalé de -0.5 ===');
let savedC = 0;
for (const r of zscoreRejects) {
  const c = r.conditions;
  const z = r.zscore_h1_s0;
  let savedThis = false;
  if (c.zscoreFloor !== null && z < c.zscoreFloor) {
    if (z >= c.zscoreFloor - 0.5) savedThis = true;
  }
  if (c.zscoreCap !== null && z > c.zscoreCap) {
    if (z <= c.zscoreCap + 0.5) savedThis = true;
  }
  if (savedThis) savedC++;
}
console.log(`Sauvés si zscore borne décalée de 0.5  : ${savedC} / ${zscoreRejects.length}`);
