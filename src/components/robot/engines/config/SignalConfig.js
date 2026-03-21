// ============================================================================
// SignalConfig.js — Paramètres H1 généraux (defaults communs à tous les actifs)
//   Les overrides par actif sont dans AssetSignalConfig.js
//   Les multiplicateurs H4/D1 sont dans MultipliersConfig.js
//   Les seuils slope sont dans SlopeConfig.js (calibrés per-asset sur données réelles)
// ============================================================================

export const H1_REVERSAL_DEFAULTS = {
  rsiWindowH1: 3,

  // ── ZONES RSI ────────────────────────────────────────────────────
  //   rsi < rsiBuyMax              → zone principale BUY  (extrême bas)
  //   rsiBuyMax ≤ rsi < rsiBuySemi → zone secondaire BUY
  //   rsiBuySemi ≤ rsi ≤ rsiSellSemi → zone continuation (pas de reversal)
  //   rsiSellSemi < rsi ≤ rsiSellMin → zone secondaire SELL
  //   rsi > rsiSellMin             → zone principale SELL (extrême haut)
  rsiBuyMax:   30,  // seuil extrême BUY (window min)
  rsiSellMin:  70,  // seuil extrême SELL
  rsiBuySemi:  35,  // borne haute zone secondaire BUY
  rsiSellSemi: 65,  // borne basse zone secondaire SELL

  // ── SLOPE GATE ───────────────────────────────────────────────────
  dslopeH1ReversalMin: 0.5,

  // ── EXTREME ZONE SLOPE CAP ─────────────────────────────────────
  slopeExtremeBuyMax:  4,   // |slope| max en zone RSI 0–20
  slopeExtremeSellMax: 4,   // |slope| max en zone RSI 80–100

  // ── EARLY FLIP ───────────────────────────────────────────────────
  flipSlopeMin:    1.0,
  flipDslopeMin:   1.0,

  // ── BB DERIVATIVE ────────────────────────────────────────────────
  dbbzBuyMin:  0.20,
  dbbzSellMax: -0.20,

  // ── PHASES ───────────────────────────────────────────────────────
  phaseExpansionSlopeMin: 1.5,
  phaseExpansionSlopeMax: 3.5,
  phaseMatureSlopeMax:    4.5,
  phaseAccelDslopeMin:    1.5,
};

export const H1_CONTINUATION_DEFAULTS = {
  // ── PHASES ───────────────────────────────────────────────────────
  phaseExpansionSlopeMin: 1.5,
  phaseExpansionSlopeMax: 3.5,
  phaseMatureSlopeMax:    5.0,
  phaseAccelDslopeMin:    1.5,

  // ── ZONE RSI ─────────────────────────────────────────────────────
  rsiContMin: 35,
  rsiContMax: 65,

  // ── BB ───────────────────────────────────────────────────────────
  zscoreH1BuyMax:  1.8,
};

// ============================================================================
// GETTER
// ============================================================================

export function getSignalConfig(symbol) {
  return {
    h1Reversal: H1_REVERSAL_DEFAULTS,
    h1Continuation: H1_CONTINUATION_DEFAULTS,
  };
}
