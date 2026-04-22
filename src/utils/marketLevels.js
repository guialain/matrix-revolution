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
// D1 STATE — matrice slope_d1_s0 × dslope_d1_s0
// Seuils calibrés sur 8 assets (~159k bougies H1) :
//   SLOPE_STRONG = 2.2 (≈ p80), SLOPE_SOFT = 0.5 (≈ p40), DSLOPE_THR = 0.5
//
//   slope \ dslope  ACCEL(≥0.5)    NEUTRE(-0.5,0.5)  DECEL(≤-0.5)
//   STRONG_UP       STRONG_UP       STRONG_UP          FADING_UP
//   SOFT_UP         FADING_UP       FADING_UP          FLAT
//   FLAT            EMERGING_UP     FLAT               EMERGING_DOWN
//   SOFT_DOWN       FLAT            FADING_DOWN        FADING_DOWN
//   STRONG_DOWN     FADING_DOWN     STRONG_DOWN        STRONG_DOWN
// ============================================================================
const D1_SLOPE_STRONG = 2.2;
const D1_SLOPE_SOFT   = 0.5;
const D1_DSLOPE_THR   = 0.5;

export function getD1State(slope_d1_s0, dslope_d1_s0) {
  if (slope_d1_s0 === null || slope_d1_s0 === undefined ||
      dslope_d1_s0 === null || dslope_d1_s0 === undefined) return "D1_FLAT";

  const slope  = Number(slope_d1_s0);
  const dslope = Number(dslope_d1_s0);
  if (!Number.isFinite(slope) || !Number.isFinite(dslope)) return "D1_FLAT";

  const accel = dslope >=  D1_DSLOPE_THR;
  const decel = dslope <= -D1_DSLOPE_THR;

  if (slope >= D1_SLOPE_STRONG) {
    if (decel) return "D1_FADING_UP";
    return "D1_STRONG_UP";
  }
  if (slope >= D1_SLOPE_SOFT) {
    if (decel) return "D1_FLAT";
    return "D1_FADING_UP";
  }
  if (slope > -D1_SLOPE_SOFT) {
    if (accel) return "D1_EMERGING_UP";
    if (decel) return "D1_EMERGING_DOWN";
    return "D1_FLAT";
  }
  if (slope > -D1_SLOPE_STRONG) {
    if (accel) return "D1_FLAT";
    return "D1_FADING_DOWN";
  }
  if (accel) return "D1_FADING_DOWN";
  return "D1_STRONG_DOWN";
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
  D1:  { explo: 2.5, acc: 1.0, soft: 0.3 },
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
// D1 FRAMEWORK V2 — classifiers symétriques + alignement s1×s0
// Remplace l'ancien getD1State dans le routing V8R (getD1State reste exporté
// pour les logs/debug et la compatibilité marketTrend).
// ============================================================================

export const SLOPE_D1_THRESHOLDS = {
  EXTREME: 5.00,
  STRONG:  2.20,
  WEAK:    0.82,
};

export const DSLOPE_D1_THRESHOLDS = {
  STRONG: 5.00,
  MEDIUM: 1.50,
  WEAK:   0.50,
};

export const DSLOPE_D1_ANTI_SPIKE = 5.00;

export function getSlopeD1Zone(slope) {
  if (slope === null || slope === undefined || !Number.isFinite(Number(slope))) return null;
  const v = Number(slope);
  if (v <= -5.00) return 'down_extreme';
  if (v <= -2.20) return 'down_strong';
  if (v <= -0.82) return 'down_weak';
  if (v <   0.82) return 'flat';
  if (v <   2.20) return 'up_weak';
  if (v <   5.00) return 'up_strong';
  return 'up_extreme';
}

export function getDslopeD1Zone(dslope) {
  if (dslope === null || dslope === undefined || !Number.isFinite(Number(dslope))) return null;
  const v = Number(dslope);
  if (v <= -5.00) return 'dslope_strong_deceleration';
  if (v <= -1.50) return 'dslope_medium_deceleration';
  if (v <= -0.50) return 'dslope_weak_deceleration';
  if (v <   0.50) return 'dslope_neutral';
  if (v <   1.50) return 'dslope_weak_acceleration';
  if (v <   5.00) return 'dslope_medium_acceleration';
  return 'dslope_strong_acceleration';
}

const UP_ZONES_D1   = new Set(['up_weak', 'up_strong', 'up_extreme']);
const DOWN_ZONES_D1 = new Set(['down_weak', 'down_strong', 'down_extreme']);

export function getAlignmentD1(zone_s1, zone_s0) {
  if (zone_s1 === null || zone_s0 === null) return null;
  const s1Up   = UP_ZONES_D1.has(zone_s1);
  const s1Down = DOWN_ZONES_D1.has(zone_s1);
  const s0Up   = UP_ZONES_D1.has(zone_s0);
  const s0Down = DOWN_ZONES_D1.has(zone_s0);
  const s1Flat = zone_s1 === 'flat';
  const s0Flat = zone_s0 === 'flat';

  if (s1Up   && s0Up)   return 'aligned_up';
  if (s1Down && s0Down) return 'aligned_down';
  if (s1Flat && s0Flat) return 'aligned_flat';
  if (s1Flat && s0Up)   return 'transition_up';
  if (s1Flat && s0Down) return 'transition_down';
  if (s1Up   && s0Flat) return 'fade_up';
  if (s1Down && s0Flat) return 'fade_down';
  if (s1Down && s0Up)   return 'inversion_up';
  if (s1Up   && s0Down) return 'inversion_down';
  return null;
}
