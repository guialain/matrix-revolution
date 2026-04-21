// ============================================================================
// VolatilityConfig.js — calibration P15/P70/P95 sur données réelles 09:30-21:30
// Ratio : atr_m15 / close
// Régimes : 'low' | 'med' | 'high' | 'explo'
// NE PAS MODIFIER — valeurs calibrées backtest
// ============================================================================

export const VOLATILITY_CONFIG = {
  // FX
  EURUSD:      { lowMax: 0.000369, medMax: 0.000715, highMax: 0.001175 },
  AUDUSD:      { lowMax: 0.000369, medMax: 0.000715, highMax: 0.001175 },
  GBPUSD:      { lowMax: 0.000447, medMax: 0.000819, highMax: 0.001276 },
  USDJPY:      { lowMax: 0.000423, medMax: 0.000837, highMax: 0.001474 },
  USDCHF:      { lowMax: 0.000369, medMax: 0.000715, highMax: 0.001175 },
  // INDEX
  UK_100:      { lowMax: 0.000602, medMax: 0.001551, highMax: 0.002781 },
  GERMANY_40:  { lowMax: 0.000843, medMax: 0.002030, highMax: 0.003774 },
  FRANCE_40:   { lowMax: 0.001213, medMax: 0.001841, highMax: 0.003359 },
  US_30:       { lowMax: 0.000705, medMax: 0.002031, highMax: 0.002994 },
  US_500:      { lowMax: 0.000746, medMax: 0.001969, highMax: 0.002870 },
  US_TECH100:  { lowMax: 0.000929, medMax: 0.002156, highMax: 0.003422 },
  // CRYPTO
  BTCEUR:      { lowMax: 0.001308, medMax: 0.003102, highMax: 0.005325 },
  BTCUSD:      { lowMax: 0.001383, medMax: 0.003352, highMax: 0.005554 },
  ETHUSD:      { lowMax: 0.001883, medMax: 0.004443, highMax: 0.007501 },
  // METAL
  GOLD:        { lowMax: 0.000280, medMax: 0.002920, highMax: 0.004457 },
  SILVER:      { lowMax: 0.002047, medMax: 0.004944, highMax: 0.008747 },
  // ENERGY
  CrudeOIL:    { lowMax: 0.003162, medMax: 0.008548, highMax: 0.015038 },
  BRENT_OIL:   { lowMax: 0.001392, medMax: 0.006946, highMax: 0.013604 },
  GASOLINE:    { lowMax: 0.001796, medMax: 0.006127, highMax: 0.012005 },
  // DEFAULT
  default:     { lowMax: 0.000366, medMax: 0.000700, highMax: 0.005200 },
};

export const TRADABLE_REGIMES = new Set(['med', 'high', 'explo']);

// ============================================================================
// HELPERS
// ============================================================================
export function getVolatilityRegime(symbol, atr_m15, close) {
  if (!Number.isFinite(atr_m15) || !Number.isFinite(close) || close <= 0) return 'unknown';
  const cfg = VOLATILITY_CONFIG[symbol] ?? VOLATILITY_CONFIG.default;
  const ratio = atr_m15 / close;
  if (ratio < cfg.lowMax)  return 'low';
  if (ratio < cfg.medMax)  return 'med';
  if (ratio < cfg.highMax) return 'high';
  return 'explo';
}

export function isTradableVolatility(symbol, atr_m15, close) {
  return TRADABLE_REGIMES.has(getVolatilityRegime(symbol, atr_m15, close));
}

// ============================================================================
// LATE ENTRY — seuil range_ratio_h1 adaptatif selon régime de volatilité
// Permet l'entrée sur bougie H1 plus étendue quand marché explose
// (continuation légitime) vs bloquer tôt en régime calme.
// ============================================================================
export const LATE_ENTRY_THR_BY_REGIME = {
  low:   0.6,
  med:   0.8,
  high:  1.5,
  explo: 2.0,
};

export function getLateEntryThreshold(symbol, atr_m15, close) {
  const regime = getVolatilityRegime(symbol, atr_m15, close);
  return LATE_ENTRY_THR_BY_REGIME[regime] ?? 0.8;
}
