// ============================================================================
// RISK CONFIG — Paramètres de risque par actif (aligned with Neo-Backtest v7.1)
//
// ✅ TP/SL basés sur ATR H1 (multiplicateurs)
//
//   tpAtr  : multiplicateur ATR H1 pour le Take Profit
//   slAtr  : multiplicateur ATR H1 pour le Stop Loss
//
//   spread : spread fixe en unités prix, relevé sur MT5.
//
//   maxHoldH : durée max d'un trade en heures (clôture forcée si dépassé)
//             Défaut global = defaultMaxHoldH (8h) si absent.
//
//   targetLeveragePerTrade : levier cible par trade (compound scaling)
//   contractSize           : taille du contrat (unités de base par lot)
//   refPrice               : prix de référence pour estimations
//   baseToEUR              : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────

  EURUSD: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.00298, maxHoldH: 96, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.169, baseToEUR: 1.000,
    volume_min: 0.01, volume_max: 150000, volume_step: 0.01,
  },
  AUDUSD: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.00224, maxHoldH: 96, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.705, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 151, volume_step: 0.01,
  },
  USDCHF: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.00240, maxHoldH: 96, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.789, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  GBPUSD: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.00319, maxHoldH: 96, reversalEnabled: true,
    spread: 0.00012,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.343, baseToEUR: 1.076,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  USDJPY: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.439, maxHoldH: 96, reversalEnabled: true,
    spread: 0.013,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 158.95, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 201, volume_step: 0.01,
  },
  EURJPY: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.50, maxHoldH: 96, reversalEnabled: true,
    spread: 0.020,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 185.86, baseToEUR: 1.000,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  GBPJPY: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.60, maxHoldH: 96, reversalEnabled: true,
    spread: 0.030,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 213.44, baseToEUR: 1.076,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  AUDJPY: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 0.40, maxHoldH: 96, reversalEnabled: true,
    spread: 0.020,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 110.22, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 43.6, maxHoldH: 96, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 10600, baseToEUR: 1.076,
    tickSize: 0.5, tickValue: 5, profitCurrency: "GBP",
    assetClass: "INDEX",
    stopsLevel: 50,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  GERMANY_40: {
    tpAtr: 0.57, slAtr: 1.75, atrH1Cap: 145.8, maxHoldH: 96, reversalEnabled: true,
    spread: 5.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 23920, baseToEUR: 1.000,
    tickSize: 1.0,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  FRANCE_40: {
    tpAtr: 0.50, slAtr: 1.65, atrH1Cap: 53.3, maxHoldH: 96, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 8206, baseToEUR: 1.000,
    tickSize: 0.5,
    volume_min: 0.001, volume_max: 100, volume_step: 0.001,
  },
  US_30: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 245.0, maxHoldH: 96, reversalEnabled: true,
    spread: 7.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 48029, baseToEUR: 0.847,
    tickSize: 1.0,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  US_500: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 36.75, maxHoldH: 96, reversalEnabled: true,
    spread: 1.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 6816, baseToEUR: 0.847,
    tickSize: 0.25,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  US_TECH100: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 182.85, maxHoldH: 96, reversalEnabled: true,
    spread: 2.25,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 25062, baseToEUR: 0.847,
    tickSize: 0.25,
    volume_min: 0.001, volume_max: 100, volume_step: 0.001,
  },
  JAPAN_225: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 350, maxHoldH: 96, reversalEnabled: true,
    spread: 15.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 56205, baseToEUR: 0.006,
    tickSize: 5.0,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 970.69, maxHoldH: 96, reversalEnabled: true,
    spread: 70.71,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 60672, baseToEUR: 1.000,
    volume_min: 0.0001, volume_max: 100, volume_step: 0.0001,
  },
  BTCUSD: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 1129.82, maxHoldH: 96, reversalEnabled: true,
    spread: 51.3,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 70945, baseToEUR: 0.847,
    volume_min: 0.0001, volume_max: 100, volume_step: 0.0001,
  },
  BTCJPY: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 1100, maxHoldH: 96, reversalEnabled: true,
    spread: 5000,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 11282266, baseToEUR: 0.006,
    volume_min: 0.0001, volume_max: 100, volume_step: 0.0001,
  },
  ETHUSD: {
    tpAtr: 0.55, slAtr: 1.75, atrH1Cap: 62.43, maxHoldH: 96, reversalEnabled: true,
    spread: 1.9,
    targetLeveragePerTrade: 0.3,
    contractSize: 100, refPrice: 2169, baseToEUR: 0.847,
    volume_min: 0.001, volume_max: 100, volume_step: 0.001,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 0.50, slAtr: 1.55, atrH1Cap: 38.60, maxHoldH: 96, reversalEnabled: true,
    spread: 1.26,
    targetLeveragePerTrade: 0.75,
    contractSize: 100, refPrice: 4770, baseToEUR: 0.847,
    tickSize: 0.01,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  SILVER: {
    tpAtr: 0.50, slAtr: 1.75, atrH1Cap: 1.653, maxHoldH: 96, reversalEnabled: true,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
    spread: 0.148,
    targetLeveragePerTrade: 0.5,
    contractSize: 10000, refPrice: 75.14, baseToEUR: 0.847,
    tickSize: 0.001,
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CrudeOIL: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 1.22, maxHoldH: 96, reversalEnabled: true,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 99.22, baseToEUR: 0.847,
    tickSize: 0.01,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  GASOLINE: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 0.0441, maxHoldH: 96, reversalEnabled: true,
    spread: 0.003,
    targetLeveragePerTrade: 0.5,
    contractSize: 100000, refPrice: 3.056, baseToEUR: 0.847,
    tickSize: 0.0001,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  BRENT_OIL: {
    tpAtr: 0.55, slAtr: 1.70, atrH1Cap: 1.22, maxHoldH: 96, reversalEnabled: true,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 97.98, baseToEUR: 0.847,
    tickSize: 0.01,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },

  // ── AGRICULTURE ────────────────────────────────────────────────────────────

  WHEAT: {
    tpAtr: 0.40, slAtr: 1.60, atrH1Cap: 5.50, maxHoldH: 96, reversalEnabled: true,
    spread: 0.05, spread_price: 0.05,
    targetLeveragePerTrade: 0.75,
    contractSize: 100, refPrice: 584, baseToEUR: 0.847,
    tickSize: 0.25,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 0.50, slAtr: 1.65,
    spread: 0,
    defaultMaxHoldH: 96,
    targetLeveragePerTrade: 0.25,
    contractSize: 100000, refPrice: 1.0, baseToEUR: 1.0,
  },
};

// ============================================================================
// HELPER
// ============================================================================
export function getRiskConfig(symbol) {
  if (!symbol) return RISK_CONFIG.default;
  const clean = String(symbol).trim();
  return RISK_CONFIG[clean] ?? RISK_CONFIG.default;
}
