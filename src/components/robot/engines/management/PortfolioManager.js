// ============================================================================
// PortfolioManager.js
// Rôle : construire l’état du portefeuille (PAS décisionnaire)
// ============================================================================

import PositionExit from "./PositionExit";




const PortfolioManager = (() => {

  function evaluate(snapshot) {
    const openPositions = snapshot?.openPositions || [];

    // ===============================
    // 1️⃣ POSITIONS OUVERTES (BRUTES)
    // ===============================
    const positions = openPositions.filter(p => p?.symbol);

    // ===============================
    // 2️⃣ CANDIDATS À LA CLÔTURE
    // (profits uniquement, via PositionExit)
    // ===============================
    const closePositions = positions
      .map(PositionExit.evaluate)
      .filter(Boolean);

    // ===============================
    // 3️⃣ TRI (urgence décroissante)
    // ===============================
    const urgencyRank = { HIGH: 3, MID: 2, LOW: 1 };

    closePositions.sort(
      (a, b) =>
        (urgencyRank[b.urgency] || 0) -
        (urgencyRank[a.urgency] || 0)
    );

    // ===============================
    // 4️⃣ PAYLOAD PORTFOLIO
    // ===============================
    return {
      openPositions: positions,
      closePositions
    };
  }

  return {
    evaluate
  };

})();

export default PortfolioManager;
