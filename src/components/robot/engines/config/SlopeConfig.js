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

  EURJPY: {
    flat:         { min:  -0.5967, max:   0.7816  },
    up_weak:      { min:   0.7816, max:   2.3542  },
    up_strong:    { min:   2.3542, max:   5.3330  },
    up_extreme:   { min:   5.3330, max:  Infinity },
    down_weak:    { min:  -2.3041, max:  -0.5967  },
    down_strong:  { min:  -5.0059, max:  -2.3041  },
    down_extreme: { min: -Infinity, max:  -5.0059 },
  },

  GBPJPY: {
    flat:         { min:  -0.6222, max:   0.7681  },
    up_weak:      { min:   0.7681, max:   2.3658  },
    up_strong:    { min:   2.3658, max:   5.1946  },
    up_extreme:   { min:   5.1946, max:  Infinity },
    down_weak:    { min:  -2.3072, max:  -0.6222  },
    down_strong:  { min:  -4.7884, max:  -2.3072  },
    down_extreme: { min: -Infinity, max:  -4.7884 },
  },

  EURGBP: {
    flat:         { min:  -0.6133, max:   0.6907  },
    up_weak:      { min:   0.6907, max:   2.2317  },
    up_strong:    { min:   2.2317, max:   5.7830  },
    up_extreme:   { min:   5.7830, max:  Infinity },
    down_weak:    { min:  -2.2926, max:  -0.6133  },
    down_strong:  { min:  -4.8131, max:  -2.2926  },
    down_extreme: { min: -Infinity, max:  -4.8131 },
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

  NZDUSD: {
    flat:         { min:  -0.6893, max:   0.7721  },
    up_weak:      { min:   0.7721, max:   2.3158  },
    up_strong:    { min:   2.3158, max:   5.5389  },
    up_extreme:   { min:   5.5389, max:  Infinity },
    down_weak:    { min:  -2.4286, max:  -0.6893  },
    down_strong:  { min:  -4.7600, max:  -2.4286  },
    down_extreme: { min: -Infinity, max:  -4.7600 },
  },

  USDCAD: {
    flat:         { min:  -0.6706, max:   0.6838  },
    up_weak:      { min:   0.6838, max:   2.2972  },
    up_strong:    { min:   2.2972, max:   5.2517  },
    up_extreme:   { min:   5.2517, max:  Infinity },
    down_weak:    { min:  -2.2271, max:  -0.6706  },
    down_strong:  { min:  -4.6057, max:  -2.2271  },
    down_extreme: { min: -Infinity, max:  -4.6057 },
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

  BTCJPY: {
    flat:         { min:  -0.6244, max:   0.7333  },
    up_weak:      { min:   0.7333, max:   2.2825  },
    up_strong:    { min:   2.2825, max:   5.6010  },
    up_extreme:   { min:   5.6010, max:  Infinity },
    down_weak:    { min:  -2.3052, max:  -0.6244  },
    down_strong:  { min:  -4.9474, max:  -2.3052  },
    down_extreme: { min: -Infinity, max:  -4.9474 },
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

  PALLADIUM: {
    flat:         { min:  -0.6269, max:   0.7646  },
    up_weak:      { min:   0.7646, max:   2.3834  },
    up_strong:    { min:   2.3834, max:   5.3881  },
    up_extreme:   { min:   5.3881, max:  Infinity },
    down_weak:    { min:  -2.3367, max:  -0.6269  },
    down_strong:  { min:  -4.9580, max:  -2.3367  },
    down_extreme: { min: -Infinity, max:  -4.9580 },
  },

  PLATINUM: {
    flat:         { min:  -0.5922, max:   0.7513  },
    up_weak:      { min:   0.7513, max:   2.2387  },
    up_strong:    { min:   2.2387, max:   5.4935  },
    up_extreme:   { min:   5.4935, max:  Infinity },
    down_weak:    { min:  -2.3093, max:  -0.5922  },
    down_strong:  { min:  -4.8433, max:  -2.3093  },
    down_extreme: { min: -Infinity, max:  -4.8433 },
  },

  COPPER: {
    flat:         { min:  -0.5965, max:   0.6848  },
    up_weak:      { min:   0.6848, max:   2.3032  },
    up_strong:    { min:   2.3032, max:   5.5518  },
    up_extreme:   { min:   5.5518, max:  Infinity },
    down_weak:    { min:  -2.4228, max:  -0.5965  },
    down_strong:  { min:  -4.7794, max:  -2.4228  },
    down_extreme: { min: -Infinity, max:  -4.7794 },
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

  NATURAL_GAS: {
    flat:         { min:  -0.6156, max:   0.6364  },
    up_weak:      { min:   0.6364, max:   2.2567  },
    up_strong:    { min:   2.2567, max:   6.1134  },
    up_extreme:   { min:   6.1134, max:  Infinity },
    down_weak:    { min:  -2.2782, max:  -0.6156  },
    down_strong:  { min:  -5.1049, max:  -2.2782  },
    down_extreme: { min: -Infinity, max:  -5.1049 },
  },

  HEATING_OIL: {
    flat:         { min:  -0.6849, max:   0.7001  },
    up_weak:      { min:   0.7001, max:   2.4313  },
    up_strong:    { min:   2.4313, max:   5.7824  },
    up_extreme:   { min:   5.7824, max:  Infinity },
    down_weak:    { min:  -2.3410, max:  -0.6849  },
    down_strong:  { min:  -5.0690, max:  -2.3410  },
    down_extreme: { min: -Infinity, max:  -5.0690 },
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

  // ── AGRI ─────────────────────────────────────────────────────────────────────

  COCOA: {
    flat:         { min:  -0.5926, max:   0.8003  },
    up_weak:      { min:   0.8003, max:   2.4499  },
    up_strong:    { min:   2.4499, max:   5.5477  },
    up_extreme:   { min:   5.5477, max:  Infinity },
    down_weak:    { min:  -2.4047, max:  -0.5926  },
    down_strong:  { min:  -5.0776, max:  -2.4047  },
    down_extreme: { min: -Infinity, max:  -5.0776 },
  },

  COFFEE_C: {
    flat:         { min:  -0.7308, max:   0.7671  },
    up_weak:      { min:   0.7671, max:   2.5409  },
    up_strong:    { min:   2.5409, max:   5.5753  },
    up_extreme:   { min:   5.5753, max:  Infinity },
    down_weak:    { min:  -2.4444, max:  -0.7308  },
    down_strong:  { min:  -5.0665, max:  -2.4444  },
    down_extreme: { min: -Infinity, max:  -5.0665 },
  },

  WHEAT: {
    flat:         { min:  -0.6697, max:   0.6886  },
    up_weak:      { min:   0.6886, max:   2.3308  },
    up_strong:    { min:   2.3308, max:   5.9316  },
    up_extreme:   { min:   5.9316, max:  Infinity },
    down_weak:    { min:  -2.4089, max:  -0.6697  },
    down_strong:  { min:  -4.9683, max:  -2.4089  },
    down_extreme: { min: -Infinity, max:  -4.9683 },
  },

  COTTON_2: {
    flat:         { min:  -0.7487, max:   0.6026  },
    up_weak:      { min:   0.6026, max:   2.3828  },
    up_strong:    { min:   2.3828, max:   5.9066  },
    up_extreme:   { min:   5.9066, max:  Infinity },
    down_weak:    { min:  -2.3749, max:  -0.7487  },
    down_strong:  { min:  -4.9242, max:  -2.3749  },
    down_extreme: { min: -Infinity, max:  -4.9242 },
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