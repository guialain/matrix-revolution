// ============================================================================
// ValidateTPSL.js — NEO MATRIX (TRINITY / PRODUCTION)
// ---------------------------------------------------------------------------
// Rôle :
//  - Vérifier la cohérence SL / TP
//  - Respecter stops_level broker
//  - Autoriser SL seul, TP seul ou aucun
// ============================================================================

const ValidateTPSL = {

  run({ draft, asset }) {
    const issues = [];
    const metrics = {};

    const side = draft?.side;
    const sl = Number(draft?.sl ?? 0);
    const tp = Number(draft?.tp ?? 0);

    const bid = Number(asset?.bid);
    const ask = Number(asset?.ask);
    const stopsLevel = Number(asset?.stops_level); // en points
    const digits = Number(asset?.digits);

    // ------------------------------------------------------------------------
    // Side valide
    // ------------------------------------------------------------------------
    if (!["BUY", "SELL"].includes(side)) {
      issues.push({
        level: "BLOCK",
        code: "SIDE_INVALID",
        message: "Side invalide"
      });
      return { issues, patch: null, metrics };
    }

    // ------------------------------------------------------------------------
    // Données asset requises
    // ------------------------------------------------------------------------
    if (![bid, ask, stopsLevel, digits].every(Number.isFinite)) {
      issues.push({
        level: "BLOCK",
        code: "ASSET_DATA_INVALID",
        message: "Données asset invalides (bid/ask/stops)"
      });
      return { issues, patch: null, metrics };
    }

    const price = side === "BUY" ? ask : bid;
    const point = Math.pow(10, -digits);
    const minDist = stopsLevel * point;

    metrics.price = price;
    metrics.minDist = minDist;

    // ------------------------------------------------------------------------
    // CAS 1 — Aucun SL / TP → AUTORISÉ
    // ------------------------------------------------------------------------
    if (sl === 0 && tp === 0) {
      metrics.mode = "NO_SL_TP";
      return { issues, patch: null, metrics };
    }

    // ------------------------------------------------------------------------
    // Validation numérique
    // ------------------------------------------------------------------------
    if (
      (sl !== 0 && !Number.isFinite(sl)) ||
      (tp !== 0 && !Number.isFinite(tp))
    ) {
      issues.push({
        level: "BLOCK",
        code: "SLTP_INVALID",
        message: "SL/TP invalides"
      });
      return { issues, patch: null, metrics };
    }

    // ------------------------------------------------------------------------
    // Vérification du sens (UNIQUEMENT si SL / TP présents)
    // ------------------------------------------------------------------------
    if (sl !== 0) {
      const slOk =
        side === "BUY" ? sl < price : sl > price;

      if (!slOk) {
        issues.push({
          level: "BLOCK",
          code: "SL_SENSE",
          message: "SL incohérent avec le sens"
        });
        return { issues, patch: null, metrics };
      }

      if (Math.abs(price - sl) < minDist) {
        issues.push({
          level: "BLOCK",
          code: "SL_TOO_CLOSE",
          message: `SL trop proche (min ${minDist.toFixed(digits)})`
        });
        return { issues, patch: null, metrics };
      }
    }

    if (tp !== 0) {
      const tpOk =
        side === "BUY" ? tp > price : tp < price;

      if (!tpOk) {
        issues.push({
          level: "BLOCK",
          code: "TP_SENSE",
          message: "TP incohérent avec le sens"
        });
        return { issues, patch: null, metrics };
      }

      if (Math.abs(tp - price) < minDist) {
        issues.push({
          level: "BLOCK",
          code: "TP_TOO_CLOSE",
          message: `TP trop proche (min ${minDist.toFixed(digits)})`
        });
        return { issues, patch: null, metrics };
      }
    }

    // ------------------------------------------------------------------------
    // OK
    // ------------------------------------------------------------------------
    metrics.mode =
      sl !== 0 && tp !== 0
        ? "SL_TP"
        : sl !== 0
          ? "SL_ONLY"
          : "TP_ONLY";

    return { issues, patch: null, metrics };
  }
};

export default ValidateTPSL;
