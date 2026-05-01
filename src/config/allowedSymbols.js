// ============================================================================
// allowedSymbols.js — source de verite UNIQUE pour les whitelists symbols
//
// DEUX listes distinctes :
//   - ALLOWED_SYMBOLS  (27) : scan complet, utilise par server.js pour
//                             filtrer marketWatch + contexte Claude API
//   - TRADABLE_SYMBOLS (22) : sous-ensemble trading, utilise par
//                             AssetEligibility.js comme gate per-symbol
//
// Les 5 symboles dans ALLOWED_SYMBOLS mais PAS dans TRADABLE_SYMBOLS
// (DOLLAR_INDX, PLATINUM, PALLADIUM, COCOA, COFFEE_C) sont des proxies
// macro pour NeoMacroContext (Data_Structure.mqh, FillMacroContext()) :
// scannes pour analyse contextuelle, jamais trades par le bot.
//
// ⚠️ MIRROR : ALLOWED_SYMBOLS doit rester synchronisee avec l'input
// EnabledSymbols dans TopMoversScanner_NEO.mq5
// (terminal MT5 → Onglet Experts → proprietes EA → onglet Inputs).
// Si desynchronise : pas de bug fonctionnel (Node refiltre cote serveur),
// juste perte de l'optimisation CPU cote MT5.
// ============================================================================

export const ALLOWED_SYMBOLS = [
  // FX
  "EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD",
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
  // CONTEXT_ONLY (non trades, utilises comme proxies macro NeoMacroContext)
  "DOLLAR_INDX", "PLATINUM", "PALLADIUM", "COCOA", "COFFEE_C",
];

export const TRADABLE_SYMBOLS = [
  // FX
  "EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD",
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

const ALLOWED_SET  = new Set(ALLOWED_SYMBOLS.map(s => s.toUpperCase()));
const TRADABLE_SET = new Set(TRADABLE_SYMBOLS.map(s => s.toUpperCase()));

export function isAllowed(sym) {
  return ALLOWED_SET.has(String(sym ?? "").toUpperCase());
}

export function isTradable(sym) {
  return TRADABLE_SET.has(String(sym ?? "").toUpperCase());
}
