// ============================================================================
// Performance Page — 2 colonnes 50/50
// Gauche : KPI stats + Open Positions
// Droite  : Closed Trades
// ============================================================================

import { useState, useCallback } from "react";

import useMT5Data       from "../../hooks/useMT5Data";
import useClosedTrades  from "../../hooks/useClosedTrades";

import PerformanceKPI   from "../matrixanalysis/Performance";
import OpenPositions    from "../terminalmt5/OpenPositions";
import ClosedTrades     from "../matrixanalysis/ClosedTrades";

import "../../styles/stylespages/performance.css";

export default function Performance() {
  const { data, ready, error } = useMT5Data();
  const { trades: allTrades, loading: tradesLoading } = useClosedTrades(5000);

  const [filteredTrades, setFilteredTrades] = useState([]);
  const handleFilteredTrades = useCallback(ft => setFilteredTrades(ft), []);

  if (error) return <div className="perf-page-state perf-page-error">MT5 connection error</div>;
  if (!ready || !data) return <div className="perf-page-state perf-page-loading">Waiting for MT5 snapshot…</div>;

  const account = data?.account ?? {};

  return (
    <div className="perf-page">

      {/* ── GAUCHE ── */}
      <div className="perf-page-col perf-page-left">
        <ClosedTrades
          trades={filteredTrades}
          loading={tradesLoading}
          account={account}
        />
      </div>

      {/* ── DROITE ── */}
      <div className="perf-page-col perf-page-right">
        <PerformanceKPI
          account={account}
          trades={allTrades}
          onFilteredTrades={handleFilteredTrades}
        />
        <OpenPositions />
      </div>

    </div>
  );
}
