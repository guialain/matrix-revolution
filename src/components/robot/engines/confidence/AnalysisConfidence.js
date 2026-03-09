// engines/confidence/AnalysisConfidence.js
// Rôle : transformer l’analyse NEO en niveau de confiance exploitable

const AnalysisConfidence = (() => {

  function evaluate(assetAnalysis) {
    let confidence = 100;
    const blockers = [];

    if (assetAnalysis?.structure?.conflict) {
      confidence -= 30;
      blockers.push("Conflit structurel");
    }

    if (assetAnalysis?.noise?.level === "HIGH") {
      confidence -= 20;
      blockers.push("Bruit de marché élevé");
    }

    if (assetAnalysis?.volatility?.regime === "COMPRESSION_EXTREME") {
      confidence -= 30;
      blockers.push("Volatilité comprimée");
    }

    if (assetAnalysis?.macro?.riskOff) {
      confidence -= 20;
      blockers.push("Contexte macro risk-off");
    }

    confidence = Math.max(0, Math.min(confidence, 100));

    const quality =
      confidence >= 70 ? "HIGH" :
      confidence >= 40 ? "MEDIUM" :
                         "LOW";

    return {
      value: confidence,
      quality,
      blockers
    };
  }

  return { evaluate };

})();

export default AnalysisConfidence;
