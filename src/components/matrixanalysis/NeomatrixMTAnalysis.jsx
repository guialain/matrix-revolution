// ============================================================================
// NeomatrixMTAnalysis.jsx
// Panel unifié : synthèse (Direction / Momentum / Noise) + détails par TF
// Remplace ConvergenceMultiTF + IndicatorsMatrix dans MatrixAnalysis.
// Source : snapshot.marketWatch.find(r => r.symbol === snapshot.asset.symbol)
// ============================================================================

import React from "react";
import {
  getSlopeLevel,
  getD1State,
  getDslopeLevel,
} from "../../utils/marketLevels.js";
import "../../styles/stylesmatrixanalysis/neomatrixmtanalysis.css";

// ── Config TF ────────────────────────────────────────────────────────────────

const TFS = [
  { key: "d1",  label: "D1"  },
  { key: "h4",  label: "H4"  },
  { key: "h1",  label: "H1"  },
  { key: "m15", label: "M15" },
  { key: "m5",  label: "M5"  },
];
const TF_UPPER = { d1: "D1", h4: "H4", h1: "H1", m15: "M15", m5: "M5" };

// ── Full-name labels (NEOMATRIX uses verbose badges) ─────────────────────────
// Input: level key from getSlopeLevel / getD1State / getDslopeLevel
// Output: "STRONG_UP", "EXPLOSIVE_DOWN", "ACCEL_UP", etc.
function fullLabel(level) {
  if (!level) return "—";
  const clean = level.startsWith("D1_") ? level.slice(3) : level;
  const map = {
    // Slope levels (getSlopeLevel / getD1State after D1_ strip)
    STRONG_UP:      "STRONG_UP",
    SOFT_UP:        "SOFT_UP",
    EMERGING_UP:    "EMERGING_UP",
    FADING_UP:      "FADING_UP",
    SPIKE_UP:       "SPIKE_UP",
    EXPLOSIVE_UP:   "EXPLOSIVE_UP",
    FLAT:           "FLAT",
    NEUTRE:         "FLAT",
    STRONG_DOWN:    "STRONG_DOWN",
    SOFT_DOWN:      "SOFT_DOWN",
    EMERGING_DOWN:  "EMERGING_DOWN",
    FADING_DOWN:    "FADING_DOWN",
    SPIKE_DOWN:     "SPIKE_DOWN",
    EXPLOSIVE_DOWN: "EXPLOSIVE_DOWN",
    // Dslope level keys (getDslopeLevel)
    EXPLO_UP:       "EXPLOSIVE_UP",
    EXPLO_DOWN:     "EXPLOSIVE_DOWN",
    ACC_UP:         "ACCEL_UP",
    ACC_DOWN:       "ACCEL_DOWN",
    SFT_UP:         "SOFT_UP",
    SFT_DOWN:       "SOFT_DOWN",
    UNKNOWN:        "—",
  };
  return map[clean] ?? clean;
}

// ── Direction helpers ────────────────────────────────────────────────────────

function dirOfSlopeLevel(level) {
  if (!level) return "flat";
  const up   = ["SPIKE_UP","EXPLOSIVE_UP","STRONG_UP","SOFT_UP","D1_STRONG_UP","D1_FADING_UP","D1_EMERGING_UP"];
  const down = ["SPIKE_DOWN","EXPLOSIVE_DOWN","STRONG_DOWN","SOFT_DOWN","D1_STRONG_DOWN","D1_FADING_DOWN","D1_EMERGING_DOWN"];
  if (up.includes(level))   return "up";
  if (down.includes(level)) return "down";
  return "flat";
}

function dirOfDslopeLevel(level) {
  if (!level || level === "UNKNOWN" || level === "FLAT") return "flat";
  if (level.endsWith("_UP"))   return "up";
  if (level.endsWith("_DOWN")) return "down";
  return "flat";
}

function signalFromSlope(level) {
  const d = dirOfSlopeLevel(level);
  return d === "up" ? "BUY" : d === "down" ? "SELL" : "NEUTRAL";
}

// ── Verdict pair (Direction, Momentum) ───────────────────────────────────────

function pairVerdict(s1, s2) {
  if (s1 === s2) {
    if (s1 === "BUY")  return { verdict: "UP",      status: "Aligné", dir: "up",   fill: 1.0 };
    if (s1 === "SELL") return { verdict: "DOWN",    status: "Aligné", dir: "down", fill: 1.0 };
    return                     { verdict: "NEUTRAL", status: "Aligné", dir: "flat", fill: 0.25 };
  }
  if ((s1 === "BUY" && s2 === "SELL") || (s1 === "SELL" && s2 === "BUY")) {
    return { verdict: "NEUTRAL", status: "Divergent", dir: "flat", fill: 0.1 };
  }
  return   { verdict: "NEUTRAL", status: "Mitigé",    dir: "flat", fill: 0.5 };
}

// ── Noise (|dslope_m5|) ──────────────────────────────────────────────────────

function noiseInfo(dslope_m5) {
  const v = Number(dslope_m5);
  if (!Number.isFinite(v)) return { level: "—", fill: 0, dir: "flat" };
  const abs = Math.abs(v);
  const fill = Math.min(abs / 5, 1);
  if (abs < 1.5) return { level: "LOW",    fill, dir: "flat" };
  if (abs < 3.5) return { level: "MEDIUM", fill, dir: "flat" };
  return           { level: "HIGH",   fill, dir: "down" };
}

// ── Utils ────────────────────────────────────────────────────────────────────

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Couleur de la cellule dSLOPE selon seuils de significativité (±1.5)
function dslopeColor(dslope) {
  const v = Number(dslope);
  if (!Number.isFinite(v)) return "rgba(232, 217, 168, 0.6)"; // neutre/absent
  if (v >=  1.5) return "#7AE582"; // vert — bullish significatif
  if (v <= -1.5) return "#FF6B6B"; // rouge — bearish significatif
  return "#e8d9a8";                // or-blanc — zone neutre
}

function fmt(v, decimals) {
  const n = num(v);
  return n == null ? "—" : n.toFixed(decimals);
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function SynthRow({ label, sublabel, verdict, status, dir, fill }) {
  return (
    <div className="nmt-syn-row">
      <div className="nmt-synth-label">
        <span className="nmt-synth-title">{label}</span>
        <span className="nmt-synth-tfs">{sublabel}</span>
      </div>
      <div className="nmt-syn-bar">
        <div className="nmt-progbar-track">
          <div
            className={`nmt-progbar-fill nmt-fill-${dir}`}
            style={{ width: `${Math.round((fill ?? 0) * 100)}%` }}
          />
        </div>
      </div>
      <div className={`nmt-syn-verdict nmt-dir-${dir}`}>{verdict}</div>
      <div className="nmt-syn-status">{status ?? ""}</div>
    </div>
  );
}

function Badge({ abbr, cls }) {
  return <span className={`nmt-badge ${cls}`}>{abbr ?? "—"}</span>;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function NeomatrixMTAnalysis({ snapshot }) {
  const symbol = snapshot?.asset?.symbol ?? "—";
  const raw    = (snapshot?.marketWatch ?? []).find(r => r.symbol === symbol) ?? null;

  // Pre-compute per-TF row data
  const rows = TFS.map(({ key, label }) => {
    const s0    = num(raw?.[`slope_${key}_s0`]);
    const s1    = num(raw?.[`slope_${key}`]);
    // dslope LIVE (s0 − s1) pour tous les TF — aligné sur V8R et SignalFilters.
    // Les champs CSV dslope_xx représentent s1−s2 (entre deux bougies closed),
    // pas la valeur live vs bougie en cours.
    const dLive = (s0 != null && s1 != null) ? s0 - s1 : null;
    const rsi   = num(raw?.[`rsi_${key}_s0`]);
    const z     = key === "d1" ? null : num(raw?.[`zscore_${key}_s0`]);

    const slopeLevel = key === "d1"
      ? (s0 != null && dLive != null ? getD1State(s0, dLive) : null)
      : (s0 != null ? getSlopeLevel(s0, symbol) : null);

    const dslopeLevel = dLive != null ? getDslopeLevel(dLive, TF_UPPER[key]) : "UNKNOWN";

    return { key, label, s0, dLive, rsi, z, slopeLevel, dslopeLevel };
  });

  // Synthesis
  const d1Sig  = signalFromSlope(rows[0].slopeLevel);
  const h4Sig  = signalFromSlope(rows[1].slopeLevel);
  const h1Sig  = signalFromSlope(rows[2].slopeLevel);
  const m15Sig = signalFromSlope(rows[3].slopeLevel);
  const dirV   = pairVerdict(d1Sig, h4Sig);
  const momV   = pairVerdict(h1Sig, m15Sig);
  const noi    = noiseInfo(rows[4].dLive);

  const now = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div className="nmt-panel">

      <div className="nmt-topbar">
        <div className="nmt-topbar-left">
          <span className="nmt-live-dot" />
          <span className="nmt-title">NEOMATRIX MT ANALYSIS</span>
          <span className="nmt-symbol">— {symbol}</span>
        </div>
        <span className="nmt-time">{now}</span>
      </div>

      {!raw ? (
        <div className="nmt-empty">No snapshot for {symbol}</div>
      ) : (
        <>
          {/* SYNTHESIS */}
          <div className="nmt-section">
            <div className="nmt-section-title">SYNTHÈSE</div>
            <SynthRow label="Direction" sublabel="D1 / H4"  {...dirV} />
            <SynthRow label="Momentum"  sublabel="H1 / M15" {...momV} />
            <SynthRow
              label="Noise" sublabel="M5"
              verdict={noi.level} status=""
              dir={noi.dir} fill={noi.fill}
            />
          </div>

          {/* DETAILS */}
          <div className="nmt-section">
            <div className="nmt-section-title">DÉTAILS</div>
            <div className="nmt-table">
              <div className="nmt-thead">
                <div>TF</div>
                <div>SIGNAL</div>
                <div>SLOPE</div>
                <div>CLASS</div>
                <div>dSLOPE</div>
                <div>CLASS</div>
                <div>RSI</div>
                <div>Z</div>
              </div>

              {rows.map(r => {
                const sig        = signalFromSlope(r.slopeLevel);
                const sigDir     = sig === "BUY" ? "up" : sig === "SELL" ? "down" : "flat";
                const slopeLbl   = fullLabel(r.slopeLevel);
                const slopeCls   = `nmt-badge-${dirOfSlopeLevel(r.slopeLevel)}`;
                const dslopeLbl  = fullLabel(r.dslopeLevel);
                const dslopeCls  = `nmt-badge-${dirOfDslopeLevel(r.dslopeLevel)}`;

                return (
                  <div key={r.key} className="nmt-trow">
                    <div className="nmt-tf">{r.label}</div>
                    <div className={`nmt-signal nmt-dir-${sigDir}`}>{sig}</div>
                    <div className="nmt-num">{fmt(r.s0, 4)}</div>
                    <div><Badge abbr={slopeLbl}  cls={slopeCls}  /></div>
                    <div className="nmt-num" style={{ color: dslopeColor(r.dLive) }}>
                      {fmt(r.dLive, 4)}
                    </div>
                    <div><Badge abbr={dslopeLbl} cls={dslopeCls} /></div>
                    <div className="nmt-num">{r.rsi != null ? r.rsi.toFixed(0) : "—"}</div>
                    <div className="nmt-num">{r.z   != null ? r.z.toFixed(2)   : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
