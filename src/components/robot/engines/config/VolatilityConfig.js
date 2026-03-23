// ============================================================================
// VolatilityConfig.js — calibration P15/P70/P95 sur données réelles 09:30-21:30
// Ratio : atr_m15 / close
// Régimes : 'low' | 'med' | 'high' | 'explo'
// NE PAS MODIFIER — valeurs calibrées backtest
// ============================================================================

export const VOLATILITY_CONFIG = {
  EURUSD:      { lowMax: 0.000369, medMax: 0.000715, highMax: 0.001175 },
  GBPUSD:      { lowMax: 0.000447, medMax: 0.000819, highMax: 0.001276 },
  USDJPY:      { lowMax: 0.000423, medMax: 0.000837, highMax: 0.001474 },
  USDCAD:      { lowMax: 0.000380, medMax: 0.000720, highMax: 0.001200 },
  EURJPY:      { lowMax: 0.000380, medMax: 0.000694, highMax: 0.001198 },
  GBPJPY:      { lowMax: 0.000439, medMax: 0.000810, highMax: 0.001353 },
  UK_100:      { lowMax: 0.000767, medMax: 0.001350, highMax: 0.002041 },
  GERMANY_40:  { lowMax: 0.000790, medMax: 0.001560, highMax: 0.002507 },
  FRANCE_40:   { lowMax: 0.000864, medMax: 0.001508, highMax: 0.002283 },
  US_30:       { lowMax: 0.000586, medMax: 0.001745, highMax: 0.003198 },
  US_500:      { lowMax: 0.000614, medMax: 0.001579, highMax: 0.003150 },
  US_TECH100:  { lowMax: 0.000859, medMax: 0.002227, highMax: 0.004454 },
  DOLLAR_INDX: { lowMax: 0.000354, medMax: 0.000688, highMax: 0.001114 },
  BTCEUR:      { lowMax: 0.001561, medMax: 0.005038, highMax: 0.009660 },
  BTCUSD:      { lowMax: 0.001531, medMax: 0.005003, highMax: 0.009439 },
  BTCJPY:      { lowMax: 0.001986, medMax: 0.006009, highMax: 0.012976 },
  ETHUSD:      { lowMax: 0.002203, medMax: 0.006829, highMax: 0.013044 },
  GOLD:        { lowMax: 0.001348, medMax: 0.003141, highMax: 0.008317 },
  SILVER:      { lowMax: 0.003933, medMax: 0.008912, highMax: 0.020993 },
  PALLADIUM:   { lowMax: 0.003882, medMax: 0.008130, highMax: 0.014306 },
  PLATINUM:    { lowMax: 0.004062, medMax: 0.008331, highMax: 0.015353 },
  COPPER:      { lowMax: 0.001725, medMax: 0.003679, highMax: 0.006823 },
  CrudeOIL:    { lowMax: 0.002422, medMax: 0.004174, highMax: 0.006392 },
  NATURAL_GAS: { lowMax: 0.004569, medMax: 0.010700, highMax: 0.020562 },
  HEATING_OIL: { lowMax: 0.002654, medMax: 0.004425, highMax: 0.006742 },
  COCOA:       { lowMax: 0.005782, medMax: 0.010071, highMax: 0.014688 },
  COFFEE_C:    { lowMax: 0.003097, medMax: 0.005269, highMax: 0.007332 },
  WHEAT:       { lowMax: 0.001277, medMax: 0.002691, highMax: 0.004492 },
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
