// ============================================================================
// allowedSymbols.js — source de verite UNIQUE pour la whitelist symbol
// Utilise par : server.js (filtrage marketWatch + Claude API context),
//               AssetEligibility.js (gate per-symbol)
//
// ⚠️ Cette liste contient 22 symboles trades + 5 context-only.
// Les context-only (DOLLAR_INDX, PLATINUM, PALLADIUM, COCOA, COFFEE_C)
// ne sont PAS trades par le bot — ils servent de proxies macro pour
// NeoMacroContext (Data_Structure.mqh, FillMacroContext()).
//
// ⚠️ MIRROR : cette liste doit rester synchronisee avec l'input
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

const ALLOWED_SET = new Set(ALLOWED_SYMBOLS.map(s => s.toUpperCase()));

export function isAllowed(sym) {
  return ALLOWED_SET.has(String(sym ?? "").toUpperCase());
}
