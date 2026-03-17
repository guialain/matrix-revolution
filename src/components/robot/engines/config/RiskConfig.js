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
//   targetLeveragePerTrade : levier cible par trade (compound scaling)
//   contractSize           : taille du contrat (unités de base par lot)
//   refPrice               : prix de référence pour estimations
//   baseToEUR              : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────

  EURUSD: {
    tpAtr: 0.60, slAtr: 1.75,
    spread: 0.00008,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 1.15330, baseToEUR: 1.000,
  },
  AUDUSD: {
    tpAtr: 0.60, slAtr: 1.75,
    spread: 0.00008,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 0.71043, baseToEUR: 0.847,
  },
  GBPUSD: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 0.00012,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 1.33423, baseToEUR: 1.076,
  },
  USDJPY: {
    tpAtr: 0.60, slAtr: 1.25,
    spread: 0.013,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 158.976, baseToEUR: 0.847,
  },
  EURJPY: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 0.018,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 183.351, baseToEUR: 1.000,
  },
  GBPJPY: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 0.022,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 212.116, baseToEUR: 1.076,
  },
  EURGBP: {
    tpAtr: 0.60, slAtr: 1.75,
    spread: 0.00012,
    targetLeveragePerTrade: 3,
    contractSize: 100000, refPrice: 0.86434, baseToEUR: 1.000,
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.60, slAtr: 2.00,
    spread: 2.0,
    targetLeveragePerTrade: 2,
    contractSize: 10, refPrice: 10398.5, baseToEUR: 1.076,
  },
  GERMANY_40: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 5.0,
    targetLeveragePerTrade: 2,
    contractSize: 10, refPrice: 23910.5, baseToEUR: 1.000,
  },
  FRANCE_40: {
    tpAtr: 0.50, slAtr: 1.50,
    spread: 2.0,
    targetLeveragePerTrade: 2,
    contractSize: 100, refPrice: 8008.5, baseToEUR: 1.000,
  },
  US_30: {
    tpAtr: 0.50, slAtr: 1.50,
    spread: 7.0,
    targetLeveragePerTrade: 2,
    contractSize: 10, refPrice: 47438, baseToEUR: 0.847,
  },
  US_500: {
    tpAtr: 0.60, slAtr: 1.25,
    spread: 1.0,
    targetLeveragePerTrade: 2,
    contractSize: 100, refPrice: 6772.75, baseToEUR: 0.847,
  },
  US_TECH100: {
    tpAtr: 0.60, slAtr: 1.75,
    spread: 2.25,
    targetLeveragePerTrade: 2,
    contractSize: 100, refPrice: 24938.75, baseToEUR: 0.847,
  },
  JAPAN_225: {
    tpAtr: 0.45, slAtr: 1.45,
    spread: 10.0,
    targetLeveragePerTrade: 2,
    contractSize: 100, refPrice: 54055, baseToEUR: 0.00613,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 70.71,
    targetLeveragePerTrade: 0.2,
    contractSize: 1, refPrice: 63931.05, baseToEUR: 1.000,
  },
  BTCUSD: {
    tpAtr: 0.60, slAtr: 1.75,
    spread: 51.3,
    targetLeveragePerTrade: 0.2,
    contractSize: 1, refPrice: 73747.20, baseToEUR: 0.847,
  },
  BTCJPY: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 12942,
    targetLeveragePerTrade: 0.2,
    contractSize: 1, refPrice: 11733376, baseToEUR: 0.00613,
  },
  ETHUSD: {
    tpAtr: 0.73, slAtr: 1.63,
    spread: 1.9,
    targetLeveragePerTrade: 0.2,
    contractSize: 1, refPrice: 2318.06, baseToEUR: 0.847,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 0.60, slAtr: 1.50,
    spread: 1.26,
    targetLeveragePerTrade: 0.5,
    contractSize: 100, refPrice: 5016.73, baseToEUR: 0.847,
  },
  SILVER: {
    tpAtr: 0.60, slAtr: 1.35,
    spread: 0.148,
    targetLeveragePerTrade: 0.5,
    contractSize: 5000, refPrice: 80.880, baseToEUR: 0.847,
  },
  PALLADIUM: {
    tpAtr: 0.60, slAtr: 1.25,
    spread: 8.5,
    targetLeveragePerTrade: 0.5,
    contractSize: 100, refPrice: 1635.00, baseToEUR: 0.847,
  },
  PLATINUM: {
    tpAtr: 0.60, slAtr: 1.25,
    spread: 5.0,
    targetLeveragePerTrade: 0.5,
    contractSize: 100, refPrice: 2129.9, baseToEUR: 0.847,
  },
  COPPER: {
    tpAtr: 0.45, slAtr: 1.45,
    spread: 0.003,
    targetLeveragePerTrade: 1,
    contractSize: 25000, refPrice: 5.7810, baseToEUR: 0.847,
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CRUDEOIL: {
    tpAtr: 0.50, slAtr: 1.45,
    spread: 0.04,
    targetLeveragePerTrade: 1,
    contractSize: 1000, refPrice: 96.80, baseToEUR: 0.847,
  },
  NATURAL_GAS: {
    tpAtr: 0.50, slAtr: 1.45,
    spread: 0.011,
    targetLeveragePerTrade: 1,
    contractSize: 10000, refPrice: 3.074, baseToEUR: 0.847,
  },
  HEATING_OIL: {
    tpAtr: 0.50, slAtr: 1.45,
    spread: 0.003,
    targetLeveragePerTrade: 1,
    contractSize: 100000, refPrice: 4.0379, baseToEUR: 0.847,
  },

  // ── AGRI ──────────────────────────────────────────────────────────────────

  COCOA: {
    tpAtr: 0.60, slAtr: 1.25,
    spread: 9.0,
    targetLeveragePerTrade: 0.5,
    contractSize: 10, refPrice: 3394, baseToEUR: 0.847,
  },
  COFFEE_C: {
    tpAtr: 0.60, slAtr: 1.25,
    spread: 0.6,
    targetLeveragePerTrade: 0.5,
    contractSize: 37500, refPrice: 297.10, baseToEUR: 0.847,
  },
  WHEAT: {
    tpAtr: 0.50, slAtr: 1.45,
    spread: 0.75,
    targetLeveragePerTrade: 0.5,
    contractSize: 5000, refPrice: 593.75, baseToEUR: 0.847,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 0.50, slAtr: 1.45,
    spread: 0,
    targetLeveragePerTrade: 1,
    contractSize: 100000, refPrice: 1.0, baseToEUR: 1.0,
  },
};

// ============================================================================
// HELPER
// ============================================================================
export function getRiskConfig(symbol) {
  if (!symbol) return RISK_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return RISK_CONFIG[clean] ?? RISK_CONFIG.default;
}