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

function NeoOpportunityLine({ op, dim = false }) {
  if (!op) return null;

  const type      = String(op.type ?? "").toUpperCase();
  const phase     = op.signalPhase ?? op.signalType ?? "";
  const intraday  = op.intraday_change ?? null;
  const breakdown = op.score_breakdown ?? op.breakdown ?? null;
  const typeShort = type === "CONTINUATION" ? "CONT" : type === "EXHAUSTION" ? "EXH" : type;

  return (
    <div className={`neo-op-card ${dim ? 'neo-op-card-dim' : ''}`}>
      {dim && <span className="neo-op-card-dot" />}
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
          <BreakdownBar label="Bollinger"   value={breakdown.c2_zscore ?? 0}                                                               max={8} />
          <BreakdownBar label="Momentum H1" value={(breakdown.c3a_slope_s1 ?? 0) + (breakdown.c3b_slope_s0 ?? 0) + (breakdown.c4_dslope ?? 0)} max={10} />
          <BreakdownBar label="Volatility"  value={breakdown.c5_volatility ?? 0}                                                           max={4} />
          <BreakdownBar label="Intraday %"  value={breakdown.c6_intraday ?? 0}                                                             max={4} />
          <BreakdownBar label="Daily Trend" value={breakdown.c7_alignment ?? 0}                                                            max={4} />
        </div>
      )}
    </div>
  );
}

/* ─── TopOpportunities ────────────────────────────────────────────────────── */

const M5_WAIT_STATES = new Set(['WAIT_M5_OVEREXTENDED', 'WAIT_M5_SETUP']);

export default function TopOpportunities({ validOpportunities = [], waitOpportunities = [] }) {
  const valids = [...validOpportunities].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const waitsM5 = waitOpportunities
    .filter(op => M5_WAIT_STATES.has(op.state))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const display = [
    ...valids.map(op => ({ op, dim: false })),
    ...waitsM5.map(op => ({ op, dim: true })),
  ];

  return (
    <>
      <div className="neo-title neo-title-section">TOP OPPORTUNITIES</div>

      {!display.length ? (
        <div className="neo-muted">No exploitable opportunities</div>
      ) : (
        <div className="neo-op-list">
          {display.slice(0, 6).map(({ op, dim }, i) => (
            <NeoOpportunityLine key={i} op={op} dim={dim} />
          ))}
        </div>
      )}
    </>
  );
}

export { fmtScore, NeoOpportunityLine };
