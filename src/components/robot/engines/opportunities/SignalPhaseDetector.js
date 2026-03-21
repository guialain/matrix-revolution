// ============================================================================
// SignalPhaseDetector.js — Classifie la phase de marché H1
//   Utilisé par continuation.js et reversal.js
//
// ── CONTINUATION PHASES (entrées dans le sens du trade) ──────────────────────
//   EXPANSION_ACCELERATING : expMin ≤ |slope| ≤ expMax  AND  signedDslope ≥ accelMin
//   EXPANSION              : expMin ≤ |slope| ≤ expMax  AND  signedDslope > 0
//   EARLY_TREND            : |slope| < expMin            AND  signedDslope ≥ accelMin
//   MATURE_CONTINUATION    : expMax < |slope| ≤ matureMax AND  signedDslope > 0
//   null                   : FLAT | EXPANSION_SLOWING | MATURE_SLOWING | CLIMAX_RUN
//
// ============================================================================

/**
 * Classifie la phase de continuation pour un trade dans le sens de la tendance.
 * @param {number} slope_h1
 * @param {number} dslope_h1
 * @param {"BUY"|"SELL"} side  — direction du trade
 * @param {object} cfg         — doit contenir phaseExpansionSlopeMin/Max, phaseMatureSlopeMax, phaseAccelDslopeMin
 * @returns {string|null}  phase name or null (NO_TRADE)
 */
export function detectContinuationPhase(slope_h1, dslope_h1, side, cfg) {
  if (!Number.isFinite(slope_h1) || !Number.isFinite(dslope_h1)) return null;

  const dir          = side === "BUY" ? 1 : -1;
  const signedSlope  = slope_h1 * dir;   // > 0 si tendance dans le sens du trade
  const signedDslope = dslope_h1 * dir;  // > 0 si momentum dans le sens du trade

  if (signedSlope <= 0) return null; // tendance opposée ou absente

  const {
    phaseExpansionSlopeMin: expMin,
    phaseExpansionSlopeMax: expMax,
    phaseMatureSlopeMax:    matureMax,
    phaseAccelDslopeMin:    accelMin,
  } = cfg;

  const abs = signedSlope; // = Math.abs(slope_h1) car signedSlope > 0

  if (abs < expMin) {
    // Zone EARLY (<expMin) : tendance faible, nécessite fort momentum
    return signedDslope >= accelMin ? "EARLY_TREND" : null; // sinon FLAT
  }

  if (abs <= expMax) {
    // Zone EXPANSION (expMin–expMax)
    if (signedDslope >= accelMin) return "EXPANSION_ACCELERATING";
    if (signedDslope > 0)         return "EXPANSION";
    return null; // EXPANSION_SLOWING → bloqué
  }

  if (abs <= matureMax) {
    // Zone MATURE (expMax–matureMax)
    return signedDslope > 0 ? "MATURE_CONTINUATION" : null; // MATURE_SLOWING → bloqué
  }

  return null; // CLIMAX_RUN (>matureMax dans le sens du trade) → bloqué
}
