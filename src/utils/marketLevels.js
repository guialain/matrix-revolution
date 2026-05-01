// ============================================================================
// marketLevels.js — Classification de régime multi-TF
//
// Fonctions utilitaires pour classer les mouvements de marché en niveaux
// qualitatifs (STRONG_UP, EXPLOSIVE_DOWN, etc.) à partir des slopes,
// intraday changes, et seuils asset-specific.
//
// SOURCE UNIQUE DE VÉRITÉ : ces fonctions sont utilisées par :
//   - Le moteur TopOpportunities_V8R (résolution des signaux)
//   - Le frontend MarketTrend.jsx (affichage multi-asset)
//
// Ne JAMAIS dupliquer cette logique ailleurs pour éviter les divergences
// entre moteur et affichage.
//
// ARCHITECTURE D1 (refonte 2026-04-30) :
//   getAlignmentD1(slope_d1, dslope_d1_live) → 1 des 49 étiquettes
//     - slope_d1     = pente stable (s1, bougie D1 fermée hier)
//     - dslope_d1_live = slope_d1_s0 - slope_d1 (variation live vs stable)
//   getAlignmentD1Mode(alignment, icLevel, side, dslope_d1_live, dslope_d1_stale)
//     → { mode, side } : mode V8R modulé par IC + side validé/recalculé
//     - side accepte 'BUY', 'SELL', 'AUTO' (AUTO laisse resolveNeutral trancher)
// ============================================================================

import { getSlopeClass } from "../components/robot/engines/config/SlopeConfig.js";
import { INTRADAY_CONFIG } from "../components/robot/engines/config/IntradayConfig.js";

// ============================================================================
// INTRADAY LEVEL — classification de intraday_change par asset
// ============================================================================
export function getIntradayLevel(intra, cfg) {
  if (intra === null || intra === undefined || !Number.isFinite(Number(intra)))
    return "NEUTRE";
  const val = Number(intra);
  if (val >  cfg.spikeUp)       return "SPIKE_UP";
  if (val >= cfg.explosiveUp)   return "EXPLOSIVE_UP";
  if (val >= cfg.strongUp)      return "STRONG_UP";
  if (val >= cfg.softUp)        return "SOFT_UP";
  if (val >  cfg.softDown)      return "NEUTRE";
  if (val >  cfg.strongDown)    return "SOFT_DOWN";
  if (val >  cfg.explosiveDown) return "STRONG_DOWN";
  if (val >  cfg.spikeDown)     return "EXPLOSIVE_DOWN";
  return "SPIKE_DOWN";
}

// Helper pratique qui résout directement par symbol
export function getIntradayLevelBySymbol(intra, symbol) {
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  return getIntradayLevel(intra, cfg);
}

// ============================================================================
// SLOPE LEVEL — classification de slope par asset (via SlopeConfig)
// ============================================================================
const SLOPE_CLASS_TO_LEVEL = {
  up_extreme:   "EXPLOSIVE_UP",
  up_strong:    "STRONG_UP",
  up_weak:      "SOFT_UP",
  flat:         "NEUTRE",
  down_weak:    "SOFT_DOWN",
  down_strong:  "STRONG_DOWN",
  down_extreme: "EXPLOSIVE_DOWN",
};

export function getSlopeLevel(slope, symbol) {
  if (slope === null || slope === undefined || !Number.isFinite(Number(slope)))
    return "NEUTRE";
  return SLOPE_CLASS_TO_LEVEL[getSlopeClass(Number(slope), symbol)] ?? "NEUTRE";
}

// ============================================================================
// RSI H1 ZONE — classification pour affichage (aligné avec matchBuyRoute/SellRoute)
// ============================================================================
export function getRsiZone(rsi) {
  if (rsi === null || rsi === undefined || !Number.isFinite(Number(rsi)))
    return "UNKNOWN";
  const v = Number(rsi);
  if (v < 28) return "EXTREME_LOW";
  if (v < 50) return "LOW_MID";
  if (v < 72) return "MID_HIGH";
  return "EXTREME_HIGH";
}

// ============================================================================
// ZSCORE H1 ZONE — classification par percentiles empiriques
// Seuils calibrés sur 5996 bougies H1 US_TECH100 sur 1 an :
//   P1=-3.04, P5=-2.18, P20=-1.15, P35=-0.42,
//   P65=0.83, P80=1.33, P95=2.13, P99=2.84
// ============================================================================
export function getZscoreZone(zscore) {
  if (zscore === null || zscore === undefined || !Number.isFinite(Number(zscore)))
    return "UNKNOWN";
  const v = Number(zscore);
  if (v < -3.04) return "EXTREME_LOW";
  if (v < -2.18) return "VERY_LOW";
  if (v < -1.15) return "LOW";
  if (v < -0.42) return "SLIGHTLY_LOW";
  if (v <  0.83) return "NEUTRAL";
  if (v <  1.33) return "SLIGHTLY_HIGH";
  if (v <  2.13) return "HIGH";
  if (v <  2.84) return "VERY_HIGH";
  return "EXTREME_HIGH";
}

// ============================================================================
// DSLOPE LEVEL — classification de l'accélération pour display
// Seuils calibrés sur distribution empirique US_TECH100
// (5996 bougies H1). Asset-agnostique mais TF-specific.
// À calibrer asset-specific dans une session future.
// ============================================================================
const DSLOPE_THRESHOLDS = {
  M5:  { explo: 5.5, acc: 2.0, soft: 0.8 },
  M15: { explo: 5.0, acc: 1.7, soft: 0.7 },
  H1:  { explo: 4.7, acc: 1.5, soft: 0.5 },
  H4:  { explo: 3.5, acc: 1.2, soft: 0.4 },
  D1:  { explo: 6.0, acc: 3.4, soft: 1.6 },  // recalibré post-period=3 (cross-asset P97/P90/P75)
};

export function getDslopeLevel(dslope, tf) {
  if (dslope === null || dslope === undefined ||
      !Number.isFinite(Number(dslope))) return "UNKNOWN";
  const thr = DSLOPE_THRESHOLDS[tf] ?? DSLOPE_THRESHOLDS.H1;
  const v = Number(dslope);
  if (v >  thr.explo) return "EXPLO_UP";
  if (v >  thr.acc)   return "ACC_UP";
  if (v >  thr.soft)  return "SFT_UP";
  if (v < -thr.explo) return "EXPLO_DOWN";
  if (v < -thr.acc)   return "ACC_DOWN";
  if (v < -thr.soft)  return "SFT_DOWN";
  return "FLAT";
}

export const DSLOPE_LEVEL_ABBR = {
  EXPLO_UP:   "EXPLO+",
  ACC_UP:     "ACC+",
  SFT_UP:     "SFT+",
  FLAT:       "FLAT",
  SFT_DOWN:   "SFT-",
  ACC_DOWN:   "ACC-",
  EXPLO_DOWN: "EXPLO-",
  UNKNOWN:    "—",
};

// ============================================================================
// D1 FRAMEWORK V3 — alignement par (slope_d1 stable + dslope_d1_live)
//
// Calibration cross-asset post slope_period=3 (10 assets, ~159k bougies H1) :
//   slope_d1  : P97 ≈ 5.0, P75 ≈ 1.9, P60 ≈ 0.5
//   dslope_d1 : P97 ≈ 6.0, P90 ≈ 3.4, P75 ≈ 1.6, P60 ≈ 0.5
// ============================================================================

export const SLOPE_D1_THRESHOLDS = {
  EXTREME: 5.0,
  STRONG:  1.9,
  WEAK:    0.3,
};

export const DSLOPE_D1_THRESHOLDS = {
  EXTREME: 6.0,
  STRONG:  3.4,
  MEDIUM:  1.6,
  WEAK:    0.5,
};

export const DSLOPE_D1_ANTI_SPIKE = 6.0;

// ============================================================================
// HELPERS — classification slope_d1 et dslope_d1
// ============================================================================

// Renvoie 'up' | 'down' | 'flat' | null
function getSlopeD1Direction(slope) {
  if (slope === null || slope === undefined || !Number.isFinite(Number(slope))) return null;
  const v = Number(slope);
  if (v >=  SLOPE_D1_THRESHOLDS.WEAK)  return 'up';
  if (v <= -SLOPE_D1_THRESHOLDS.WEAK)  return 'down';
  return 'flat';
}

// Renvoie 'extreme_up' | 'strong_up' | 'weak_up' | 'flat'
//       | 'weak_down' | 'strong_down' | 'extreme_down' | null
function getSlopeD1ZoneSuffix(slope) {
  if (slope === null || slope === undefined || !Number.isFinite(Number(slope))) return null;
  const v = Number(slope);
  if (v >=  SLOPE_D1_THRESHOLDS.EXTREME) return 'extreme_up';
  if (v >=  SLOPE_D1_THRESHOLDS.STRONG)  return 'strong_up';
  if (v >=  SLOPE_D1_THRESHOLDS.WEAK)    return 'weak_up';
  if (v >  -SLOPE_D1_THRESHOLDS.WEAK)    return 'flat';
  if (v >  -SLOPE_D1_THRESHOLDS.STRONG)  return 'weak_down';
  if (v >  -SLOPE_D1_THRESHOLDS.EXTREME) return 'strong_down';
  return 'extreme_down';
}

// Renvoie 'up' | 'down' | 'flat' | null (sens dslope)
function getDslopeD1Direction(dslope) {
  if (dslope === null || dslope === undefined || !Number.isFinite(Number(dslope))) return null;
  const v = Number(dslope);
  if (v >=  DSLOPE_D1_THRESHOLDS.WEAK) return 'up';
  if (v <= -DSLOPE_D1_THRESHOLDS.WEAK) return 'down';
  return 'flat';
}

// Renvoie 'strong' | 'soft' | 'weak' | 'flat' | null (intensité dslope sur magnitude)
function getDslopeD1Intensity(dslope) {
  if (dslope === null || dslope === undefined || !Number.isFinite(Number(dslope))) return null;
  const v = Math.abs(Number(dslope));
  if (v >= DSLOPE_D1_THRESHOLDS.STRONG)  return 'strong';
  if (v >= DSLOPE_D1_THRESHOLDS.MEDIUM)  return 'soft';
  if (v >= DSLOPE_D1_THRESHOLDS.WEAK)    return 'weak';
  return 'flat';
}

// ============================================================================
// getAlignmentD1 — renvoie 1 des 49 étiquettes du framework V3
//
// Convention de nommage : <intensité>_<contexte>_<sens>_from_<zone>
//   intensité : strong | soft | weak | flat (magnitude dslope)
//   contexte  : aligned | inversion | transition
//   sens      : up | down | flat
//   zone      : extreme_up | strong_up | weak_up | flat | weak_down | strong_down | extreme_down
//
// Exemples :
//   strong_inversion_down_from_extreme_up : zone UP extrême + dslope fortement négatif
//   soft_aligned_up_from_strong_up        : zone UP forte + dslope modérément positif
//   weak_transition_down_from_flat        : zone flat + dslope faiblement négatif
//   flat_aligned_up_from_extreme_up       : zone UP extrême + dslope nul (exhaustion)
//   flat_transition_flat_from_flat        : zone flat + dslope nul (vrai rien)
// ============================================================================
export function getAlignmentD1(slope_d1, dslope_d1_live) {
  const slopeDir       = getSlopeD1Direction(slope_d1);
  const zoneSuffix     = getSlopeD1ZoneSuffix(slope_d1);
  const dslopeDir      = getDslopeD1Direction(dslope_d1_live);
  const dslopeIntensity = getDslopeD1Intensity(dslope_d1_live);

  if (slopeDir === null || zoneSuffix === null
   || dslopeDir === null || dslopeIntensity === null) return null;

  // Cas slope flat
  if (slopeDir === 'flat') {
    if (dslopeIntensity === 'flat') return 'flat_transition_flat_from_flat';
    return `${dslopeIntensity}_transition_${dslopeDir}_from_flat`;
  }

  // Cas dslope flat (dérivée nulle)
  if (dslopeIntensity === 'flat') {
    return `flat_aligned_${slopeDir}_from_${zoneSuffix}`;
  }

  // Cas même sens : aligned
  if (slopeDir === dslopeDir) {
    return `${dslopeIntensity}_aligned_${slopeDir}_from_${zoneSuffix}`;
  }

  // Cas opposés : inversion (sens = celui de dslope, qui pousse vers le retournement)
  return `${dslopeIntensity}_inversion_${dslopeDir}_from_${zoneSuffix}`;
}

// ============================================================================
// Tables alignment → mode V8R de base. Modes : strict | normal | soft | relaxed
// Calibré manuellement (xlsx alignment_d1_v2)
//
// Scindées en deux selon le préfixe d'étiquette (intensité du dslope) :
//   - D1_ALIGNMENT_MODE_NEUTRAL     (7)  : préfixe `flat_` (dslope_d1 neutre)
//   - D1_ALIGNMENT_MODE_DIRECTIONAL (42) : préfixes `weak_` / `soft_` / `strong_`
//
// Consommateurs :
//   - resolveDirectional → D1_ALIGNMENT_MODE_DIRECTIONAL (lookup pure)
//   - resolveNeutral     → MODE_MATRIX_NEUTRAL (logique 6a basée sur dslope_stale)
//     D1_ALIGNMENT_MODE_NEUTRAL n'est plus lu en prod mais conservée comme
//     fallback documentaire / référence des modes "purs" hors logique 6a.
// ============================================================================

// ─── NEUTRAL (7 entrées : dslope_d1 neutre, |dslope| < WEAK) ─────────────────
// Préfixe `flat_` = aucune accélération D1 mesurable. Le slope reste tel quel.
// Note : cette table N'est PLUS lue par getAlignmentD1Mode (resolveNeutral
// utilise MODE_MATRIX_NEUTRAL + dslope_d1_stale). Conservée comme référence
// documentaire des modes "purs" pré-6a.
const D1_ALIGNMENT_MODE_NEUTRAL = {
  // BUY (slope up, dslope flat) — 3 zones
  'flat_aligned_up_from_extreme_up':     'strict',
  'flat_aligned_up_from_strong_up':      'soft',
  'flat_aligned_up_from_weak_up':        'normal',

  // SELL (slope down, dslope flat) — 3 zones
  'flat_aligned_down_from_extreme_down': 'strict',
  'flat_aligned_down_from_strong_down':  'soft',
  'flat_aligned_down_from_weak_down':    'normal',

  // SKIP (slope flat ET dslope flat = vrai rien)
  'flat_transition_flat_from_flat':      null,
};

// ─── DIRECTIONAL (42 entrées : dslope_d1 actif, |dslope| >= WEAK) ────────────
// Préfixes `weak_` / `soft_` / `strong_` = accélération D1 présente.
// Couvre les contextes aligned (slope+dslope même sens), transition (slope flat
// + dslope directionnel), inversion (slope+dslope sens opposés).
const D1_ALIGNMENT_MODE_DIRECTIONAL = {
  // ─── BUY CONT (aligned_up + transition_up = 9+3=12 entrées) ──────────────
  'weak_aligned_up_from_extreme_up':       'normal',
  'weak_aligned_up_from_strong_up':        'soft',
  'weak_aligned_up_from_weak_up':          'normal',
  'soft_aligned_up_from_extreme_up':       'soft',
  'soft_aligned_up_from_strong_up':        'soft',
  'soft_aligned_up_from_weak_up':          'soft',
  'strong_aligned_up_from_extreme_up':     'strict',
  'strong_aligned_up_from_strong_up':      'soft',
  'strong_aligned_up_from_weak_up':        'relaxed',

  'weak_transition_up_from_flat':          'strict',
  'soft_transition_up_from_flat':          'normal',
  'strong_transition_up_from_flat':        'relaxed',

  // ─── BUY EXH (inversion_up = 9 entrées) ───────────────────────────────────
  'weak_inversion_up_from_extreme_down':   'relaxed',
  'weak_inversion_up_from_strong_down':    'soft',
  'weak_inversion_up_from_weak_down':      'strict',
  'soft_inversion_up_from_extreme_down':   'normal',
  'soft_inversion_up_from_strong_down':    'normal',
  'soft_inversion_up_from_weak_down':      'normal',
  'strong_inversion_up_from_extreme_down': 'relaxed',
  'strong_inversion_up_from_strong_down':  'relaxed',
  'strong_inversion_up_from_weak_down':    'relaxed',

  // ─── SELL CONT (aligned_down + transition_down = 9+3=12 entrées) ─────────
  'weak_aligned_down_from_extreme_down':   'normal',
  'weak_aligned_down_from_strong_down':    'soft',
  'weak_aligned_down_from_weak_down':      'normal',
  'soft_aligned_down_from_extreme_down':   'soft',
  'soft_aligned_down_from_strong_down':    'soft',
  'soft_aligned_down_from_weak_down':      'soft',
  'strong_aligned_down_from_extreme_down': 'strict',
  'strong_aligned_down_from_strong_down':  'soft',
  'strong_aligned_down_from_weak_down':    'relaxed',

  'weak_transition_down_from_flat':        'strict',
  'soft_transition_down_from_flat':        'normal',
  'strong_transition_down_from_flat':      'relaxed',

  // ─── SELL EXH (inversion_down = 9 entrées) ────────────────────────────────
  'weak_inversion_down_from_extreme_up':   'relaxed',
  'weak_inversion_down_from_strong_up':    'soft',
  'weak_inversion_down_from_weak_up':      'strict',
  'soft_inversion_down_from_extreme_up':   'normal',
  'soft_inversion_down_from_strong_up':    'normal',
  'soft_inversion_down_from_weak_up':      'normal',
  'strong_inversion_down_from_extreme_up': 'relaxed',
  'strong_inversion_down_from_strong_up':  'relaxed',
  'strong_inversion_down_from_weak_up':    'relaxed',
};

// ─── MODE_MATRIX_NEUTRAL — matrice (zone_slope × force_stale) → mode base ───
// Utilisée par resolveNeutral (logique 6a). Remplace la lookup
// D1_ALIGNMENT_MODE_NEUTRAL pour les cas où dslope_d1_live est neutre :
// le mode dépend de la zone du slope ET de la force du dslope STALE (s1 vs s2).
const MODE_MATRIX_NEUTRAL = {
  extreme: { weak: 'strict', medium: 'strict', strong: 'normal'  },
  strong:  { weak: 'strict', medium: 'soft',   strong: 'soft'    },
  weak:    { weak: 'normal', medium: 'soft',   strong: 'relaxed' },
};

// ============================================================================
// IC modulation — applique +/- 1 cran selon force IC vs side
// ============================================================================
const MODE_LADDER = ['strict', 'normal', 'soft', 'relaxed'];

function shiftMode(mode, delta) {
  const idx = MODE_LADDER.indexOf(mode);
  if (idx === -1) return 'strict';
  const newIdx = Math.max(0, Math.min(MODE_LADDER.length - 1, idx + delta));
  return MODE_LADDER[newIdx];
}

const IC_BULLISH_STRONG = new Set(['STRONG_UP', 'EXPLOSIVE_UP']);
const IC_BEARISH_STRONG = new Set(['STRONG_DOWN', 'EXPLOSIVE_DOWN']);

function applyICModulation(modeBase, icLevel, side) {
  if (icLevel === 'NEUTRE') return shiftMode(modeBase, -1);

  if (side === 'BUY') {
    if (IC_BULLISH_STRONG.has(icLevel)) return shiftMode(modeBase, +1);
    if (icLevel === 'SOFT_UP')          return modeBase;
    if (icLevel === 'SOFT_DOWN')        return shiftMode(modeBase, -1);
  }

  if (side === 'SELL') {
    if (IC_BEARISH_STRONG.has(icLevel)) return shiftMode(modeBase, +1);
    if (icLevel === 'SOFT_DOWN')        return modeBase;
    if (icLevel === 'SOFT_UP')          return shiftMode(modeBase, -1);
  }

  // STRONG/EXPLOSIVE contre + SPIKE : safety net (selectRoute / detectSpike auraient dû filtrer)
  return shiftMode(modeBase, -1);
}

// ============================================================================
// getAlignmentD1Mode — dispatcher resolveNeutral / resolveDirectional + IC
//
// Inputs :
//   alignment        : étiquette V3 (49 valeurs possibles)
//   icLevel          : niveau intraday classifié
//   side             : 'BUY' | 'SELL' | 'AUTO' (AUTO laisse 6a trancher)
//   dslope_d1_live   : variation live (slope_d1_s0 - slope_d1)
//   dslope_d1_stale  : CSV column dslope_d1 (s1 vs s2 = bougie précédente)
//
// Output : { mode, side }
//   mode : 'strict' | 'normal' | 'soft' | 'relaxed' | null
//   side : 'BUY' | 'SELL' | null
//   { mode: null, side: null } = signal exclu (alignment inconnu, dégénéré,
//                                 cohérence side/sens KO, ou logique 6a échoue)
// ============================================================================

// 6a — resolveNeutral : pour étiquettes "flat_*" (dslope_d1_live neutre).
// Utilise dslope_d1_stale (s1 vs s2) pour détecter le sens et la force,
// dslope_d1_live (signe) pour confirmer que ça ne s'inverse pas.
function resolveNeutral(alignment, icLevel, side, dslope_d1_live, dslope_d1_stale) {
  // Étape 1 : cas dégénéré (slope flat ET dslope flat)
  if (alignment === 'flat_transition_flat_from_flat') return { mode: null, side: null };

  // Garde-fou : sans dslope_stale on ne peut pas classifier
  if (dslope_d1_stale === null || dslope_d1_stale === undefined
   || !Number.isFinite(Number(dslope_d1_stale))) return { mode: null, side: null };
  if (dslope_d1_live === null || dslope_d1_live === undefined
   || !Number.isFinite(Number(dslope_d1_live)))  return { mode: null, side: null };

  // Étape 2 : classification stale (sens + force) et live (signe)
  const stale = Number(dslope_d1_stale);
  const live  = Number(dslope_d1_live);

  const stale_class =
      stale >=  DSLOPE_D1_THRESHOLDS.WEAK ? 'up'
    : stale <= -DSLOPE_D1_THRESHOLDS.WEAK ? 'down'
    : 'neutral';

  const absStale = Math.abs(stale);
  const stale_force =
      absStale >= DSLOPE_D1_THRESHOLDS.STRONG ? 'strong'
    : absStale >= DSLOPE_D1_THRESHOLDS.MEDIUM ? 'medium'
    : absStale >= DSLOPE_D1_THRESHOLDS.WEAK   ? 'weak'
    : 'flat';

  const live_sign = live >= 0 ? 'pos' : 'neg';

  // Étape 3 : direction du slope depuis l'étiquette
  const slopeDir = alignment.includes('_up_') ? 'up' : 'down';

  // Étape 4 : matrice du sens trading
  let side_calc = null;
  if (slopeDir === 'up') {
    if      (stale_class === 'up'   && live_sign === 'pos') side_calc = 'BUY';
    else if (stale_class === 'down' && live_sign === 'neg') side_calc = 'SELL';
  } else {
    if      (stale_class === 'down' && live_sign === 'neg') side_calc = 'SELL';
    else if (stale_class === 'up'   && live_sign === 'pos') side_calc = 'BUY';
  }
  if (side_calc === null) return { mode: null, side: null };

  // Étape 5 : cohérence avec le side demandé
  if (side !== 'AUTO' && side !== side_calc) return { mode: null, side: null };
  const side_final = side_calc;

  // Étape 6 : mode base via matrice (zone_slope × stale_force)
  const zone_slope =
      alignment.includes('extreme') ? 'extreme'
    : alignment.includes('strong')  ? 'strong'
    : 'weak';
  const mode_base = MODE_MATRIX_NEUTRAL[zone_slope][stale_force];
  if (!mode_base) return { mode: null, side: null }; // safety

  // Étape 7 : modulation IC
  const mode_final = applyICModulation(mode_base, icLevel, side_final);
  return { mode: mode_final, side: side_final };
}

// 6b — resolveDirectional : pour étiquettes weak_/soft_/strong_ (dslope actif).
// Lookup classique dans D1_ALIGNMENT_MODE_DIRECTIONAL + modulation IC.
function resolveDirectional(alignment, icLevel, side) {
  const modeBase = D1_ALIGNMENT_MODE_DIRECTIONAL[alignment];
  if (modeBase === null || modeBase === undefined) return { mode: null, side: null };
  const mode_final = applyICModulation(modeBase, icLevel, side);
  return { mode: mode_final, side };
}

// 6c — dispatcher
export function getAlignmentD1Mode(alignment, icLevel, side, dslope_d1_live, dslope_d1_stale) {
  if (alignment === null || alignment === undefined) return { mode: null, side: null };
  if (alignment.startsWith('flat_')) {
    return resolveNeutral(alignment, icLevel, side, dslope_d1_live, dslope_d1_stale);
  }
  return resolveDirectional(alignment, icLevel, side);
}

// ============================================================================
// Sets selectRoute — autorisations BUY/SELL par alignement
// ============================================================================
export const D1_ALIGNMENTS_BUY = new Set([
  // aligned_up (12)
  'flat_aligned_up_from_extreme_up',   'flat_aligned_up_from_strong_up',   'flat_aligned_up_from_weak_up',
  'weak_aligned_up_from_extreme_up',   'weak_aligned_up_from_strong_up',   'weak_aligned_up_from_weak_up',
  'soft_aligned_up_from_extreme_up',   'soft_aligned_up_from_strong_up',   'soft_aligned_up_from_weak_up',
  'strong_aligned_up_from_extreme_up', 'strong_aligned_up_from_strong_up', 'strong_aligned_up_from_weak_up',
  // transition_up (3)
  'weak_transition_up_from_flat', 'soft_transition_up_from_flat', 'strong_transition_up_from_flat',
  // inversion_up (9)
  'weak_inversion_up_from_extreme_down',   'weak_inversion_up_from_strong_down',   'weak_inversion_up_from_weak_down',
  'soft_inversion_up_from_extreme_down',   'soft_inversion_up_from_strong_down',   'soft_inversion_up_from_weak_down',
  'strong_inversion_up_from_extreme_down', 'strong_inversion_up_from_strong_down', 'strong_inversion_up_from_weak_down',
]);

export const D1_ALIGNMENTS_SELL = new Set([
  // aligned_down (12)
  'flat_aligned_down_from_extreme_down',   'flat_aligned_down_from_strong_down',   'flat_aligned_down_from_weak_down',
  'weak_aligned_down_from_extreme_down',   'weak_aligned_down_from_strong_down',   'weak_aligned_down_from_weak_down',
  'soft_aligned_down_from_extreme_down',   'soft_aligned_down_from_strong_down',   'soft_aligned_down_from_weak_down',
  'strong_aligned_down_from_extreme_down', 'strong_aligned_down_from_strong_down', 'strong_aligned_down_from_weak_down',
  // transition_down (3)
  'weak_transition_down_from_flat', 'soft_transition_down_from_flat', 'strong_transition_down_from_flat',
  // inversion_down (9)
  'weak_inversion_down_from_extreme_up',   'weak_inversion_down_from_strong_up',   'weak_inversion_down_from_weak_up',
  'soft_inversion_down_from_extreme_up',   'soft_inversion_down_from_strong_up',   'soft_inversion_down_from_weak_up',
  'strong_inversion_down_from_extreme_up', 'strong_inversion_down_from_strong_up', 'strong_inversion_down_from_weak_up',
]);

// ============================================================================
// Type signal (CONT / EXH) déduit de l'alignement
// ============================================================================
export function getSignalTypeFromAlignment(alignment) {
  if (typeof alignment !== 'string') return null;
  if (alignment.includes('_inversion_'))  return 'EXHAUSTION';
  if (alignment.includes('_aligned_'))    return 'CONTINUATION';
  if (alignment.includes('_transition_')) return 'CONTINUATION';
  return null;
}

// ============================================================================
// LEGACY — getD1State conservé pour compat UI (MarketTrend + NeomatrixMTAnalysis)
// À migrer post-audit V3. Ne pas utiliser dans le V8R.
//
// Ancienne matrice slope_d1_s0 × dslope_d1_s0 :
//   slope \ dslope  ACCEL(≥0.5)    NEUTRE(-0.5,0.5)  DECEL(≤-0.5)
//   STRONG_UP       STRONG_UP       STRONG_UP          FADING_UP
//   SOFT_UP         FADING_UP       FADING_UP          FLAT
//   FLAT            EMERGING_UP     FLAT               EMERGING_DOWN
//   SOFT_DOWN       FLAT            FADING_DOWN        FADING_DOWN
//   STRONG_DOWN     FADING_DOWN     STRONG_DOWN        STRONG_DOWN
// ============================================================================
const D1_SLOPE_STRONG_LEGACY = 2.2;
const D1_SLOPE_SOFT_LEGACY   = 0.5;
const D1_DSLOPE_THR_LEGACY   = 0.5;

export function getD1State(slope_d1_s0, dslope_d1_s0) {
  if (slope_d1_s0 === null || slope_d1_s0 === undefined ||
      dslope_d1_s0 === null || dslope_d1_s0 === undefined) return "D1_FLAT";

  const slope  = Number(slope_d1_s0);
  const dslope = Number(dslope_d1_s0);
  if (!Number.isFinite(slope) || !Number.isFinite(dslope)) return "D1_FLAT";

  const accel = dslope >=  D1_DSLOPE_THR_LEGACY;
  const decel = dslope <= -D1_DSLOPE_THR_LEGACY;

  if (slope >= D1_SLOPE_STRONG_LEGACY) {
    if (decel) return "D1_FADING_UP";
    return "D1_STRONG_UP";
  }
  if (slope >= D1_SLOPE_SOFT_LEGACY) {
    if (decel) return "D1_FLAT";
    return "D1_FADING_UP";
  }
  if (slope > -D1_SLOPE_SOFT_LEGACY) {
    if (accel) return "D1_EMERGING_UP";
    if (decel) return "D1_EMERGING_DOWN";
    return "D1_FLAT";
  }
  if (slope > -D1_SLOPE_STRONG_LEGACY) {
    if (accel) return "D1_FLAT";
    return "D1_FADING_DOWN";
  }
  if (accel) return "D1_FADING_DOWN";
  return "D1_STRONG_DOWN";
}
