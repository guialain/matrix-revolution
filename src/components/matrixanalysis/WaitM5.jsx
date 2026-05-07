// ============================================================================
// WaitM5.jsx — Countdown next M5 close + opportunités en attente confirmation
// Toujours visible, jamais hidden.
// ============================================================================

import { useState, useEffect } from "react";

const M5_WAIT_STATES = new Set(["WAIT_M5_OVEREXTENDED", "WAIT_M5_SETUP"]);

function nextM5Seconds(now) {
  const sec = now.getSeconds();
  const min = now.getMinutes();
  const minToNext = (5 - (min % 5)) % 5;
  if (minToNext === 0) {
    return sec === 0 ? 0 : (5 * 60 - sec);
  }
  return minToNext * 60 - sec;
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function WaitM5({ waitOpportunities = [] }) {
  const [secs, setSecs] = useState(nextM5Seconds(new Date()));

  useEffect(() => {
    const id = setInterval(() => setSecs(nextM5Seconds(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const m5Waits = waitOpportunities.filter(op => M5_WAIT_STATES.has(op?.state));

  return (
    <div className="ma-wait-m5">
      <div className="ma-wait-m5-header">
        <span className="ma-wait-m5-title">WAIT M5</span>
        <span className="ma-wait-m5-count">{m5Waits.length}</span>
        <span className="ma-wait-m5-spacer" />
        <span className="ma-wait-m5-countdown">next close · {fmt(secs)}</span>
      </div>
      {m5Waits.length === 0 ? (
        <div className="ma-wait-m5-empty">No M5 confirmation pending</div>
      ) : (
        <div className="ma-wait-m5-list">
          {m5Waits.slice(0, 6).map((op, i) => {
            const stateShort = String(op.state ?? "").replace(/^WAIT_/, "");
            const type       = String(op.type ?? "").toUpperCase();
            const typeShort  = type === "CONTINUATION" ? "CONT" : type === "EXHAUSTION" ? "EXH" : type;
            return (
              <div key={i} className="ma-wait-m5-item">
                <span className="ma-wait-m5-sym">{op.symbol}</span>
                <span className={`ma-wait-m5-side ma-wait-m5-side-${(op.side ?? "").toLowerCase()}`}>
                  {op.side}
                </span>
                <span className={`ma-wait-m5-type ma-wait-m5-type-${type.toLowerCase()}`}>
                  {typeShort}
                </span>
                <span className="ma-wait-m5-state">{stateShort}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
