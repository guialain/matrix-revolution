// ============================================================================
// H1Alignment.js — matrice H1 (étape 1 : zones alignées uniquement)
// Retourne :
//   - { side, mode, zone_s1, zone_s0 } pour aligned_up / aligned_down
//   - { skip: true, zone_s1, zone_s0 } pour aligned_flat (skip couche H1)
//   - { deferred: true, zone_s1, zone_s0 } pour zones non-alignées (étape 2)
//   - null si slope invalide ou zone 'unknown'
// Combinaison avec le mode D1 via combineMode() → prend le PLUS STRICT.
// ============================================================================

import { getSlopeClass } from "../config/SlopeConfig.js";

const UP_ZONES   = new Set(['up_weak', 'up_strong', 'up_extreme']);
const DOWN_ZONES = new Set(['down_weak', 'down_strong', 'down_extreme']);

function isAlignedUp(z1, z0)   { return UP_ZONES.has(z1)   && UP_ZONES.has(z0); }
function isAlignedDown(z1, z0) { return DOWN_ZONES.has(z1) && DOWN_ZONES.has(z0); }
function isAlignedFlat(z1, z0) { return z1 === 'flat' && z0 === 'flat'; }

// ─── Matrices alignées (mode 'relaxed' aligné sur contrat buildGates) ─────

const ALIGNED_UP_MATRIX = {
  'up_weak': {
    'up_weak':    { side: 'BUY', mode: 'normal'  },
    'up_strong':  { side: 'BUY', mode: 'relaxed' },
    'up_extreme': { side: 'BUY', mode: 'relaxed' },
  },
  'up_strong': {
    'up_weak':    { side: 'BUY', mode: 'soft'    },
    'up_strong':  { side: 'BUY', mode: 'normal'  },
    'up_extreme': { side: 'BUY', mode: 'relaxed' },
  },
  'up_extreme': {
    'up_weak':    { side: 'BUY', mode: 'strict'  },
    'up_strong':  { side: 'BUY', mode: 'soft'    },
    'up_extreme': { side: 'BUY', mode: 'normal'  },
  },
};

const ALIGNED_DOWN_MATRIX = {
  'down_extreme': {
    'down_extreme': { side: 'SELL', mode: 'normal'  },
    'down_strong':  { side: 'SELL', mode: 'soft'    },
    'down_weak':    { side: 'SELL', mode: 'strict'  },
  },
  'down_strong': {
    'down_extreme': { side: 'SELL', mode: 'relaxed' },
    'down_strong':  { side: 'SELL', mode: 'normal'  },
    'down_weak':    { side: 'SELL', mode: 'soft'    },
  },
  'down_weak': {
    'down_extreme': { side: 'SELL', mode: 'relaxed' },
    'down_strong':  { side: 'SELL', mode: 'relaxed' },
    'down_weak':    { side: 'SELL', mode: 'normal'  },
  },
};

// ─── Cellules EXTRÊMES (étape 2a — 14 cellules) ──────────────────────────
// Anti-FOMO : retournements violents (8 cellules, block both sides)
// Sortie d'extrême : décélération du mouvement violent (6 cellules)
// Si key présente mais cell[side] === null → block explicite pour ce side.
// ─────────────────────────────────────────────────────────────────────────

const EXTREME_CELLS = {
  // Anti-FOMO : passages violents en zone extrême (block BUY et SELL)
  'flat|up_extreme':         { BUY: null, SELL: null },
  'down_weak|up_extreme':    { BUY: null, SELL: null },
  'down_strong|up_extreme':  { BUY: null, SELL: null },
  'down_extreme|up_extreme': { BUY: null, SELL: null },
  'flat|down_extreme':       { BUY: null, SELL: null },
  'up_weak|down_extreme':    { BUY: null, SELL: null },
  'up_strong|down_extreme':  { BUY: null, SELL: null },
  'up_extreme|down_extreme': { BUY: null, SELL: null },

  // Sortie d'extrême — décélération du mouvement violent
  'down_extreme|flat':       { BUY: { side: 'BUY',  mode: 'strict' }, SELL: null },
  'down_extreme|up_weak':    { BUY: { side: 'BUY',  mode: 'strict' }, SELL: null },
  'down_extreme|up_strong':  { BUY: { side: 'BUY',  mode: 'normal' }, SELL: null },
  'up_extreme|flat':         { BUY: null, SELL: { side: 'SELL', mode: 'strict' } },
  'up_extreme|down_weak':    { BUY: null, SELL: { side: 'SELL', mode: 'strict' } },
  'up_extreme|down_strong':  { BUY: null, SELL: { side: 'SELL', mode: 'normal' } },
};

// ─── Résolveur H1 ────────────────────────────────────────────────────────

export function resolveH1Alignment(slope_h1, slope_h1_s0, side, symbol) {
  if (!Number.isFinite(slope_h1) || !Number.isFinite(slope_h1_s0)) return null;

  const zone_s1 = getSlopeClass(slope_h1, symbol);
  const zone_s0 = getSlopeClass(slope_h1_s0, symbol);

  if (zone_s1 === 'unknown' || zone_s0 === 'unknown') return null;

  if (isAlignedUp(zone_s1, zone_s0)) {
    const hit = ALIGNED_UP_MATRIX[zone_s1]?.[zone_s0];
    return hit ? { ...hit, zone_s1, zone_s0 } : null;
  }
  if (isAlignedDown(zone_s1, zone_s0)) {
    const hit = ALIGNED_DOWN_MATRIX[zone_s1]?.[zone_s0];
    return hit ? { ...hit, zone_s1, zone_s0 } : null;
  }
  if (isAlignedFlat(zone_s1, zone_s0)) {
    return { skip: true, zone_s1, zone_s0 };
  }

  // Cellules extrêmes (étape 2a) — dispatcher par side
  const extremeKey = `${zone_s1}|${zone_s0}`;
  if (extremeKey in EXTREME_CELLS) {
    const hit = EXTREME_CELLS[extremeKey][side];
    if (hit) return { ...hit, zone_s1, zone_s0, extreme: true };
    return { block: true, zone_s1, zone_s0, extreme: true };
  }

  // Zones non-alignées restantes (transitions modérées, inversions modérées) — étape 2b future
  return { deferred: true, zone_s1, zone_s0 };
}

// ─── Combinaison des modes : plus strict gagne ───────────────────────────

const MODE_RANK = { 'relaxed': 0, 'normal': 1, 'soft': 2, 'strict': 3 };

export function combineMode(modeD1, modeH1) {
  if (!modeD1) return modeH1;
  if (!modeH1) return modeD1;
  const rD1 = MODE_RANK[modeD1] ?? 0;
  const rH1 = MODE_RANK[modeH1] ?? 0;
  return rH1 > rD1 ? modeH1 : modeD1;
}
