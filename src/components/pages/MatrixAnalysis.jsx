// hooks (remonter à src/)
import useMT5Data from "../../hooks/useMT5Data";
import useRobotCore from "../../hooks/useRobotCore";
import { sendSwitchSymbol } from "../../utilitaires/sendMT5Instructions";

// matrixanalysis components (déjà dans src/components)
import NeomatrixMTAnalysis from "../matrixanalysis/NeomatrixMTAnalysis";
import AccountLevels from "../matrixanalysis/AccountLevels";
import MarketTrend from "../matrixanalysis/MarketTrend";
import MarketWatch from "../matrixanalysis/MarketWatch";

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
    macro: data.macro ?? {},

    marketWatch: data.marketWatch ?? [],
  } : null;

  const core = useRobotCore(snapshot);

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
          <NeomatrixMTAnalysis snapshot={snapshot} />
          <div className="matrix-bottom-row">
            <AccountLevels snapshot={snapshot} />
            <MarketTrend snapshot={snapshot} />
          </div>
        </div>

        <div className="matrix-col">
          <MarketWatch
            onSwitchSymbol={sendSwitchSymbol}
            topOpportunities={core?.topOpportunities ?? null}
          />
        </div>

      </div>

    </div>
  );
}
