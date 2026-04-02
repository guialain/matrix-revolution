#!/usr/bin/env node
// ============================================================================
// backtest_audit.mjs — Backtest routes with TP/SL ATR-based
// Usage: node scripts/backtest_audit.mjs [path | ALL]
// ============================================================================

import { readFileSync, readdirSync } from 'fs';
import { basename } from 'path';

const AUDIT_DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const arg = process.argv[2] || 'ALL';
const files = arg === 'ALL'
  ? readdirSync(AUDIT_DIR).filter(f => f.startsWith('neo_audit_') && f.endsWith('.csv')).map(f => `${AUDIT_DIR}/${f}`)
  : [arg];

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ============================================================================
// RISK CONFIG (inline — tpAtr, slAtr, maxHoldH, spread)
// ============================================================================
const RISK = {
  EURUSD:     { tpAtr: 0.45, slAtr: 1.50, maxH: 24, spread: 0.00008 },
  AUDUSD:     { tpAtr: 0.40, slAtr: 1.50, maxH: 24, spread: 0.00008 },
  USDCHF:     { tpAtr: 0.45, slAtr: 1.50, maxH: 24, spread: 0.00015 },
  GBPUSD:     { tpAtr: 0.45, slAtr: 1.50, maxH: 24, spread: 0.00012 },
  USDJPY:     { tpAtr: 0.45, slAtr: 1.50, maxH: 24, spread: 0.013 },
  UK_100:     { tpAtr: 0.40, slAtr: 1.45, maxH: 24, spread: 2.0 },
  GERMANY_40: { tpAtr: 0.45, slAtr: 1.45, maxH: 24, spread: 5.0 },
  US_30:      { tpAtr: 0.40, slAtr: 1.45, maxH: 24, spread: 7.0 },
  US_500:     { tpAtr: 0.45, slAtr: 1.45, maxH: 24, spread: 1.0 },
  US_TECH100: { tpAtr: 0.40, slAtr: 1.45, maxH: 24, spread: 2.25 },
  BTCUSD:     { tpAtr: 0.45, slAtr: 1.65, maxH: 24, spread: 51.3 },
  ETHUSD:     { tpAtr: 0.45, slAtr: 1.65, maxH: 24, spread: 1.9 },
  GOLD:       { tpAtr: 0.50, slAtr: 1.45, maxH: 24, spread: 1.26 },
  SILVER:     { tpAtr: 0.50, slAtr: 1.45, maxH: 24, spread: 0.148 },
  CrudeOIL:   { tpAtr: 0.45, slAtr: 1.45, maxH: 24, spread: 0.04 },
  BRENT_OIL:  { tpAtr: 0.45, slAtr: 1.45, maxH: 24, spread: 0.04 },
  WHEAT:      { tpAtr: 0.35, slAtr: 1.35, maxH: 24, spread: 0.30 },
  default:    { tpAtr: 0.45, slAtr: 1.45, maxH: 24, spread: 0 },
};
const getCfg = s => RISK[s] ?? RISK.default;

// ============================================================================
// matchRoute — mirror of TopOpportunities_H1.js (current)
// ============================================================================
function matchRoute(r) {
  const rsi = num(r.rsi_h1), slope_h1 = num(r.slope_h1), dslope_h1 = num(r.dslope_h1);
  const drsi_h1 = num(r.drsi_h1), zscore_h1 = num(r.zscore_h1);
  const prevLow3 = num(r.rsi_h1_previouslow3), prevHigh3 = num(r.rsi_h1_previoushigh3);
  const zscore_h1_min3 = num(r.zscore_h1_min3), zscore_h1_max3 = num(r.zscore_h1_max3);
  const slope_h1_s0 = num(r.slope_h1_s0), drsi_h1_s0 = num(r.drsi_h1_s0), zscore_h1_s0 = num(r.zscore_h1_s0);
  const drsi_h4 = num(r.drsi_h4), drsi_h4_s0 = num(r.drsi_h4_s0);
  const slope_h4 = num(r.slope_h4), slope_h4_s0 = num(r.slope_h4_s0);

  if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

  const dslope_h4_live = (slope_h4_s0 !== null && slope_h4 !== null) ? slope_h4_s0 - slope_h4 : null;
  const h4SlopeAccel = (dslope_h4_live === null || dslope_h4_live > 0.25)
    && (slope_h4 === null || slope_h4 > -3.0);
  const h4SlopeDecel = (dslope_h4_live === null || dslope_h4_live < -1.0)
    && (slope_h4 === null || slope_h4 < 3.0);
  const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
  const h4BuyOk  = drsi_h4_eff === null || drsi_h4_eff >= -0.3;
  const h4SellOk = drsi_h4_eff === null || drsi_h4_eff <=  0.3;
  const drsi_h1_eff = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
  const h1BuyOk  = drsi_h1_eff === null || drsi_h1_eff > 0.3;
  const h1SellOk = drsi_h1_eff === null || drsi_h1_eff < -0.3;
  const slope_buy  = (slope_h1_s0 !== null) ? Math.max(slope_h1 ?? -Infinity, slope_h1_s0) : slope_h1;
  const slope_sell = (slope_h1_s0 !== null) ? Math.min(slope_h1 ?? Infinity,  slope_h1_s0) : slope_h1;
  const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null) ? slope_h1_s0 - slope_h1 : null;
  const h1SlopeAccel = dslope_h1_live === null || dslope_h1_live > 0.1;
  const h1SlopeDecel = dslope_h1_live === null || dslope_h1_live < -0.1;
  const drsi_buy  = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
  const drsi_sell = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
  const zscore = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
  const drsiS0Safe = drsi_h1_s0 === null || Math.abs(drsi_h1_s0) < 6;

  // REV BUY
  if (rsi < 25 && drsi_buy > 0 && slope_h4 !== null && slope_h4 > -3 && drsi_h4_s0 !== null && drsi_h4_s0 > 0 && dslope_h1 > 0.25 && zscore < -0.3)
    return { route: "BUY-R-[0-25]", side: "BUY", type: "REV" };
  if (rsi >= 25 && rsi < 30 && drsi_buy > 0.5 && slope_h4 !== null && slope_h4 > -3 && drsi_h4_s0 !== null && drsi_h4_s0 > 0 && dslope_h1 > 0.25 && zscore < -0.3)
    return { route: "BUY-R-[25-30]", side: "BUY", type: "REV" };
  if (rsi >= 30 && rsi < 35 && slope_h1 > -2 && drsi_buy > 1 && slope_h4 !== null && slope_h4 > -3 && drsi_h4_s0 !== null && drsi_h4_s0 > 0.5 && dslope_h1 > 0.25 && zscore < -0.8 && prevLow3 !== null && prevLow3 < 30)
    return { route: "BUY-R-[30-35]", side: "BUY", type: "REV" };

  // CONT BUY
  if (rsi >= 35 && rsi < 50 && slope_buy > 0.5 && h1SlopeAccel && h4SlopeAccel && zscore > -1.5 && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < -0.3 && prevLow3 !== null && prevLow3 < 45 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { route: "BUY-C-[35-50]-BRK", side: "BUY", type: "CONT" };
  if (rsi >= 50 && rsi < 65 && slope_h1 > -0.5 && dslope_h1_live !== null && dslope_h1_live > 1.5 && dslope_h4_live !== null && dslope_h4_live > 0.25 && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5 && prevHigh3 !== null && prevHigh3 > 65 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { route: "BUY-C-[50-65]-RET", side: "BUY", type: "CONT" };
  if (rsi >= 50 && rsi < 65 && slope_buy > -0.5 && drsi_h1 !== null && Math.abs(drsi_h1) < 6 && h1SlopeAccel && h4SlopeAccel && zscore > 0.3 && zscore < 1.6 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.05 && prevLow3 !== null && prevLow3 < 57 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { route: "BUY-C-[50-65]-BRK", side: "BUY", type: "CONT" };
  if (rsi >= 65 && rsi < 70 && slope_h1 > -1.0 && h1SlopeAccel && h4SlopeAccel && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5 && prevHigh3 !== null && prevHigh3 > 64 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { route: "BUY-C-[65-70]-RET", side: "BUY", type: "CONT" };
  if (rsi >= 65 && rsi < 70 && slope_buy > 1.0 && h1SlopeAccel && h4SlopeAccel && zscore > 0.3 && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5 && prevLow3 !== null && prevLow3 < 65 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { route: "BUY-C-[65-70]-BRK", side: "BUY", type: "CONT" };

  // CONT SELL
  if (rsi >= 50 && rsi < 65 && slope_h1 < 2.0 && dslope_h1_live !== null && dslope_h1_live < -1.5 && dslope_h4_live !== null && dslope_h4_live < -0.25 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3 && prevHigh3 !== null && prevHigh3 > 65 && drsiS0Safe && h4SellOk && h1SellOk)
    return { route: "SELL-C-[65-50]-RET", side: "SELL", type: "CONT" };
  if (rsi >= 50 && rsi < 65 && slope_sell < 0.5 && drsi_h1 !== null && Math.abs(drsi_h1) < 6 && h1SlopeDecel && h4SlopeDecel && zscore < -0.3 && zscore > -1.6 && zscore_h1_max3 !== null && zscore_h1_max3 < -0.05 && prevHigh3 !== null && prevHigh3 > 43 && drsiS0Safe && h4SellOk && h1SellOk)
    return { route: "SELL-C-[65-50]-BRK", side: "SELL", type: "CONT" };
  if (rsi >= 35 && rsi < 50 && slope_h1 < 0.5 && dslope_h1_live !== null && dslope_h1_live < -1.5 && dslope_h4_live !== null && dslope_h4_live < -0.25 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3 && prevHigh3 !== null && prevHigh3 > 35 && drsiS0Safe && h4SellOk && h1SellOk)
    return { route: "SELL-C-[50-35]-RET", side: "SELL", type: "CONT" };
  if (rsi >= 35 && rsi < 50 && slope_sell < -0.5 && h1SlopeDecel && h4SlopeDecel && zscore < -0.1 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.05 && prevHigh3 !== null && prevHigh3 > 42 && drsiS0Safe && h4SellOk && h1SellOk)
    return { route: "SELL-C-[50-35]-BRK", side: "SELL", type: "CONT" };
  if (rsi >= 30 && rsi < 35 && slope_h1 < 1.0 && h1SlopeDecel && h4SlopeDecel && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 < 0.5 && prevLow3 !== null && prevLow3 < 30 && drsiS0Safe && h4SellOk && h1SellOk)
    return { route: "SELL-C-[35-30]-RET", side: "SELL", type: "CONT" };
  if (rsi >= 30 && rsi < 35 && slope_sell < -1.0 && h1SlopeDecel && h4SlopeDecel && zscore < -0.3 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3 && prevHigh3 !== null && prevHigh3 > 35 && drsiS0Safe && h4SellOk && h1SellOk)
    return { route: "SELL-C-[35-30]-BRK", side: "SELL", type: "CONT" };

  // REV SELL
  if (rsi >= 65 && rsi < 70 && slope_h1 < 2 && slope_h4 !== null && slope_h4 < 3 && drsi_sell < -1 && drsi_h4_s0 !== null && drsi_h4_s0 < -0.5 && dslope_h1 < -0.25 && zscore > 0.8 && prevHigh3 !== null && prevHigh3 > 70)
    return { route: "SELL-R-[70-65]", side: "SELL", type: "REV" };
  if (rsi >= 70 && rsi < 75 && slope_h1 < 2 && slope_h4 !== null && slope_h4 < 3 && drsi_sell < -0.5 && drsi_h4_s0 !== null && drsi_h4_s0 < 0 && dslope_h1 < -0.25 && zscore > 0.3)
    return { route: "SELL-R-[75-70]", side: "SELL", type: "REV" };
  if (rsi >= 75 && drsi_sell < 0 && slope_h4 !== null && slope_h4 < 3 && drsi_h4_s0 !== null && drsi_h4_s0 < 0 && dslope_h1 < -0.25 && zscore > 0.3)
    return { route: "SELL-R-[100-75]", side: "SELL", type: "REV" };

  return null;
}

// ============================================================================
// M5 FILTERS — mirror of SignalFilters.js
// ============================================================================
function isM5Contrary(r, side) {
  const rsi    = num(r.rsi_m5);
  const slope  = num(r.slope_m5);
  const drsi   = num(r.drsi_m5);
  const dslope = num(r.dslope_m5);
  const rsi_s0   = num(r.rsi_m5_s0);
  const slope_s0 = num(r.slope_m5_s0);
  const slopeTh = 5;

  if (side === 'BUY') {
    if (rsi    !== null && rsi    > 68)       return true;
    if (slope  !== null && slope  < -slopeTh) return true;
    if (drsi   !== null && drsi   < -2)       return true;
    if (dslope !== null && dslope < -2.0)     return true;
    if (rsi_s0   !== null && rsi_s0   > 68)       return true;
    if (slope_s0 !== null && slope_s0 < -slopeTh) return true;
  }
  if (side === 'SELL') {
    if (rsi    !== null && rsi    < 32)       return true;
    if (slope  !== null && slope  > slopeTh)  return true;
    if (drsi   !== null && drsi   > 2)        return true;
    if (dslope !== null && dslope > 2.0)      return true;
    if (rsi_s0   !== null && rsi_s0   < 32)       return true;
    if (slope_s0 !== null && slope_s0 > slopeTh)  return true;
  }
  return false;
}

function isM5Overextended(r, side) {
  const slope    = num(r.slope_m5);
  const zm5      = num(r.zscore_m5);
  const slope_s0 = num(r.slope_m5_s0);
  const zm5_s0   = num(r.zscore_m5_s0);

  if (side === 'BUY') {
    if (slope  !== null && slope  > 7)    return true;
    if (zm5    !== null && zm5    > 2.5)  return true;
    if (slope_s0 !== null && slope_s0 > 7)   return true;
    if (zm5_s0   !== null && zm5_s0   > 2.5) return true;
  }
  if (side === 'SELL') {
    if (slope  !== null && slope  < -7)   return true;
    if (zm5    !== null && zm5    < -2.5) return true;
    if (slope_s0 !== null && slope_s0 < -7)   return true;
    if (zm5_s0   !== null && zm5_s0   < -2.5) return true;
  }
  return false;
}

// ============================================================================
// SIMULATE — TP/SL ATR + maxHold
// ============================================================================
const COOLDOWN_BARS = 1; // 1 bar = 5min cooldown
const MAX_HOLD_BARS = 288; // 24h fallback
const MAX_POS_PER_SYMBOL = 3;
const allTrades = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8').trim().split('\n');
  const headers = raw[0].split(';');
  const rows = raw.slice(1).map(line => {
    const vals = line.split(';');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim() ?? ''; });
    return obj;
  });

  const symbol = basename(file).replace('neo_audit_', '').replace('.csv', '');
  const cfg = getCfg(symbol);
  const lastSignalBar = {};
  const openPositions = []; // { closeBar }

  for (let i = 0; i < rows.length; i++) {
    // Purge closed positions
    while (openPositions.length > 0 && openPositions[0].closeBar <= i) openPositions.shift();

    const r = rows[i];
    const match = matchRoute(r);
    if (!match) continue;

    // M5 filters
    if (isM5Contrary(r, match.side)) continue;
    if (isM5Overextended(r, match.side)) continue;

    // Intraday gate — CONT only
    const intra = num(r.intraday_change);
    if (match.type === 'CONT' && intra !== null) {
      if (match.side === 'SELL' && intra > 1.5) continue;
      if (match.side === 'BUY'  && intra < -1.5) continue;
    }

    // Max positions per symbol
    if (openPositions.length >= MAX_POS_PER_SYMBOL) continue;

    const lastBar = lastSignalBar[match.route] ?? -999;
    if (i - lastBar < COOLDOWN_BARS) continue;
    lastSignalBar[match.route] = i;

    const entry = num(r.price) ?? num(r.close_m5);
    const atr = num(r.atr_h1);
    if (!entry || !atr || atr <= 0) continue;

    const tpDist = atr * cfg.tpAtr + cfg.spread;
    const slDist = atr * cfg.slAtr + cfg.spread;
    const tp = match.side === 'BUY' ? entry + tpDist : entry - tpDist;
    const sl = match.side === 'BUY' ? entry - slDist : entry + slDist;
    const maxBars = Math.min(Math.round((cfg.maxH * 60) / 5), MAX_HOLD_BARS);

    // Walk forward bar by bar
    let exitPrice = null, exitReason = null, holdBars = 0;
    for (let j = i + 1; j < rows.length && j <= i + maxBars; j++) {
      const p = num(rows[j].price) ?? num(rows[j].close_m5);
      if (!p) continue;
      holdBars = j - i;

      if (match.side === 'BUY') {
        if (p >= tp) { exitPrice = tp; exitReason = 'TP'; break; }
        if (p <= sl) { exitPrice = sl; exitReason = 'SL'; break; }
      } else {
        if (p <= tp) { exitPrice = tp; exitReason = 'TP'; break; }
        if (p >= sl) { exitPrice = sl; exitReason = 'SL'; break; }
      }
    }

    // Max hold or end of data
    if (!exitPrice) {
      const lastIdx = Math.min(i + maxBars, rows.length - 1);
      exitPrice = num(rows[lastIdx].price) ?? num(rows[lastIdx].close_m5);
      exitReason = lastIdx >= i + maxBars ? 'MAX' : 'EOD';
      holdBars = lastIdx - i;
      if (!exitPrice) continue;
    }

    const pnlPct = match.side === 'BUY'
      ? ((exitPrice - entry) / entry) * 100
      : ((entry - exitPrice) / entry) * 100;

    const holdMin = holdBars * 5;
    const holdStr = holdMin >= 60 ? `${(holdMin / 60).toFixed(1)}h` : `${holdMin}min`;

    // Track open position
    openPositions.push({ closeBar: i + holdBars });
    openPositions.sort((a, b) => a.closeBar - b.closeBar);

    allTrades.push({
      timestamp: r.timestamp, symbol, signal: match.route, type: match.type,
      side: match.side, entry, exit: exitPrice, pnl: pnlPct,
      reason: exitReason, hold: holdStr, holdMin
    });
  }
}

// ============================================================================
// OUTPUT
// ============================================================================
allTrades.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

const pad = (s, n) => String(s).padEnd(n);
const padr = (s, n) => String(s).padStart(n);

console.log('');
console.log(pad('TIMESTAMP', 18) + pad('SYMBOL', 14) + pad('SIGNAL', 26) + pad('SIDE', 6) + padr('ENTRY', 12) + padr('EXIT', 12) + padr('PnL%', 10) + pad(' EXIT', 5) + pad(' HOLD', 8));
console.log('-'.repeat(115));

let wins = 0, losses = 0, totalPnl = 0, tpCount = 0, slCount = 0;

for (const t of allTrades) {
  const icon = t.reason === 'TP' ? '✅' : t.reason === 'SL' ? '❌' : '➖';
  if (t.pnl > 0) wins++;
  else if (t.pnl < -0.05) losses++;
  totalPnl += t.pnl;
  if (t.reason === 'TP') tpCount++;
  if (t.reason === 'SL') slCount++;

  console.log(
    pad(t.timestamp, 18) + pad(t.symbol, 14) + pad(t.signal, 26) + pad(t.side, 6) +
    padr(t.entry.toFixed(2), 12) + padr(t.exit.toFixed(2), 12) +
    padr((t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(3) + '%', 10) +
    pad(' ' + t.reason, 5) + pad(' ' + t.hold, 8) + icon
  );
}

console.log('-'.repeat(115));
const total = wins + losses;
const wr = total > 0 ? ((wins / total) * 100).toFixed(0) : 'N/A';
console.log(`\nTOTAL: ${allTrades.length} trades  |  W=${wins} L=${losses} WR=${wr}%  |  TP=${tpCount} SL=${slCount}  |  PnL=${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(3)}%`);
console.log(`Avg PnL/trade: ${(totalPnl / allTrades.length).toFixed(3)}%  |  Avg hold: ${(allTrades.reduce((s,t) => s + t.holdMin, 0) / allTrades.length).toFixed(0)}min`);
