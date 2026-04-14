import { useState, useCallback } from "react";

// hooks (remonter à src/)
import useMT5Data from "../../hooks/useMT5Data";
import useRobotCore from "../../hooks/useRobotCore";

// matrixanalysis components (déjà dans src/components)
import IndicatorsMatrix from "../matrixanalysis/IndicatorsMatrix";
import AccountLevels from "../matrixanalysis/AccountLevels";
import MarketTrend from "../matrixanalysis/MarketTrend";
import ConvergenceMultiTF from "../matrixanalysis/ConvergenceMultiTF";

// styles
import "../../styles/stylespages/matrixanalysis.css";

export default function MatrixAnalysis() {

  // ==================================================
  // HOOKS (ORDRE STRICT)
  // ==================================================
  const { data, ready, error } = useMT5Data();

  const snapshot = data ? {
    time: data.time ?? {},
    account: data.account ?? {},
    openPositions: data.openPositions ?? [],

    asset: data.asset ?? null,
    indicators: data.indicators ?? {},
    macro: data.macro ?? {},

    marketWatch: data.marketWatch ?? [],
  } : null;

  const robotData = useRobotCore(snapshot);

  // ==================================================
  // STATES
  // ==================================================
  if (error) {
    return <div className="ma-state ma-state-error">MT5 connection error</div>;
  }

  if (!ready || !data) {
    return <div className="ma-state ma-state-loading">Waiting for MT5 snapshot…</div>;
  }

  // ==================================================
  // PAGE
  // ==================================================
  return (
    <div className="ma-page">

      <div className="matrix-layout">

        <div className="matrix-col">
          <ConvergenceMultiTF snapshot={snapshot} robot={robotData} />
          <IndicatorsMatrix snapshot={snapshot} />
          <div className="matrix-bottom-row">
            <AccountLevels snapshot={snapshot} />
            <MarketTrend snapshot={snapshot} />
          </div>
        </div>

        <div className="matrix-col">
          <div className="ma-placeholder">Performance</div>
          <div className="ma-placeholder">Results</div>
        </div>

      </div>

    </div>
  );
}
