// ============================================================================
// PositionExit.js
// Rôle : analyser si une position GAGNANTE doit être clôturée
// Version : v1.0 (profits uniquement)
// ============================================================================

const PositionExit = (() => {

  // ===============================
  // MAIN EVALUATOR
  // ===============================
  function evaluate(position) {
    if (!position) return null;

    const {
      symbol,
      side,
      pnl_atr_h1,
      pnl_atr_h4,
      rsi_h1,
      rsi_h4
    } = position;

    // --------------------------------------------------
    // 1️⃣ FILTRE STRICT : positions gagnantes uniquement
    // --------------------------------------------------
    const isWinning =
      (pnl_atr_h1 != null && pnl_atr_h1 > 0) ||
      (pnl_atr_h4 != null && pnl_atr_h4 > 0);

    if (!isWinning) return null;

  // ===============================
// 2️⃣ MATURITÉ (ASSOUPLIE)
// ===============================
const isMature =
  pnl_atr_h1 >= 0.9 ||
  pnl_atr_h4 >= 0.7;

if (!isMature) return null;

// ===============================
// 3️⃣ RSI — DÉCLENCHEUR DE SORTIE
// ===============================
let urgency = null;
let reasons = [];

if (side === "BUY") {

  if (rsi_h1 >= 68 && rsi_h4 >= 64) {
    urgency = "HIGH";
    reasons.push("RSI H1 & H4 overbought");

  } else if (rsi_h1 >= 68) {
    urgency = "MID";
    reasons.push("RSI H1 overbought");

  } else if (
    (rsi_h1 >= 63 && rsi_h1 <= 68) ||
    (rsi_h4 >= 60 && rsi_h4 <= 64)
  ) {
    urgency = "LOW";
    reasons.push("RSI approaching overbought");
  }
}

if (side === "SELL") {

  if (rsi_h1 <= 32 && rsi_h4 <= 35) {
    urgency = "HIGH";
    reasons.push("RSI H1 & H4 oversold");

  } else if (rsi_h1 <= 32) {
    urgency = "MID";
    reasons.push("RSI H1 oversold");

  } else if (
    (rsi_h1 >= 31 && rsi_h1 <= 35) ||
    (rsi_h4 >= 36 && rsi_h4 <= 40)
  ) {
    urgency = "LOW";
    reasons.push("RSI approaching oversold");
  }
}

if (!urgency) return null;


    // --------------------------------------------------
    // 4️⃣ SORTIE STRUCTURÉE POUR TRINITY
    // --------------------------------------------------
    return {
      symbol,
      side,
      urgency,
      reason: reasons.join(" | "),
      pnl_atr_h1,
      pnl_atr_h4,
      rsi_h1,
      rsi_h4
    };
  }

  // ===============================
  // API
  // ===============================
  return {
    evaluate
  };

})();

export default PositionExit;
