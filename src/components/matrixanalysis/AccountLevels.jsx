// ============================================================================
//  RISK PANEL — Neo Matrix (SAFE HOOKS + JS leverage)
// ============================================================================

import React, { useMemo } from "react";
import useMT5Data from "../../hooks/useMT5Data";
import useExposureByAsset from "../../hooks/useExposureByAsset";
import "../../styles/stylesmatrixanalysis/accountlevels.css";


// ============================================================================
// HELPERS
// ============================================================================

function getStage(label, value, balance = null) {
  switch (label) {
    case "Margin Level":
      if (value < 350) return "Danger - Plus de marge";
      if (value < 750) return "Medium - Attention";
      return "Marge confortable";

    case "PnL":
      if (balance !== null && value <= balance * -0.3)
        return "Critical - Grosse perte";
      if (value < 0) return "Loss";
      return "Profit";

    case "Leverage":
      if (value > 30) return "Danger - Trop Eleve";
      if (value > 15) return "Medium - Attention ";
      return "Safe - Optimal";

    default:
      return "";
  }
}

const fmtEUR = (v) =>
  v === null || v === undefined || isNaN(v)
    ? "—"
    : `${Math.round(v).toLocaleString("fr-FR")} €`;

const fmtPct = (v) =>
  v === null || v === undefined || isNaN(v)
    ? "—"
    : `${Math.round(v)} %`;

const fmtLev = (v) =>
  v === null || v === undefined || isNaN(v)
    ? "—"
    : `x${v.toFixed(1)}`;

const fmtPnL = (v) =>
  v === null || v === undefined || isNaN(v)
    ? "—"
    : `${v > 0 ? "+" : ""}${fmtEUR(v)}`;

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountLevels() {

  // 🔒 TOUS LES HOOKS — TOUJOURS APPELÉS
  const { data, ready } = useMT5Data();

const { rows: exposureData, total: totalExposure } =
  useExposureByAsset(data, {
    topN: 99,
    minPct: 0
  });


  // 🟡 RENDER LOADING APRÈS HOOKS
  if (!ready || !data?.account) {
    return <div className="risk-panel">Loading…</div>;
  }

  const a = data.account;

  // ========================================================================
  // CALCUL LEVERAGE — JS SOURCE OF TRUTH
  // ========================================================================

  const leverageUsed =
    a.equity > 0
      ? totalExposure / a.equity
      : 0;

  // ========================================================================
  // ROWS
  // ========================================================================

  const rows = [
    { label: "Balance", value: a.balance, format: fmtEUR },
    { label: "Equity", value: a.equity, format: fmtEUR },
    { label: "Margin Level", value: a.marginLevel, format: fmtPct },
    { label: "Free Margin", value: a.freeMargin, format: fmtEUR },
    { label: "Leverage", value: leverageUsed, format: fmtLev },
    { label: "PnL", value: a.pnl, format: fmtPnL }
  ];

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="risk-panel">
      <div className="risk-title">Risk & Account</div>

      <div className="risk-grid">
        {rows.map((row) => {
          const stage =
            row.label === "PnL"
              ? getStage(row.label, row.value, a.balance)
              : getStage(row.label, row.value);

          return (
            <div key={row.label} className="risk-row">
              <div className="risk-label">{row.label}</div>
              <div className="risk-value">{row.format(row.value)}</div>
              {stage && <div className="risk-stage">{stage}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
