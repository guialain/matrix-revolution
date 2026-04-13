#!/usr/bin/env node
// ============================================================================
// optimize_tpsl.mjs — Grid search TP/SL par asset sur données audit
// Usage: node scripts/optimize_tpsl.mjs
// ============================================================================

import { readFileSync, readdirSync } from 'fs';
import { basename } from 'path';

const AUDIT_DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const files = readdirSync(AUDIT_DIR).filter(f => f.startsWith('neo_audit_') && f.endsWith('.csv') && !f.includes('WHEAT')).map(f => `${AUDIT_DIR}/${f}`);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ============================================================================
// matchRoute — same as backtest_audit.mjs
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
  const h4SlopeAccel = (dslope_h4_live === null || dslope_h4_live > 0.25) && (slope_h4 === null || slope_h4 > -5.0);
  const h4SlopeDecel = (dslope_h4_live === null || dslope_h4_live < -1.0) && (slope_h4 === null || slope_h4 < 5.0);
  const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
  const h4BuyOk = drsi_h4_eff === null || drsi_h4_eff >= -0.3;
  const h4SellOk = drsi_h4_eff === null || drsi_h4_eff <= 0.3;
  const drsi_h1_eff = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
  const h1BuyOk = drsi_h1_eff === null || drsi_h1_eff > 0.3;
  const h1SellOk = drsi_h1_eff === null || drsi_h1_eff < -0.3;
  const slope_buy = (slope_h1_s0 !== null) ? Math.max(slope_h1 ?? -Infinity, slope_h1_s0) : slope_h1;
  const slope_sell = (slope_h1_s0 !== null) ? Math.min(slope_h1 ?? Infinity, slope_h1_s0) : slope_h1;
  const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null) ? slope_h1_s0 - slope_h1 : null;
  const h1SlopeAccel = dslope_h1_live === null || dslope_h1_live > 0.1;
  const h1SlopeDecel = dslope_h1_live === null || dslope_h1_live < -0.1;
  const drsi_buy = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
  const drsi_sell = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
  const zscore = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
  const drsiS0Safe = drsi_h1_s0 === null || Math.abs(drsi_h1_s0) < 6;

  // REV BUY
  if (rsi < 25 && drsi_buy > 0 && slope_h4 !== null && slope_h4 > -3 && drsi_h4_s0 !== null && drsi_h4_s0 > 0 && dslope_h1 > 0.25 && zscore < -0.3)
    return { side: "BUY", type: "REV" };
  if (rsi >= 25 && rsi < 30 && drsi_buy > 0.5 && slope_h4 !== null && slope_h4 > -3 && drsi_h4_s0 !== null && drsi_h4_s0 > 0 && dslope_h1 > 0.25 && zscore < -0.3)
    return { side: "BUY", type: "REV" };
  if (rsi >= 30 && rsi < 35 && slope_h1 > -2 && drsi_buy > 1 && slope_h4 !== null && slope_h4 > -3 && drsi_h4_s0 !== null && drsi_h4_s0 > 0.5 && dslope_h1 > 0.25 && zscore < -0.8 && prevLow3 !== null && prevLow3 < 30)
    return { side: "BUY", type: "REV" };

  // CONT BUY
  if (rsi >= 35 && rsi < 50 && slope_buy > 0.5 && h1SlopeAccel && h4SlopeAccel && zscore > -1.5 && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < -0.3 && prevLow3 !== null && prevLow3 < 45 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { side: "BUY", type: "CONT" };
  if (rsi >= 50 && rsi < 65 && slope_h1 > -0.5 && dslope_h1_live !== null && dslope_h1_live > 1.5 && dslope_h4_live !== null && dslope_h4_live > 0.25 && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5 && prevHigh3 !== null && prevHigh3 > 65 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { side: "BUY", type: "CONT" };
  if (rsi >= 50 && rsi < 65 && slope_buy > -0.5 && drsi_h1 !== null && Math.abs(drsi_h1) < 6 && h1SlopeAccel && h4SlopeAccel && zscore > 0.3 && zscore < 1.6 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.05 && prevLow3 !== null && prevLow3 < 57 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { side: "BUY", type: "CONT" };
  if (rsi >= 65 && rsi < 70 && slope_h1 > -1.0 && h1SlopeAccel && h4SlopeAccel && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5 && prevHigh3 !== null && prevHigh3 > 64 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { side: "BUY", type: "CONT" };
  if (rsi >= 65 && rsi < 70 && slope_buy > 1.0 && h1SlopeAccel && h4SlopeAccel && zscore > 0.3 && zscore < 1.9 && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5 && prevLow3 !== null && prevLow3 < 65 && drsiS0Safe && h4BuyOk && h1BuyOk)
    return { side: "BUY", type: "CONT" };

  // CONT SELL
  if (rsi >= 50 && rsi < 65 && slope_h1 < 2.0 && dslope_h1_live !== null && dslope_h1_live < -1.5 && dslope_h4_live !== null && dslope_h4_live < -0.25 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3 && prevHigh3 !== null && prevHigh3 > 65 && drsiS0Safe && h4SellOk && h1SellOk)
    return { side: "SELL", type: "CONT" };
  if (rsi >= 50 && rsi < 65 && slope_sell < 0.5 && drsi_h1 !== null && Math.abs(drsi_h1) < 6 && h1SlopeDecel && h4SlopeDecel && zscore < -0.3 && zscore > -1.6 && zscore_h1_max3 !== null && zscore_h1_max3 < -0.05 && prevHigh3 !== null && prevHigh3 > 43 && drsiS0Safe && h4SellOk && h1SellOk)
    return { side: "SELL", type: "CONT" };
  if (rsi >= 35 && rsi < 50 && slope_h1 < 0.5 && dslope_h1_live !== null && dslope_h1_live < -1.5 && dslope_h4_live !== null && dslope_h4_live < -0.25 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3 && prevHigh3 !== null && prevHigh3 > 35 && drsiS0Safe && h4SellOk && h1SellOk)
    return { side: "SELL", type: "CONT" };
  if (rsi >= 35 && rsi < 50 && slope_sell < -0.5 && h1SlopeDecel && h4SlopeDecel && zscore < -0.1 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.05 && prevHigh3 !== null && prevHigh3 > 42 && drsiS0Safe && h4SellOk && h1SellOk)
    return { side: "SELL", type: "CONT" };
  if (rsi >= 30 && rsi < 35 && slope_h1 < 1.0 && h1SlopeDecel && h4SlopeDecel && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 < 0.5 && prevLow3 !== null && prevLow3 < 30 && drsiS0Safe && h4SellOk && h1SellOk)
    return { side: "SELL", type: "CONT" };
  if (rsi >= 30 && rsi < 35 && slope_sell < -1.0 && h1SlopeDecel && h4SlopeDecel && zscore < -0.3 && zscore > -1.8 && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3 && prevHigh3 !== null && prevHigh3 > 35 && drsiS0Safe && h4SellOk && h1SellOk)
    return { side: "SELL", type: "CONT" };

  // REV SELL
  if (rsi >= 65 && rsi < 70 && slope_h1 < 2 && slope_h4 !== null && slope_h4 < 3 && drsi_sell < -1 && drsi_h4_s0 !== null && drsi_h4_s0 < -0.5 && dslope_h1 < -0.25 && zscore > 0.8 && prevHigh3 !== null && prevHigh3 > 70)
    return { side: "SELL", type: "REV" };
  if (rsi >= 70 && rsi < 75 && slope_h1 < 2 && slope_h4 !== null && slope_h4 < 3 && drsi_sell < -0.5 && drsi_h4_s0 !== null && drsi_h4_s0 < 0 && dslope_h1 < -0.25 && zscore > 0.3)
    return { side: "SELL", type: "REV" };
  if (rsi >= 75 && drsi_sell < 0 && slope_h4 !== null && slope_h4 < 3 && drsi_h4_s0 !== null && drsi_h4_s0 < 0 && dslope_h1 < -0.25 && zscore > 0.3)
    return { side: "SELL", type: "REV" };

  return null;
}

// M5 filters
function isM5Contrary(r, side) {
  const rsi = num(r.rsi_m5), slope = num(r.slope_m5), drsi = num(r.drsi_m5), dslope = num(r.dslope_m5);
  const rsi_s0 = num(r.rsi_m5_s0), slope_s0 = num(r.slope_m5_s0);
  if (side === 'BUY') {
    if (rsi !== null && rsi > 68) return true;
    if (slope !== null && slope < -5) return true;
    if (drsi !== null && drsi < -2) return true;
    if (dslope !== null && dslope < -2) return true;
    if (rsi_s0 !== null && rsi_s0 > 68) return true;
    if (slope_s0 !== null && slope_s0 < -5) return true;
  }
  if (side === 'SELL') {
    if (rsi !== null && rsi < 32) return true;
    if (slope !== null && slope > 5) return true;
    if (drsi !== null && drsi > 2) return true;
    if (dslope !== null && dslope > 2) return true;
    if (rsi_s0 !== null && rsi_s0 < 32) return true;
    if (slope_s0 !== null && slope_s0 > 5) return true;
  }
  return false;
}
function isM5Overextended(r, side) {
  const slope = num(r.slope_m5), zm5 = num(r.zscore_m5);
  const slope_s0 = num(r.slope_m5_s0), zm5_s0 = num(r.zscore_m5_s0);
  if (side === 'BUY') {
    if (slope !== null && slope > 7) return true;
    if (zm5 !== null && zm5 > 2.5) return true;
    if (slope_s0 !== null && slope_s0 > 7) return true;
    if (zm5_s0 !== null && zm5_s0 > 2.5) return true;
  }
  if (side === 'SELL') {
    if (slope !== null && slope < -7) return true;
    if (zm5 !== null && zm5 < -2.5) return true;
    if (slope_s0 !== null && slope_s0 < -7) return true;
    if (zm5_s0 !== null && zm5_s0 < -2.5) return true;
  }
  return false;
}

const INTRADAY = {
  EURUSD: 0.41, GBPUSD: 0.52, USDJPY: 0.50, USDCHF: 0.40, AUDUSD: 0.35,
  EURJPY: 0.41, GBPJPY: 0.48, AUDJPY: 0.45,
  US_30: 1.14, US_500: 1.02, US_TECH100: 1.60, GERMANY_40: 0.94, FRANCE_40: 0.98, UK_100: 0.88, JAPAN_225: 1.20,
  BTCUSD: 2.97, BTCEUR: 3.54, ETHUSD: 4.58,
  GOLD: 1.76, SILVER: 4.22,
  CrudeOIL: 2.32, BRENT_OIL: 2.32, GASOLINE: 6.09,
  default: 1.00,
};

// ============================================================================
// GRID SEARCH
// ============================================================================
const TP_RANGE = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80];
const SL_RANGE = [0.80, 1.00, 1.10, 1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50, 1.65, 1.80];
const COOLDOWN_BARS = 1;
const MAX_POS = 3;

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
  const strongMax = INTRADAY[symbol] ?? INTRADAY.default;

  // Pre-compute signals
  const signals = [];
  const lastBar = {};
  const openPos = [];

  for (let i = 0; i < rows.length; i++) {
    while (openPos.length > 0 && openPos[0] <= i) openPos.shift();
    const r = rows[i];
    const match = matchRoute(r);
    if (!match) continue;
    if (isM5Contrary(r, match.side)) continue;
    if (isM5Overextended(r, match.side)) continue;
    const intra = num(r.intraday_change);
    if (match.type === 'CONT' && intra !== null) {
      if (match.side === 'SELL' && intra > strongMax) continue;
      if (match.side === 'BUY' && intra < -strongMax) continue;
    }
    if (openPos.length >= MAX_POS) continue;
    const lb = lastBar[match.side] ?? -999;
    if (i - lb < COOLDOWN_BARS) continue;
    lastBar[match.side] = i;

    const entry = num(r.price) ?? num(r.close_m5);
    const atr = num(r.atr_h1);
    if (!entry || !atr || atr <= 0) continue;
    signals.push({ bar: i, side: match.side, entry, atr });
    openPos.push(i + 288); // rough estimate for position tracking
  }

  if (signals.length === 0) {
    console.log(`${symbol}: no signals\n`);
    continue;
  }

  // Grid search
  let best = { tp: 0, sl: 0, pf: 0, wr: 0, pnl: -Infinity, trades: 0 };

  for (const tpMult of TP_RANGE) {
    for (const slMult of SL_RANGE) {
      let wins = 0, losses = 0, grossWin = 0, grossLoss = 0;

      for (const sig of signals) {
        const tpDist = sig.atr * tpMult;
        const slDist = sig.atr * slMult;
        const tp = sig.side === 'BUY' ? sig.entry + tpDist : sig.entry - tpDist;
        const sl = sig.side === 'BUY' ? sig.entry - slDist : sig.entry + slDist;
        const maxBar = Math.min(sig.bar + 288, rows.length - 1);

        let exitPrice = null;
        for (let j = sig.bar + 1; j <= maxBar; j++) {
          const p = num(rows[j].price) ?? num(rows[j].close_m5);
          if (!p) continue;
          if (sig.side === 'BUY') {
            if (p >= tp) { exitPrice = tp; break; }
            if (p <= sl) { exitPrice = sl; break; }
          } else {
            if (p <= tp) { exitPrice = tp; break; }
            if (p >= sl) { exitPrice = sl; break; }
          }
        }
        if (!exitPrice) exitPrice = num(rows[maxBar].price) ?? num(rows[maxBar].close_m5);
        if (!exitPrice) continue;

        const pnl = sig.side === 'BUY' ? (exitPrice - sig.entry) / sig.entry * 100 : (sig.entry - exitPrice) / sig.entry * 100;
        if (pnl > 0) { wins++; grossWin += pnl; }
        else { losses++; grossLoss += Math.abs(pnl); }
      }

      const total = wins + losses;
      if (total < 3) continue;
      const wr = wins / total * 100;
      const pf = grossLoss > 0 ? grossWin / grossLoss : 999;
      const pnl = grossWin - grossLoss;

      if (pf > best.pf || (pf === best.pf && pnl > best.pnl)) {
        best = { tp: tpMult, sl: slMult, pf, wr, pnl, trades: total, wins, losses, grossWin, grossLoss };
      }
    }
  }

  console.log(`${symbol} — ${signals.length} signals`);
  console.log(`  BEST: tpAtr=${best.tp.toFixed(2)}  slAtr=${best.sl.toFixed(2)}  Ratio=1:${(best.sl/best.tp).toFixed(1)}  WR=${best.wr.toFixed(0)}%  PF=${best.pf.toFixed(2)}  PnL=${best.pnl >= 0 ? '+' : ''}${best.pnl.toFixed(2)}%  (${best.wins}W/${best.losses}L)`);

  // Also show top 3 by PnL
  const results = [];
  for (const tpMult of TP_RANGE) {
    for (const slMult of SL_RANGE) {
      let wins = 0, losses = 0, grossWin = 0, grossLoss = 0;
      for (const sig of signals) {
        const tpDist = sig.atr * tpMult; const slDist = sig.atr * slMult;
        const tp = sig.side === 'BUY' ? sig.entry + tpDist : sig.entry - tpDist;
        const sl = sig.side === 'BUY' ? sig.entry - slDist : sig.entry + slDist;
        const maxBar = Math.min(sig.bar + 288, rows.length - 1);
        let exitPrice = null;
        for (let j = sig.bar + 1; j <= maxBar; j++) {
          const p = num(rows[j].price) ?? num(rows[j].close_m5);
          if (!p) continue;
          if (sig.side === 'BUY') { if (p >= tp) { exitPrice = tp; break; } if (p <= sl) { exitPrice = sl; break; } }
          else { if (p <= tp) { exitPrice = tp; break; } if (p >= sl) { exitPrice = sl; break; } }
        }
        if (!exitPrice) exitPrice = num(rows[maxBar].price) ?? num(rows[maxBar].close_m5);
        if (!exitPrice) continue;
        const pnl = sig.side === 'BUY' ? (exitPrice - sig.entry) / sig.entry * 100 : (sig.entry - exitPrice) / sig.entry * 100;
        if (pnl > 0) { wins++; grossWin += pnl; } else { losses++; grossLoss += Math.abs(pnl); }
      }
      const total = wins + losses;
      if (total < 3) continue;
      const wr = wins / total * 100;
      const pf = grossLoss > 0 ? grossWin / grossLoss : 999;
      results.push({ tp: tpMult, sl: slMult, wr, pf, pnl: grossWin - grossLoss, wins, losses });
    }
  }
  results.sort((a, b) => b.pnl - a.pnl);
  console.log('  TOP 3 by PnL:');
  for (const r of results.slice(0, 3)) {
    console.log(`    tp=${r.tp.toFixed(2)} sl=${r.sl.toFixed(2)} WR=${r.wr.toFixed(0)}% PF=${r.pf.toFixed(2)} PnL=${r.pnl >= 0?'+':''}${r.pnl.toFixed(2)}% (${r.wins}W/${r.losses}L)`);
  }
  console.log();
}
