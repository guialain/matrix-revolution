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

// ============================================================================
// Cooldown intra-WAIT (etage 3) — throttle 5s par symbol
//
// Empeche la republication d'un meme WAIT toutes les ~800ms (tick rate).
// Granularite : symbol seul (BUY+SELL+wait_reason confondus).
// VALID jamais affecte (different appel cote orchestrateur).
// Map singleton module-level : survit aux re-renders React, perdue au
// hard-reload navigateur (acceptable : reset propre).
// ============================================================================

const WAIT_COOLDOWN_MS = 5000;
const lastWaitEmission = new Map(); // symbol -> timestamp ms

/**
 * Filtre une liste d'opportunites WAIT en supprimant celles dont le symbol
 * a deja emis un WAIT il y a moins de WAIT_COOLDOWN_MS.
 * Les opportunites passantes ont leur timestamp mis a jour.
 *
 * @param {Array} waitOpps
 * @returns {Array} waitOpps filtrees (meme objets, pas de copie)
 */
export function filterWaitCooldown(waitOpps) {
  if (!Array.isArray(waitOpps) || !waitOpps.length) return [];
  const now = Date.now();
  const out = [];
  for (const opp of waitOpps) {
    const sym = opp?.symbol;
    if (!sym) continue;
    const last = lastWaitEmission.get(sym);
    if (Number.isFinite(last) && (now - last) < WAIT_COOLDOWN_MS) continue;
    lastWaitEmission.set(sym, now);
    out.push(opp);
  }
  return out;
}

/**
 * Reset (utile pour tests ou flush manuel).
 */
export function resetWaitCooldown() {
  lastWaitEmission.clear();
}

// ── HELPER ─────────────────────────────────────────────────────────────────
// MT5 format: "2026.04.29 14:30" -> ISO UTC ms
function parseOpenTime(open_time) {
  if (!open_time) return NaN;
  const iso = String(open_time).replace(/\./g, "-");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}
