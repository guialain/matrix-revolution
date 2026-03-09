// ============================================================================
// AssetSignals.js
// Rôle : produire les signaux directionnels agrégés de l’actif
// Source unique : IndicatorsEngine
// ============================================================================

import IndicatorsEngine from "../IndicatorsEngine";

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// SIGNAL STRENGTH PICKER
// ---------------------------------------------------------------------------
function pickStrongerSignal(a, b) {
  if (!a && !b) return "Neutral";
  if (!a) return b;
  if (!b) return a;

  if (a.includes("Strong")) return a;
  if (b.includes("Strong")) return b;

  if (a !== "Neutral") return a;
  if (b !== "Neutral") return b;

  return "Neutral";
}

// ---------------------------------------------------------------------------
// SIGN ALIGNMENT
// ---------------------------------------------------------------------------
function sameSign(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return (a > 0 && b > 0) || (a < 0 && b < 0);
}


// ---------------------------------------------------------------------------
// CONTEXT AGGREGATOR
// ---------------------------------------------------------------------------
function aggregateContext(ctxA, ctxB, slopeA, slopeB) {
  if (!ctxA || !ctxB) {
    return {
      converge: false,
      alignment: "Unknown",
      signal: "Neutral",
      trade: "Neutral",
      confidence: 0
    };
  }

  const converge = sameSign(slopeA, slopeB);

  const signal = pickStrongerSignal(
    ctxA.slope.signal,
    ctxB.slope.signal
  );

  const trade = pickStrongerSignal(
    ctxA.trade,
    ctxB.trade
  );

  const confidence =
    ((ctxA.confidence + ctxB.confidence) / 2) *
    (converge ? 1 : 0.6);

  let alignment = "Diverge";
  if (converge && signal === "Neutral") alignment = "Converge (Weak)";
  else if (converge) alignment = "Converge";

  return {
    converge,
    alignment,
    signal,
    trade,
    confidence,
    rsi: {
      A: ctxA.rsi,
      B: ctxB.rsi
    }
  };
}

// ============================================================================
// MAIN
// ============================================================================

const AssetSignals = {

  evaluate(indicators) {
    if (!indicators) {
      const empty = {
        converge: false,
        signal: "Neutral",
        trade: "Neutral",
        confidence: 0
      };
      return {
        structure: empty,
        dominant:  empty,
        timing:    empty,
        noise:     empty
      };
    }

    const rsiSlope = indicators.rsiSlope ?? {};
    const rsiValue = indicators.rsi ?? {};

    // --------------------------------------------------
    // STRUCTURE — W1 / MN
    // --------------------------------------------------
    const ctxW1 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.W1,
      rsi:   rsiValue.W1
    });

    const ctxMN = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.MN,
      rsi:   rsiValue.MN
    });

    // --------------------------------------------------
    // DOMINANT — H4 / D1
    // --------------------------------------------------
    const ctxH4 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.H4,
      rsi:   rsiValue.H4
    });

    const ctxD1 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.D1,
      rsi:   rsiValue.D1
    });

    // --------------------------------------------------
    // TIMING — M15 / H1
    // --------------------------------------------------
    const ctxM15 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.M15,
      rsi:   rsiValue.M15
    });

    const ctxH1 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.H1,
      rsi:   rsiValue.H1
    });

    // --------------------------------------------------
    // NOISE — M1 / M5
    // --------------------------------------------------
    const ctxM1 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.M1,
      rsi:   rsiValue.M1
    });

    const ctxM5 = IndicatorsEngine.getIndicatorContext({
      slope: rsiSlope.M5,
      rsi:   rsiValue.M5
    });

    return {
      structure: aggregateContext(ctxW1, ctxMN, rsiSlope.W1, rsiSlope.MN),
      dominant:  aggregateContext(ctxH4, ctxD1, rsiSlope.H4, rsiSlope.D1),
      timing:    aggregateContext(ctxM15, ctxH1, rsiSlope.M15, rsiSlope.H1),
      noise:     aggregateContext(ctxM1, ctxM5, rsiSlope.M1, rsiSlope.M5)
    };
  }
};

export default AssetSignals;
