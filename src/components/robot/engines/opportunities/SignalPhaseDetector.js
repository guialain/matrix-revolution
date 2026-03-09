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
// ── REVERSAL PHASES (entrées contre la tendance établie) ─────────────────────
//   REVERSAL_START  : |slope| > matureMax  AND  |anti-dslope| > accelMin × 2
//   CLIMAX_SLOWING  : |slope| > matureMax  AND  accelMin ≤ |anti-dslope| ≤ accelMin × 2
//   MATURE_END      : expMax ≤ |slope| ≤ matureMax  AND  |anti-dslope| ≥ accelMin
//   EXPANSION_END   : expMin ≤ |slope| < expMax      AND  |anti-dslope| ≥ accelMin
//   null            : FLAT | EXPANSION_SLOWING | MATURE_SLOWING | CLIMAX_RUN
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

/**
 * Classifie la phase de reversal pour un trade contre la tendance établie.
 * @param {number} slope_h1
 * @param {number} dslope_h1
 * @param {"BUY"|"SELL"} side  — direction du TRADE (opposée à la tendance existante)
 * @param {object} cfg         — doit contenir phaseExpansionSlopeMin/Max, phaseMatureSlopeMax, phaseAccelDslopeMin
 * @returns {string|null}  phase name or null (NO_TRADE)
 */
export function detectReversalPhase(slope_h1, dslope_h1, side, cfg) {
  if (!Number.isFinite(slope_h1) || !Number.isFinite(dslope_h1)) return null;

  // BUY reversal : tendance existante est baissière (slope < 0), flex haussier (dslope > 0)
  // SELL reversal: tendance existante est haussière (slope > 0), flex baissier (dslope < 0)
  const trendDir     = side === "BUY" ? -1 : 1;
  const signedSlope  = slope_h1 * trendDir;    // > 0 = tendance établie contre le trade
  const signedDslope = dslope_h1 * (-trendDir); // > 0 = flex dans le sens du trade (reversal)

  if (signedSlope <= 0) return null; // pas de tendance à renverser
  if (signedDslope <= 0) return null; // pas de flex dans le sens du trade

  const {
    phaseExpansionSlopeMin: expMin,
    phaseExpansionSlopeMax: expMax,
    phaseMatureSlopeMax:    matureMax,
    phaseAccelDslopeMin:    accelMin,
  } = cfg;

  const flexStrong = accelMin * 2; // seuil fort (ex: 1.5 × 2 = 3.0)
  const abs        = signedSlope;  // = |slope_h1|

  if (abs > matureMax) {
    // Zone CLIMAX (>matureMax)
    if (signedDslope > flexStrong)        return "REVERSAL_START";  // renversement fort
    if (signedDslope >= accelMin)         return "CLIMAX_SLOWING";  // ralentissement
    return null; // CLIMAX_RUN : flex trop faible, trop risqué
  }

  if (abs >= expMax) {
    // Zone MATURE (expMax–matureMax)
    return signedDslope >= accelMin ? "MATURE_END" : null; // MATURE_SLOWING → bloqué
  }

  if (abs >= expMin) {
    // Zone EXPANSION (expMin–expMax)
    return signedDslope >= accelMin ? "EXPANSION_END" : null; // EXPANSION_SLOWING → bloqué
  }

  return null; // FLAT (<expMin) : pas de tendance à renverser
}
