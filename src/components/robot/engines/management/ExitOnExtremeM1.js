// ============================================================================
// ExitOnExtremeM1.js
// Rôle : détecter les positions du robot en profit où le RSI M1 atteint
//        un extrême contre la position (BUY rsi>75, SELL rsi<25).
//        Retourne un tableau de positions à fermer via sendCloseToMT5.
//
// Filtres :
//   - magic = ROBOT_MAGIC (positions ouvertes par le robot)
//   - profit : pnl_pts > spread_points (rentable apres spread)
//   - warmup : >=120s depuis open_time (2 bougies M1)
//   - RSI extreme : BUY rsi_m1_s0 > 75, SELL rsi_m1_s0 < 25
// ============================================================================

const ROBOT_MAGIC = 202601;
const WARMUP_MS   = 120_000;
const RSI_HIGH    = 75;
const RSI_LOW     = 25;

const ExitOnExtremeM1 = (() => {

  /**
   * @param {Array} positions    — openPositions from MT5
   * @param {Array} marketWatch  — snapshot.marketWatch (pour rsi_m1_s0)
   * @returns {Array} positions to close
   */
  function evaluate(positions, marketWatch) {
    if (!Array.isArray(positions) || !positions.length) return [];
    if (!Array.isArray(marketWatch)) return [];

    const now = Date.now();
    const toClose = [];

    for (const p of positions) {
      if (!p?.ticket || !p?.symbol) continue;

      // Filtre 1 : robot only
      if (Number(p.magic) !== ROBOT_MAGIC) continue;

      // Filtre 2 : profit (pnl_pts > spread_points)
      const pnl    = Number(p.pnl_pts);
      const spread = Number(p.spread);
      if (!Number.isFinite(pnl) || !Number.isFinite(spread)) continue;
      if (pnl <= spread) continue;

      // Filtre 3 : warmup
      const openMs = parseOpenTime(p.open_time);
      if (!Number.isFinite(openMs)) continue;
      if ((now - openMs) < WARMUP_MS) continue;

      // Lookup rsi_m1_s0
      const row = marketWatch.find(r => r.symbol === p.symbol);
      const rsi = Number(row?.rsi_m1_s0);
      if (!Number.isFinite(rsi)) continue;

      const side = String(p.side ?? "").toUpperCase();
      let reason = null;
      if (side === "BUY"  && rsi > RSI_HIGH) reason = "M1_EXTREME_HIGH";
      if (side === "SELL" && rsi < RSI_LOW)  reason = "M1_EXTREME_LOW";
      if (!reason) continue;

      toClose.push({
        ticket:        p.ticket,
        symbol:        p.symbol,
        side,
        magic:         ROBOT_MAGIC,
        opened_at:     p.open_time,
        rsi_at_close:  rsi,
        pnl_pts:       pnl,
        pnl_eur:       Number(p.pnl_eur),
        spread_points: spread,
        reason,
      });
    }

    return toClose;
  }

  return { evaluate, ROBOT_MAGIC, WARMUP_MS, RSI_HIGH, RSI_LOW };

})();

// ── HELPER ─────────────────────────────────────────────────────────────────
function parseOpenTime(open_time) {
  if (!open_time) return NaN;
  // MT5 format: "2026.04.28 14:30" → ISO UTC
  const iso = String(open_time).replace(/\./g, "-");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}

export default ExitOnExtremeM1;
