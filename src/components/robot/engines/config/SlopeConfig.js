// ============================================================================
// SlopeConfig.js — Classification des régimes de slope H1, par actif
// Calibration : P40/P60 (flat) — P20/P80 (weak) — P97 (strong/extreme)
// spike filter = P97 : au-delà → penser reversal, pas continuation
// Source : données réelles H1, 12 mois (~6043 barres), slope RSI pondéré (period=5)
// Recalibré le : 2026-03-18
// ============================================================================

export const SLOPE_CONFIG = {

  // ── FX ───────────────────────────────────────────────────────────────────────

  EURUSD: {
    flat:         { min:  -0.6297, max:   0.7248  },
    up_weak:      { min:   0.7248, max:   2.3453  },
    up_strong:    { min:   2.3453, max:   5.4954  },
    up_extreme:   { min:   5.4954, max:  Infinity },
    down_weak:    { min:  -2.4024, max:  -0.6297  },
    down_strong:  { min:  -4.8123, max:  -2.4024  },
    down_extreme: { min: -Infinity, max:  -4.8123 },
  },

  GBPUSD: {
    flat:         { min:  -0.6039, max:   0.7441  },
    up_weak:      { min:   0.7441, max:   2.2872  },
    up_strong:    { min:   2.2872, max:   5.2982  },
    up_extreme:   { min:   5.2982, max:  Infinity },
    down_weak:    { min:  -2.3401, max:  -0.6039  },
    down_strong:  { min:  -4.8119, max:  -2.3401  },
    down_extreme: { min: -Infinity, max:  -4.8119 },
  },

  USDJPY: {
    flat:         { min:  -0.6826, max:   0.7747  },
    up_weak:      { min:   0.7747, max:   2.3753  },
    up_strong:    { min:   2.3753, max:   5.3799  },
    up_extreme:   { min:   5.3799, max:  Infinity },
    down_weak:    { min:  -2.3333, max:  -0.6826  },
    down_strong:  { min:  -4.8714, max:  -2.3333  },
    down_extreme: { min: -Infinity, max:  -4.8714 },
  },

  AUDUSD: {
    flat:         { min:  -0.6552, max:   0.7009  },
    up_weak:      { min:   0.7009, max:   2.3159  },
    up_strong:    { min:   2.3159, max:   5.4661  },
    up_extreme:   { min:   5.4661, max:  Infinity },
    down_weak:    { min:  -2.3602, max:  -0.6552  },
    down_strong:  { min:  -4.8322, max:  -2.3602  },
    down_extreme: { min: -Infinity, max:  -4.8322 },
  },

  // ── INDEX ────────────────────────────────────────────────────────────────────

  UK_100: {
    flat:         { min:  -0.6159, max:   0.7518  },
    up_weak:      { min:   0.7518, max:   2.3065  },
    up_strong:    { min:   2.3065, max:   5.4910  },
    up_extreme:   { min:   5.4910, max:  Infinity },
    down_weak:    { min:  -2.2801, max:  -0.6159  },
    down_strong:  { min:  -4.8597, max:  -2.2801  },
    down_extreme: { min: -Infinity, max:  -4.8597 },
  },

  GERMANY_40: {
    flat:         { min:  -0.5312, max:   0.7792  },
    up_weak:      { min:   0.7792, max:   2.3590  },
    up_strong:    { min:   2.3590, max:   5.5668  },
    up_extreme:   { min:   5.5668, max:  Infinity },
    down_weak:    { min:  -2.3325, max:  -0.5312  },
    down_strong:  { min:  -5.1751, max:  -2.3325  },
    down_extreme: { min: -Infinity, max:  -5.1751 },
  },

  FRANCE_40: {
    flat:         { min:  -0.6025, max:   0.7899  },
    up_weak:      { min:   0.7899, max:   2.3815  },
    up_strong:    { min:   2.3815, max:   5.5189  },
    up_extreme:   { min:   5.5189, max:  Infinity },
    down_weak:    { min:  -2.4069, max:  -0.6025  },
    down_strong:  { min:  -4.9794, max:  -2.4069  },
    down_extreme: { min: -Infinity, max:  -4.9794 },
  },

  US_30: {
    flat:         { min:  -0.6205, max:   0.6328  },
    up_weak:      { min:   0.6328, max:   2.3113  },
    up_strong:    { min:   2.3113, max:   6.1830  },
    up_extreme:   { min:   6.1830, max:  Infinity },
    down_weak:    { min:  -2.2373, max:  -0.6205  },
    down_strong:  { min:  -5.2866, max:  -2.2373  },
    down_extreme: { min: -Infinity, max:  -5.2866 },
  },

  US_500: {
    flat:         { min:  -0.5505, max:   0.8164  },
    up_weak:      { min:   0.8164, max:   2.3997  },
    up_strong:    { min:   2.3997, max:   5.5217  },
    up_extreme:   { min:   5.5217, max:  Infinity },
    down_weak:    { min:  -2.3360, max:  -0.5505  },
    down_strong:  { min:  -5.2664, max:  -2.3360  },
    down_extreme: { min: -Infinity, max:  -5.2664 },
  },

  US_TECH100: {
    flat:         { min:  -0.5345, max:   0.8321  },
    up_weak:      { min:   0.8321, max:   2.3957  },
    up_strong:    { min:   2.3957, max:   5.6057  },
    up_extreme:   { min:   5.6057, max:  Infinity },
    down_weak:    { min:  -2.3265, max:  -0.5345  },
    down_strong:  { min:  -5.3371, max:  -2.3265  },
    down_extreme: { min: -Infinity, max:  -5.3371 },
  },

  // ── CRYPTO ───────────────────────────────────────────────────────────────────

  BTCEUR: {
    flat:         { min:  -0.6215, max:   0.7071  },
    up_weak:      { min:   0.7071, max:   2.3029  },
    up_strong:    { min:   2.3029, max:   5.5756  },
    up_extreme:   { min:   5.5756, max:  Infinity },
    down_weak:    { min:  -2.2888, max:  -0.6215  },
    down_strong:  { min:  -4.8784, max:  -2.2888  },
    down_extreme: { min: -Infinity, max:  -4.8784 },
  },

  BTCUSD: {
    flat:         { min:  -0.6363, max:   0.7134  },
    up_weak:      { min:   0.7134, max:   2.2917  },
    up_strong:    { min:   2.2917, max:   5.5545  },
    up_extreme:   { min:   5.5545, max:  Infinity },
    down_weak:    { min:  -2.2675, max:  -0.6363  },
    down_strong:  { min:  -4.8930, max:  -2.2675  },
    down_extreme: { min: -Infinity, max:  -4.8930 },
  },

  ETHUSD: {
    flat:         { min:  -0.6126, max:   0.7313  },
    up_weak:      { min:   0.7313, max:   2.3126  },
    up_strong:    { min:   2.3126, max:   5.3113  },
    up_extreme:   { min:   5.3113, max:  Infinity },
    down_weak:    { min:  -2.2117, max:  -0.6126  },
    down_strong:  { min:  -5.0708, max:  -2.2117  },
    down_extreme: { min: -Infinity, max:  -5.0708 },
  },

  // ── METAL ────────────────────────────────────────────────────────────────────

  GOLD: {
    flat:         { min:  -0.5971, max:   0.7883  },
    up_weak:      { min:   0.7883, max:   2.2526  },
    up_strong:    { min:   2.2526, max:   5.2166  },
    up_extreme:   { min:   5.2166, max:  Infinity },
    down_weak:    { min:  -2.2934, max:  -0.5971  },
    down_strong:  { min:  -4.8774, max:  -2.2934  },
    down_extreme: { min: -Infinity, max:  -4.8774 },
  },

  SILVER: {
    flat:         { min:  -0.5078, max:   0.8514  },
    up_weak:      { min:   0.8514, max:   2.2906  },
    up_strong:    { min:   2.2906, max:   5.0937  },
    up_extreme:   { min:   5.0937, max:  Infinity },
    down_weak:    { min:  -2.3017, max:  -0.5078  },
    down_strong:  { min:  -5.0079, max:  -2.3017  },
    down_extreme: { min: -Infinity, max:  -5.0079 },
  },

  // ── OIL & GAS ────────────────────────────────────────────────────────────────

  CrudeOIL: {
    flat:         { min:  -0.6228, max:   0.7153  },
    up_weak:      { min:   0.7153, max:   2.3925  },
    up_strong:    { min:   2.3925, max:   5.6883  },
    up_extreme:   { min:   5.6883, max:  Infinity },
    down_weak:    { min:  -2.3554, max:  -0.6228  },
    down_strong:  { min:  -5.1228, max:  -2.3554  },
    down_extreme: { min: -Infinity, max:  -5.1228 },
  },

  BRENT_OIL: {
    flat:         { min:  -0.5574, max:   0.8665  },
    up_weak:      { min:   0.8665, max:   2.5907  },
    up_strong:    { min:   2.5907, max:   5.6592  },
    up_extreme:   { min:   5.6592, max:  Infinity },
    down_weak:    { min:  -2.6582, max:  -0.5574  },
    down_strong:  { min:  -6.3011, max:  -2.6582  },
    down_extreme: { min: -Infinity, max:  -6.3011 },
  },

  GASOLINE: {
    flat:         { min:  -0.7381, max:   0.7456  },
    up_weak:      { min:   0.7456, max:   2.4146  },
    up_strong:    { min:   2.4146, max:   5.7238  },
    up_extreme:   { min:   5.7238, max:  Infinity },
    down_weak:    { min:  -2.3368, max:  -0.7381  },
    down_strong:  { min:  -5.1724, max:  -2.3368  },
    down_extreme: { min: -Infinity, max:  -5.1724 },
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    flat:         { min:  -0.6262, max:   0.7383  },
    up_weak:      { min:   0.7383, max:   2.3406  },
    up_strong:    { min:   2.3406, max:   5.5526  },
    up_extreme:   { min:   5.5526, max:  Infinity },
    down_weak:    { min:  -2.3311, max:  -0.6262  },
    down_strong:  { min:  -4.9677, max:  -2.3311  },
    down_extreme: { min: -Infinity, max:  -4.9677 },
  },

};

// ============================================================================
// HELPER
// ============================================================================
export function getSlopeClass(slope, symbol) {
  const cfg = getSlopeConfig(symbol);
  for (const [regime, { min, max }] of Object.entries(cfg)) {
    if (slope > min && slope <= max) return regime;
  }
  return 'unknown';
}

export function getSlopeConfig(symbol) {
  if (!symbol) return SLOPE_CONFIG.default;
  const clean = String(symbol).trim();
  return SLOPE_CONFIG[clean] ?? SLOPE_CONFIG.default;
}