// ============================================================================
// ScoringEngine.js — NEO MATRIX Scoring
// Reversal BUY/SELL + Continuation BUY/SELL
// Composantes : RSI, BBZ, Slope, DSlope, Volatility, Intraday
// ============================================================================

import { getVolatilityRegime } from '../config/VolatilityConfig.js';
import { INTRADAY_CONFIG }     from '../config/IntradayConfig.js';

// ============================================================================
// HELPERS
// ============================================================================
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function getStrongMax(symbol) {
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  return cfg.strongMax;
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
// Normalisation : ±5 = max signal
// ============================================================================
function scoreSlope(slope_h1, dslope_h1) {
  const slopeScore  = clamp(slope_h1  / 5.0, -1, 1) * 20;
  const dslopeScore = clamp(dslope_h1 / 5.0, -1, 1) * 10;
  return { slopeScore, dslopeScore };
}

// ============================================================================
// COMPOSANTE — INTRADAY REVERSAL (±20)
// Logique W : pics à ±75% strongMax, pénalité au delà de strongMax
// ============================================================================
function scoreIntradayReversal(symbol, intraday_change) {
  const sMax  = getStrongMax(symbol);
  const ratio = intraday_change / sMax;

  const lobePos   = Math.pow(clamp( ratio / 0.75, 0, 1), 0.8)
                  * Math.pow(clamp((1.5 - ratio) / 0.75, 0, 1), 0.8) * 20;
  const lobeMinus = Math.pow(clamp(-ratio / 0.75, 0, 1), 0.8)
                  * Math.pow(clamp((1.5 + ratio) / 0.75, 0, 1), 0.8) * 20;
  const penalty   = -clamp((Math.abs(ratio) - 1.0) / 0.5, 0, 1) * 20;

  return Math.max(lobePos, lobeMinus) + penalty;
}

// ============================================================================
// COMPOSANTE — INTRADAY CONTINUATION (±25)
// Bonne direction  : rampe +25 de 0 → strongMax
// Mauvaise direction : pénalité -15 dès ratio < 0, max à -strongMax
// ============================================================================
function scoreIntradayContinuation(symbol, intraday_change, side) {
  const sMax  = getStrongMax(symbol);
  const dir   = side === 'BUY' ? 1 : -1;
  const ratio = (intraday_change * dir) / sMax;
  // ratio > 0 = bonne direction (BUY quand hausse, SELL quand baisse)
  // ratio < 0 = mauvaise direction (BUY quand hausse pour SELL, baisse pour BUY)

  // Bonne direction : rampe de 0 à +15
  const lobePos    = clamp(ratio / 1.0, 0, 1) * 25;

  // Mauvaise direction : pénalité dès ratio < 0, max -25 à ratio = -1
  const penaltyNeg = -clamp(-ratio / 1.0, 0, 1) * 25;

  return lobePos + penaltyNeg;
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
  const zWeight     = clamp(-zscore_h1 / 2.0, 0, 1);
  const slopeScore  = clamp(1 - Math.abs(slope_h1) / 5.0, 0, 1) * 20 * zWeight;
  const dslopeScore = clamp(dslope_h1 / 5.0, -1, 1) * 10;

  // VOLATILITY
  const volatilityScore = scoreVolatility(symbol, atr_m15, close);

  // INTRADAY
  const intradayScore = scoreIntradayReversal(symbol, intraday_change);

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
  const zWeight     = clamp(zscore_h1 / 2.0, 0, 1);
  const slopeScore  = clamp(1 - Math.abs(slope_h1) / 5.0, 0, 1) * 20 * zWeight;
  const dslopeScore = clamp(-dslope_h1 / 5.0, -1, 1) * 10;

  // VOLATILITY
  const volatilityScore = scoreVolatility(symbol, atr_m15, close);

  // INTRADAY
  const intradayScore = scoreIntradayReversal(symbol, intraday_change);

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
  const { slopeScore, dslopeScore } = scoreSlope(slope_h1, dslope_h1);

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
  const { slopeScore, dslopeScore } = scoreSlope(-slope_h1, -dslope_h1);

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