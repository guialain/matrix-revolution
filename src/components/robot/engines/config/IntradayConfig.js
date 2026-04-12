// ============================================================================
// IntradayConfig.js — calibration sur données H1 réelles MQL5 (zones mortes filtrées)
//
// Seuils calibrés depuis context CSVs H1 (backtest V8R — 2026-04-12) :
//   neutral       = P70  — borne NEUTRE (symétrique max(|P30|,P70))
//   dailyUp/Down  = P80/P20 — mouvement directionnel modéré
//   strongUp/Down = P95/P5  — mouvement fort
//   explosiveUp/Down = P99/P1 — mouvement extrême
//
// Zones mortes filtrées : INDEX 07-22h, METAL/ENERGY 01-22h, AGRI 09-20h
// ============================================================================

export const INTRADAY_CONFIG = {

  // ── Forex ─────────────────────────────────────────────────────────────────
  EURUSD: {
    neutral: 0.11, dailyUp: 0.19, dailyDown: -0.19,
    strongUp: 0.56, strongDown: -0.50, explosiveUp: 1.02, explosiveDown: -0.81,
  },
  GBPUSD: {
    neutral: 0.12, dailyUp: 0.21, dailyDown: -0.19,
    strongUp: 0.54, strongDown: -0.54, explosiveUp: 0.87, explosiveDown: -0.87,
  },
  USDJPY: {
    neutral: 0.17, dailyUp: 0.30, dailyDown: -0.30,
    strongUp: 0.72, strongDown: -0.67, explosiveUp: 1.19, explosiveDown: -1.17,
  },
  USDCHF: {
    neutral: 0.12, dailyUp: 0.22, dailyDown: -0.22,
    strongUp: 0.56, strongDown: -0.64, explosiveUp: 0.98, explosiveDown: -1.16,
  },
  USDCAD: {
    neutral: 0.08, dailyUp: 0.13, dailyDown: -0.12,
    strongUp: 0.31, strongDown: -0.36, explosiveUp: 0.51, explosiveDown: -0.70,
  },
  AUDUSD: {
    neutral: 0.20, dailyUp: 0.33, dailyDown: -0.27,
    strongUp: 0.70, strongDown: -0.66, explosiveUp: 1.25, explosiveDown: -1.02,
  },
  NZDUSD: {
    neutral: 0.19, dailyUp: 0.31, dailyDown: -0.31,
    strongUp: 0.75, strongDown: -0.73, explosiveUp: 1.31, explosiveDown: -1.12,
  },

  // ── Indices ───────────────────────────────────────────────────────────────
  UK_100: {
    neutral: 0.29, dailyUp: 0.46, dailyDown: -0.32,
    strongUp: 1.07, strongDown: -0.86, explosiveUp: 1.88, explosiveDown: -2.25,
  },
  GERMANY_40: {
    neutral: 0.34, dailyUp: 0.54, dailyDown: -0.60,
    strongUp: 1.18, strongDown: -1.48, explosiveUp: 2.09, explosiveDown: -3.04,
  },
  FRANCE_40: {
    neutral: 0.35, dailyUp: 0.55, dailyDown: -0.42,
    strongUp: 1.08, strongDown: -1.15, explosiveUp: 1.85, explosiveDown: -2.63,
  },
  ITALY_40: {
    neutral: 0.67, dailyUp: 1.25, dailyDown: -0.91,
    strongUp: 2.04, strongDown: -1.75, explosiveUp: 4.26, explosiveDown: -2.98,
  },
  US_30: {
    neutral: 0.22, dailyUp: 0.39, dailyDown: -0.36,
    strongUp: 1.04, strongDown: -0.95, explosiveUp: 1.91, explosiveDown: -2.05,
  },
  US_500: {
    neutral: 0.26, dailyUp: 0.42, dailyDown: -0.36,
    strongUp: 1.03, strongDown: -1.01, explosiveUp: 2.01, explosiveDown: -2.09,
  },
  US_TECH100: {
    neutral: 0.36, dailyUp: 0.56, dailyDown: -0.46,
    strongUp: 1.37, strongDown: -1.39, explosiveUp: 2.48, explosiveDown: -2.57,
  },
  JAPAN_225: {
    neutral: 0.60, dailyUp: 0.99, dailyDown: -0.73,
    strongUp: 2.05, strongDown: -1.82, explosiveUp: 3.78, explosiveDown: -3.94,
  },

  // ── Crypto ────────────────────────────────────────────────────────────────
  BTCUSD: {
    neutral: 0.49, dailyUp: 0.89, dailyDown: -0.88,
    strongUp: 2.27, strongDown: -2.59, explosiveUp: 4.56, explosiveDown: -4.44,
  },
  BTCEUR: {
    neutral: 0.48, dailyUp: 0.88, dailyDown: -0.86,
    strongUp: 2.26, strongDown: -2.61, explosiveUp: 4.42, explosiveDown: -4.54,
  },
  BTCJPY: {
    neutral: 0.53, dailyUp: 0.94, dailyDown: -0.86,
    strongUp: 2.36, strongDown: -2.68, explosiveUp: 4.60, explosiveDown: -4.67,
  },
  ETHUSD: {
    neutral: 0.82, dailyUp: 1.48, dailyDown: -1.42,
    strongUp: 4.10, strongDown: -4.19, explosiveUp: 7.90, explosiveDown: -6.69,
  },

  // ── Metals ────────────────────────────────────────────────────────────────
  GOLD: {
    neutral: 0.51, dailyUp: 0.80, dailyDown: -0.53,
    strongUp: 1.74, strongDown: -1.73, explosiveUp: 2.87, explosiveDown: -4.29,
  },
  SILVER: {
    neutral: 0.95, dailyUp: 1.56, dailyDown: -0.84,
    strongUp: 3.84, strongDown: -3.63, explosiveUp: 6.40, explosiveDown: -8.94,
  },

  // ── Energy ────────────────────────────────────────────────────────────────
  CrudeOIL: {
    neutral: 0.52, dailyUp: 0.96, dailyDown: -0.85,
    strongUp: 2.54, strongDown: -2.35, explosiveUp: 6.37, explosiveDown: -4.72,
  },
  BRENT_OIL: {
    neutral: 0.55, dailyUp: 0.98, dailyDown: -0.80,
    strongUp: 2.70, strongDown: -2.28, explosiveUp: 6.44, explosiveDown: -4.58,
  },
  GASOLINE: {
    neutral: 0.48, dailyUp: 0.86, dailyDown: -0.62,
    strongUp: 2.21, strongDown: -1.80, explosiveUp: 4.42, explosiveDown: -3.19,
  },

  // ── Agri ──────────────────────────────────────────────────────────────────
  WHEAT: {
    neutral: 0.51, dailyUp: 0.71, dailyDown: -0.83,
    strongUp: 1.82, strongDown: -1.73, explosiveUp: 3.05, explosiveDown: -2.76,
  },

  // ── Default ───────────────────────────────────────────────────────────────
  default: {
    neutral: 0.25, dailyUp: 0.50, dailyDown: -0.50,
    strongUp: 1.00, strongDown: -1.00, explosiveUp: 2.00, explosiveDown: -2.00,
  },
};
