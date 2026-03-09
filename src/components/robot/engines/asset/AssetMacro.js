// ============================================================================
// AssetMacro.js
// Rôle : contexte macro global (risk-on / risk-off)
// Source : données macro déjà calculées / agrégées
// ============================================================================

const AssetMacro = (() => {

  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

  function evaluate(snapshot) {
    const indices = snapshot?.macro?.indices || {};
    const vixData = snapshot?.macro?.vix || {};

    // ----------------------------
    // EQUITIES SCORE
    // ----------------------------
    const changes = Object.values(indices)
      .map(i => num(i?.change))
      .filter(v => v !== null);

    let equityScore = null;
    if (changes.length) {
      equityScore = changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    let equities = "MIXED";
    if (equityScore !== null) {
      if (equityScore > 0.3) equities = "UP";
      else if (equityScore < -0.3) equities = "DOWN";
    }

    // ----------------------------
    // VOLATILITY (VIX)
    // ----------------------------
    const vixValue  = num(vixData.value);
    const vixChange = num(vixData.change);

    let volatility = "RISING";
    if (vixValue !== null) {
      if (vixValue < 15) volatility = "LOW";
      else if (vixValue > 20) volatility = "HIGH";
    }

    // ----------------------------
    // REGIME
    // ----------------------------
    let regime = "NEUTRAL";
    if (equities === "UP" && volatility === "LOW") regime = "RISK_ON";
    if (equities === "DOWN" && volatility === "HIGH") regime = "RISK_OFF";

    // ----------------------------
    // CONFIDENCE
    // ----------------------------
    let confidence = 0.5;
    if (regime !== "NEUTRAL") confidence = 0.8;
    if (equityScore === null || vixValue === null) confidence = 0.3;

    return {
      regime,
      confidence,
      drivers: {
        equities,
        volatility
      },
      details: {
        equityScore,
        vix: {
          value: vixValue,
          change: vixChange
        }
      }
    };
  }

  return { evaluate };

})();

export default AssetMacro;
