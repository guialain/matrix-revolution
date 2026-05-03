// ============================================================================
// ScoreEngine.js — V10R scoring (refonte additive)
//
// Architecture :
//   - 7 composantes additives independantes (c8 mode V8R retire)
//   - Range natif : -20..33 (CONT), -10..33 (EXH)
//   - Mapping final : ((brut + offset) / range_total) * 100, arrondi -> [0, 100]
//   - Tables differenciees par type (CONT/EXH) x side (BUY/SELL)
//
// Composantes :
//   c1  RSI H1            (0..3)         : zone-based, par type/side, par zone EXH
//   c2  Bollinger         (-5..8 / -1..8): zone zscore + classification dsigma
//   c3a Slope H1 (s1)     (-4..4)        : zone-based via getSlopeClass, x2 vs V8R
//   c3b Slope H1 (s0)     (-4..4)        : meme table que c3a, x2 vs V8R
//   c4  DSlope H1         (-1..2)        : zone-based via getSlopeClass
//   c5  Volatility regime (-3..4)        : low/med/high/explo
//   c6  Intraday class    (-4..4 / -2..4): par type/side, x2 vs V8R
//   c7  Alignment D1      (1..4)         : reason Gate D1 (CONT) / simulation (EXH)
//
// Note : c2 fusionne ancien c2 Zscore et nouvelle composante dsigma (memes seuils
// que Gate IC).
// ============================================================================

import { getSlopeClass }       from '../config/SlopeConfig.js';
import { getVolatilityRegime } from '../config/VolatilityConfig.js';

// =====================================================================
// HELPERS
// =====================================================================
function num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Normalisation finale : range total est de 53 (de min -20 a max 33)
// pour CONT et de 43 (de min -10 a max 33) pour EXH.
// Pour simplicite et stabilite, on utilise une seule formule basee sur le
// range CONT (le plus large), ce qui signifie que les EXH n'atteindront
// pas le 0 absolu mais resteront dans [~24, 100].
function normalizeScore(brut) {
  const x = ((brut + 20) / 53) * 100;
  return Math.max(0, Math.min(100, Math.round(x)));
}

// Memes seuils que Gate IC dans TopOpportunities_V10R.js
const DSIGMA_THRESHOLDS = {
  COMPRESSION_FORTE: -15,
  CONTRACTION:        -5,
  STABLE_HIGH:         5,
  EXPANSION:          15,
};

function classifyDsigma(dsigmaRatioPct) {
  if (dsigmaRatioPct === null || !Number.isFinite(dsigmaRatioPct)) return null;
  if (dsigmaRatioPct <= DSIGMA_THRESHOLDS.COMPRESSION_FORTE) return 'compression_forte';
  if (dsigmaRatioPct <= DSIGMA_THRESHOLDS.CONTRACTION)       return 'contraction';
  if (dsigmaRatioPct <  DSIGMA_THRESHOLDS.STABLE_HIGH)       return 'stable';
  if (dsigmaRatioPct <  DSIGMA_THRESHOLDS.EXPANSION)         return 'expansion';
  return 'explosion';
}

function getZoneFromZscore(zscore) {
  if (zscore === null || !Number.isFinite(zscore)) return 'UNKNOWN';
  const v = zscore;
  if (v >  2.9) return 'EXTREME_HAUTE';
  if (v >  1.5) return 'HAUTE';
  if (v >  0.5) return 'NORMALE_HAUTE';
  if (v >= -0.5) return 'GRISE';
  if (v >  -1.5) return 'NORMALE_BASSE';
  if (v >= -2.9) return 'BASSE';
  return 'EXTREME_BASSE';
}

// =====================================================================
// COMPOSANTE 1 — RSI H1
// =====================================================================
function scoreRSI(rsi, type, side, zone) {
  if (!Number.isFinite(rsi)) return 0;

  // CONT (inchange V8R)
  if (type === 'CONTINUATION' && side === 'BUY') {
    if (rsi >= 50 && rsi < 55) return 1;
    if (rsi >= 55 && rsi < 65) return 3;
    if (rsi >= 65 && rsi < 72) return 2;
    return 0;
  }
  if (type === 'CONTINUATION' && side === 'SELL') {
    if (rsi >= 45 && rsi < 50) return 1;
    if (rsi >= 35 && rsi < 45) return 3;
    if (rsi >= 28 && rsi < 35) return 2;
    return 0;
  }

  // EXH (par zone)
  const isExtreme = (zone === 'EXTREME_BASSE' || zone === 'EXTREME_HAUTE');

  if (type === 'EXHAUSTION' && side === 'BUY') {
    if (isExtreme) {
      if (rsi < 22)              return 3;
      if (rsi >= 22 && rsi < 27) return 2;
      if (rsi >= 27 && rsi < 32) return 1;
    } else {
      if (rsi < 25)              return 3;
      if (rsi >= 25 && rsi < 30) return 2;
      if (rsi >= 30 && rsi < 35) return 1;
    }
    return 0;
  }
  if (type === 'EXHAUSTION' && side === 'SELL') {
    if (isExtreme) {
      if (rsi > 78)              return 3;
      if (rsi > 73 && rsi <= 78) return 2;
      if (rsi > 68 && rsi <= 73) return 1;
    } else {
      if (rsi > 75)              return 3;
      if (rsi > 70 && rsi <= 75) return 2;
      if (rsi > 65 && rsi <= 70) return 1;
    }
    return 0;
  }

  return 0;
}

// =====================================================================
// COMPOSANTE 2 — Bollinger (zone + dsigma)
// =====================================================================
function scoreZoneCONT(zscore, side) {
  if (!Number.isFinite(zscore)) return 0;
  const z = zscore;

  if (side === 'BUY') {
    if (z >= -1.5 && z < -0.5) return -1;
    if (z >=  0.5 && z <  1.0) return 1;
    if (z >=  1.0 && z <  1.5) return 2;
    if (z >=  1.5 && z <  2.0) return 4;
    if (z >=  2.0 && z <  2.5) return 3;
    if (z >=  2.5 && z <  2.9) return 2;
    return 0;
  }
  if (side === 'SELL') {
    // miroir
    if (z > 0.5 && z <= 1.5)  return -1;
    if (z > -1.0 && z <= -0.5) return 1;
    if (z > -1.5 && z <= -1.0) return 2;
    if (z > -2.0 && z <= -1.5) return 4;
    if (z > -2.5 && z <= -2.0) return 3;
    if (z > -2.9 && z <= -2.5) return 2;
    return 0;
  }
  return 0;
}

function scoreZoneEXH(zscore, side) {
  if (!Number.isFinite(zscore)) return 0;
  const z = zscore;

  if (side === 'SELL') {
    if (z >= 1.5 && z < 2.0) return 1;
    if (z >= 2.0 && z < 2.5) return 2;
    if (z >= 2.5 && z < 2.9) return 3;
    if (z >= 2.9)            return 4;
    return 0;
  }
  if (side === 'BUY') {
    // miroir
    if (z > -2.0 && z <= -1.5) return 1;
    if (z > -2.5 && z <= -2.0) return 2;
    if (z > -2.9 && z <= -2.5) return 3;
    if (z <= -2.9)             return 4;
    return 0;
  }
  return 0;
}

const DSIGMA_TABLE_CONT = {
  compression_forte: -4, contraction: -2, stable: 2, expansion: 4, explosion: -2,
};
const DSIGMA_TABLE_EXH = {
  compression_forte:  4, contraction:  2, stable:-2, expansion:-2, explosion:  4,
};

function scoreBollinger(zscore, dsigmaRatioPct, type, side) {
  let scoreZone = 0;
  if (type === 'CONTINUATION') scoreZone = scoreZoneCONT(zscore, side);
  else if (type === 'EXHAUSTION') scoreZone = scoreZoneEXH(zscore, side);

  const dsigmaLevel = classifyDsigma(dsigmaRatioPct);
  let scoreDsigma = 0;
  if (dsigmaLevel) {
    if (type === 'CONTINUATION') scoreDsigma = DSIGMA_TABLE_CONT[dsigmaLevel] ?? 0;
    else if (type === 'EXHAUSTION') scoreDsigma = DSIGMA_TABLE_EXH[dsigmaLevel] ?? 0;
  }

  return scoreZone + scoreDsigma;
}

// =====================================================================
// COMPOSANTE 3 — Slope H1 (zone-based, table x2 vs V8R)
// Utilisee par c3a (slope_h1), c3b (slope_h1_s0)
// =====================================================================
const SLOPE_TABLE = {
  CONTINUATION_BUY: {
    down_extreme: 0,  down_strong: 0,  down_weak: -2,
    flat: 0,
    up_weak: 4,  up_strong: 2,  up_extreme: -4,
  },
  CONTINUATION_SELL: {
    down_extreme: -4, down_strong: 2,  down_weak: 4,
    flat: 0,
    up_weak: -2, up_strong: 0,  up_extreme: 0,
  },
  EXHAUSTION_BUY: {
    down_extreme: 4,  down_strong: 2,  down_weak: -2,
    flat: 0,
    up_weak: 2,  up_strong: 0,  up_extreme: 0,
  },
  EXHAUSTION_SELL: {
    down_extreme: 0,  down_strong: 0,  down_weak: 2,
    flat: 0,
    up_weak: -2, up_strong: 2,  up_extreme: 4,
  },
};

function scoreSlopeZone(slope, symbol, type, side) {
  if (!Number.isFinite(slope)) return 0;
  const zone = getSlopeClass(slope, symbol);
  const key = `${type}_${side}`;
  const table = SLOPE_TABLE[key];
  if (!table) return 0;
  return table[zone] ?? 0;
}

// =====================================================================
// COMPOSANTE 4 — DSlope H1 (zone-based, table propre)
// =====================================================================
const DSLOPE_TABLE = {
  CONTINUATION_BUY: {
    down_extreme: 0,  down_strong: 0,  down_weak: -1,
    flat: 0,
    up_weak: 1,  up_strong: 2,  up_extreme: -1,
  },
  CONTINUATION_SELL: {
    down_extreme: -1, down_strong: 2,  down_weak: 1,
    flat: 0,
    up_weak: -1, up_strong: 0,  up_extreme: 0,
  },
  EXHAUSTION_BUY: {
    down_extreme: 0,  down_strong: 0,  down_weak: 0,
    flat: 0,
    up_weak: 1,  up_strong: 2,  up_extreme: -1,
  },
  EXHAUSTION_SELL: {
    down_extreme: -1, down_strong: 2,  down_weak: 1,
    flat: 0,
    up_weak: 0,  up_strong: 0,  up_extreme: 0,
  },
};

function scoreDslopeZone(dslope, symbol, type, side) {
  if (!Number.isFinite(dslope)) return 0;
  const zone = getSlopeClass(dslope, symbol);
  const key = `${type}_${side}`;
  const table = DSLOPE_TABLE[key];
  if (!table) return 0;
  return table[zone] ?? 0;
}

// =====================================================================
// COMPOSANTE 5 — Volatility regime (inchange V8R)
// =====================================================================
function scoreVolatilityRegime(symbol, atr_m15, close) {
  const regime = getVolatilityRegime(symbol, atr_m15, close);
  if (regime === 'low')   return -3;
  if (regime === 'med')   return  3;
  if (regime === 'high')  return  4;
  if (regime === 'explo') return -3;
  return 0;
}

// =====================================================================
// COMPOSANTE 6 — Intraday class (x2 vs V8R)
// =====================================================================
const INTRADAY_TABLE = {
  CONTINUATION_BUY: {
    EXPLOSIVE_UP: -2, STRONG_UP: 4, SOFT_UP: 2, NEUTRE: 0,
    SOFT_DOWN: -2, STRONG_DOWN: -4, EXPLOSIVE_DOWN: 2,
    SPIKE_UP: -4, SPIKE_DOWN: -4,
  },
  CONTINUATION_SELL: {
    EXPLOSIVE_DOWN: -2, STRONG_DOWN: 4, SOFT_DOWN: 2, NEUTRE: 0,
    SOFT_UP: -2, STRONG_UP: -4, EXPLOSIVE_UP: 2,
    SPIKE_UP: -4, SPIKE_DOWN: -4,
  },
  EXHAUSTION_BUY: {
    SOFT_UP: -2, NEUTRE: 0,
    SOFT_DOWN: 1, STRONG_DOWN: 2, EXPLOSIVE_DOWN: 4,
    STRONG_UP: 0, EXPLOSIVE_UP: 0,
    SPIKE_UP: -4, SPIKE_DOWN: -4,
  },
  EXHAUSTION_SELL: {
    SOFT_DOWN: -2, NEUTRE: 0,
    SOFT_UP: 1, STRONG_UP: 2, EXPLOSIVE_UP: 4,
    STRONG_DOWN: 0, EXPLOSIVE_DOWN: 0,
    SPIKE_UP: -4, SPIKE_DOWN: -4,
  },
};

function scoreIntraday(intraday_class, type, side) {
  if (!intraday_class) return 0;
  const key = `${type}_${side}`;
  const table = INTRADAY_TABLE[key];
  if (!table) return 0;
  return table[intraday_class] ?? 0;
}

// =====================================================================
// COMPOSANTE 7 — Alignment D1 (refondu sur reason Gate D1)
// =====================================================================
function scoreAlignment(reasonD1) {
  if (!reasonD1 || typeof reasonD1 !== 'string') return 1;  // defensif

  if (reasonD1.startsWith('aligned_'))  return 4;
  if (reasonD1.startsWith('early_'))    return 3;
  if (reasonD1.startsWith('opposed_'))  return 1;

  return 1;  // defensif
}

// =====================================================================
// FONCTION PUBLIQUE
// =====================================================================
export function scoreOpportunity(row) {
  const {
    type, side, symbol,
    rsi_h1, zscore_h1_s0, dsigma_ratio_h1_pct,
    slope_h1, slope_h1_s0,
    dslope_h1_s0,
    intraday_class,
    atr_m15, close_m5_s1,
    reasonD1,  // V10R : passe par evaluate (Gate D1 result), remplace alignmentD1
  } = row;

  const zone = getZoneFromZscore(zscore_h1_s0);

  const c1  = scoreRSI(rsi_h1, type, side, zone);
  const c2  = scoreBollinger(zscore_h1_s0, dsigma_ratio_h1_pct, type, side);
  const c3a = scoreSlopeZone(slope_h1,    symbol, type, side);
  const c3b = scoreSlopeZone(slope_h1_s0, symbol, type, side);
  const c4  = scoreDslopeZone(dslope_h1_s0, symbol, type, side);
  const c5  = scoreVolatilityRegime(symbol, atr_m15, close_m5_s1);
  const c6  = scoreIntraday(intraday_class, type, side);
  const c7  = scoreAlignment(reasonD1);

  const total_brut = c1 + c2 + c3a + c3b + c4 + c5 + c6 + c7;
  const total = normalizeScore(total_brut);

  return {
    total,
    total_brut,
    breakdown: {
      c1_rsi:        c1,
      c2_zscore:     c2,
      c3a_slope_s1:  c3a,
      c3b_slope_s0:  c3b,
      c4_dslope:     c4,
      c5_volatility: c5,
      c6_intraday:   c6,
      c7_alignment:  c7,
    },
  };
}
