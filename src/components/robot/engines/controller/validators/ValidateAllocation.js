import CapitalAllocation from "../../trading/CapitalAllocation";


const ValidateAllocation = {
  run({ draft, account, openPositions }) {
    const issues = [];
    const metrics = {};

    const equity = Number(account?.equity);
    if (!Number.isFinite(equity) || equity <= 0) {
      issues.push({
        level: "BLOCK",
        code: "EQUITY_INVALID",
        message: "Equity invalide"
      });
      return { issues, patch: null, metrics };
    }

    const newNotional = Number(draft?.notional_eur);
    if (!Number.isFinite(newNotional) || newNotional <= 0) {
      issues.push({
        level: "BLOCK",
        code: "NOTIONAL_INVALID",
        message: "Notional invalide"
      });
      return { issues, patch: null, metrics };
    }

    const alloc = CapitalAllocation.checkTrade({
      symbol: draft.symbol,
      newNotional,
      equity,
      openPositions
    });

    metrics.allocation = {
      assetClass: alloc.assetClass,
      capacity: alloc.capacity,
      current: alloc.current,
      remaining: alloc.remaining,
      usageRatio: alloc.usageRatio
    };

    if (!alloc.allowed) {
      issues.push({
        level: "BLOCK",
        code: alloc.reason ?? "ALLOCATION_BLOCK",
        message: `Allocation ${alloc.assetClass} saturée`
      });
      return { issues, patch: null, metrics };
    }

    if (alloc.reduced) {
      issues.push({
        level: "WARN",
        code: "ALLOCATION_NEAR_LIMIT",
        message: `Allocation ${alloc.assetClass} presque pleine`
      });
      metrics.maxNotionalAllowed = alloc.remaining;
    }

    return { issues, patch: null, metrics };
  }
};

export default ValidateAllocation;
