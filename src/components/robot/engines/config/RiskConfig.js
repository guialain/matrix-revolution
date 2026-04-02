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
    tpAtr: 0.50, slAtr: 1.50, atrH1Cap: 0.00298, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.147722, baseToEUR: 1.000,
    volume_min: 0.01, volume_max: 150000, volume_step: 0.01,
  },
  AUDUSD: {
    tpAtr: 0.45, slAtr: 1.50, atrH1Cap: 0.00224, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.71043, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 151, volume_step: 0.01,
  },
  USDCHF: {
    tpAtr: 0.50, slAtr: 1.50, atrH1Cap: 0.00240, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.8850, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  GBPUSD: {
    tpAtr: 0.45, slAtr: 1.50, atrH1Cap: 0.00319, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00012,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.33423, baseToEUR: 1.076,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  USDJPY: {
    tpAtr: 0.55, slAtr: 1.50, atrH1Cap: 0.439, maxHoldH: 24, reversalEnabled: true,
    spread: 0.013,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 158.976, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 201, volume_step: 0.01,
  },
  EURJPY: {
    tpAtr: 0.55, slAtr: 1.50, atrH1Cap: 0.50, maxHoldH: 24, reversalEnabled: true,
    spread: 0.020,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 162.0, baseToEUR: 1.000,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  GBPJPY: {
    tpAtr: 0.60, slAtr: 1.50, atrH1Cap: 0.60, maxHoldH: 24, reversalEnabled: true,
    spread: 0.030,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 190.0, baseToEUR: 1.076,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  AUDJPY: {
    tpAtr: 0.50, slAtr: 1.50, atrH1Cap: 0.40, maxHoldH: 24, reversalEnabled: true,
    spread: 0.020,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 95.0, baseToEUR: 0.847,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.40, slAtr: 1.45, atrH1Cap: 43.6, maxHoldH: 24, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 8500, baseToEUR: 1.076,
    tickSize: 0.5, tickValue: 5, profitCurrency: "GBP",
    assetClass: "INDEX",
    stopsLevel: 50,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  GERMANY_40: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 145.8, maxHoldH: 24, reversalEnabled: true,
    spread: 5.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 23910.5, baseToEUR: 1.000,
    tickSize: 1.0,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  FRANCE_40: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 53.3, maxHoldH: 24, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 8008.5, baseToEUR: 1.000,
    tickSize: 0.5,
    volume_min: 0.001, volume_max: 100, volume_step: 0.001,
  },
  US_30: {
    tpAtr: 0.40, slAtr: 1.45, atrH1Cap: 245.0, maxHoldH: 24, reversalEnabled: true,
    spread: 7.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 47438, baseToEUR: 0.847,
    tickSize: 1.0,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  US_500: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 36.75, maxHoldH: 24, reversalEnabled: true,
    spread: 1.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 6772.75, baseToEUR: 0.847,
    tickSize: 0.25,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  US_TECH100: {
    tpAtr: 0.40, slAtr: 1.45, atrH1Cap: 182.85, maxHoldH: 24, reversalEnabled: true,
    spread: 2.25,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 24938.75, baseToEUR: 0.847,
    tickSize: 0.25,
    volume_min: 0.001, volume_max: 100, volume_step: 0.001,
  },
  JAPAN_225: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 350, maxHoldH: 24, reversalEnabled: true,
    spread: 15.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 36000, baseToEUR: 0.006,
    tickSize: 5.0,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 0.45, slAtr: 1.65, atrH1Cap: 970.69, maxHoldH: 24, reversalEnabled: true,
    spread: 70.71,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 63931.05, baseToEUR: 1.000,
    volume_min: 0.0001, volume_max: 100, volume_step: 0.0001,
  },
  BTCUSD: {
    tpAtr: 0.45, slAtr: 1.65, atrH1Cap: 1129.82, maxHoldH: 24, reversalEnabled: true,
    spread: 51.3,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 73747.20, baseToEUR: 0.847,
    volume_min: 0.0001, volume_max: 100, volume_step: 0.0001,
  },
  ETHUSD: {
    tpAtr: 0.45, slAtr: 1.65, atrH1Cap: 62.43, maxHoldH: 24, reversalEnabled: true,
    spread: 1.9,
    targetLeveragePerTrade: 0.3,
    contractSize: 100, refPrice: 2318.06, baseToEUR: 0.847,
    volume_min: 0.001, volume_max: 100, volume_step: 0.001,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 0.50, slAtr: 1.45, atrH1Cap: 38.60, maxHoldH: 24, reversalEnabled: true,
    spread: 1.26,
    targetLeveragePerTrade: 0.75,
    contractSize: 100, refPrice: 5016.73, baseToEUR: 0.847,
    tickSize: 0.01,
    volume_min: 0.01, volume_max: 150, volume_step: 0.01,
  },
  SILVER: {
    tpAtr: 0.5, slAtr: 1.45, atrH1Cap: 1.653, maxHoldH: 24, reversalEnabled: true,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
    spread: 0.148,
    targetLeveragePerTrade: 0.5,
    contractSize: 10000, refPrice: 80.880, baseToEUR: 0.847,
    tickSize: 0.001,
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CrudeOIL: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 1.22, maxHoldH: 24, reversalEnabled: true,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 94.70, baseToEUR: 0.847,
    tickSize: 0.01,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  GASOLINE: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 0.0441, maxHoldH: 24, reversalEnabled: true,
    spread: 0.003,
    targetLeveragePerTrade: 0.5,
    contractSize: 100000, refPrice: 3.13, baseToEUR: 0.847,
    tickSize: 0.0001,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  BRENT_OIL: {
    tpAtr: 0.45, slAtr: 1.45, atrH1Cap: 1.22, maxHoldH: 24, reversalEnabled: true,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 112.27, baseToEUR: 0.847,
    tickSize: 0.01,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },

  // ── AGRICULTURE ────────────────────────────────────────────────────────────

  WHEAT: {
    tpAtr: 0.35, slAtr: 1.35, atrH1Cap: 5.50, maxHoldH: 24, reversalEnabled: true,
    spread: 0.30, spread_price: 0.25,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 550, baseToEUR: 0.847,
    tickSize: 0.25,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 0.45, slAtr: 1.45,
    spread: 0,
    defaultMaxHoldH: 24,
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
