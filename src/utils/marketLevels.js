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
