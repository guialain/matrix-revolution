// ============================================================================
// RobotNeo.jsx — Robot image + Wait opportunities + Zone Classification
// ============================================================================

import { fmtScore } from "./TopOpportunities";
import ZoneClassification from "./ZoneClassification";
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
            const typeShort = type === "CONTINUATION" ? "CONT" : type === "EXHAUSTION" ? "EXH" : type;
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

/* ─── RobotNeo ────────────────────────────────────────────────────────────── */

export default function RobotNeo({ waitOpportunities, topOpportunities }) {
  return (
    <div className="rc-container">
      <section className="mo-section rc-robot">
        <img src="/neo.png" alt="Neo Robot" className="rc-robot-img" />
      </section>

      <WaitSection opportunities={waitOpportunities} />
      <ZoneClassification topOpportunities={topOpportunities} />
    </div>
  );
}
