// engines/confidence/OpportunityRanking.js
// Rôle : hiérarchisation finale des opportunités NEO

const OpportunityRanking = (() => {

  function evaluate({ market, asset, score }) {

    // Cas minimaliste (1 actif analysé)
    const opportunityScore =
      (score?.value ?? score ?? 0) *
      ((market?.confidence ?? 0.5) * 100) / 100;

    const priority =
      opportunityScore >= 65 ? "HIGH" :
      opportunityScore >= 45 ? "MEDIUM" :
                               "LOW";

    return {
      asset: asset?.asset?.symbol ?? asset?.symbol ?? null,
      score: opportunityScore,
      priority
    };
  }

  return { evaluate };

})();

export default OpportunityRanking;
