// ============================================================================
// TopOpportunities.js — Routeur RSI 9 zones → engine
// Rôle :
//  - getRsiRegime() classe le RSI H1 en 9 zones
//  - Chaque regime dispatch vers reversal, continuation, ou les deux
//  - 1 seul signal max par symbol, trié par score desc
// ============================================================================

import ContinuationStrategy from "./continuation";
import ReversalStrategy     from "./reversal";
import ZmidStrategy         from "./ZmidStrategy";
import { getSlopeConfig }   from "../config/SlopeConfig";

const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

const SCORE_MIN_DEFAULT = 30;

// ============================================================================
// RSI REGIME ROUTER — 9 zones
// ============================================================================
function getRsiRegime(rsi) {
  if (rsi === null) return null;
  if (rsi < 20) return "EXTREME_OVERSOLD";
  if (rsi < 30) return "OVERSOLD";
  if (rsi < 35) return "TRANSITION_LOW_1";
  if (rsi < 48) return "TRANSITION_LOW_2";
  if (rsi < 52) return "NEUTRAL";
  if (rsi < 65) return "TRANSITION_HIGH_2";
  if (rsi < 70) return "TRANSITION_HIGH_1";
  if (rsi < 80) return "OVERBOUGHT";
  return "EXTREME_OVERBOUGHT";
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
    const zscore = num(row?.zscore_h1);
    const zMin3  = num(row?.zscore_h1_min3);
    const zMax3  = num(row?.zscore_h1_max3);
    const oneRow = [row];

    // ── ZMID check first ──
    const isZmidZone = zscore !== null && Math.abs(zscore) < 0.5
                    && zMin3 !== null && zMax3 !== null
                    && (zMax3 - zMin3) > 0.5;

    if (isZmidZone) {
      if (rsi !== null && rsi >= 48 && rsi <= 52) continue; // NEUTRAL → WAIT
      setBest(best, symbol, pickBest(ZmidStrategy.evaluate(oneRow, { scoreMin })));
      continue;
    }

    // ── Route RSI normal — 9 zones ──
    const regime = getRsiRegime(rsi);
    if (!regime) continue;

    // ── EXTREME + DEEP → reversal only ──
    if (regime === "EXTREME_OVERSOLD" || regime === "OVERSOLD" ||
        regime === "OVERBOUGHT" || regime === "EXTREME_OVERBOUGHT") {
      setBest(best, symbol, pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin })));

    // ── TRANSITION_1 → reversal + continuation ──
    } else if (regime === "TRANSITION_LOW_1") {
      const prevRSIMin = num(row?.rsi_h1_previouslow3);
      if (prevRSIMin !== null && prevRSIMin < 30) {
        const slope  = num(row?.slope_h1);
        const dslope = num(row?.dslope_h1);
        const slopeMin = getSlopeConfig(symbol).up_weak.min;

        if (slope > slopeMin && dslope > 0) {
          setBest(best, symbol, pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin })));
        } else if (slope < -slopeMin && dslope < 0) {
          setBest(best, symbol, pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin })));
        }
      }

    } else if (regime === "TRANSITION_HIGH_1") {
      const prevRSIMax = num(row?.rsi_h1_previoushigh3);
      if (prevRSIMax !== null && prevRSIMax > 70) {
        const slope  = num(row?.slope_h1);
        const dslope = num(row?.dslope_h1);
        const slopeMin = getSlopeConfig(symbol).up_weak.min;

        if (slope < -slopeMin && dslope < 0) {
          setBest(best, symbol, pickBest(ReversalStrategy.evaluate(oneRow, { scoreMin })));
        } else if (slope > slopeMin && dslope > 0) {
          setBest(best, symbol, pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin })));
        }
      }

    // ── TRANSITION_2 → continuation only ──
    } else if (regime === "TRANSITION_LOW_2" || regime === "TRANSITION_HIGH_2") {
      setBest(best, symbol, pickBest(ContinuationStrategy.evaluate(oneRow, { scoreMin })));

    // ── NEUTRAL → WAIT ──
    }
    // regime === "NEUTRAL" → skip
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}
