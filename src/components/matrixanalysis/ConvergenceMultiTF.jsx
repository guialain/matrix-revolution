// ============================================================================
// ConvergenceMultiTF.jsx — UI redesign
// ============================================================================

import React from "react";
import "../../styles/stylesmatrixanalysis/convergencemultiTF.css";
import useRobotCore from "../../hooks/useRobotCore";

// ─── signal → config ─────────────────────────────────────────────────────────

function getSignalConfig(signal) {
  if (!signal) return { color: "#555", icon: "●", strength: 0, label: "NEUTRAL" };
  const s = signal.toUpperCase().replace(" ", "_");
  const map = {
    STRONG_UP:   { color: "#22c55e", icon: "▲▲", strength: 1.0,  label: "STRONG UP" },
    UP:          { color: "#4ade80", icon: "▲",  strength: 0.6,  label: "UP" },
    NEUTRAL:     { color: "#eab308", icon: "●",  strength: 0.3,  label: "NEUTRAL" },
    DOWN:        { color: "#f97316", icon: "▼",  strength: 0.6,  label: "DOWN" },
    STRONG_DOWN: { color: "#ef4444", icon: "▼▼", strength: 1.0,  label: "STRONG DOWN" },
  };
  return map[s] ?? { color: "#555", icon: "●", strength: 0.2, label: signal.toUpperCase() };
}

// ─── SignalCard ───────────────────────────────────────────────────────────────

function SignalCard({ label, sublabel, align, signal }) {
  const cfg = getSignalConfig(signal);

  return (
    <div className="cmtf-card">
      <div className="cmtf-card-left">
        <span className="cmtf-card-icon" style={{ color: cfg.color }}>{cfg.icon}</span>
        <div className="cmtf-card-text">
          <span className="cmtf-card-label">{label}</span>
          {sublabel && <span className="cmtf-card-sublabel">{sublabel}</span>}
        </div>
      </div>
      <div className="cmtf-card-right">
        <div className="cmtf-bar-track">
          <div
            className="cmtf-bar-fill"
            style={{ width: `${cfg.strength * 100}%`, background: cfg.color }}
          />
        </div>
        <span className="cmtf-card-align">{align ?? "—"}</span>
        <span className="cmtf-card-signal" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function ConvergenceMultiTF({ snapshot }) {
  const core = useRobotCore(snapshot);

  if (!core) {
    return (
      <div className="cmtf-container">
        <div className="cmtf-loading">Initialisation…</div>
      </div>
    );
  }

  const {
    structureSignal, structureAlign,
    dominantSignal,  dominantAlign,
    timingSignal,    timingAlign,
    noiseLevel,
    macroRegime,
  } = core;

  const noiseSignal = noiseLevel != null && noiseLevel > 0.6 ? "Strong Down" : "Neutral";
  const noiseAlign  = noiseLevel != null && noiseLevel > 0.6 ? "High" : "Low";
  const macroSignal = macroRegime === "RISK_ON" ? "Up" : "Down";

  const symbol = snapshot?.asset?.symbol ?? "—";

  return (
    <div className="cmtf-container">

      {/* HEADER */}
      <div className="cmtf-header">
        <span className="cmtf-header-title">Multi-Timeframe Analysis</span>
        <span className="cmtf-header-symbol">{symbol}</span>
      </div>

      {/* CARDS */}
      <div className="cmtf-cards">
        <SignalCard
          label="Tendance structurelle"
          sublabel="WEEK · MONTH"
          align={structureAlign}
          signal={structureSignal}
        />
        <SignalCard
          label="Tendance directionnelle"
          sublabel="DAY · H4"
          align={dominantAlign}
          signal={dominantSignal}
        />
        <SignalCard
          label="Timing / Momentum"
          sublabel="M15 · H1"
          align={timingAlign}
          signal={timingSignal}
        />
        <SignalCard
          label="Perturbation / Bruit"
          sublabel="M1 · M5"
          align={noiseAlign}
          signal={noiseSignal}
        />
        <SignalCard
          label="Contexte Macro"
          sublabel="Global"
          align="Macro"
          signal={macroSignal}
        />
      </div>

    </div>
  );
}
