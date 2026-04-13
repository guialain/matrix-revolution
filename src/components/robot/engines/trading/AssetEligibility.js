// ============================================================================
// AssetEligibility.js
// Rôle :
//  - Déterminer si un actif est éligible au trading
//  - Agrège : GlobalMarketHours + VolatilityConfig
//  - assetclass fourni directement par le feed MQL5
// NON décisionnaire (ne BUY / SELL jamais)
// ============================================================================

import GlobalMarketHours from "./GlobalMarketHours";
import { getVolatilityRegime, isTradableVolatility } from '../config/VolatilityConfig';

// ============================================================================
// Helper — lookup de la row marketWatch pour un symbole
// ============================================================================
function findMarketWatchRow(snapshot, symbol) {
  if (!symbol) return null;
  const mw = snapshot?.marketWatch;
  if (!Array.isArray(mw)) return null;
  return mw.find(r => r.symbol === symbol) ?? null;
}

// ============================================================================
// Helper — normalise assetclass → clé GlobalMarketHours
// ============================================================================
export function resolveMarket(assetclass) {
  switch (assetclass?.toUpperCase()) {
    case 'FX':     return 'FX';
    case 'INDEX':  return 'INDEX';
    case 'CRYPTO': return 'CRYPTO';
    case 'METAL':  return 'METAL';
    case 'ENERGY':  return 'ENERGY';
    case 'OIL_GAS': return 'ENERGY';
    case 'GAS':     return 'ENERGY';
    case 'AGRI':    return 'AGRI';
    case 'SOFT':    return 'AGRI';
    default:       return null;
  }
}

// Temporarily blocked — configs preserved, trading disabled
export const BLOCKED_SYMBOLS = [
  "JAPAN_225",
];

export const ALLOWED_SYMBOLS = [
  // FX
  "EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCHF", "EURJPY", "GBPJPY", "AUDJPY",
  // INDEX
  "GERMANY_40", "UK_100", "US_30", "US_500", "US_TECH100", "JAPAN_225",
  // CRYPTO
  "BTCUSD", "BTCEUR", "BTCJPY", "ETHUSD",
  // METAL
  "GOLD", "SILVER",
  // ENERGY
  "CrudeOIL", "BRENT_OIL", "GASOLINE",
  // AGRI
  "WHEAT",
];

// ============================================================================
// CORE
// ============================================================================
const AssetEligibility = {

  check(snapshot, now = new Date()) {

    const symbol = snapshot?.asset?.symbol;
    if (!symbol) {
      return {
        eligible: false,
        reasons: ["Missing asset symbol"],
        context: null
      };
    }

    if (BLOCKED_SYMBOLS.includes(symbol)) {
      return {
        eligible: false,
        reasons: [`Symbol temporarily blocked`],
        context: { symbol }
      };
    }

    if (!ALLOWED_SYMBOLS.includes(symbol)) {
      return {
        eligible: false,
        reasons: [`Symbol not in allowed list`],
        context: { symbol }
      };
    }

    const row = findMarketWatchRow(snapshot, symbol);

    // =========================
    // 1) MARCHÉ (assetclass fourni par neo_market_scan.csv)
    // =========================
    const marketKey = resolveMarket(row?.assetclass);
    if (!marketKey) {
      return {
        eligible: false,
        reasons: ["Unknown asset market"],
        context: { symbol }
      };
    }

    // =========================
    // 2) HEURES DE MARCHÉ
    // =========================
    const hours = GlobalMarketHours.check(marketKey, now, symbol);
    if (!hours?.allowed) {
      return {
        eligible: false,
        reasons: [hours?.reason ?? "Market closed"],
        context: {
          symbol,
          market: marketKey,
          hour: hours?.hour ?? null
        }
      };
    }

    // =========================
    // 3) VOLATILITÉ (atr_m15 / close)
    // =========================
    const atr_m15 = row?.atr_m15 ?? null;
    const close   = row?.price   ?? null;

    if (!Number.isFinite(atr_m15) || !Number.isFinite(close)) {
      return {
        eligible: true,
        reasons: ["Volatility Unknown"],
        context: {
          symbol,
          market: marketKey,
          hour: hours.hour,
          volatilityLevel: 'unknown',
          tradeMode: "PRUDENT"
        }
      };
    }

    const volatilityLevel = getVolatilityRegime(symbol, atr_m15, close);

    if (!isTradableVolatility(symbol, atr_m15, close)) {
      return {
        eligible: false,
        reasons: [`Volatility ${volatilityLevel}`],
        context: {
          symbol,
          market: marketKey,
          hour: hours.hour,
          volatilityLevel,
          atr_m15,
          close
        }
      };
    }

    // =========================
    // 4) MODE DE TRADING (INFO)
    // =========================
    let tradeMode = "NORMAL";
    if (volatilityLevel === 'high')  tradeMode = "DYNAMIQUE";
    if (volatilityLevel === 'explo') tradeMode = "PRUDENT";

    // =========================
    // ✅ ÉLIGIBLE
    // =========================
    return {
      eligible: true,
      reasons: [],
      context: {
        symbol,
        market: marketKey,
        hour: hours.hour,
        volatilityLevel,
        tradeMode
      }
    };
  }
};

export default AssetEligibility;
