// ============================================================================
// IntradayConfig.js — calibration P95 sur données réelles MQL5
// Source : intraday_change (%) valeur absolue
// Régimes : 'low' | 'strong'
// NE PAS MODIFIER — valeurs calibrées backtest
// ============================================================================

export const INTRADAY_CONFIG = {
  // Forex
  EURUSD:      { strongMax: 0.41 },
  GBPUSD:      { strongMax: 0.52 },
  USDJPY:      { strongMax: 0.50 },
  EURJPY:      { strongMax: 0.41 },
  GBPJPY:      { strongMax: 0.48 },
  EURGBP:      { strongMax: 0.31 },

  // Indices
  US_30:       { strongMax: 1.14 },
  US_500:      { strongMax: 1.02 },
  US_TECH100:  { strongMax: 1.60 },
  GERMANY_40:  { strongMax: 0.94 },
  FRANCE_40:   { strongMax: 0.98 },
  UK_100:      { strongMax: 0.88 },

  // Crypto
  BTCUSD:      { strongMax: 2.97 },
  BTCEUR:      { strongMax: 3.54 },
  BTCJPY:      { strongMax: 2.90 },
  ETHUSD:      { strongMax: 4.58 },

  // Metals
  GOLD:        { strongMax: 1.76 },
  SILVER:      { strongMax: 4.22 },
  PLATINUM:    { strongMax: 4.58 },
  PALLADIUM:   { strongMax: 5.16 },

  // Energy
  CrudeOIL:    { strongMax: 2.32 },
  NATURAL_GAS: { strongMax: 6.09 },
  HEATING_OIL: { strongMax: 2.80 },

  // Softs
  COCOA:       { strongMax: 5.17 },
  COFFEE_C:    { strongMax: 3.16 },
  WHEAT:       { strongMax: 1.49 },

  default:     { strongMax: 1.00 },
};

// ============================================================================
// HELPERS
// ============================================================================
export function getIntradayRegime(symbol, intraday_change) {
  if (!Number.isFinite(intraday_change)) return 'unknown';
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  const abs  = Math.abs(intraday_change);
  return abs >= cfg.strongMax ? 'strong' : 'low';
}

export function getIntradayRatio(symbol, intraday_change) {
  if (!Number.isFinite(intraday_change)) return 0;
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  return Math.abs(intraday_change) / cfg.strongMax;
}