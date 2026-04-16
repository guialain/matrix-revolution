// ============================================================================
// GlobalMarketHours.js
// Rôle :
//  - Indiquer si NEO est OUVERT ou FERMÉ (NeoHours)
//  - Indiquer si un MARCHÉ est OUVERT ou FERMÉ (horaires officiels)
//  - Aucune notion de liquidité, volatilité ou qualité d’exécution
// Timezone : GMT (UTC)
// ============================================================================

const GlobalMarketHours = {

  // =========================
  // NEO HOURS (GLOBAL)
  // =========================
  neo: {
    label: "NEO MATRIX HOURS",
    open: 0.0,    // 00h00 UTC
    close: 24.0   // 24h/24
  },

  // =========================
  // MARCHÉS OFFICIELS
  // =========================
  markets: {

    // ---------- FX ----------
    FX:     { label: "FX Market",     open: 0.0,  close: 24.0 },

    // ---------- CRYPTO ----------
    CRYPTO: { label: "Crypto Market", open: 0.0,  close: 24.0 },

    // ---------- INDICES ----------
    INDEX:  { label: "Index Market",  open: 0.0,  close: 24.0 },

    // ---------- METALS ----------
    METAL:  { label: "Metals (COMEX)", open: 0.0, close: 24.0 },

    // ---------- ENERGY ----------
    ENERGY: { label: "Energy (NYMEX)", open: 0.0, close: 24.0 },

    // ---------- AGRI ----------
    AGRI:   { label: "Agri (ICE/CBOT)", open: 0.0, close: 24.0 },

    // ---------- DEFAULT (actifs non mappés) ----------
    default: { label: "Unknown Market", open: 0.0, close: 24.0 },
  },

  // =========================
  // SYMBOL OVERRIDES (heures spécifiques par actif)
  // =========================
  symbolOverrides: {
    WHEAT: { label: "CBOT Wheat", open: 0.0, close: 24.0 },
  },

  // =========================
  // UTILS TEMPORELLES
  // =========================
  getHour(now = new Date()) {
    return now.getUTCHours() + now.getUTCMinutes() / 60;
  },

  inRange(hour, start, end) {
    return hour >= start && hour < end;
  },

  // =========================
  // CHECK GLOBAL (NEO + MARKET)
  // =========================
  check(marketKey, now = new Date(), symbol = null) {
    const hour = this.getHour(now);

    // --- Neo open ? ---
    const neoOpen = this.inRange(hour, this.neo.open, this.neo.close);

    // --- Symbol override > market key > default fallback ---
    const market = (symbol && this.symbolOverrides?.[symbol])
      || this.markets[marketKey]
      || this.markets.default;

    // --- Market open ? ---
    const marketOpen = this.inRange(hour, market.open, market.close);

    // --- Combined gate ---
    const allowed = neoOpen && marketOpen;

    let reason = "Allowed";
    if (!neoOpen && !marketOpen) reason = "Outside NEO hours & market closed";
    else if (!neoOpen) reason = "Outside NEO MATRIX hours";
    else if (!marketOpen) reason = `Market closed (${market.label})`;

    return {
      allowed,
      neoOpen,
      marketOpen,
      market: market.label,
      hour,
      reason
    };
  }
};

export default GlobalMarketHours;
