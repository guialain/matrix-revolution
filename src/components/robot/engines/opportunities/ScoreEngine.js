// ============================================================================
// ScoringEngine.js — NEO MATRIX Scoring
// Reversal BUY/SELL + Continuation BUY/SELL
// Composantes : RSI, BBZ, Slope, DSlope, Volatility, Intraday
// ============================================================================

import { getVolatilityRegime } from '../config/VolatilityConfig.js';
import { INTRADAY_CONFIG }     from '../config/IntradayConfig.js';
import { getSlopeConfig }      from '../config/SlopeConfig.js';

// ============================================================================
// HELPERS
// ============================================================================
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function getStrongMax(symbol) {
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  return cfg.strongMax;
}

function getSlopeNorm(symbol) {
  const cfg = getSlopeConfig(symbol);
  const slopeMax = cfg.up_strong?.max ?? 5.0;
  const slopeMin = Math.abs(cfg.down_strong?.min ?? -5.0);
  return (slopeMax + slopeMin) / 2;
}

// ============================================================================
// COMPOSANTE — VOLATILITY (−3 / +5 / +10)
// ============================================================================
function scoreVolatility(symbol, atr_m15, close) {
  const regime = getVolatilityRegime(symbol, atr_m15, close);
  if (regime === 'high')  return 7;
  if (regime === 'med')   return  3;
  if (regime === 'explo') return -3;
  return 0; // low
}

// ============================================================================
// COMPOSANTE — SLOPE H1 (±20) + DSLOPE H1 (±10)
// Normalisation : up_strong/down_strong de SlopeConfig par asset
// ============================================================================
function scoreSlope(symbol, slope_h1, dslope_h1) {
  const norm = getSlopeNorm(symbol);
  const slopeScore  = clamp(slope_h1  / norm, -1, 1) * 20;
  const dslopeScore = clamp(dslope_h1 / norm, -1, 1) * 10;
  return { slopeScore, dslopeScore };
}

// ============================================================================
// COMPOSANTE — INTRADAY REVERSAL (±20)
// Zone normale  (ratio 0.0 → 0.6) : pénalité forte  (-20 → -10)
// Zone limite   (ratio 0.6 → 1.0) : pénalité faible (-10 → 0)
// Zone excès    (ratio > 1.0)     : score positif   (0 → +20)
// ============================================================================
function scoreIntradayReversal(symbol, intraday_change, side) {
  const sMax  = getStrongMax(symbol);
  const dir   = side === 'BUY' ? -1 : 1; // BUY veut baisse, SELL veut hausse
  const ratio = (intraday_change * dir) / sMax;

  if (ratio < 0.6) {
    return -20 + (ratio / 0.6) * 10;
  } else if (ratio < 1.0) {
    return -10 + ((ratio - 0.6) / 0.4) * 10;
  } else {
    return Math.min(((ratio - 1.0) / 0.5) * 20, 20);
  }
}

// ============================================================================
// COMPOSANTE — INTRADAY CONTINUATION (±25)
// Sens opposé        (ratio < 0)          : pénalité -25 → 0
// Bon sens           (ratio 0 → 0.75)     : score    0 → +25
// Limite             (ratio 0.75 → 1.0)   : score    +25 → +10
// Excès              (ratio > 1.0)        : pénalité +10 → -10
// ============================================================================
function scoreIntradayContinuation(symbol, intraday_change, side) {
  const sMax  = getStrongMax(symbol);
  const dir   = side === 'BUY' ? 1 : -1;
  const ratio = (intraday_change * dir) / sMax;

  if (ratio < 0) {
    return clamp(ratio / 0.6, -1, 0) * 10;
  } else if (ratio <= 0.75) {
    return (ratio / 0.75) * 25;
  } else if (ratio <= 1.0) {
    return 25 - ((ratio - 0.75) / 0.25) * 15;
  } else {
    return Math.max(10 - ((ratio - 1.0) / 0.5) * 20, -10);
  }
}

// ============================================================================
// REVERSAL BUY
// RSI(0-30) + BBZ(0-15) + Slope(±20) + DSlope(±10) + Vol(−3/+7) + Intraday(±20)
// Max théorique : +100  |  Min théorique : −53
// ============================================================================
export function scoreReversalBuy(row) {
  const {
    symbol, rsi_h1_previouslow3, zscore_h1,
    slope_h1, dslope_h1,
    atr_m15, close, intraday_change
  } = row;

  // RSI (0-30) — oversold, limite à 35, score max à RSI=10
  const rsiScore = Math.pow(clamp((35 - rsi_h1_previouslow3) / 25, 0, 1), 0.67) * 30;

  // BBZ (0-15)
  const lobeExtreme = Math.pow(clamp((-zscore_h1 - 1.8) / 0.7, 0, 1), 0.5) * 15;
  const lobeMid     = Math.pow(clamp(-zscore_h1 / 1.0, 0, 1), 0.8)
                    * Math.pow(clamp((1.5 + zscore_h1) / 0.5, 0, 1), 1.2) * 11;
  const zscoreScore = Math.max(lobeExtreme, lobeMid);

  // SLOPE + DSLOPE
  const sNorm       = getSlopeNorm(symbol);
  const zWeight     = clamp(-zscore_h1 / 2.0, 0, 1);
  const slopeScore  = clamp(1 - Math.abs(slope_h1) / sNorm, 0, 1) * 20 * zWeight;
  const dslopeScore = clamp(dslope_h1 / sNorm, -1, 1) * 10;

  // VOLATILITY
  const volatilityScore = scoreVolatility(symbol, atr_m15, close);

  // INTRADAY
  const intradayScore = scoreIntradayReversal(symbol, intraday_change, 'BUY');

  const total = rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;

  return {
    total,
    breakdown: { rsiScore, zscoreScore, slopeScore, dslopeScore, volatilityScore, intradayScore }
  };
}

// ============================================================================
// REVERSAL SELL
// RSI(0-30) + BBZ(0-15) + Slope(±20) + DSlope(±10) + Vol(−3/+7) + Intraday(±20)
// ============================================================================
export function scoreReversalSell(row) {
  const {
    symbol, rsi_h1_previoushigh3, zscore_h1,
    slope_h1, dslope_h1,
    atr_m15, close, intraday_change
  } = row;

  // RSI (0-30) — overbought, limite à 65, score max à RSI=90
  const rsiScore = Math.pow(clamp((rsi_h1_previoushigh3 - 65) / 25, 0, 1), 0.67) * 30;

  // BBZ (0-15)
  const lobeExtreme = Math.pow(clamp((zscore_h1 - 1.8) / 0.7, 0, 1), 0.5) * 15;
  const lobeMid     = Math.pow(clamp(zscore_h1 / 1.0, 0, 1), 0.8)
                    * Math.pow(clamp((1.5 - zscore_h1) / 0.5, 0, 1), 1.2) * 11;
  const zscoreScore = Math.max(lobeExtreme, lobeMid);

  // SLOPE + DSLOPE
  const sNorm       = getSlopeNorm(symbol);
  const zWeight     = clamp(zscore_h1 / 2.0, 0, 1);
  const slopeScore  = clamp(1 - Math.abs(slope_h1) / sNorm, 0, 1) * 20 * zWeight;
  const dslopeScore = clamp(-dslope_h1 / sNorm, -1, 1) * 10;

  // VOLATILITY
  const volatilityScore = scoreVolatility(symbol, atr_m15, close);

  // INTRADAY
  const intradayScore = scoreIntradayReversal(symbol, intraday_change, 'SELL');

  const total = rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;

  return {
    total,
    breakdown: { rsiScore, zscoreScore, slopeScore, dslopeScore, volatilityScore, intradayScore }
  };
}

// ============================================================================
// CONTINUATION BUY
// RSI(0-30) + BBZ(0-15) + Slope(±20) + DSlope(±10) + Vol(−3/+7) + Intraday(±25)
// ============================================================================
export function scoreContinuationBuy(row) {
  const {
    symbol, rsi_h1, zscore_h1,
    slope_h1, dslope_h1,
    atr_m15, close, intraday_change
  } = row;

  // RSI (0-30) — deux lobes + neutre
  const lobeHigh      = Math.pow(clamp((70 - rsi_h1) / 14, 0, 1), 0.4)
                      * Math.pow(clamp((rsi_h1 - 56) / 7, 0, 1), 0.6) * 30;
  const lobeHighEntry = Math.pow(clamp((rsi_h1 - 56) / 10, 0, 1), 0.67) * 30;
  const neutral       = clamp(1 - Math.abs(rsi_h1 - 50) / 5, 0, 1) * 5;
  const rsiScore      = Math.max(lobeHigh, lobeHighEntry, neutral);

  // BBZ (0-15) — deux lobes symétriques ±1
  const zWeight     = clamp((Math.abs(zscore_h1) - 0.3) / 1.7, 0, 1);
  const lobePlus    = Math.pow(clamp( zscore_h1 / 1.0, 0, 1), 0.8)
                    * Math.pow(clamp((2.0 - zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const lobeMinus   = Math.pow(clamp(-zscore_h1 / 1.0, 0, 1), 0.8)
                    * Math.pow(clamp((2.0 + zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const zscoreScore = Math.max(lobePlus, lobeMinus) * zWeight;

  // SLOPE + DSLOPE
  const { slopeScore, dslopeScore } = scoreSlope(symbol, slope_h1, dslope_h1);

  // VOLATILITY
  const volatilityScore = scoreVolatility(symbol, atr_m15, close);

  // INTRADAY
  const intradayScore = scoreIntradayContinuation(symbol, intraday_change, 'BUY');

  const total = rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;

  return {
    total,
    breakdown: { rsiScore, zscoreScore, slopeScore, dslopeScore, volatilityScore, intradayScore }
  };
}

// ============================================================================
// CONTINUATION SELL
// RSI(0-30) + BBZ(0-15) + Slope(±20) + DSlope(±10) + Vol(−3/+7) + Intraday(±25)
// ============================================================================
export function scoreContinuationSell(row) {
  const {
    symbol, rsi_h1, zscore_h1,
    slope_h1, dslope_h1,
    atr_m15, close, intraday_change
  } = row;

  // RSI (0-30) — deux lobes + neutre
  const lobeHigh = Math.pow(clamp((rsi_h1 - 55) / 10, 0, 1), 0.67) * 30;
  const lobeLow  = Math.pow(clamp((70 - rsi_h1) / 14, 0, 1), 0.4)
                 * Math.pow(clamp((44 - rsi_h1) / 7,  0, 1), 0.6) * 30;
  const neutral  = clamp(1 - Math.abs(rsi_h1 - 50) / 5, 0, 1) * 5;
  const rsiScore = Math.max(lobeHigh, lobeLow, neutral);

  // BBZ (0-15) — deux lobes symétriques ±1
  const zWeight     = clamp((Math.abs(zscore_h1) - 0.3) / 1.7, 0, 1);
  const lobePlus    = Math.pow(clamp( zscore_h1 / 1.0, 0, 1), 0.8)
                    * Math.pow(clamp((2.0 - zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const lobeMinus   = Math.pow(clamp(-zscore_h1 / 1.0, 0, 1), 0.8)
                    * Math.pow(clamp((2.0 + zscore_h1) / 1.0, 0, 1), 0.8) * 15;
  const zscoreScore = Math.max(lobePlus, lobeMinus) * zWeight;

  // SLOPE + DSLOPE (sell : slope négatif = bon signal)
  const { slopeScore, dslopeScore } = scoreSlope(symbol, -slope_h1, -dslope_h1);

  // VOLATILITY
  const volatilityScore = scoreVolatility(symbol, atr_m15, close);

  // INTRADAY
  const intradayScore = scoreIntradayContinuation(symbol, intraday_change, 'SELL');

  const total = rsiScore + zscoreScore + slopeScore + dslopeScore + volatilityScore + intradayScore;

  return {
    total,
    breakdown: { rsiScore, zscoreScore, slopeScore, dslopeScore, volatilityScore, intradayScore }
  };
}