// ============================================================================
// ExitOnTimeoutGreen.js
// Rôle : time-stop sur positions du robot en profit (apres spread) restees
//        ouvertes >=45 min sans avoir touche TP/SL.
//        Ferme la position pour libérer l'equity / eviter le retournement
//        progressif.
//
// Filtres (alignes sur ExitOnExtremeM1) :
//   - magic = ROBOT_MAGIC (positions ouvertes par le robot)
//   - profit : pnl_pts > spread_points (rentable apres spread)
//   - age : (now - open_time) >= MAX_HOLD_MS (45 min)
//
// Reason CSV : "MAX_HOLD_GREEN"
// rsi_at_close : null (non pertinent pour ce guard)
// ============================================================================

// Kill-switch local : reactive avec MAX_HOLD_MS = 45 min
const MODULE_ENABLED = true;

const ROBOT_MAGIC = 202601;
const MAX_HOLD_MS = 45 * 60 * 1000; // 45 min

const ExitOnTimeoutGreen = (() => {

  /**
   * @param {Array} positions    — openPositions from MT5
   * @param {Array} marketWatch  — snapshot.marketWatch (signature aligned ExtremeM1, non utilise ici)
   * @returns {Array} positions to close
   */
  // eslint-disable-next-line no-unused-vars
  function evaluate(positions, marketWatch) {
    if (!MODULE_ENABLED) return [];
    if (!Array.isArray(positions) || !positions.length) return [];

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

      // Filtre 3 : age >= MAX_HOLD_MS
      const openMs = parseOpenTime(p.open_time);
      if (!Number.isFinite(openMs)) continue;
      if ((now - openMs) < MAX_HOLD_MS) continue;

      const side = String(p.side ?? "").toUpperCase();

      toClose.push({
        ticket:        p.ticket,
        symbol:        p.symbol,
        side,
        magic:         ROBOT_MAGIC,
        opened_at:     p.open_time,
        rsi_at_close:  null,           // non pertinent pour MAX_HOLD_GREEN
        pnl_pts:       pnl,
        pnl_eur:       Number(p.pnl_eur),
        spread_points: spread,
        reason:        "MAX_HOLD_GREEN",
      });
    }

    return toClose;
  }

  return { evaluate, ROBOT_MAGIC, MAX_HOLD_MS };

})();

// ── HELPER ─────────────────────────────────────────────────────────────────
function parseOpenTime(open_time) {
  if (!open_time) return NaN;
  // MT5 format: "2026.04.28 14:30" → ISO UTC
  const iso = String(open_time).replace(/\./g, "-");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}

export default ExitOnTimeoutGreen;
