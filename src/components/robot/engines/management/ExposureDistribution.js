// ============================================================================
// ExposureDistribution.js
// Rôle : mesurer la répartition et la concentration du portefeuille
// ============================================================================

const ExposureDistribution = (() => {

  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;

  function evaluate(snapshot) {
    const positions = snapshot?.openPositions || [];

    const totalPositions = positions.length;
    if (totalPositions === 0) {
      return {
        totalPositions: 0,
        byDirection: { buy: 0, sell: 0 },
        directionalBias: "BALANCED",
        concentration: {
          maxSymbolPct: null,
          dominantSymbol: null
        },
        exposureScore: 0
      };
    }

    // -------------------------------------------------
    // DIRECTION
    // -------------------------------------------------
    let buy = 0, sell = 0;
    let totalVolume = 0;

    const symbolVolume = {};

    for (const p of positions) {
      const vol = num(p.volume);
      totalVolume += vol;

      if (p.direction === "BUY") buy += vol;
      if (p.direction === "SELL") sell += vol;

      if (p.symbol) {
        symbolVolume[p.symbol] = (symbolVolume[p.symbol] || 0) + vol;
      }
    }

    const directionalBias =
      buy > sell ? "LONG" :
      sell > buy ? "SHORT" :
      "BALANCED";

    // -------------------------------------------------
    // CONCENTRATION
    // -------------------------------------------------
    let dominantSymbol = null;
    let maxVol = 0;

    for (const s in symbolVolume) {
      if (symbolVolume[s] > maxVol) {
        maxVol = symbolVolume[s];
        dominantSymbol = s;
      }
    }

    const maxSymbolPct =
      totalVolume > 0
        ? maxVol / totalVolume
        : null;

    // -------------------------------------------------
    // EXPOSURE SCORE (indicatif)
    // -------------------------------------------------
    let exposureScore = 0;

    if (directionalBias !== "BALANCED") exposureScore += 30;
    if (maxSymbolPct !== null) exposureScore += Math.round(maxSymbolPct * 70);

    exposureScore = Math.min(exposureScore, 100);

    return {
      totalPositions,
      byDirection: {
        buy,
        sell
      },
      directionalBias,
      concentration: {
        maxSymbolPct,
        dominantSymbol
      },
      exposureScore
    };
  }

  return { evaluate };

})();

export default ExposureDistribution;
