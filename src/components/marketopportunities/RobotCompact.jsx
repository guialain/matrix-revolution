// ============================================================================
// RobotCompact.jsx — Robot 200px paysage avec overlay + animation pulse
// État : 'scanning' (vert) | 'prudent' (orange) | 'block' (rouge) | 'idle' (gris)
// ============================================================================

import { useState, useEffect } from "react";

export default function RobotCompact({ state = "scanning", reason = "", symbolCount = 0 }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const t = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });

  const stateLabel = {
    scanning: "SCANNING",
    prudent:  "PRUDENT",
    block:    "BLOCKED",
    idle:     "IDLE",
  }[state] ?? "SCANNING";

  return (
    <div className={`rc-compact rc-state-${state}`}>
      <img src="/neo.png" alt="Neo Robot" className="rc-compact-img" />
      <div className="rc-compact-overlay">
        <div className="rc-compact-line">
          <span className="rc-compact-brand">NEO MATRIX</span>
          <span className="rc-compact-sep">·</span>
          <span className={`rc-compact-state rc-compact-state-${state}`}>{stateLabel}</span>
          <span className="rc-compact-sep">·</span>
          <span className="rc-compact-count">{symbolCount} sym</span>
          <span className="rc-compact-sep">·</span>
          <span className="rc-compact-time">{t}</span>
        </div>
        {reason && <div className="rc-compact-reason">{reason}</div>}
      </div>
    </div>
  );
}
