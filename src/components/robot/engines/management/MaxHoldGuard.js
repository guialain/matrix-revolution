// ============================================================================
// MaxHoldGuard.js
// Rôle : détecter les positions ouvertes dépassant maxHoldH (RiskConfig)
// Retourne un tableau de { ticket, symbol, reason, duration_h, maxHoldH }
//         à fermer via sendCloseToMT5
//
// TODO — exit guard non branché sur GlobalMarketHours.
//   Symptôme : une position ouverte juste avant la cloche d'un actif à
//   fenêtre intraday (WHEAT 9-16 UTC, COCOA 5.75-14.4833 UTC, futurs indices
//   intraday) reste détenue hors-marché jusqu'à TP/SL hit ou maxHoldH (96h).
//   Risque concret : position COCOA ouverte Jeudi 14:00 UTC, non close avant
//   Ven 14:29 UTC → détenue ~65h hors-marché → swap × 2 nuits + gap dim/lun.
//   Fix proposé : ajouter dans evaluate() un check
//     if (!GlobalMarketHours.check(market, now, symbol).allowed) → force-close
//   À traiter pour tous les symboles avec entrée dans symbolOverrides.
// ============================================================================

import { getRiskConfig, RISK_CONFIG } from "../config/RiskConfig";

const DEFAULT_MAX_HOLD_H = RISK_CONFIG.default?.defaultMaxHoldH || 8;

// Kill-switch local : desactive temporairement (cloture forcee 96h trop agressive
// vs duree typique des trades). Pour reactiver : MODULE_ENABLED = true.
const MODULE_ENABLED = false;

const MaxHoldGuard = (() => {

  /**
   * @param {Array} positions — openPositions from MT5
   *   Each: { ticket, symbol, open_time, side, pnl_eur, ... }
   * @returns {Array} positions to close: [{ ticket, symbol, side, reason, duration_h, maxHoldH }]
   */
  function evaluate(positions) {
    if (!MODULE_ENABLED) return [];
    if (!Array.isArray(positions) || !positions.length) return [];

    const now = Date.now();
    const toClose = [];

    for (const p of positions) {
      if (!p?.ticket || !p?.symbol) continue;

      const openMs = parseOpenTime(p.open_time);
      if (!Number.isFinite(openMs)) continue;

      const durationH = (now - openMs) / 3_600_000;
      const rc = getRiskConfig(p.symbol);
      const maxH = rc.maxHoldH || DEFAULT_MAX_HOLD_H;

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
