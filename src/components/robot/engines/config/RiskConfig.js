// ============================================================================
// RISK CONFIG — Paramètres de risque par actif
//
// ✅ TP/SL basés sur ATR H1 (multiplicateurs)
//
//   tpAtr  : multiplicateur ATR H1 pour le Take Profit
//   slAtr  : multiplicateur ATR H1 pour le Stop Loss
//
//   spread : spread fixe en unités prix, relevé sur MT5.
//            Source unique dans computeSpreadPrice (priorité après config.spread global).
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
    tpAtr: 0.60, slAtr: 1.75, maxHoldH: 8, reversalEnabled: false,
    spread: 0.00008,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.147722, baseToEUR: 1.000,
  },
  AUDUSD: {
    tpAtr: 0.40, slAtr: 0.90, maxHoldH: 8, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 0.71043, baseToEUR: 0.847,
  },
  NZDUSD: {
    tpAtr: 0.45, slAtr: 3.30, maxHoldH: 8, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 0.63000, baseToEUR: 0.847,
  },
  USDCHF: {
    tpAtr: 0.50, slAtr: 1.40, maxHoldH: 8, reversalEnabled: false,
    spread: 0.00015,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 0.8850, baseToEUR: 0.847,
  },
  GBPUSD: {
    tpAtr: 0.40, slAtr: 2.60, maxHoldH: 8, reversalEnabled: true,
    spread: 0.00012,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.33423, baseToEUR: 1.076,
  },
  USDJPY: {
    tpAtr: 0.25, slAtr: 2.10, maxHoldH: 8, reversalEnabled: true,
    spread: 0.013,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 158.976, baseToEUR: 0.847,
  },
  EURJPY: {
    tpAtr: 0.45, slAtr: 2.60, maxHoldH: 8, reversalEnabled: true,
    spread: 0.018,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 183.351, baseToEUR: 1.000,
  },
  EURAUD: {
    tpAtr: 0.50, slAtr: 1.20, maxHoldH: 8, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.61500, baseToEUR: 1.000,
  },
  GBPJPY: {
    tpAtr: 0.45, slAtr: 1.50, maxHoldH: 8, reversalEnabled: true,
    spread: 0.022,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 212.116, baseToEUR: 1.076,
  },
  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.60, slAtr: 1.50, maxHoldH: 4.05, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 8500, baseToEUR: 1.076,
    tickSize: 0.5, tickValue: 5, profitCurrency: "GBP",
    assetClass: "INDEX",
    stopsLevel: 50,
    volume_min: 0.01, volume_max: 100, volume_step: 0.01,
  },
  GERMANY_40: {
    tpAtr: 0.40, slAtr: 1.80, maxHoldH: 4, reversalEnabled: true,
    spread: 5.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 23910.5, baseToEUR: 1.000,
    tickSize: 1.0,
  },
  FRANCE_40: {
    tpAtr: 0.30, slAtr: 2.00, maxHoldH: 4, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 8008.5, baseToEUR: 1.000,
    tickSize: 0.5,
  },
  US_30: {
    tpAtr: 0.45, slAtr: 2.00, maxHoldH: 4, reversalEnabled: true,
    spread: 7.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 10, refPrice: 47438, baseToEUR: 0.847,
    tickSize: 1.0,
  },
  US_500: {
    tpAtr: 0.40, slAtr: 2.00, maxHoldH: 4, reversalEnabled: true,
    spread: 1.0,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 6772.75, baseToEUR: 0.847,
    tickSize: 0.25,
  },
  US_TECH100: {
    tpAtr: 0.37, slAtr: 1.15, maxHoldH: 4, reversalEnabled: true,
    spread: 2.25,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 24938.75, baseToEUR: 0.847,
    tickSize: 0.25,
  },
  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 0.45, slAtr: 1.45, maxHoldH: 1.25, reversalEnabled: false,
    spread: 70.71,
    targetLeveragePerTrade: 0.25,
    contractSize: 10, refPrice: 63931.05, baseToEUR: 1.000,
  },
  BTCUSD: {
    tpAtr: 0.45, slAtr: 1.65, maxHoldH: 1.5, reversalEnabled: false,
    spread: 51.3,
    targetLeveragePerTrade: 0.25,
    contractSize: 10, refPrice: 73747.20, baseToEUR: 0.847,
  },
  ETHUSD: {
    tpAtr: 0.35, slAtr: 1.5, maxHoldH: 1.5, reversalEnabled: false,
    spread: 1.9,
    targetLeveragePerTrade: 0.5,
    contractSize: 100, refPrice: 2318.06, baseToEUR: 0.847,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 0.50, slAtr: 1.0, maxHoldH: 0.75, reversalEnabled: true,
    spread: 1.26,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 5016.73, baseToEUR: 0.847,
    tickSize: 0.01,
  },
  SILVER: {
    tpAtr: 0.55, slAtr: 2.85, maxHoldH: 3.5, reversalEnabled: false,
    spread: 0.148,
    targetLeveragePerTrade: 0.5,
    contractSize: 10000, refPrice: 80.880, baseToEUR: 0.847,
    tickSize: 0.001,
  },
  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CrudeOIL: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 1.5, reversalEnabled: false,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 94.70, baseToEUR: 0.847,
    tickSize: 0.01,
  },
  GASOLINE: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 1.5, reversalEnabled: false,
    spread: 0.003,
    targetLeveragePerTrade: 0.5,
    contractSize: 100000, refPrice: 3.13, baseToEUR: 0.847,
    tickSize: 0.0001,
  },
  BRENT_OIL: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 1.5, reversalEnabled: false,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 112.27, baseToEUR: 0.847,
    tickSize: 0.01,
  },

  // ── AGRI ──────────────────────────────────────────────────────────────────

  WHEAT: {
    tpAtr: 0.45, slAtr: 1.85, maxHoldH: 3, reversalEnabled: false,
    spread: 0.75,
    targetLeveragePerTrade: 0.5,
    contractSize: 5000, refPrice: 593.75, baseToEUR: 0.847,
    tickSize: 0.25,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 0.45, slAtr: 1.45,
    spread: 0,
    defaultMaxHoldH: 1.5,
    targetLeveragePerTrade: 1,
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