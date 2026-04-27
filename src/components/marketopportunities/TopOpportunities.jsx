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
  const typeShort = type === "CONTINUATION" ? "CONT" : type === "EXHAUSTION" ? "EXH" : type;

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
          <BreakdownBar label="RSI"         value={breakdown.c1_rsi ?? 0}                                                                  max={3} />
          <BreakdownBar label="Bollinger"   value={breakdown.c2_zscore ?? 0}                                                               max={5} />
          <BreakdownBar label="Momentum H1" value={(breakdown.c3a_slope_s1 ?? 0) + (breakdown.c3b_slope_s0 ?? 0) + (breakdown.c4_dslope ?? 0)} max={9} />
          <BreakdownBar label="Volatility"  value={breakdown.c5_volatility ?? 0}                                                           max={4} />
          <BreakdownBar label="Intraday %"  value={breakdown.c6_intraday ?? 0}                                                             max={4} />
          <BreakdownBar label="Daily Trend" value={(breakdown.c7_alignment ?? 0) + (breakdown.c8_mode ?? 0)}                                max={8} />
        </div>
      )}
    </div>
  );
}

/* ─── TopOpportunities ────────────────────────────────────────────────────── */

export default function TopOpportunities({ opportunities }) {
  const list = opportunities?.list ?? [];
  const tradable = list.filter(op =>
    !op?.isWait && op?.route !== "WAIT" && op?.type !== "WAIT"
  );

  return (
    <>
      <div className="neo-title neo-title-section">TOP OPPORTUNITIES</div>

      {!tradable.length ? (
        <div className="neo-muted">No exploitable opportunities</div>
      ) : (
        <div className="neo-op-list">
          {tradable.slice(0, 6).map((op, i) => (
            <NeoOpportunityLine key={i} op={op} />
          ))}
        </div>
      )}
    </>
  );
}

export { fmtScore, NeoOpportunityLine };
