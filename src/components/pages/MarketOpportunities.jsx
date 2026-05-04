// ============================================================================
// MarketOpportunities.jsx
// Cross-asset scanner: Top Opportunities + Market Watch + Not Eligible
// ============================================================================

import React from "react";
import useMT5Data from "../../hooks/useMT5Data";
import useRobotCore from "../../hooks/useRobotCore";
import NewsFeed from "../marketopportunities/NewsFeed";
import TopOpportunities from "../marketopportunities/TopOpportunities";
import RobotNeo from "../marketopportunities/RobotNeo";
import { sendSwitchSymbol } from "../../utilitaires/sendMT5Instructions";
import "../../styles/stylespages/marketopportunities.css";

/* =====================================================
   MAIN COMPONENT — MarketOpportunities
   ===================================================== */
export default function MarketOpportunities() {

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

  function handleSwitchSymbol(symbol) {
    if (!symbol) return;
    sendSwitchSymbol(symbol);
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500 bg-black">
        MT5 connection error
      </div>
    );
  }

  if (!ready || !data) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 bg-black">
        Waiting for MT5 snapshot…
      </div>
    );
  }

  const topOpportunities = core?.topOpportunities ?? { list: [], blocked: [] };
  const waitOpportunities = core?.waitOpportunities ?? [];

  return (
    <div className="mo-page">

      {/* ====== LEFT (40%) — NEWS FEED ====== */}
      <section className="mo-section mo-market-watch">
        <NewsFeed />
      </section>

      {/* ====== CENTER (20%) — Robot + Wait + Zone Classification ====== */}
      <RobotNeo
        waitOpportunities={waitOpportunities}
        topOpportunities={topOpportunities}
      />

      {/* ====== RIGHT (40%) — TOP OPPORTUNITIES ====== */}
      <section className="mo-section mo-opportunities">
        <TopOpportunities opportunities={topOpportunities} />
      </section>

    </div>
  );
}
