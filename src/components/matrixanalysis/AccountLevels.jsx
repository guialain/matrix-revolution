// ============================================================================
//  RISK PANEL — Neo Matrix — Heatmap version
// ============================================================================

import React from "react";
import useMT5Data from "../../hooks/useMT5Data";
import useExposureByAsset from "../../hooks/useExposureByAsset";
import "../../styles/stylesmatrixanalysis/accountlevels.css";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getStage(label, value, balance = null) {
  switch (label) {
    case "Margin Level":
      if (value < 350) return { text: "Danger",   color: "#ef4444" };
      if (value < 750) return { text: "Attention", color: "#f97316" };
      return               { text: "Safe",        color: "#4ade80" };
    case "PnL":
      if (balance !== null && value <= balance * -0.3)
        return             { text: "Critical",    color: "#ef4444" };
      if (value < 0) return { text: "Loss",        color: "#f97316" };
      return               { text: "Profit",      color: "#4ade80" };
    case "Leverage":
      if (value > 30) return { text: "Danger",    color: "#ef4444" };
      if (value > 15) return { text: "Attention", color: "#f97316" };
      return                 { text: "Optimal",   color: "#4ade80" };
    default: return null;
  }
}

function getValueColor(label, value, balance = null) {
  const s = getStage(label, value, balance);
  return s ? s.color : "#f5c26b";
}

function getRowBg(label, value, balance = null) {
  const s = getStage(label, value, balance);
  if (!s) return "transparent";
  if (s.color === "#ef4444") return "rgba(239,68,68,0.08)";
  if (s.color === "#f97316") return "rgba(249,115,22,0.07)";
  if (s.color === "#4ade80") return "rgba(74,222,128,0.06)";
  return "transparent";
}

const fmtEUR = v => v == null || isNaN(v) ? "—" : `${Math.round(v).toLocaleString("fr-FR")} €`;
const fmtPct = v => v == null || isNaN(v) ? "—" : `${Math.round(v)} %`;
const fmtLev = v => v == null || isNaN(v) ? "—" : `x${v.toFixed(1)}`;
const fmtPnL = v => v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${fmtEUR(v)}`;

// ─── main ─────────────────────────────────────────────────────────────────────

export default function AccountLevels() {
  const { data, ready } = useMT5Data();
  const { total: totalExposure } = useExposureByAsset(data, { topN: 99, minPct: 0 });

  if (!ready || !data?.account) return <div className="al-panel">Loading…</div>;

  const a = data.account;
  const leverageUsed = a.equity > 0 ? totalExposure / a.equity : 0;

  const rows = [
    { label: "Balance",      value: a.balance,     fmt: fmtEUR },
    { label: "Equity",       value: a.equity,      fmt: fmtEUR },
    { label: "Margin Level", value: a.marginLevel, fmt: fmtPct },
    { label: "Free Margin",  value: a.freeMargin,  fmt: fmtEUR },
    { label: "Leverage",     value: leverageUsed,  fmt: fmtLev },
    { label: "PnL",          value: a.pnl,         fmt: fmtPnL },
  ];

  return (
    <div className="al-panel">
      <div className="al-title">Risk &amp; Account</div>
      <div className="al-grid">
        {rows.map(row => {
          const stage  = getStage(row.label, row.value, row.label === "PnL" ? a.balance : null);
          const vcolor = getValueColor(row.label, row.value, row.label === "PnL" ? a.balance : null);
          const bg     = getRowBg(row.label, row.value, row.label === "PnL" ? a.balance : null);
          return (
            <div key={row.label} className="al-row" style={{ background: bg }}>
              <span className="al-label">{row.label}</span>
              <span className="al-value" style={{ color: vcolor }}>{row.fmt(row.value)}</span>
              {stage && <span className="al-stage" style={{ color: stage.color }}>{stage.text}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
