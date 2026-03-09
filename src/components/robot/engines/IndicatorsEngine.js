// ============================================================================
// IndicatorsEngine
// Rôle : lecture technique micro (slope, RSI, signaux)
// ============================================================================

const IndicatorsEngine = {

  // -------------------------------------------------------------------------
  // SLOPE CLASSIFICATION
  // -------------------------------------------------------------------------
  classifySlope(s) {
    if (!Number.isFinite(s))
      return { signal: "Neutral", strength: 0 };

    const m = Math.abs(s);

    if (m <= 0.2)
      return { signal: "Neutral", strength: 0 };

    if (s > 0) {
      if (m <= 1.0)  return { signal: "Up",        strength: 0.4 };
      if (m <= 2.72) return { signal: "Up",        strength: 0.7 };
      return          { signal: "Strong Up", strength: 1.0 };
    } else {
      if (m <= 1.0)  return { signal: "Down",        strength: 0.4 };
      if (m <= 2.72) return { signal: "Down",        strength: 0.7 };
      return          { signal: "Strong Down", strength: 1.0 };
    }
  },

  // -------------------------------------------------------------------------
  // RSI ZONE (enriched, UI + Brain compatible)
  // -------------------------------------------------------------------------
  getRsiZone(rsi) {
    if (!Number.isFinite(rsi)) {
      return {
        zone: "—",
        cls: "",
        bias: "NEUTRAL",
        strength: 0,
        extreme: false,
        score: 0
      };
    }

    if (rsi >= 80)
      return { zone: "Surachat extrême", cls: "rsi-z7", bias: "SELL", strength: 1.0, extreme: true,  score: -2 };

    if (rsi >= 70)
      return { zone: "Surachat",         cls: "rsi-z6", bias: "SELL", strength: 0.7, extreme: false, score: -1 };

    if (rsi >= 55)
      return { zone: "Haute",            cls: "rsi-z5", bias: "NEUTRAL", strength: 0.4, extreme: false, score: 0 };

    if (rsi >= 45)
      return { zone: "Neutre",           cls: "rsi-z4", bias: "NEUTRAL", strength: 0.2, extreme: false, score: 0 };

    if (rsi >= 30)
      return { zone: "Basse",            cls: "rsi-z3", bias: "NEUTRAL", strength: 0.4, extreme: false, score: 0 };

    if (rsi >= 20)
      return { zone: "Survente",         cls: "rsi-z2", bias: "BUY", strength: 0.7, extreme: false, score: +1 };

    return {
      zone: "Survente extrême",
      cls: "rsi-z1",
      bias: "BUY",
      strength: 1.0,
      extreme: true,
      score: +2
    };
  },

  // -------------------------------------------------------------------------
  // TRADE SIGNAL (slope + RSI)
  // -------------------------------------------------------------------------
  getTradeSignal({ slope, rsi }) {
    if (!Number.isFinite(slope) || !Number.isFinite(rsi))
      return "Neutral";

    const m = Math.abs(slope);

    if (m <= 0.2)
      return "Neutral";

    if (m > 2.72) {
      if (slope > 0 && rsi <= 30) return "Strong Buy";
      if (slope < 0 && rsi >= 70) return "Strong Sell";
    }

    if (slope > 0 && rsi < 70) return "Buy";
    if (slope < 0 && rsi > 30) return "Sell";

    return "Neutral";
  },

  // -------------------------------------------------------------------------
  // CONTEXT SYNTHESIS (READY FOR AssetSignals)
  // -------------------------------------------------------------------------
  getIndicatorContext({ slope, rsi }) {
    const slopeInfo = this.classifySlope(slope);
    const rsiInfo   = this.getRsiZone(rsi);
    const trade     = this.getTradeSignal({ slope, rsi });

    return {
      slope: slopeInfo,
      rsi:   rsiInfo,
      trade,
      confidence:
        (slopeInfo.strength * 0.6) +
        (Math.abs(rsiInfo.score) / 2 * 0.4)
    };
  }

};

export default IndicatorsEngine;
