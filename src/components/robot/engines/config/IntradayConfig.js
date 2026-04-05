// ============================================================================
// IntradayConfig.js — calibration sur données H1 réelles MQL5 (5000+ barres)
//
// Seuils signés asymétriques par symbole :
//   dailyUp / dailyDown         = P85 / P15 — mouvement directionnel modéré
//   strongUp / strongDown       = P95 / P5  — mouvement fort (block CONT contre)
//   explosiveUp / explosiveDown = P99 / P1  — mouvement extrême
//   neutral                     = abs P50   — amplitude neutre de référence
// ============================================================================

export const INTRADAY_CONFIG = {

  // ── Forex ─────────────────────────────────────────────────────────────────
  EURUSD: {
    neutral: 0.13, dailyUp: 0.21, dailyDown: -0.24,
    strongUp: 0.45, strongDown: -0.48, explosiveUp: 0.82, explosiveDown: -0.73,
  },
  GBPUSD: {
    neutral: 0.14, dailyUp: 0.23, dailyDown: -0.26,
    strongUp: 0.49, strongDown: -0.52, explosiveUp: 0.75, explosiveDown: -0.85,
  },
  USDJPY: {
    neutral: 0.20, dailyUp: 0.37, dailyDown: -0.31,
    strongUp: 0.68, strongDown: -0.58, explosiveUp: 1.03, explosiveDown: -1.01,
  },
  USDCHF: {
    neutral: 0.14, dailyUp: 0.29, dailyDown: -0.24,
    strongUp: 0.53, strongDown: -0.56, explosiveUp: 0.91, explosiveDown: -0.97,
  },
  USDCAD: {
    neutral: 0.09, dailyUp: 0.17, dailyDown: -0.13,
    strongUp: 0.30, strongDown: -0.29, explosiveUp: 0.46, explosiveDown: -0.54,
  },
  AUDUSD: {
    neutral: 0.20, dailyUp: 0.35, dailyDown: -0.34,
    strongUp: 0.62, strongDown: -0.64, explosiveUp: 0.94, explosiveDown: -0.97,
  },
  NZDUSD: {
    neutral: 0.21, dailyUp: 0.32, dailyDown: -0.39,
    strongUp: 0.62, strongDown: -0.73, explosiveUp: 1.06, explosiveDown: -1.06,
  },

  // ── Indices ───────────────────────────────────────────────────────────────
  UK_100: {
    neutral: 0.19, dailyUp: 0.43, dailyDown: -0.30,
    strongUp: 0.86, strongDown: -0.68, explosiveUp: 1.50, explosiveDown: -1.39,
  },
  GERMANY_40: {
    neutral: 0.26, dailyUp: 0.46, dailyDown: -0.56,
    strongUp: 0.96, strongDown: -1.12, explosiveUp: 1.60, explosiveDown: -2.03,
  },
  FRANCE_40: {
    neutral: 0.35, dailyUp: 0.63, dailyDown: -0.52,
    strongUp: 1.02, strongDown: -0.98, explosiveUp: 1.57, explosiveDown: -1.91,
  },
  ITALY_40: {
    neutral: 0.67, dailyUp: 1.25, dailyDown: -0.91,
    strongUp: 2.04, strongDown: -1.75, explosiveUp: 4.26, explosiveDown: -2.98,
  },
  US_30: {
    neutral: 0.18, dailyUp: 0.35, dailyDown: -0.34,
    strongUp: 0.80, strongDown: -0.76, explosiveUp: 1.47, explosiveDown: -1.36,
  },
  US_500: {
    neutral: 0.20, dailyUp: 0.38, dailyDown: -0.34,
    strongUp: 0.79, strongDown: -0.79, explosiveUp: 1.34, explosiveDown: -1.45,
  },
  US_TECH100: {
    neutral: 0.27, dailyUp: 0.52, dailyDown: -0.46,
    strongUp: 1.06, strongDown: -1.08, explosiveUp: 1.77, explosiveDown: -1.88,
  },
  JAPAN_225: {
    neutral: 0.57, dailyUp: 1.08, dailyDown: -0.83,
    strongUp: 1.86, strongDown: -1.66, explosiveUp: 3.05, explosiveDown: -2.89,
  },

  // ── Crypto ────────────────────────────────────────────────────────────────
  BTCUSD: {
    neutral: 0.65, dailyUp: 1.17, dailyDown: -1.36,
    strongUp: 2.21, strongDown: -2.69, explosiveUp: 4.41, explosiveDown: -4.53,
  },
  BTCEUR: {
    neutral: 0.64, dailyUp: 1.18, dailyDown: -1.31,
    strongUp: 2.24, strongDown: -2.69, explosiveUp: 4.10, explosiveDown: -4.52,
  },
  BTCJPY: {
    neutral: 0.66, dailyUp: 1.26, dailyDown: -1.27,
    strongUp: 2.32, strongDown: -2.74, explosiveUp: 4.22, explosiveDown: -4.66,
  },
  ETHUSD: {
    neutral: 1.02, dailyUp: 1.88, dailyDown: -1.99,
    strongUp: 3.94, strongDown: -4.26, explosiveUp: 7.45, explosiveDown: -6.55,
  },

  // ── Metals ────────────────────────────────────────────────────────────────
  GOLD: {
    neutral: 0.46, dailyUp: 0.93, dailyDown: -0.62,
    strongUp: 1.65, strongDown: -1.63, explosiveUp: 2.88, explosiveDown: -4.42,
  },
  SILVER: {
    neutral: 0.91, dailyUp: 2.13, dailyDown: -1.16,
    strongUp: 3.92, strongDown: -3.76, explosiveUp: 6.66, explosiveDown: -9.25,
  },

  // ── Energy ────────────────────────────────────────────────────────────────
  CrudeOIL: {
    neutral: 0.63, dailyUp: 1.24, dailyDown: -1.08,
    strongUp: 2.58, strongDown: -2.25, explosiveUp: 6.44, explosiveDown: -4.48,
  },
  BRENT_OIL: {
    neutral: 0.62, dailyUp: 1.31, dailyDown: -1.00,
    strongUp: 2.75, strongDown: -2.13, explosiveUp: 6.52, explosiveDown: -4.15,
  },
  GASOLINE: {
    neutral: 0.63, dailyUp: 1.45, dailyDown: -0.98,
    strongUp: 2.90, strongDown: -2.14, explosiveUp: 5.22, explosiveDown: -4.26,
  },

  // ── Agri ──────────────────────────────────────────────────────────────────
  WHEAT: {
    neutral: 0.39, dailyUp: 0.65, dailyDown: -0.69,
    strongUp: 1.46, strongDown: -1.39, explosiveUp: 2.60, explosiveDown: -2.26,
  },

  // ── Default ───────────────────────────────────────────────────────────────
  default: {
    neutral: 0.30, dailyUp: 0.50, dailyDown: -0.50,
    strongUp: 1.00, strongDown: -1.00, explosiveUp: 2.00, explosiveDown: -2.00,
  },
};
