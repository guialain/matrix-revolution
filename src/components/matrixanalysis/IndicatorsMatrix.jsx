// ============================================================================
//  INDICATORS MATRIX — Neo Matrix (ENGINE-DRIVEN / CLEAN)
// ============================================================================

import React, { useMemo } from "react";
import useMT5Data from "../../hooks/useMT5Data";
import "../../styles/stylesmatrixanalysis/indicatorsmatrix.css";


import IndicatorsEngine from "../robot/engines/IndicatorsEngine";

// ---------------------------------------------------------------------------
// TIMEFRAMES (DOIT MATCHER MT5)
// ---------------------------------------------------------------------------

const TFS = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

// ---------------------------------------------------------------------------
// ROWS
// ---------------------------------------------------------------------------

const ROWS = [
  { key: "signal",      label: "Signal" },
  { key: "rsi",         label: "RSI" },
  { key: "rsiZone",     label: "RSI Zone" },
  { key: "slope",       label: "Slope" },
  { key: "direction",   label: "Direction" },
  { key: "atrSpread",   label: "ATR / Spread" },
  { key: "rangeSpread", label: "Range / Spread" },
  { key: "deltaSpread", label: "Delta Range" },
  { key: "high",        label: "High" },
  { key: "low",         label: "Low" }
];

// ---------------------------------------------------------------------------
// FORMAT
// ---------------------------------------------------------------------------

const fmt = (v, digits = 1) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("fr-FR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });

// ============================================================================
// COMPONENT
// ============================================================================

export default function IndicatorsMatrix() {

  const { data, ready } = useMT5Data();
  const indicators = data?.indicators ?? null;

  const spread = data?.asset?.spread ?? null;
  const validSpread = Number.isFinite(spread) && spread > 0;

  // -------------------------------------------------------------------------
  // TF MAP (RAW DATA ONLY)
  // -------------------------------------------------------------------------

  const tfMap = useMemo(() => {
    if (!indicators) return {};

    const out = {};
    TFS.forEach(tf => {
      out[tf] = {
        rsi:   indicators.rsi?.[tf] ?? null,
        slope: indicators.rsiSlope?.[tf] ?? null,
        atr:   indicators.atr?.[tf] ?? null,
        range: indicators.range?.[tf] ?? null,
        high:  indicators.high?.[tf] ?? null,
        low:   indicators.low?.[tf] ?? null
      };
    });
    return out;
  }, [indicators]);

  if (!ready || !indicators) {
    return <div className="indicators-panel">Loading…</div>;
  }

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="indicators-panel">
      <div className="indicators-grid">

        {/* HEADER */}
        <div className="indicator-label">Indicateurs</div>
        {TFS.map(tf => (
          <div key={tf} className="indicator-header">{tf}</div>
        ))}

        {/* ROWS */}
        {ROWS.map(row => (
          <React.Fragment key={row.key}>

            <div className="indicator-label">{row.label}</div>

            {TFS.map(tf => {
              const d = tfMap[tf] ?? {};

              const atrSpread =
                Number.isFinite(d.atr) && validSpread
                  ? d.atr / spread
                  : null;

              const rangeSpread =
                Number.isFinite(d.range) && validSpread
                  ? d.range / spread
                  : null;

              const deltaSpread =
                Number.isFinite(atrSpread) && Number.isFinite(rangeSpread)
                  ? atrSpread - rangeSpread
                  : null;

              // ================= SIGNAL =================
              if (row.key === "signal") {
                const sig = IndicatorsEngine.getTradeSignal({
                  slope: d.slope,
                  rsi: d.rsi
                });

                const cls =
                  sig === "Strong Buy"  ? "signal-strong-buy" :
                  sig === "Buy"         ? "signal-buy" :
                  sig === "Sell"        ? "signal-sell" :
                  sig === "Strong Sell" ? "signal-strong-sell" :
                                           "signal-neutral";

                return (
                  <div key={tf} className={`indicator-cell ${cls}`}>
                    {sig}
                  </div>
                );
              }

              // ================= DIRECTION =================
              if (row.key === "direction") {
                const { signal } =
                  IndicatorsEngine.classifySlope(d.slope);

                return (
                  <div key={tf} className="indicator-cell">
                    {signal ?? "—"}
                  </div>
                );
              }

              // ================= RSI ZONE =================
              if (row.key === "rsiZone") {
                const zone =
                  IndicatorsEngine.getRsiZone?.(d.rsi) ??
                  { zone: "—", cls: "" };

                return (
                  <div key={tf} className={`indicator-cell ${zone.cls}`}>
                    {zone.zone}
                  </div>
                );
              }

              // ================= NUMERIC =================
              let value;
              switch (row.key) {
                case "atrSpread":   value = atrSpread; break;
                case "rangeSpread": value = rangeSpread; break;
                case "deltaSpread": value = deltaSpread; break;
                case "high":        value = d.high; break;
                case "low":         value = d.low; break;
                default:            value = d[row.key];
              }

              const isNegativeDelta =
                row.key === "deltaSpread" &&
                Number.isFinite(value) &&
                value < 0;

              return (
                <div
                  key={tf}
                  className={`indicator-cell ${isNegativeDelta ? "delta-negative" : ""}`}
                >
{row.key === "rsi"
  ? (Number.isFinite(value) ? Math.round(value) : "—")
  : (row.key === "atrSpread" ||
     row.key === "rangeSpread" ||
     row.key === "deltaSpread")
      ? (Number.isFinite(value) ? Math.round(value) : "—")
      : (row.key === "high" || row.key === "low")
          ? fmt(value, 2)
          : fmt(value, 1)}

                </div>
              );
            })}

          </React.Fragment>
        ))}

      </div>
    </div>
  );
}
