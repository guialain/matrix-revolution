// ============================================================================
// RobotNeo.jsx — Robot image + Wait opportunities + Not Eligible
// ============================================================================

import { fmtScore } from "./TopOpportunities";
import "../../styles/marketopportunities/robotneo.css";

/* ─── WaitSection ─────────────────────────────────────────────────────────── */

function WaitSection({ opportunities }) {
  return (
    <section className="mo-section rc-wait">
      <div className="neo-title neo-title-section">
        WAIT
        <span className="rc-wait-count">{opportunities.length}</span>
      </div>

      {!opportunities.length ? (
        <div className="neo-muted">No opportunity waiting confirmation</div>
      ) : (
        <div className="neo-op-list">
          {opportunities.slice(0, 6).map((op, i) => {
            const type      = String(op.type ?? "").toUpperCase();
            const typeShort = type === "CONTINUATION" ? "CONT" : type === "REVERSAL" ? "REV" : type;
            const waitState = String(op.state ?? "").replace(/^WAIT_/, "");

            return (
              <div key={i} className="neo-op-card rc-wait-card">
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
  );
}

/* ─── NotEligibleSection ──────────────────────────────────────────────────── */

function resolveBlockReason(op) {
  const eligible = op.eligibility?.eligible;
  const reasons  = op.eligibility?.reasons ?? [];

  // Not eligible → use eligibility reason
  if (!eligible && reasons.length > 0) return reasons[0];
  if (!eligible) return "Not eligible";

  // Eligible but blocked by score
  const score = op.score ?? 0;
  if (score < 5) return `Low score (${Math.round(score)})`;

  return "Unknown";
}

function NotEligibleSection({ blocked }) {
  return (
    <section className="mo-section rc-not-eligible">
      <div className="neo-title rc-not-eligible-title">NOT ELIGIBLE</div>

      {blocked.length > 0 ? (
        <div className="rc-ne-lines">
          {blocked.slice(0, 6).map((op, i) => {
            const reason   = resolveBlockReason(op);
            const volLevel = op.eligibility?.context?.volatilityLevel ?? null;

            return (
              <div key={i} className="rc-ne-line">
                <span className="neo-op-symbol">{op.symbol}</span>
                <span className="rc-ne-reason" data-reason={reason}>
                  {reason}
                </span>
                {volLevel && (
                  <span className={`rc-ne-vol rc-ne-vol-${volLevel.toLowerCase()}`}>
                    {volLevel}
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
  );
}

/* ─── RobotNeo ────────────────────────────────────────────────────────────── */

export default function RobotNeo({ waitOpportunities, blocked }) {
  return (
    <div className="rc-container">
      <section className="mo-section rc-robot">
        <img src="/neo.png" alt="Neo Robot" className="rc-robot-img" />
      </section>

      <WaitSection opportunities={waitOpportunities} />
      <NotEligibleSection blocked={blocked} />
    </div>
  );
}
