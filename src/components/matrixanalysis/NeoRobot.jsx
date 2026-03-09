// ============================================================================
// NeoRobot.jsx
// Rôle : UI NEO (lecture pure des signaux multi-TF + scanner)
// ============================================================================

import React from "react";
import "../../styles/stylesmatrixanalysis/neorobot.css";

import useRobotCore from "../../hooks/useRobotCore";


/* =====================================================
   UTILS — signal → css class
   ===================================================== */
function signalClass(signal) {
  if (!signal) return "neo-neutral";
  return `neo-${signal.toLowerCase().replace(" ", "-")}`;
}

/* =====================================================
   SOUS-COMPONENT — NeoLine
   ===================================================== */
function NeoLine({ label, align, signal }) {
  return (
    <div className="neo-line neo-3cols">
      <span className="neo-col neo-label">{label}</span>
      <span className="neo-col neo-align">{align ?? "Unknown"}</span>
      <span className={`neo-col neo-signal ${signalClass(signal)}`}>
        {signal ?? "Neutral"}
      </span>
    </div>
  );
}

/* =====================================================
   MAIN COMPONENT — NeoRobot
   ===================================================== */
export default function NeoRobot({ snapshot }) {
  const core = useRobotCore(snapshot);

  if (!core) {
    return (
      <div className="neo-row">
        <div className="neo-box">
          <div className="neo-title">NEO</div>
          Initialisation du moteur…
        </div>
      </div>
    );
  }

  const {
    finalDecision,

    // === ASSET (AssetSignals) ===
    structureSignal,
    structureAlign,

    dominantSignal,
    dominantAlign,

    timingSignal,
    timingAlign,

    noiseLevel,
    macroRegime
  } = core;

  return (
    <div className="neo-row">

      {/* ==================================================
          CADRE 1 — ASSET ANALYSIS (MULTI-TF)
         ================================================== */}
      <section className="neo-box neo-asset">

        <div className="neo-title neo-title-split">
          <span className="neo-title-context">MULTI-TIMEFRAME ANALYSIS</span>
          <span className="neo-title-sep">:</span>
          <span className="neo-title-symbol">
            {snapshot?.asset?.symbol ?? "—"}
          </span>
        </div>

        <NeoLine
          label="Tendance structurelle"
          align={structureAlign}
          signal={structureSignal}
        />

        <NeoLine
          label="Tendance directionnelle"
          align={dominantAlign}
          signal={dominantSignal}
        />

        <NeoLine
          label="Timing / Momentum"
          align={timingAlign}
          signal={timingSignal}
        />

        <NeoLine
          label="Perturbation / Bruit"
          align={noiseLevel != null && noiseLevel > 0.6 ? "High" : "Low"}
          signal={noiseLevel != null && noiseLevel > 0.6 ? "Strong Down" : "Neutral"}
        />

        <NeoLine
          label="Contexte macro"
          align="Global"
          signal={macroRegime === "RISK_ON" ? "Up" : "Down"}
        />
      </section>

      {/* ==================================================
          CADRE 2 — ROBOT (VERDICT GLOBAL)
         ================================================== */}
      <section className="neo-box neo-center neo-robot">
        <img src="/neo.png" alt="Neo Robot" className="neo-robot-img" />

        <div
          className={`neo-robot-alert ${
            finalDecision === "WAIT" ? "alert-wait" : "alert-ok"
          }`}
        >
          {finalDecision === "WAIT"
            ? "AUCUNE OPPORTUNITÉ"
            : "OPPORTUNITÉS DÉTECTÉES"}
        </div>
      </section>

    </div>
  );
}
