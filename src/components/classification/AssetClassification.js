// ============================================================================
// AssetClassification.js
// Rôle : Classification officielle des actifs NEO MATRIX
// ============================================================================

/**
 * Asset Classes
 */
export const ASSET_CLASSES = {
  FX: "FX",
  CRYPTO: "CRYPTO",
  INDEX: "INDEX",
  METAL: "METAL",
  AGRI: "AGRI",
  OIL_GAS: "OIL_GAS"
};

/**
 * Assets by Class
 */
export const ASSETS_BY_CLASS = {
  [ASSET_CLASSES.FX]: [
    "AUDCAD", "AUDNZD", "AUDUSD",
    "EURAUD", "EURCAD", "EURCHF", "EURGBP", "EURJPY",
    "EURNOK", "EURNZD", "EURUSD",
    "GBPNZD", "GBPJPY", "GBPUSD",
    "NZDUSD",
    "USDCAD", "USDCHF", "USDJPY",
    "USDNOK", "USDSEK"
  ],

  [ASSET_CLASSES.CRYPTO]: [
    "BTCUSD", "BTCEUR", "BTCJPY",
    "ETHUSD",
    "LTCUSD",
    "DOGEUSD",
    "XRPUSD",
    "NEOUSD"
  ],

  [ASSET_CLASSES.INDEX]: [
    "US_30", "US_500", "US_TECH100",
    "FRANCE_40", "GERMANY_40", "ITALY_40",
    "UK_100", "DOLLAR_INDX"
  ],

  [ASSET_CLASSES.METAL]: [
    "GOLD", "SILVER", "PLATINUM", "PALLADIUM"
  ],

  [ASSET_CLASSES.AGRI]: [
    "COCOA",
    "COFFEE_C"
  ],

  [ASSET_CLASSES.OIL_GAS]: [
    "CrudeOIL",
    "BRENT_OIL",
    "HEATING_OIL",
    "GASOLINE",
    "NATURAL_GAS",
    "COPPER"
  ]
};

/**
 * Helpers
 */
export function getAssetClasses() {
  return Object.values(ASSET_CLASSES);
}

export function getAssetClass(symbol) {
  for (const [cls, symbols] of Object.entries(ASSETS_BY_CLASS)) {
    if (symbols.includes(symbol)) return cls;
  }
  return null;
}
