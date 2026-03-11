// ============================================================================
// TERMINAL MT5 — PAGE
// Rôle : Orchestration UI MT5
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
const API_BASE = window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin;

// hooks
import useRobotCore from "../../hooks/useRobotCore";
import useExposureByAsset from "../../hooks/useExposureByAsset";
import buildCapitalAllocation from "../../hooks/buildCapitalAllocation";

// components
import DealPipeline from "../terminalmt5/DealPipeline";
import DealingRoom from "../terminalmt5/DealingRoom";
import OpenPositions from "../terminalmt5/OpenPositions";
import ExposureDistribution from "../terminalmt5/ExposureDistribution";
import AccountHealth from "../terminalmt5/AccountHealth";
import CapitalAllocationPanel from "../terminalmt5/CapitalAllocation";

// styles
import "../../styles/stylespages/terminalmt5.css";

export default function TerminalMT5({ snapshot }) {

  // ==========================================================================
  // HOOKS (must be called unconditionally, before any return)
  // ==========================================================================

  const robot = useRobotCore(snapshot);

  const { rows: exposureData, total: totalExposure } =
    useExposureByAsset(snapshot, { topN: 7, minPct: 0.03 });

  const account = snapshot?.account;

  const capitalAllocation = useMemo(
    () =>
      buildCapitalAllocation({
        account,
        positions: snapshot?.openPositions
      }),
    [account, snapshot?.openPositions]
  );

  const [draftDeal, setDraftDeal] = useState(null);
  const [dealLocked, setDealLocked] = useState(false);

  // ==========================================================================
  // GUARD (after all hooks)
  // ==========================================================================
  if (!snapshot || !account) return null;

  function handleSelectDeal(op) {
    if (!op?.symbol) return;

    setDraftDeal(op);
    setDealLocked(true);

    fetch(`${API_BASE}/api/mt5switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: op.symbol })
    }).catch(() => {});
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="terminal-mt5-grid">

      {/* ================= LEFT ================= */}
      <div className="left-column">

        <div className="left-top-row">
          <div className="terminal-block pipeline">
            <DealPipeline
              robot={robot}
              onSelectDeal={handleSelectDeal}
            />
          </div>

          <div className="terminal-block dealing">
            <DealingRoom
              robot={robot}
              draftDeal={draftDeal}
              dealLocked={dealLocked}
              onOrderSent={() => { setDraftDeal(null); setDealLocked(false); }}
            />
          </div>
        </div>

        <div className="left-bottom-row">

          <div className="terminal-block account-health">
            <AccountHealth
              account={account}
              totalExposure={totalExposure}
            />
          </div>

          <div className="terminal-block exposure-distribution">
           <ExposureDistribution exposureData={exposureData} />

          </div>

        </div>
      </div>

      {/* ================= RIGHT ================= */}
      <div className="right-column">

        <div className="terminal-block open-positions">
          <OpenPositions />
        </div>

        <div className="terminal-block capital-allocation">
          <CapitalAllocationPanel allocation={capitalAllocation} />
        </div>

      </div>
    </div>
  );
}
