// ============================================================================
// AccountRisk.js
// Rôle : évaluer le risque du compte (drawdown / margin)
// ============================================================================

const AccountRisk = (() => {

  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

  function evaluate(snapshot) {
    const acc = snapshot?.account || {};

    const balance = num(acc.balance);
    const equity  = num(acc.equity);
    const marginLevel = num(acc.marginLevel);

    // ----------------------------
    // DRAWDOWN
    // ----------------------------
    const drawdown =
      balance && equity
        ? Math.max((balance - equity) / balance, 0)
        : null;

    // ----------------------------
    // RISK STATE
    // ----------------------------
    let state = "SAFE";

    if (marginLevel !== null) {
      if (marginLevel < 200) state = "DANGER";
      else if (marginLevel < 400) state = "WARNING";
    }

    // ----------------------------
    // CAN TRADE ?
    // ----------------------------
    let canTrade = true;
    let reason = null;

    if (state === "DANGER") {
      canTrade = false;
      reason = "Margin level too low";
    }

    if (drawdown !== null && drawdown > 0.30) {
      canTrade = false;
      reason = "Max drawdown exceeded";
    }

    return {
      drawdown,
      marginLevel,
      state,
      canTrade,
      reason
    };
  }

  return { evaluate };

})();

export default AccountRisk;
