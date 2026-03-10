// ============================================================================
// TopOpportunities.jsx — Ranked opportunity cards with score breakdown
// ============================================================================

import "../../styles/marketopportunities/topopportunities.css";

/* ─── formatters ──────────────────────────────────────────────────────────── */

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

/* ─── BreakdownBar ────────────────────────────────────────────────────────── */

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

/* ─── NeoOpportunityLine ──────────────────────────────────────────────────── */

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

/* ─── TopOpportunities ────────────────────────────────────────────────────── */

export default function TopOpportunities({ opportunities }) {
  const list = opportunities?.list ?? [];

  return (
    <>
      <div className="neo-title neo-title-section">TOP OPPORTUNITIES</div>

      {!list.length ? (
        <div className="neo-muted">No exploitable opportunities</div>
      ) : (
        <div className="neo-op-list">
          {list.slice(0, 6).map((op, i) => (
            <NeoOpportunityLine key={i} op={op} />
          ))}
        </div>
      )}
    </>
  );
}

export { fmtScore, NeoOpportunityLine };
