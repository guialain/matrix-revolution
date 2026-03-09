

import CapitalAllocation, { CLASS_WEIGHTS }
  from "../components/robot/engines/trading/CapitalAllocation";
import { getAssetClasses }
  from "../components/classification/AssetClassification";

export default function buildCapitalAllocation({ account, positions }) {
  const equity = Number(account?.equity);
  if (!Number.isFinite(equity) || equity <= 0) return [];

  const assetClasses = getAssetClasses();
  const exposure = CapitalAllocation.classExposure(positions);

  const maxWeight = Math.max(...Object.values(CLASS_WEIGHTS));

  return assetClasses.map((assetClass) => {
    const usedNotional = exposure?.[assetClass] ?? 0;
    const capacity = CapitalAllocation.classCapacity({ equity, assetClass });
    const weight = CLASS_WEIGHTS[assetClass] ?? 0;

    return {
      assetClass,
      weight,
      heightRatio: weight / maxWeight,     // 👈 hauteur relative du tube
      usedRatio:
  capacity > 0
    ? Math.min(usedNotional / capacity, 1)
    : 0,

      usedNotional,
      capacity,
      empty: usedNotional === 0
    };
  });
}
