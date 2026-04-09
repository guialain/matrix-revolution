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
  UK_100:      { lowMax: 0.000767, medMax: 0.001350, highMax: 0.005041 },
  GERMANY_40:  { lowMax: 0.000790, medMax: 0.001560, highMax: 0.002507 },
  FRANCE_40:   { lowMax: 0.000864, medMax: 0.001508, highMax: 0.002283 },
  US_30:       { lowMax: 0.000586, medMax: 0.001745, highMax: 0.003198 },
  US_500:      { lowMax: 0.000614, medMax: 0.001579, highMax: 0.003150 },
  US_TECH100:  { lowMax: 0.000859, medMax: 0.002227, highMax: 0.004454 },
  // CRYPTO
  BTCEUR:      { lowMax: 0.001561, medMax: 0.005038, highMax: 0.009660 },
  BTCUSD:      { lowMax: 0.001531, medMax: 0.005003, highMax: 0.009439 },
  ETHUSD:      { lowMax: 0.002203, medMax: 0.006829, highMax: 0.013044 },
  // METAL
  GOLD:        { lowMax: 0.001348, medMax: 0.003141, highMax: 0.008317 },
  SILVER:      { lowMax: 0.001933, medMax: 0.008912, highMax: 0.020993 },
  // ENERGY
  CrudeOIL:    { lowMax: 0.002422, medMax: 0.004174, highMax: 0.006392 },
  BRENT_OIL:   { lowMax: 0.002422, medMax: 0.004174, highMax: 0.006392 },
  GASOLINE:    { lowMax: 0.002654, medMax: 0.004425, highMax: 0.006742 },
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
