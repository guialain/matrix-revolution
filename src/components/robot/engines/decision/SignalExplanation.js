// ============================================================================
// SignalExplanation.js
// Rôle : produire une justification lisible du signal de trading
// ============================================================================

const SignalExplanation = (() => {

  function build({ asset, market, brain }) {
    if (!market || !brain) {
      return "Données insuffisantes pour produire une explication.";
    }

    const lines = [];

    // ----------------------------------------------------------------------
    // ASSET
    // ----------------------------------------------------------------------
    if (asset?.symbol) {
      lines.push(`Actif analysé : ${asset.symbol}`);
    }

    // ----------------------------------------------------------------------
    // STRUCTURE & TENDANCE
    // ----------------------------------------------------------------------
    if (market.structure) {
      lines.push(
        `Structure : ${market.structure.direction}`
      );
    }

    if (market.dominant) {
      lines.push(
        `Tendance dominante : ${market.dominant.direction}`
      );
    }

    // ----------------------------------------------------------------------
    // TIMING
    // ----------------------------------------------------------------------
    if (market.timing) {
      lines.push(
        `Timing : ${market.timing.state}`
      );
    }

    // ----------------------------------------------------------------------
    // VOLATILITÉ & MACRO
    // ----------------------------------------------------------------------
    if (market.volatility) {
      lines.push(
        `Volatilité : ${market.volatility.regime}`
      );
    }

    if (market.macro?.riskOff) {
      lines.push("Contexte macro : risk-off");
    }

    // ----------------------------------------------------------------------
    // DÉCISION FINALE
    // ----------------------------------------------------------------------
    if (brain.decision === "BUY") {
      lines.push("Décision finale : ACHAT");
    } else if (brain.decision === "SELL") {
      lines.push("Décision finale : VENTE");
    } else {
      lines.push("Décision finale : ATTENTE");
    }

    if (brain.conviction !== undefined) {
      lines.push(`Conviction : ${(brain.conviction * 100).toFixed(0)} %`);
    }

    return lines.join(" | ");
  }

  return { build };

})();

export default SignalExplanation;
