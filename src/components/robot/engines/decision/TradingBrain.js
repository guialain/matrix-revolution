// ============================================================================
// TradingBrain.js
// Rôle : convertir état marché + portefeuille en intention décisionnelle
// ============================================================================

const TradingBrain = (() => {

  function decide({ asset, market, confidence, ranking, portfolio }) {

    const {
      timestamp,
      structure,
      dominant,
      timing,
      noise,
      volatility,
      macro
    } = asset;

    // ----------------------------
    // PORTFOLIO GATE
    // ----------------------------
    if (!portfolio?.capacity?.canTrade) {
      return decisionWait(
        asset.asset,
        timestamp,
        "Portfolio blocked"
      );
    }

    // ----------------------------
    // STRUCTURE & DOMINANT
    // ----------------------------
    if (
      structure.direction === "FLAT" ||
      dominant.direction === "FLAT" ||
      structure.direction === "CONFLICT" ||
      dominant.direction === "CONFLICT" ||
      structure.direction !== dominant.direction
    ) {
      return decisionWait(
        asset.asset,
        timestamp,
        "Structure/Dominant misalignment"
      );
    }

    const direction = structure.direction; // UP / DOWN

    // ----------------------------
    // TIMING
    // ----------------------------
    if (
      (direction === "UP"   && timing.state !== "BUY_ZONE") ||
      (direction === "DOWN" && timing.state !== "SELL_ZONE")
    ) {
      return decisionWait(
        asset.asset,
        timestamp,
        "Timing not ready"
      );
    }

    // ----------------------------
    // NOISE & VOLATILITY
    // ----------------------------
    if (noise.level === "HIGH") {
      return decisionWait(
        asset.asset,
        timestamp,
        "Market noise too high"
      );
    }

    if (!volatility.tradable) {
      return decisionWait(
        asset.asset,
        timestamp,
        "Volatility not tradable"
      );
    }

    // ----------------------------
    // DECISION
    // ----------------------------
    const action = direction === "UP" ? "BUY" : "SELL";

    // ----------------------------
    // CONVICTION
    // ----------------------------
    let conviction =
      0.30 * (confidence?.value ?? 0) / 100 +
      0.25 * (ranking?.score ?? 0) / 100 +
      0.25 * structure.confidence +
      0.20 * dominant.confidence;

    conviction = Math.min(Math.max(conviction, 0), 1);

    // ----------------------------
    // HORIZON
    // ----------------------------
    const horizon =
      conviction >= 0.75 ? "OVERNIGHT" : "INTRADAY";

    return {
      action,
      conviction,
      horizon,

      reasons: {
        structure: structure.direction,
        dominant: dominant.direction,
        timing: timing.state,
        noise: noise.level,
        volatility: volatility.regime,
        macro: macro.regime
      },

      meta: {
        asset: asset.asset,
        timestamp
      }
    };
  }

  // -------------------------------------------------------------------------
  // WAIT HELPER
  // -------------------------------------------------------------------------
  function decisionWait(asset, timestamp, reason) {
    return {
      action: "WAIT",
      conviction: 0,
      horizon: "INTRADAY",
      reasons: { reason },
      meta: { asset, timestamp }
    };
  }

  return { decide };

})();

export default TradingBrain;
