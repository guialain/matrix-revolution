// ============================================================================
// ValidateSize.js
// - vérifie lots (min/max/step)
// - calcule notional_eur estimé
// - propose auto-fix (lots) si besoin
// ============================================================================

function roundToStepDown(value, step) {
  return Math.floor(value / step) * step;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const ValidateSize = {

  run({ draft, asset }) {
    const issues = [];
    const metrics = {};

    if (!draft?.symbol || !draft?.side) {
      issues.push({ level: "BLOCK", code: "DRAFT_INCOMPLETE", message: "Trade incomplet (symbol/side)" });
      return { issues, patch: null, metrics };
    }

    const price = draft.side === "BUY" ? Number(asset?.ask) : Number(asset?.bid);
    const cs = Number(asset?.contract_size);

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cs) || cs <= 0) {
      issues.push({ level: "BLOCK", code: "PRICE_CONTRACT_INVALID", message: "Prix/contract_size invalide" });
      return { issues, patch: null, metrics };
    }

    const volMin  = Number(asset?.volume_min);
    const volMax  = Number(asset?.volume_max);
    const volStep = Number(asset?.volume_step);

    if (![volMin, volMax, volStep].every(Number.isFinite) || volMin <= 0 || volMax <= 0 || volStep <= 0) {
      issues.push({ level: "BLOCK", code: "VOLUME_RULES_INVALID", message: "Contraintes de volume broker invalides" });
      return { issues, patch: null, metrics };
    }

    let lots = Number(draft?.lots);
    if (!Number.isFinite(lots) || lots <= 0) {
      issues.push({ level: "BLOCK", code: "LOTS_INVALID", message: "Lots invalide" });
      return { issues, patch: null, metrics };
    }

    // enforce step (down, broker-safe)
    let fixedLots = roundToStepDown(lots, volStep);
    fixedLots = clamp(fixedLots, volMin, volMax);

    const changed = Math.abs(fixedLots - lots) > 1e-12;
    if (changed) {
      issues.push({ level: "WARN", code: "LOTS_ADJUSTED_TO_BROKER", message: "Lots ajustés aux contraintes broker" });
    }

    const notional = fixedLots * cs * price;

    metrics.price = price;
    metrics.contractSize = cs;
    metrics.notional_eur = notional;
    metrics.lots = fixedLots;

    return {
      issues,
      patch: changed ? { lots: Number(fixedLots.toFixed(Math.max(0, Math.ceil(-Math.log10(volStep))))), notional_eur: notional } : { notional_eur: notional },
      metrics
    };
  }
};

export default ValidateSize;
