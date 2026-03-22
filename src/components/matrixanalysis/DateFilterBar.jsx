import { useState, useCallback } from "react";
import "../../styles/stylesmatrixanalysis/datefilterbar.css";

const PRESETS = [
  { key: "day",   label: "Jour" },
  { key: "week",  label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "all",   label: "Tout" },
  { key: "custom", label: "Custom" },
];

function startOfDay(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }

function presetRange(key) {
  const now = new Date();
  const today = startOfDay(now);
  if (key === "day")   return { from: today, to: null };
  if (key === "week")  { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: d, to: null }; }
  if (key === "month") { const d = new Date(today); d.setMonth(d.getMonth() - 1); return { from: d, to: null }; }
  return { from: null, to: null }; // all
}

/** Parse MT5 close_time "YYYY.MM.DD HH:MM:SS" to Date */
function parseMT5Date(ct) {
  if (!ct) return null;
  const s = ct.replace(/\./g, "-"); // "2026-03-22 15:30:45"
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function filterTradesByRange(trades, preset, customFrom, customTo) {
  if (preset === "all") return trades;

  let from, to;
  if (preset === "custom") {
    from = customFrom ? startOfDay(new Date(customFrom)) : null;
    to   = customTo   ? new Date(new Date(customTo).setHours(23,59,59,999)) : null;
  } else {
    const r = presetRange(preset);
    from = r.from;
    to   = r.to;
  }

  return trades.filter(t => {
    const d = parseMT5Date(t.close_time);
    if (!d) return false;
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
}

export default function DateFilterBar({ preset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo, tradeCount }) {
  return (
    <div className="dfb-bar">
      <div className="dfb-presets">
        {PRESETS.map(p => (
          <button
            key={p.key}
            className={`dfb-btn${preset === p.key ? " active" : ""}`}
            onClick={() => onPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="dfb-custom">
          <input type="date" className="dfb-input" value={customFrom} onChange={e => onCustomFrom(e.target.value)} />
          <span className="dfb-sep">→</span>
          <input type="date" className="dfb-input" value={customTo}   onChange={e => onCustomTo(e.target.value)} />
        </div>
      )}

      <span className="dfb-count">{tradeCount} trades</span>
    </div>
  );
}
