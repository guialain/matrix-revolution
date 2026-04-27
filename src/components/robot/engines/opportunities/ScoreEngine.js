// ============================================================================
// ScoreEngine.js — V8R scoring (refonte additive)
//
// Architecture :
//   - 9 composantes additives independantes
//   - Range natif : -6 a +33
//   - Mapping final : ((brut + 6) / 39) * 100, arrondi → [0, 100]
//   - Conditionnel par type (CONT/EXH) × side (BUY/SELL)
//   - Zones impossibles → score 0 + console.warn
//
// Composantes :
//   c1  RSI H1            (1..3)
//   c2  Zscore H1         (1..5)
//   c3a Slope H1 (s1)     (-1..3)
//   c3b Slope H1 (s0)     (-1..3)
//   c4  DSlope H1         (-1..3)
//   c5  Volatility        (-3..4)
//   c6  Intraday class    (-4..4)
//   c7  Alignment D1      (1..4)
//   c8  Mode V8R          (1..4)
// ============================================================================

import { getSlopeClass }      from '../config/SlopeConfig.js';
import { getVolatilityRegime } from '../config/VolatilityConfig.js';

// =====================================================================
// HELPERS
// =====================================================================
function normalizeScore(brut) {
  // Range natif: -6 a +33 → ((brut + 6) / 39) * 100
  const x = ((brut + 6) / 39) * 100;
  return Math.max(0, Math.min(100, Math.round(x)));
}

// =====================================================================
// COMPOSANTE 1 — RSI H1
// =====================================================================
function scoreRSI(rsi, type, side) {
  if (!Number.isFinite(rsi)) return 0;

  if (type === 'CONTINUATION' && side === 'BUY') {
    if (rsi >= 50 && rsi < 55) return 1;
    if (rsi >= 55 && rsi < 65) return 3;
    if (rsi >= 65 && rsi < 72) return 2;
    console.warn('[ScoreEngine] RSI hors plage CONT BUY:', rsi);
    return 0;
  }
  if (type === 'EXHAUSTION' && side === 'BUY') {
    if (rsi < 28)               return 3;
    if (rsi >= 28 && rsi < 40)  return 2;
    if (rsi >= 40 && rsi < 50)  return 1;
    console.warn('[ScoreEngine] RSI hors plage EXH BUY:', rsi);
    return 0;
  }
  if (type === 'CONTINUATION' && side === 'SELL') {
    if (rsi >= 45 && rsi < 50)  return 1;
    if (rsi >= 35 && rsi < 45)  return 3;
    if (rsi >= 28 && rsi < 35)  return 2;
    console.warn('[ScoreEngine] RSI hors plage CONT SELL:', rsi);
    return 0;
  }
  if (type === 'EXHAUSTION' && side === 'SELL') {
    if (rsi > 72)               return 3;
    if (rsi >= 60 && rsi <= 72) return 2;
    if (rsi >= 50 && rsi < 60)  return 1;
    console.warn('[ScoreEngine] RSI hors plage EXH SELL:', rsi);
    return 0;
  }
  return 0;
}

// =====================================================================
// COMPOSANTE 2 — Zscore H1 (sur |zscore|)
// =====================================================================
function scoreZscore(zscore, type) {
  if (!Number.isFinite(zscore)) return 0;
  const abs = Math.abs(zscore);

  if (type === 'CONTINUATION') {
    if (abs >= 0.5 && abs < 1.0) return 4;
    if (abs >= 1.0 && abs < 1.5) return 3;
    if (abs >= 1.5 && abs < 2.0) return 2;
    if (abs >= 2.0 && abs < 2.5) return 1;
    // >= 2.5 ne survient pas en CONT par construction matchRoute
    return 0;
  }
  if (type === 'EXHAUSTION') {
    if (abs >= 0.5 && abs < 1.0) return 4;
    if (abs >= 1.0 && abs < 1.5) return 3;
    if (abs >= 1.5 && abs < 2.0) return 2;
    if (abs >= 2.0 && abs < 2.5) return 1;
    if (abs >= 2.5)              return 5;
    return 0;
  }
  return 0;
}

// =====================================================================
// COMPOSANTE 3 — Slope H1 (zone-based, table type × side)
// Utilise par c3a (slope_h1), c3b (slope_h1_s0), c4 (dslope_h1)
// =====================================================================
const SLOPE_TABLE = {
  CONTINUATION_BUY: {
    down_weak: -1, flat: 0, up_weak: 1, up_strong: 2, up_extreme: 1,
  },
  EXHAUSTION_BUY: {
    down_extreme: -1, down_strong: 0, down_weak: 1, flat: 2, up_weak: 3,
  },
  CONTINUATION_SELL: {
    up_weak: -1, flat: 0, down_weak: 1, down_strong: 2, down_extreme: 1,
  },
  EXHAUSTION_SELL: {
    up_extreme: -1, up_strong: 0, up_weak: 1, flat: 2, down_weak: 3,
  },
};

function scoreSlopeZone(slope, symbol, type, side) {
  if (!Number.isFinite(slope)) return 0;
  const zone = getSlopeClass(slope, symbol);
  const key = `${type}_${side}`;
  const table = SLOPE_TABLE[key];
  if (!table) {
    console.warn('[ScoreEngine] scoreSlope key inconnu:', key);
    return 0;
  }
  if (!(zone in table)) {
    console.warn(`[ScoreEngine] scoreSlope zone hors table ${key}: ${zone}`);
    return 0;
  }
  return table[zone];
}

// =====================================================================
// COMPOSANTE 5 — Volatility regime
// =====================================================================
function scoreVolatilityRegime(symbol, atr_m15, close) {
  const regime = getVolatilityRegime(symbol, atr_m15, close);
  if (regime === 'low')   return -3;
  if (regime === 'med')   return 3;
  if (regime === 'high')  return 4;
  if (regime === 'explo') return -3;
  return 0;
}

// =====================================================================
// COMPOSANTE 6 — Intraday class
// =====================================================================
const INTRADAY_TABLE = {
  CONTINUATION_BUY: {
    SPIKE_UP: -4, EXPLOSIVE_UP: 3, STRONG_UP: 2, SOFT_UP: 1,
    NEUTRE: 0,
    SOFT_DOWN: -1, STRONG_DOWN: -2, EXPLOSIVE_DOWN: -3, SPIKE_DOWN: -4,
  },
  CONTINUATION_SELL: {
    SPIKE_DOWN: -4, EXPLOSIVE_DOWN: 3, STRONG_DOWN: 2, SOFT_DOWN: 1,
    NEUTRE: 0,
    SOFT_UP: -1, STRONG_UP: -2, EXPLOSIVE_UP: -3, SPIKE_UP: -4,
  },
  EXHAUSTION_BUY: {
    SPIKE_UP: -4, EXPLOSIVE_UP: 2, STRONG_UP: 3, SOFT_UP: 1,
    NEUTRE: 0,
    SOFT_DOWN: 1, STRONG_DOWN: -3, EXPLOSIVE_DOWN: 2, SPIKE_DOWN: -4,
  },
  EXHAUSTION_SELL: {
    SPIKE_DOWN: -4, EXPLOSIVE_DOWN: 2, STRONG_DOWN: 3, SOFT_DOWN: 1,
    NEUTRE: 0,
    SOFT_UP: 1, STRONG_UP: -3, EXPLOSIVE_UP: 2, SPIKE_UP: -4,
  },
};

function scoreIntraday(intraday_class, type, side) {
  if (!intraday_class) return 0;
  const key = `${type}_${side}`;
  const table = INTRADAY_TABLE[key];
  if (!table) {
    console.warn('[ScoreEngine] scoreIntraday key inconnu:', key);
    return 0;
  }
  if (!(intraday_class in table)) {
    console.warn(`[ScoreEngine] scoreIntraday classe inconnue ${key}: ${intraday_class}`);
    return 0;
  }
  return table[intraday_class];
}

// =====================================================================
// COMPOSANTE 7 — Alignment D1
// =====================================================================
const ALIGNMENT_TABLE = {
  BUY:  { aligned_up: 4,   transition_up: 3,   inversion_up: 2,   fade_up: 1 },
  SELL: { aligned_down: 4, transition_down: 3, inversion_down: 2, fade_down: 1 },
};

function scoreAlignment(alignmentD1, side) {
  if (!alignmentD1) return 0;
  const table = ALIGNMENT_TABLE[side];
  if (!table) {
    console.warn('[ScoreEngine] scoreAlignment side inconnu:', side);
    return 0;
  }
  if (!(alignmentD1 in table)) {
    console.warn(`[ScoreEngine] scoreAlignment alignment incompatible ${side}: ${alignmentD1}`);
    return 0;
  }
  return table[alignmentD1];
}

// =====================================================================
// COMPOSANTE 8 — Mode V8R
// =====================================================================
const MODE_TABLE = { strict: 1, normal: 2, soft: 3, relaxed: 4 };

function scoreMode(mode) {
  if (!mode) return 0;
  if (!(mode in MODE_TABLE)) {
    console.warn('[ScoreEngine] scoreMode mode inconnu:', mode);
    return 0;
  }
  return MODE_TABLE[mode];
}

// =====================================================================
// FONCTION PUBLIQUE
// =====================================================================
export function scoreOpportunity(row) {
  const {
    type, side, symbol,
    rsi_h1, zscore_h1_s0,
    slope_h1, slope_h1_s0,
    dslope_h1,
    intraday_class,
    atr_m15, close,
    alignmentD1, mode,
  } = row;

  const c1  = scoreRSI(rsi_h1, type, side);
  const c2  = scoreZscore(zscore_h1_s0, type);
  const c3a = scoreSlopeZone(slope_h1,    symbol, type, side);
  const c3b = scoreSlopeZone(slope_h1_s0, symbol, type, side);
  const c4  = scoreSlopeZone(dslope_h1,   symbol, type, side);
  const c5  = scoreVolatilityRegime(symbol, atr_m15, close);
  const c6  = scoreIntraday(intraday_class, type, side);
  const c7  = scoreAlignment(alignmentD1, side);
  const c8  = scoreMode(mode);

  const total_brut = c1 + c2 + c3a + c3b + c4 + c5 + c6 + c7 + c8;
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
      c8_mode:       c8,
    },
  };
}
