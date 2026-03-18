// ============================================================================
// NEO MATRIX — OFFICIAL ASSET → MARKET CONTEXT MAP (v1.1)
// Source of truth for MarketTrend & Context logic
// ============================================================================

export const ASSET_MARKET_CONTEXT_MAP = {

  // ======================================================
  // STOCKS / EQUITIES (CFD SHARES, ETF)
  // ======================================================
  stock: {
    key: "stocks",
    title: "Equities",
    symbols: [] // facultatif, le panel fonctionne sans
  },

  // ======================================================
  // METALS
  // ======================================================
  metal: {
    key: "metals",
    title: "Metals",
    symbols: [
      "GOLD",
      "SILVER",
      "COPPER",
      "PLATINUM",
      "PALLADIUM",
      "DOLLAR_INDX"
    ]
  },

  // ======================================================
  // ENERGY
  // ======================================================
  energy: {
    key: "energy",
    title: "Energy",
    symbols: [
      "BRENT_OIL",
      "CrudeOIL",
      "GASOLINE",
      "HEATING_OIL",
      "NATURAL_GAS",
      "USDCAD"
    ]
  },

  // ======================================================
  // INDICES
  // ======================================================
  index: {
    key: "index",
    title: "Global Indices",
    symbols: [
      "US_30",
      "US_500",
      "US_TECH100",
      "GERMANY_40",
      "FRANCE_40",
      "UK_100",
      "DOLLAR_INDX"
    ]
  },

  // ======================================================
  // CRYPTO
  // ======================================================
  crypto: {
    key: "crypto",
    title: "Crypto Market",
    symbols: [
      "BTCUSD",
      "ETHUSD",
      "SOLUSD",
      "DOGEUSD",
      "XRPUSD",
      "LINKUSD"
    ]
  },

  // ======================================================
  // SOFT COMMODITIES
  // ======================================================
  soft: {
    key: "softs",
    title: "Soft Commodities",
    symbols: [
      "COCOA",
      "COFFEE_C",
      "COTTON#2",
      "SUGAR#11",
      "CORN",
      "WHEAT"
    ]
  },

  // ======================================================
  // FOREX — USD
  // ======================================================
  fx_usd: {
    key: "forex",
    title: "Forex — USD",
    base: "USD",
    symbols: [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "AUDUSD",
      "USDCAD",
      "USDCHF"
    ]
  },

  // ======================================================
  // FOREX — EUR
  // ======================================================
  fx_eur: {
    key: "forex_eur",
    title: "Forex — EUR",
    base: "EUR",
    symbols: [
      "EURUSD",
      "EURJPY",
      "EURGBP",
      "EURCHF",
      "EURAUD",
      "EURCAD"
    ]
  },

  // ======================================================
  // FOREX — GBP
  // ======================================================
  fx_gbp: {
    key: "forex_gbp",
    title: "Forex — GBP",
    base: "GBP",
    symbols: [
      "GBPUSD",
      "EURGBP",
      "GBPJPY",
      "GBPAUD",
      "GBPCAD",
      "GBPCHF"
    ]
  },

  // ======================================================
  // FOREX — JPY
  // ======================================================
  fx_jpy: {
    key: "forex_jpy",
    title: "Forex — JPY",
    base: "JPY",
    symbols: [
      "USDJPY",
      "EURJPY",
      "GBPJPY",
      "AUDJPY",
      "CADJPY",
      "CHFJPY"
    ]
  },

  // ======================================================
  // FOREX — AUD
  // ======================================================
  fx_aud: {
    key: "forex_aud",
    title: "Forex — AUD",
    base: "AUD",
    symbols: [
      "AUDUSD",
      "EURAUD",
      "GBPAUD",
      "AUDJPY",
      "AUDCAD",
      "AUDCHF"
    ]
  },

  // ======================================================
  // FOREX — CAD
  // ======================================================
  fx_cad: {
    key: "forex_cad",
    title: "Forex — CAD",
    base: "CAD",
    symbols: [
      "USDCAD",
      "EURCAD",
      "GBPCAD",
      "AUDCAD",
      "CADJPY",
      "CADCHF"
    ]
  },

  // ======================================================
  // FOREX — CHF
  // ======================================================
  fx_chf: {
    key: "forex_chf",
    title: "Forex — CHF",
    base: "CHF",
    symbols: [
      "USDCHF",
      "EURCHF",
      "GBPCHF",
      "AUDCHF",
      "CADCHF",
      "CHFJPY"
    ]
  },

  // ======================================================
  // FOREX — NZD
  // ======================================================
  fx_nzd: {
    key: "forex_nzd",
    title: "Forex — NZD",
    base: "NZD",
    symbols: [
      "NZDUSD",
      "EURNZD",
      "GBPNZD",
      "AUDNZD",
      "NZDJPY",
      "NZDCAD"
    ]
  },

  // ======================================================
  // FOREX — SEK
  // ======================================================
  fx_sek: {
    key: "forex_sek",
    title: "Forex — SEK",
    base: "SEK",
    symbols: [
      "USDSEK",
      "EURSEK",
      "GBPSEK",
      "SEKJPY",
      "AUDSEK",
      "CADSEK"
    ]
  },

  // ======================================================
  // FOREX — NOK
  // ======================================================
  fx_nok: {
    key: "forex_nok",
    title: "Forex — NOK",
    base: "NOK",
    symbols: [
      "USDNOK",
      "EURNOK",
      "GBPNOK",
      "NOKJPY",
      "AUDNOK",
      "CADNOK"
    ]
  }
};
