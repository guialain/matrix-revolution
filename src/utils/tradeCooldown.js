// ============================================================================
// tradeCooldown.js — Skip evaluation si position robot ouverte recente
//
// Cooldown UI-driven : la duree provient du dropdown DealPipeline
// (1/2/5/10/15/30/45/60 min) via SignalFrequency.getCooldownMinutes().
//
// Logique :
//   - Filtre magic = ROBOT_MAGIC (positions manuelles ignorees)
//   - Granularite : symbol seul (BUY+SELL confondus)
//   - Compteur s'arrete a la fermeture de position (pas de carry-over)
// ============================================================================

const ROBOT_MAGIC = 202601;

/**
 * Retourne true si une position robot est ouverte sur `symbol` depuis
 * moins de cooldownMs millisecondes.
 *
 * @param {string} symbol
 * @param {Array} positions - openPositions from MT5 snapshot
 * @param {number} cooldownMs - duree du cooldown en ms (0 ou null -> jamais en cooldown)
 * @returns {boolean}
 */
export function isInCooldown(symbol, positions, cooldownMs) {
  if (!Array.isArray(positions) || !positions.length) return false;
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) return false;
  if (!symbol) return false;

  const now = Date.now();
  for (const p of positions) {
    if (Number(p.magic) !== ROBOT_MAGIC) continue;
    if (p.symbol !== symbol) continue;
    const openMs = parseOpenTime(p.open_time);
    if (!Number.isFinite(openMs)) continue;
    if ((now - openMs) < cooldownMs) return true;
  }
  return false;
}

/**
 * Retourne le Set des symbols en cooldown (positions robot ouvertes recentes).
 * Pratique pour pre-filtrer une liste de rows en O(N+P).
 */
export function buildCooldownSet(positions, cooldownMs) {
  const set = new Set();
  if (!Array.isArray(positions) || !positions.length) return set;
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) return set;

  const now = Date.now();
  for (const p of positions) {
    if (Number(p.magic) !== ROBOT_MAGIC) continue;
    if (!p.symbol) continue;
    const openMs = parseOpenTime(p.open_time);
    if (!Number.isFinite(openMs)) continue;
    if ((now - openMs) < cooldownMs) set.add(p.symbol);
  }
  return set;
}

// ── HELPER ─────────────────────────────────────────────────────────────────
// MT5 format: "2026.04.29 14:30" -> ISO UTC ms
function parseOpenTime(open_time) {
  if (!open_time) return NaN;
  const iso = String(open_time).replace(/\./g, "-");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}
