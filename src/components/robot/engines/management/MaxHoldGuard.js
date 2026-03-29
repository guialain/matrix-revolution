// ============================================================================
// MaxHoldGuard.js
// Rôle : détecter les positions ouvertes dépassant maxHoldH (RiskConfig)
//        et les positions ouvertes vendredi >= 20:30 UTC → FRIDAY_CLOSE
// Retourne un tableau de { ticket, symbol, reason, duration_h, maxHoldH }
//         à fermer via sendCloseToMT5
// ============================================================================

import { getRiskConfig, RISK_CONFIG } from "../config/RiskConfig";

const DEFAULT_MAX_HOLD_H = RISK_CONFIG.default?.defaultMaxHoldH || 8;
const FRIDAY_CLOSE_H = 21; // 21:00 UTC

const MaxHoldGuard = (() => {

  /**
   * @param {Array} positions — openPositions from MT5
   *   Each: { ticket, symbol, open_time, side, pnl_eur, ... }
   * @returns {Array} positions to close: [{ ticket, symbol, side, reason, duration_h, maxHoldH }]
   */
  function evaluate(positions) {
    if (!Array.isArray(positions) || !positions.length) return [];

    const now = Date.now();
    const nowDate = new Date(now);
    const isFriday = nowDate.getUTCDay() === 5;
    const nowHourUTC = nowDate.getUTCHours() + nowDate.getUTCMinutes() / 60;
    const isFridayClose = isFriday && nowHourUTC >= FRIDAY_CLOSE_H;

    const toClose = [];

    for (const p of positions) {
      if (!p?.ticket || !p?.symbol) continue;

      const openMs = parseOpenTime(p.open_time);
      if (!Number.isFinite(openMs)) continue;

      const durationH = (now - openMs) / 3_600_000;
      const rc = getRiskConfig(p.symbol);
      const maxH = rc.maxHoldH || DEFAULT_MAX_HOLD_H;

      // ── FRIDAY CLOSE (priority) ────────────────────────────────────────
      if (isFridayClose) {
        toClose.push({
          ticket:     p.ticket,
          symbol:     p.symbol,
          side:       p.side,
          reason:     "FRIDAY_CLOSE",
          duration_h: durationH,
          maxHoldH:   maxH,
        });
        continue;
      }

      // ── MAX HOLD ───────────────────────────────────────────────────────
      if (durationH >= maxH) {
        toClose.push({
          ticket:     p.ticket,
          symbol:     p.symbol,
          side:       p.side,
          reason:     "MAX_HOLD",
          duration_h: durationH,
          maxHoldH:   maxH,
        });
      }
    }

    return toClose;
  }

  return { evaluate };

})();

// ── HELPER ─────────────────────────────────────────────────────────────────
function parseOpenTime(open_time) {
  if (!open_time) return NaN;
  // MT5 format: "2026.03.21 14:30" → ISO UTC
  const iso = String(open_time).replace(/\./g, "-");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}

export default MaxHoldGuard;
