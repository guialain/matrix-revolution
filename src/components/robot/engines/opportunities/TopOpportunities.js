// ============================================================================
// TopOpportunities.js — Wrapper live identique au backtest
// Rôle :
//  - Pour chaque symbol : reversal d'abord, continuation si pas de reversal
//  - 1 seul signal max par symbol (priorité reversal)
//  - scoreMin appliqué
// ============================================================================

import ContinuationStrategy from "./continuation";
import ReversalStrategy     from "./reversal";

const SCORE_MIN_DEFAULT = 30;

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

    const oneRow = [row];

    // Reversal first (priorité)
    const revOpps = ReversalStrategy.evaluate(oneRow, { scoreMin });
    if (revOpps.length) {
      const top = revOpps.reduce((a, b) => (a.score >= b.score ? a : b));
      const existing = best.get(symbol);
      if (!existing || top.score > existing.score) {
        best.set(symbol, top);
      }
      continue; // reversal trouvé → pas de continuation pour ce symbol
    }

    // Continuation en fallback
    const contOpps = ContinuationStrategy.evaluate(oneRow, { scoreMin });
    if (contOpps.length) {
      const top = contOpps.reduce((a, b) => (a.score >= b.score ? a : b));
      const existing = best.get(symbol);
      if (!existing || top.score > existing.score) {
        best.set(symbol, top);
      }
    }
  }

  // Tri par score décroissant
  return [...best.values()].sort((a, b) => b.score - a.score);
}
