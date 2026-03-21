// ============================================================================
// TopOpportunities.js — Routeur RSI → regime → engine
// Rôle :
//  - getRsiRegime() classe le RSI H1 en regime
//  - Chaque regime dispatch vers reversal, continuation, ou les deux (transition)
//  - 1 seul signal max par symbol, trié par score desc
// ============================================================================

import ContinuationStrategy from "./continuation";
import ReversalStrategy     from "./reversal";

const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

const SCORE_MIN_DEFAULT = 30;

// ============================================================================
// RSI REGIME ROUTER
//   RSI < 20          → REVERSAL_BUY   (extreme)
//   RSI 20–30         → REVERSAL_BUY   (deep)
//   RSI 30–35         → TRANSITION_LOW  (reversal BUY ou continuation SELL)
//   RSI 35–65         → CONTINUATION
//   RSI 65–70         → TRANSITION_HIGH (reversal SELL ou continuation BUY)
//   RSI 70–80         → REVERSAL_SELL   (deep)
//   RSI > 80          → REVERSAL_SELL   (extreme)
// ============================================================================
function getRsiRegime(rsi) {
  if (rsi === null) return null;
  if (rsi < 30)  return "REVERSAL_BUY";
  if (rsi < 35)  return "TRANSITION_LOW";
  if (rsi <= 65) return "CONTINUATION";
  if (rsi <= 70) return "TRANSITION_HIGH";
  return "REVERSAL_SELL";
}

// ============================================================================
// Helpers — pick best opp from array
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

    const rsi = num(row?.rsi_h1);
    const regime = getRsiRegime(rsi);
    if (!regime) continue;

    const oneRow = [row];

    if (regime === "REVERSAL_BUY" || regime === "REVERSAL_SELL") {
      // Reversal uniquement
      const opp = pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin }));
      setBest(best, symbol, opp);

    } else if (regime === "CONTINUATION") {
      // Continuation uniquement
      const opp = pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin }));
      setBest(best, symbol, opp);

    } else if (regime === "TRANSITION_LOW") {
      // Reversal BUY ou Continuation SELL
      const rev  = pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin }));
      const cont = pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin }));
      // Reversal prioritaire, fallback continuation
      setBest(best, symbol, rev ?? cont);

    } else if (regime === "TRANSITION_HIGH") {
      // Reversal SELL ou Continuation BUY
      const rev  = pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin }));
      const cont = pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin }));
      setBest(best, symbol, rev ?? cont);
    }
  }

  // Tri par score décroissant
  return [...best.values()].sort((a, b) => b.score - a.score);
}
