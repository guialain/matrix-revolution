// Rôle : scoring synthétique de l’analyse NEO

const AnalysisScore = (() => {

  function evaluate(asset, market) {
    let score = 0;

    if (market?.confidence != null)
      score += market.confidence * 0.4;

    if (asset?.dominant?.strength != null)
      score += asset.dominant.strength * 0.3;

    if (asset?.timing?.quality != null)
      score += asset.timing.quality * 0.3;

    return {
      value: Number(score.toFixed(2)),
      level:
        score > 0.70 ? "HIGH" :
        score > 0.50  ? "MEDIUM" :
                       "LOW"
    };
  }

  return { evaluate };

})();

export default AnalysisScore;
