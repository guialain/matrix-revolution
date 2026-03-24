// ============================================================================
// backtest-uk100.mjs — Backtest UK_100 on 5min data
// Replicates: 12-route matchRoute + ScoreEngine + SignalFilters
// Simulates trades with ATR-based TP/SL grid
// ============================================================================

import { readFileSync } from 'fs';

// ── HELPERS ──────────────────────────────────────────────────────────────────
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ── CONFIGS (inlined for standalone) ─────────────────────────────────────────
const VOL_CFG = { lowMax: 0.000767, medMax: 0.001350, highMax: 0.002041 };
const INTRADAY_STRONG_MAX = 0.88;

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

// ── 12-ROUTE MATCHER (aligned with TopOpportunities.js) ─────────────────────
function matchRoute(rsi, slope_h1, dslope_h1, zscore_h1) {
  if (rsi === null || slope_h1 === null || dslope_h1 === null) return null;

  if (rsi < 25 && slope_h1 < -6 && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };
  if (rsi >= 25 && rsi < 30 && slope_h1 < -2 && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };
  if (rsi >= 30 && rsi < 35 && slope_h1 > 1.0 && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

  if (rsi >= 30 && rsi < 35 && slope_h1 <= -2.0 && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-C-[30-35]", side: "SELL", type: "CONTINUATION" };
  if (rsi >= 35 && rsi < 48 && slope_h1 <= -1.5 && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-C-[35-48]", side: "SELL", type: "CONTINUATION" };

  if (rsi >= 35 && rsi < 48 && slope_h1 >= 1.0 && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-C-[35-48]", side: "BUY", type: "CONTINUATION" };
  if (rsi >= 52 && rsi < 65 && slope_h1 >= 1.5 && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-C-[52-65]", side: "BUY", type: "CONTINUATION" };
  if (rsi >= 52 && rsi < 65 && slope_h1 <= -1.0 && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-C-[52-65]", side: "SELL", type: "CONTINUATION" };

  if (rsi >= 65 && rsi < 70 && slope_h1 >= 2.0 && dslope_h1 > 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

  if (rsi >= 65 && rsi < 70 && slope_h1 < -1.0 && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-R-[65-70]", side: "SELL", type: "REVERSAL" };
  if (rsi >= 70 && rsi < 75 && slope_h1 > 2.0 && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };
  if (rsi >= 75 && slope_h1 > 6.0 && dslope_h1 < 0
   && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
    return { route: "SELL-R-[75-100]", side: "SELL", type: "REVERSAL" };

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

// ── SCORE ENGINE (UK_100 — index points) ────────────────────────────────────
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

// ── MARKET HOURS FILTER (INDEX: 9-21 GMT, weekday only) ─────────────────────
function isMarketOpen(ts) {
  const parts = ts.split(/[.\s:]/);
  const y = +parts[0], mo = +parts[1] - 1, d = +parts[2], h = +parts[3], m = +parts[4];
  const dt = new Date(Date.UTC(y, mo, d, h, m));
  const dow = dt.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const hourDec = h + m / 60;
  return hourDec >= 9 && hourDec < 21;
}

// ── LOAD CSV ─────────────────────────────────────────────────────────────────
const CSV_PATH = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/UK_100_5min.csv";
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

  const rsi_h1 = num(row.rsi_h1), slope_h1 = num(row.slope_h1);
  const dslope_h1 = num(row.dslope_h1), zscore_h1 = num(row.zscore_h1);

  const match = matchRoute(rsi_h1, slope_h1, dslope_h1, zscore_h1);
  if (!match) continue;

  const rsiStats = getMinMaxRSI_H1(rows, i, 3);
  const opp = {
    symbol: 'UK_100',
    rsi_h1, slope_h1, dslope_h1, zscore_h1,
    rsi_h1_previouslow3:  rsiStats?.minRSI ?? rsi_h1,
    rsi_h1_previoushigh3: rsiStats?.maxRSI ?? rsi_h1,
    atr_m15: num(row.atr_m15), close: num(row.close),
    intraday_change: num(row.intraday_change) ?? 0,
  };

  const scoreFn =
    match.type === "REVERSAL" && match.side === "BUY"  ? scoreReversalBuy :
    match.type === "REVERSAL" && match.side === "SELL" ? scoreReversalSell :
    match.type === "CONTINUATION" && match.side === "BUY"  ? scoreContinuationBuy :
    scoreContinuationSell;

  const score = scoreFn(opp);
  if (score < SCORE_MIN) continue;

  signals.push({
    index: i,
    timestamp: row.timestamp,
    type: match.type, side: match.side,
    signalType: match.route, score,
    close: num(row.close),
    atr_h1: num(row.atr_h1),
  });
}

console.log(`Signals generated: ${signals.length} (scoreMin=${SCORE_MIN})`);
console.log(`  REVERSAL: ${signals.filter(s => s.type === "REVERSAL").length}`);
console.log(`  CONTINUATION: ${signals.filter(s => s.type === "CONTINUATION").length}`);
console.log(`  BUY: ${signals.filter(s => s.side === "BUY").length}  SELL: ${signals.filter(s => s.side === "SELL").length}\n`);

// ── BACKTEST SIMULATION ──────────────────────────────────────────────────────
const COOLDOWN_BARS = 60;   // 5h cooldown
const SPREAD = 2.0;         // UK_100 spread in points

function simulate(tpMul, slMul) {
  const trades = [];
  let lastEntryIdx = -COOLDOWN_BARS - 1;

  for (const sig of signals) {
    if (sig.index - lastEntryIdx < COOLDOWN_BARS) continue;
    const atr = sig.atr_h1;
    if (!atr || atr <= 0) continue;

    const entry = sig.close + (sig.side === "BUY" ? SPREAD / 2 : -SPREAD / 2);
    // TP/SL nets de spread (comme en live : le spread réduit le TP effectif)
    const tpDist = atr * tpMul - SPREAD;
    const slDist = atr * slMul + SPREAD;

    let tp, sl;
    if (sig.side === "BUY") {
      tp = entry + tpDist;
      sl = entry - slDist;
    } else {
      tp = entry - tpDist;
      sl = entry + slDist;
    }

    let exitPrice = null, exitIdx = null, exitReason = null;
    for (let j = sig.index + 1; j < rows.length; j++) {
      const high = num(rows[j].high);
      const low = num(rows[j].low);
      if (high === null || low === null) continue;

      if (sig.side === "BUY") {
        if (low <= sl) { exitPrice = sl; exitIdx = j; exitReason = "SL"; break; }
        if (high >= tp) { exitPrice = tp; exitIdx = j; exitReason = "TP"; break; }
      } else {
        if (high >= sl) { exitPrice = sl; exitIdx = j; exitReason = "SL"; break; }
        if (low <= tp) { exitPrice = tp; exitIdx = j; exitReason = "TP"; break; }
      }
    }

    if (!exitPrice) continue;

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
const TP_RANGE = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 1.00, 1.20];
const SL_RANGE = [0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.50];

const results = [];

for (const tp of TP_RANGE) {
  for (const sl of SL_RANGE) {
    const trades = simulate(tp, sl);
    if (trades.length < 3) continue;

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

    // Max drawdown
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
console.log("=" .repeat(140));
console.log("TP/SL OPTIMIZATION GRID — UK_100 (5min, scoreMin=30, cooldown=5h)");
console.log("=" .repeat(140));
console.log(
  "TP×ATR".padEnd(8) +
  "SL×ATR".padEnd(8) +
  "#Trades".padEnd(9) +
  "WR%".padEnd(8) +
  "PF".padEnd(8) +
  "Net(pts)".padEnd(11) +
  "AvgHold".padEnd(10) +
  "AvgWin".padEnd(10) +
  "AvgLoss".padEnd(10) +
  "MaxDD".padEnd(10) +
  "#REV".padEnd(7) +
  "REV_WR".padEnd(9) +
  "#CONT".padEnd(7) +
  "CONT_WR".padEnd(9)
);
console.log("-".repeat(140));

for (const r of results.slice(0, 30)) {
  console.log(
    `${r.tp.toFixed(2)}`.padEnd(8) +
    `${r.sl.toFixed(2)}`.padEnd(8) +
    `${r.trades}`.padEnd(9) +
    `${(r.wr * 100).toFixed(1)}%`.padEnd(8) +
    `${r.pf.toFixed(2)}`.padEnd(8) +
    `${r.netPnl.toFixed(1)}`.padEnd(11) +
    `${Math.round(r.avgHold)}min`.padEnd(10) +
    `${r.avgWin.toFixed(1)}p`.padEnd(10) +
    `${r.avgLoss.toFixed(1)}p`.padEnd(10) +
    `${r.maxDD.toFixed(1)}p`.padEnd(10) +
    `${r.revCount}`.padEnd(7) +
    `${(r.revWR * 100).toFixed(1)}%`.padEnd(9) +
    `${r.contCount}`.padEnd(7) +
    `${(r.contWR * 100).toFixed(1)}%`.padEnd(9)
  );
}

// ── BEST COMBO DETAIL ────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(80));
console.log("BEST COMBO DETAIL (highest PF with ≥5 trades)");
console.log("=".repeat(80));

const best = results.find(r => r.trades >= 5) ?? results[0];
if (best) {
  const trades = simulate(best.tp, best.sl);
  console.log(`\nTP=${best.tp}×ATR  SL=${best.sl}×ATR`);
  console.log(`Trades: ${best.trades}  WR: ${(best.wr*100).toFixed(1)}%  PF: ${best.pf.toFixed(2)}  Net: ${best.netPnl.toFixed(1)} pts`);
  console.log(`AvgHold: ${Math.round(best.avgHold)} min  AvgWin: ${best.avgWin.toFixed(1)}p  AvgLoss: ${best.avgLoss.toFixed(1)}p  MaxDD: ${best.maxDD.toFixed(1)}p`);
  console.log(`\nREVERSAL: ${best.revCount} trades (WR ${(best.revWR*100).toFixed(1)}%)`);
  console.log(`CONTINUATION: ${best.contCount} trades (WR ${(best.contWR*100).toFixed(1)}%)`);

  console.log(`\nTrade log (first 25):`);
  console.log("Time".padEnd(18) + "Type".padEnd(6) + "Side".padEnd(6) + "Score".padEnd(7) + "PnL(p)".padEnd(10) + "Exit".padEnd(5) + "Hold".padEnd(8));
  console.log("-".repeat(60));
  for (const t of trades.slice(0, 25)) {
    console.log(
      t.timestamp.padEnd(18) +
      t.type.slice(0,4).padEnd(6) +
      t.side.padEnd(6) +
      t.score.toFixed(1).padEnd(7) +
      `${t.pnl.toFixed(1)}`.padEnd(10) +
      t.exitReason.padEnd(5) +
      `${t.holdMinutes}m`.padEnd(8)
    );
  }
}

// ── CURRENT CONFIG ───────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(80));
console.log("CURRENT CONFIG: TP=0.60×ATR  SL=1.50×ATR");
console.log("=".repeat(80));
const currentR = results.find(r => r.tp === 0.60 && r.sl === 1.50);
if (currentR) {
  console.log(`Trades: ${currentR.trades}  WR: ${(currentR.wr*100).toFixed(1)}%  PF: ${currentR.pf.toFixed(2)}  Net: ${currentR.netPnl.toFixed(1)} pts`);
  console.log(`AvgHold: ${Math.round(currentR.avgHold)} min  AvgWin: ${currentR.avgWin.toFixed(1)}p  AvgLoss: ${currentR.avgLoss.toFixed(1)}p  MaxDD: ${currentR.maxDD.toFixed(1)}p`);
  console.log(`REVERSAL: ${currentR.revCount} (WR ${(currentR.revWR*100).toFixed(1)}%)  CONTINUATION: ${currentR.contCount} (WR ${(currentR.contWR*100).toFixed(1)}%)`);
} else {
  console.log("(not enough trades for this combo)");
}

// ── SUMMARY: TOP 5 sorted by net PnL (min 5 trades) ─────────────────────────
console.log("\n" + "=".repeat(80));
console.log("TOP 5 BY NET PNL (≥5 trades)");
console.log("=".repeat(80));
const byNet = results.filter(r => r.trades >= 5).sort((a, b) => b.netPnl - a.netPnl);
for (const r of byNet.slice(0, 5)) {
  console.log(`TP=${r.tp.toFixed(2)}  SL=${r.sl.toFixed(2)}  | ${r.trades} trades  WR=${(r.wr*100).toFixed(1)}%  PF=${r.pf.toFixed(2)}  Net=${r.netPnl.toFixed(1)}pts  MaxDD=${r.maxDD.toFixed(1)}pts`);
}

console.log("\n" + "=".repeat(80));
console.log("TOP 5 BY PROFIT FACTOR (≥5 trades)");
console.log("=".repeat(80));
const byPF = results.filter(r => r.trades >= 5).sort((a, b) => b.pf - a.pf);
for (const r of byPF.slice(0, 5)) {
  console.log(`TP=${r.tp.toFixed(2)}  SL=${r.sl.toFixed(2)}  | ${r.trades} trades  WR=${(r.wr*100).toFixed(1)}%  PF=${r.pf.toFixed(2)}  Net=${r.netPnl.toFixed(1)}pts  MaxDD=${r.maxDD.toFixed(1)}pts`);
}
