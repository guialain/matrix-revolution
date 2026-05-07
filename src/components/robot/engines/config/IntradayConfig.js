// ============================================================================
// IntradayConfig.js — 9 régimes intraday, calibrés sur  CSVs
//
//  Régime            Percentile    Borne basse (cfg)
//  ────────────────────────────────────────────────
//  ⚡ SPIKE_DOWN      < P1          spikeDown
//  🟥 EXPLOSIVE_DOWN  P1  – P5      explosiveDown
//  🔻 STRONG_DOWN     P5  – P20     strongDown
//  ⬇️  SOFT_DOWN      P20 – P30     softDown
//  ➖ NEUTRE          P30 – P70     (entre softDown et softUp)
//  ↗️  SOFT_UP        P70 – P80     softUp
//  ⬆️  STRONG_UP      P80 – P95     strongUp
//  🟩 EXPLOSIVE_UP   P95 – P99     explosiveUp
//  ⚡ SPIKE_UP        > P99         spikeUp
//
// Sources :  CSVs (intraday context) — données longues, zones mortes filtrées
//  Zones mortes filtrées : INDEX 07-22h, METAL/ENERGY 01-22h, AGRI 09-20h
// ============================================================================

export const INTRADAY_CONFIG = {

  // ── FX ───────────────────────────────────────────────────────────────────────
  EURUSD: { 
    spikeDown: -0.81, explosiveDown: -0.5, strongDown: -0.19, softDown: -0.11,
    softUp: 0.11, strongUp: 0.19, explosiveUp: 0.56, spikeUp: 1.02,
  },
  GBPUSD: { 
    spikeDown: -0.87, explosiveDown: -0.54, strongDown: -0.19, softDown: -0.12,
    softUp: 0.12, strongUp: 0.21, explosiveUp: 0.54, spikeUp: 0.87,
  },
  USDJPY: { 
    spikeDown: -1.17, explosiveDown: -0.67, strongDown: -0.3, softDown: -0.17,
    softUp: 0.17, strongUp: 0.3, explosiveUp: 0.72, spikeUp: 1.19,
  },
  USDCHF: { 
    spikeDown: -1.16, explosiveDown: -0.64, strongDown: -0.22, softDown: -0.12,
    softUp: 0.12, strongUp: 0.22, explosiveUp: 0.56, spikeUp: 0.98,
  },
  USDCAD: { 
    spikeDown: -0.7, explosiveDown: -0.36, strongDown: -0.12, softDown: -0.08,
    softUp: 0.08, strongUp: 0.13, explosiveUp: 0.31, spikeUp: 0.51,
  },
  AUDUSD: {
    spikeDown: -1.02, explosiveDown: -0.66, strongDown: -0.27, softDown: -0.2,
    softUp: 0.2, strongUp: 0.33, explosiveUp: 0.7, spikeUp: 1.25,
  },
  NZDUSD: { 
    spikeDown: -1.12, explosiveDown: -0.73, strongDown: -0.31, softDown: -0.19,
    softUp: 0.19, strongUp: 0.31, explosiveUp: 0.75, spikeUp: 1.31,
  },
  EURJPY: {
    spikeDown: -0.76, explosiveDown: -0.48, strongDown: -0.2, softDown: -0.14,
    softUp: 0.14, strongUp: 0.23, explosiveUp: 0.53, spikeUp: 0.84,
  },
  GBPJPY: {
    spikeDown: -0.92, explosiveDown: -0.54, strongDown: -0.21, softDown: -0.14,
    softUp: 0.14, strongUp: 0.23, explosiveUp: 0.59, spikeUp: 0.93,
  },
  EURCHF: { 
    spikeDown: -0.62, explosiveDown: -0.31, strongDown: -0.12, softDown: -0.06,
    softUp: 0.06, strongUp: 0.12, explosiveUp: 0.3, spikeUp: 0.5,
  },

  // ── INDEX ────────────────────────────────────────────────────────────────────
  UK_100: { 
    spikeDown: -2.25, explosiveDown: -0.86, strongDown: -0.32, softDown: -0.29,
    softUp: 0.29, strongUp: 0.46, explosiveUp: 1.07, spikeUp: 1.88,
  },
  GERMANY_40: {
    spikeDown: -3.04, explosiveDown: -1.48, strongDown: -0.6, softDown: -0.34,
    softUp: 0.34, strongUp: 0.54, explosiveUp: 1.18, spikeUp: 2.09,
  },
  FRANCE_40: { 
    spikeDown: -2.63, explosiveDown: -1.15, strongDown: -0.42, softDown: -0.35,
    softUp: 0.35, strongUp: 0.55, explosiveUp: 1.08, spikeUp: 1.85,
  },
  US_30: { 
    spikeDown: -2.05, explosiveDown: -0.95, strongDown: -0.36, softDown: -0.22,
    softUp: 0.22, strongUp: 0.39, explosiveUp: 1.04, spikeUp: 1.91,
  },
  US_500: {
    spikeDown: -2.09, explosiveDown: -1.01, strongDown: -0.36, softDown: -0.26,
    softUp: 0.26, strongUp: 0.42, explosiveUp: 1.03, spikeUp: 2.01,
  },
  US_TECH100: { 
    spikeDown: -2.57, explosiveDown: -1.39, strongDown: -0.46, softDown: -0.36,
    softUp: 0.36, strongUp: 0.56, explosiveUp: 1.37, spikeUp: 2.48,
  },
  JAPAN_225: { 
    spikeDown: -3.94, explosiveDown: -1.82, strongDown: -0.73, softDown: -0.6,
    softUp: 0.6, strongUp: 0.99, explosiveUp: 2.05, spikeUp: 3.78,
  },

  // ── CRYPTO ───────────────────────────────────────────────────────────────────
  BTCUSD: { 
    spikeDown: -4.44, explosiveDown: -2.59, strongDown: -0.88, softDown: -0.49,
    softUp: 0.49, strongUp: 0.89, explosiveUp: 2.27, spikeUp: 4.56,
  },
  BTCEUR: { 
    spikeDown: -4.54, explosiveDown: -2.61, strongDown: -0.86, softDown: -0.48,
    softUp: 0.48, strongUp: 0.88, explosiveUp: 2.26, spikeUp: 4.42,
  },
  BTCJPY: {
    spikeDown: -4.67, explosiveDown: -2.68, strongDown: -0.86, softDown: -0.53,
    softUp: 0.53, strongUp: 0.94, explosiveUp: 2.36, spikeUp: 4.6,
  },
  ETHUSD: { 
    spikeDown: -6.69, explosiveDown: -4.19, strongDown: -1.42, softDown: -0.82,
    softUp: 0.82, strongUp: 1.48, explosiveUp: 4.1, spikeUp: 7.9,
  },

  // ── METAL ────────────────────────────────────────────────────────────────────
  GOLD: { 
    spikeDown: -4.29, explosiveDown: -1.73, strongDown: -0.53, softDown: -0.51,
    softUp: 0.51, strongUp: 0.8, explosiveUp: 1.74, spikeUp: 2.87,
  },
  SILVER: { 
    spikeDown: -8.94, explosiveDown: -3.63, strongDown: -0.84, softDown: -0.84,
    softUp: 0.95, strongUp: 1.56, explosiveUp: 3.84, spikeUp: 6.4,
  },

  // ── ENERGY ───────────────────────────────────────────────────────────────────
  CrudeOIL: {
    spikeDown: -4.72, explosiveDown: -2.35, strongDown: -0.85, softDown: -0.52,
    softUp: 0.52, strongUp: 0.96, explosiveUp: 2.54, spikeUp: 6.37,
  },
  BRENT_OIL: { 
    spikeDown: -4.58, explosiveDown: -2.28, strongDown: -0.8, softDown: -0.55,
    softUp: 0.55, strongUp: 0.98, explosiveUp: 2.7, spikeUp: 6.44,
  },
  GASOLINE: { 
    spikeDown: -3.19, explosiveDown: -1.8, strongDown: -0.62, softDown: -0.48,
    softUp: 0.48, strongUp: 0.86, explosiveUp: 2.21, spikeUp: 4.42,
  },

  // ── AGRI ─────────────────────────────────────────────────────────────────────
  WHEAT: {
    spikeDown: -2.76, explosiveDown: -1.73, strongDown: -0.83, softDown: -0.51,
    softUp: 0.51, strongUp: 0.71, explosiveUp: 1.82, spikeUp: 3.05,
  },
  COCOA: {
    spikeDown: -6.73, explosiveDown: -4.25, strongDown: -1.87, softDown: -0.99,
    softUp: 0.98, strongUp: 1.67, explosiveUp: 4.01, spikeUp: 6.02,
  },

  // ── Default — actifs sans context CSV ─────────────────────────────────────
  default: {
    spikeDown: -2.00, explosiveDown: -1.00, strongDown: -0.50, softDown: -0.25,
    softUp: 0.25, strongUp: 0.50, explosiveUp: 1.00, spikeUp: 2.00,
  },
};

