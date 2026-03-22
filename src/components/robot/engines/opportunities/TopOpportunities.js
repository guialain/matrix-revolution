// ============================================================================
// TopOpportunities.js — Routeur RSI 9 zones → engine
// Rôle :
//  - getRsiRegime() classe le RSI H1 en 9 zones
//  - Chaque regime dispatch vers reversal, continuation, ou les deux
//  - 1 seul signal max par symbol, trié par score desc
// ============================================================================

import ContinuationStrategy from "./continuation";
import ReversalStrategy     from "./reversal";
// ZmidStrategy removed — zone z~0 too noisy, continuation handles it better

const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

const SCORE_MIN_DEFAULT = 30;

// ============================================================================
// RSI REGIME ROUTER — continuation zones (30-70)
// Reversals bypass the router (M15 detector)
// ============================================================================
function getRsiRegime(rsi) {
  if (rsi === null) return null;
  if (rsi < 30 || rsi >= 70) return null;   // reversal territory
  if (rsi < 35) return "OVERSOLD_NEAR";     // 30-35
  if (rsi < 48) return "TRANSITION_LOW";    // 35-48
  if (rsi < 52) return "NEUTRAL";           // 48-52
  if (rsi < 65) return "TRANSITION_HIGH";   // 52-65
  if (rsi < 70) return "OVERBOUGHT_NEAR";   // 65-70
  return null;
}

// ============================================================================
// Helpers
// ============================================================================
function pickBest(opps) {
  if (!opps.length) return null;
  return opps.reduce((a, b) => (a.score >= b.score ? a : b));
}

function setBest(map, symbol, opp) {
  if (!opp) return;
  const existing = map.get(symbol);
  if (!existing || opp.score > existing.score) {
    map.set(symbol, opp);
  }
}

// ============================================================================
// MAIN
// ============================================================================

/**
 * @param {Array} marketData — tableau de rows (1 row = 1 symbol, live snapshot)
 * @param {object} [opts]
 * @param {number} [opts.scoreMin=30]
 * @returns {Array} — opps dédupliquées (1 par symbol max), triées par score desc
 */
export function evaluateTopOpportunities(marketData = [], opts = {}) {
  if (!Array.isArray(marketData) || !marketData.length) return [];

  const scoreMin = opts.scoreMin ?? SCORE_MIN_DEFAULT;
  const best = new Map(); // symbol → opp

  for (const row of marketData) {
    const symbol = row?.symbol;
    if (!symbol) continue;

    const rsi    = num(row?.rsi_h1);
    const oneRow = [row];

    // ── Reversal M15: bypass router, always evaluate ──
    setBest(best, symbol, pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin })));

    // ── Continuation: route by RSI regime (30-70) ──
    const regime = getRsiRegime(rsi);
    if (!regime) continue;

    if (regime === "OVERSOLD_NEAR" || regime === "OVERBOUGHT_NEAR" ||
        regime === "TRANSITION_LOW" || regime === "TRANSITION_HIGH") {
      setBest(best, symbol, pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin })));
    }
    // NEUTRAL → skip
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}
