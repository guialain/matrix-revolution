import { useMemo } from "react";
import { getRiskConfig } from "../components/robot/engines/config/RiskConfig";

// ============================================================================
// Exposure Engine — EUR based
// ============================================================================

const DEFAULT_COLORS = [
  "#f1c40f",
  "#9b59b6",
  "#bdc3c7",
  "#3498db",
  "#e67e22",
  "#1abc9c"
];

// ----------------------------------------------------------------------------
// CORE ENGINE
// ----------------------------------------------------------------------------
function computeExposureByAsset(positions, options = {}) {
  if (!Array.isArray(positions) || positions.length === 0) {
    return { rows: [], total: 0 };
  }

  const { topN = 6, minPct = 0.03 } = options;

  // ----------------------------------------------------------
  // 1. Agrégation par SYMBOL + SIDE
  // ----------------------------------------------------------
  const exposureMap = {};

  positions.forEach(pos => {
    const { symbol, side } = pos;
    const fallback = pos.volume && pos.price && pos.contract_size
      ? pos.volume * pos.price * Number(pos.contract_size) * (getRiskConfig(symbol)?.baseToEUR ?? 1)
      : 0;
    const expo = Math.abs(
      Number(pos.notional_eur ?? pos.notional ?? pos.exposure ?? fallback)
    );

    if (!symbol || !side || expo <= 0) return;

    if (!exposureMap[symbol]) {
      exposureMap[symbol] = { BUY: 0, SELL: 0 };
    }

    exposureMap[symbol][side] += expo;
  });

  // ----------------------------------------------------------
  // 2. Flatten + total
  // ----------------------------------------------------------
  let flat = [];
  let total = 0;

  Object.entries(exposureMap).forEach(([symbol, sides]) => {
    Object.entries(sides).forEach(([side, value]) => {
      if (value > 0) {
        flat.push({
          symbol,
          side,
          key: `${symbol} ${side}`,
          value
        });
        total += value;
      }
    });
  });

  if (total <= 0) return { rows: [], total: 0 };

  // ----------------------------------------------------------
  // 3. Normalisation + tri
  // ----------------------------------------------------------
  flat = flat
    .map(r => ({ ...r, ratio: r.value / total }))
    .sort((a, b) => b.value - a.value);

  // ----------------------------------------------------------
  // 4. Top N + Others
  // ----------------------------------------------------------
  const main = flat.slice(0, topN);
  const rest = flat.slice(topN);

  let result = [];
  let otherValue = 0;

  main.forEach((r, i) => {
    if (r.ratio >= minPct) {
      result.push({
        ...r,
        color: DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      });
    } else {
      otherValue += r.value;
    }
  });

  rest.forEach(r => {
    otherValue += r.value;
  });

  if (otherValue > 0) {
    result.push({
      key: "Others",
      value: otherValue,
      ratio: otherValue / total,
      color: "#3498db"
    });
  }

  return { rows: result, total };
}

// ----------------------------------------------------------------------------
// HOOK
// ----------------------------------------------------------------------------
export default function useExposureByAsset(mt5Data, options = {}) {
  const stableOptions = useMemo(
    () => ({
      topN: options.topN ?? 6,
      minPct: options.minPct ?? 0.03
    }),
    [options.topN, options.minPct]
  );

  return useMemo(() => {
    if (!mt5Data || !Array.isArray(mt5Data.openPositions)) {
      return { rows: [], total: 0 };
    }

    return computeExposureByAsset(
      mt5Data.openPositions,
      stableOptions
    );
  }, [mt5Data?.openPositions, stableOptions]);
}
