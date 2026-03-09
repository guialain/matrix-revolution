// ============================================================================
// MarketOpportunities.jsx
// Cross-asset scanner: Top Opportunities + Market Watch + Not Eligible
// ============================================================================

import React from "react";
import useMT5Data from "../../hooks/useMT5Data";
import useRobotCore from "../../hooks/useRobotCore";
import TopMovers from "../matrixanalysis/TopMovers";
import { sendSwitchSymbol } from "../../utilitaires/sendMT5Instructions";
import "../../styles/stylespages/marketopportunities.css";

/* =====================================================
   UTILS — formatters
   ===================================================== */

function fmtScore(v) {
  if (!Number.isFinite(v)) return <span className="score-na">?</span>;
  const rounded = Math.round(v);
  const cls = v > 0 ? "score-pos" : v < 0 ? "score-neg" : "score-zero";
  return (
    <span className={cls}>
      {rounded > 0 ? "+" : ""}{rounded}
    </span>
  );
}

function fmtIntraday(v) {
  if (!Number.isFinite(v)) return null;
  const cls = v > 0 ? "intraday-pos" : v < 0 ? "intraday-neg" : "intraday-zero";
  return (
    <span className={`neo-intraday ${cls}`}>
      {v > 0 ? "▲" : v < 0 ? "▼" : "—"}{Math.abs(v).toFixed(2)}%
    </span>
  );
}

/* =====================================================
   SOUS-COMPONENT — BreakdownBar
   ===================================================== */
function BreakdownBar({ label, value, max }) {
  const pct   = Math.min(Math.abs(value ?? 0) / max, 1) * 100;
  const isNeg = (value ?? 0) < 0;
  return (
    <div className="bk-item">
      <span className="bk-label">{label}</span>
      <div className="bk-track">
        <div
          className={`bk-fill ${isNeg ? "bk-neg" : "bk-pos"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`bk-val ${isNeg ? "score-neg" : "score-pos"}`}>
        {(value ?? 0) > 0 ? "+" : ""}{Math.round(value ?? 0)}
      </span>
    </div>
  );
}

/* =====================================================
   SOUS-COMPONENT — NeoOpportunityLine
   ===================================================== */
function NeoOpportunityLine({ op }) {
  if (!op) return null;

  const type      = String(op.type ?? "").toUpperCase();
  const phase     = op.signalPhase ?? op.signalType ?? "";
  const intraday  = op.intraday_change ?? null;
  const breakdown = op.score_breakdown ?? op.breakdown ?? null;
  const typeShort = type === "CONTINUATION" ? "CONT" : type === "REVERSAL" ? "REV" : type;

  return (
    <div className="neo-op-card">
      <div className="neo-op-row">
        <span className="neo-op-symbol">{op.symbol}</span>
        <span className={`neo-op-side ${(op.side ?? "").toLowerCase()}`}>
          {op.side}
        </span>
        <span className="neo-op-score">
          {fmtScore(op.score)}
        </span>
        <span className="neo-op-meta">
          <span className={`neo-op-type neo-op-type-${type.toLowerCase()}`}>
            {typeShort}
          </span>
          {phase && (
            <span className="neo-op-phase">
              {phase.replace(/_/g, " ")}
            </span>
          )}
          {fmtIntraday(intraday)}
        </span>
      </div>

      {breakdown && (
        <div className="neo-op-breakdown">
          <BreakdownBar label="RSI"   value={breakdown.rsiScore}        max={30} />
          <BreakdownBar label="BBZ"   value={breakdown.zscoreScore}     max={20} />
          <BreakdownBar label="SLP"   value={breakdown.slopeScore}      max={20} />
          <BreakdownBar label="dSLP"  value={breakdown.dslopeScore}     max={10} />
          <BreakdownBar label="VOL"   value={breakdown.volatilityScore} max={10} />
          <BreakdownBar label="INTRA" value={breakdown.intradayScore}   max={25} />
        </div>
      )}
    </div>
  );
}

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
    indicators: data.indicators ?? {},
    macro: data.macro ?? {},
    topMovers:   data.topMovers   ?? null,
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
  const blocked = topOpportunities.blocked ?? [];
  const waitOpportunities = core?.waitOpportunities ?? [];

  return (
    <div className="mo-page">

      {/* ====== LEFT (40%) — MARKET WATCH ====== */}
      <section className="mo-section mo-market-watch">
        <TopMovers onSwitchSymbol={handleSwitchSymbol} />
      </section>

      {/* ====== CENTER (20%) — Robot + Not Eligible ====== */}
      <div className="mo-center">

        <section className="mo-section mo-robot">
          <img src="/neo.png" alt="Neo Robot" className="mo-robot-img" />
        </section>

        <section className="mo-section mo-wait">
          <div className="neo-title neo-title-section">
            WAIT
            <span className="mo-wait-count">{waitOpportunities.length}</span>
          </div>

          {!waitOpportunities.length ? (
            <div className="neo-muted">No opportunity waiting confirmation</div>
          ) : (
            <div className="neo-op-list">
              {waitOpportunities.slice(0, 6).map((op, i) => {
                const type      = String(op.type ?? "").toUpperCase();
                const typeShort = type === "CONTINUATION" ? "CONT" : type === "REVERSAL" ? "REV" : type;
                const waitState = String(op.state ?? "").replace(/^WAIT_/, "");

                return (
                  <div key={i} className="neo-op-card mo-wait-card">
                    <div className="neo-op-row">
                      <span className="neo-op-symbol">{op.symbol}</span>
                      <span className={`neo-op-side ${(op.side ?? "").toLowerCase()}`}>
                        WAIT-{op.side}
                      </span>
                      <span className="neo-op-score">{fmtScore(op.score)}</span>
                      <span className="neo-op-meta">
                        <span className={`neo-op-type neo-op-type-${type.toLowerCase()}`}>
                          {typeShort}
                        </span>
                        <span className="neo-op-phase">{waitState}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mo-section mo-not-eligible">
          <div className="neo-title not-eligible">NOT ELIGIBLE</div>

          {blocked.length > 0 ? (
            <div className="neo-not-eligible-lines">
              {blocked.slice(0, 6).map((op, i) => {
                const volLevel = op.eligibility?.context?.volatilityLevel ?? null;
                const volRatio = op.eligibility?.context?.volatilityRatio ?? null;

                return (
                  <div key={i} className="neo-not-eligible-line">
                    <span className="neo-op-symbol">
                      {op.symbol}
                    </span>
                    <span
                      className="neo-not-eligible-reason"
                      data-reason={(op.eligibility?.reasons ?? ["Unknown"])[0]}
                    >
                      {(op.eligibility?.reasons ?? ["Unknown"])[0]}
                    </span>
                    {volLevel && (
                      <span
                        className={`neo-vol neo-vol-${volLevel.toLowerCase()}`}
                        title={volRatio != null ? `ATR M15 / Spread = ${volRatio}` : undefined}
                      >
                        {volLevel}
                        {volRatio != null && ` (${volRatio})`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="neo-muted">No blocked opportunities</div>
          )}
        </section>

      </div>

      {/* ====== RIGHT (40%) — TOP OPPORTUNITIES ====== */}
      <section className="mo-section mo-opportunities">
        <div className="neo-title neo-title-section">TOP OPPORTUNITIES</div>

        {!topOpportunities.list?.length ? (
          <div className="neo-muted">No exploitable opportunities</div>
        ) : (
          <div className="neo-op-list">
            {topOpportunities.list.slice(0, 6).map((op, i) => (
              <NeoOpportunityLine key={i} op={op} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
