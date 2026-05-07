// ============================================================================
// MatrixAnalysis.jsx — Layout 3 colonnes 25 / 50 / 25
//   Gauche : LIVE NEWS (NewsFeed + filtres chips ECB/Fed/Macro/Geo)
//   Centre : Robot compact + Top Opportunities + Wait M5 + Active Position
//   Droite : ASSETS TRENDS (ZoneClassification, pills cliquables)
// ============================================================================

import { useState, useCallback } from "react";

import useMT5Data    from "../../hooks/useMT5Data";
import useRobotCore  from "../../hooks/useRobotCore";
import useRobotState from "../../hooks/useRobotState";
import { TRADABLE_SYMBOLS } from "../../config/allowedSymbols";

// composants réutilisés (marketopportunities)
import NewsFeed                          from "../marketopportunities/NewsFeed";
import TopOpportunities                  from "../marketopportunities/TopOpportunities";
import ZoneClassification, { classifyOpp } from "../marketopportunities/ZoneClassification";

// composants spécifiques Matrix Analysis
import RobotCompact   from "../matrixanalysis/RobotCompact";
import WaitM5         from "../matrixanalysis/WaitM5";
import ActivePosition from "../matrixanalysis/ActivePosition";

import "../../styles/stylespages/matrixanalysis.css";

// ─── Filtres news (matching keyword client-side) ───────────────────────────
const NEWS_FILTERS = [
  { key: "All",   label: "All",   regex: null },
  { key: "ECB",   label: "ECB",   regex: /ECB|euro central|lagarde|christine/i },
  { key: "Fed",   label: "Fed",   regex: /\bFed\b|FOMC|powell|jerome/i },
  { key: "Macro", label: "Macro", regex: /CPI|GDP|PMI|jobs|payroll|inflation|unemployment/i },
  { key: "Geo",   label: "Geo",   regex: /Russia|Ukraine|China|Taiwan|Israel|Iran|\bwar\b|sanction/i },
];

// ─── Compteurs zones pour empty state TopOpportunities ─────────────────────
function computeZoneCounts(topOpps) {
  const counts = { EXH_BUY: 0, EXH_SELL: 0, CONT_BUY: 0, CONT_SELL: 0, GRISE: 0 };
  const list = topOpps?.list ?? [];
  for (const opp of list) {
    if (opp?.engine !== "V10R") continue;
    const r = classifyOpp(opp);
    if (!r) continue;
    if (r.bucket in counts) counts[r.bucket]++;
  }
  return counts;
}

export default function MatrixAnalysis() {
  const { data, ready, error } = useMT5Data();

  const snapshot = data ? {
    time:          data.time ?? {},
    account:       data.account ?? {},
    openPositions: data.openPositions ?? [],
    asset:         data.asset ?? null,
    macro:         data.macro ?? {},
    marketWatch:   data.marketWatch ?? [],
  } : null;

  const core       = useRobotCore(snapshot);
  const robotState = useRobotState(snapshot);

  // Highlight transitoire d'une card depuis un click pill ASSETS TRENDS
  const [highlightedSymbol, setHighlightedSymbol] = useState(null);

  const handlePillClick = useCallback((symbol) => {
    if (!symbol) return;
    setHighlightedSymbol(symbol);
    // scroll vers la card si présente dans le DOM
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-mo-symbol="${symbol}"]`);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    setTimeout(() => setHighlightedSymbol(null), 1500);
  }, []);

  if (error) {
    return <div className="ma-state ma-state-error">MT5 connection error</div>;
  }
  if (!ready || !data) {
    return <div className="ma-state ma-state-loading">Waiting for MT5 snapshot…</div>;
  }

  const validOpportunities = core?.validOpportunities ?? [];
  const waitOpportunities  = core?.waitOpportunities  ?? [];
  const topOpportunities   = core?.topOpportunities   ?? { list: [], blocked: [] };
  const zoneCounts         = computeZoneCounts(topOpportunities);
  const activePos          = data.openPositions?.[0] ?? null;

  return (
    <div className="ma-page">
      <div className="ma-grid">

        {/* ═══ GAUCHE 25% — LIVE NEWS ═══ */}
        <aside className="ma-col ma-col-news">
          <NewsFeed filters={NEWS_FILTERS} defaultFilter="All" />
        </aside>

        {/* ═══ CENTRE 50% — Zone actionnable ═══ */}
        <main className="ma-col ma-col-center">
          <RobotCompact
            state={robotState.state}
            reason={robotState.reason}
            symbolCount={TRADABLE_SYMBOLS.length}
          />
          <div className="ma-center-scrollable">
            <section className="ma-center-card">
              <TopOpportunities
                validOpportunities={validOpportunities}
                waitOpportunities={waitOpportunities}
                emptyStats={zoneCounts}
                symbolCount={TRADABLE_SYMBOLS.length}
                highlightedSymbol={highlightedSymbol}
              />
            </section>
            <section className="ma-center-card">
              <WaitM5 waitOpportunities={waitOpportunities} />
            </section>
            {activePos && (
              <section className="ma-center-card">
                <ActivePosition position={activePos} />
              </section>
            )}
          </div>
        </main>

        {/* ═══ DROITE 25% — ASSETS TRENDS ═══ */}
        <aside className="ma-col ma-col-trends">
          <ZoneClassification
            topOpportunities={topOpportunities}
            onPillClick={handlePillClick}
          />
        </aside>

      </div>
    </div>
  );
}
