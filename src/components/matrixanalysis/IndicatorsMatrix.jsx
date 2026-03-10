// ============================================================================
//  INDICATORS MATRIX — Heatmap version
// ============================================================================

import React, { useMemo } from "react";
import useMT5Data from "../../hooks/useMT5Data";
import "../../styles/stylesmatrixanalysis/indicatorsmatrix.css";
import IndicatorsEngine from "../robot/engines/IndicatorsEngine";

const TFS = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

// ─── color helpers ───────────────────────────────────────────────────────────

function signalBg(signal) {
  if (!signal) return "transparent";
  const s = signal.toLowerCase();
  if (s.includes("strong buy")  || s === "strong up")   return "rgba(34,197,94,0.25)";
  if (s.includes("buy")         || s === "up")           return "rgba(74,222,128,0.15)";
  if (s.includes("neutral"))                             return "rgba(234,179,8,0.10)";
  if (s.includes("sell")        || s === "down")         return "rgba(249,115,22,0.18)";
  if (s.includes("strong sell") || s === "strong down")  return "rgba(239,68,68,0.28)";
  return "transparent";
}

function signalColor(signal) {
  if (!signal) return "#888";
  const s = signal.toLowerCase();
  if (s.includes("strong buy")  || s === "strong up")   return "#22c55e";
  if (s.includes("buy")         || s === "up")           return "#4ade80";
  if (s.includes("neutral"))                             return "#eab308";
  if (s.includes("sell")        || s === "down")         return "#f97316";
  if (s.includes("strong sell") || s === "strong down")  return "#ef4444";
  return "#fff";
}

function rsiBg(rsi) {
  if (!Number.isFinite(rsi)) return "transparent";
  if (rsi >= 70) return "rgba(239,68,68,0.22)";
  if (rsi >= 60) return "rgba(249,115,22,0.15)";
  if (rsi <= 30) return "rgba(34,197,94,0.22)";
  if (rsi <= 40) return "rgba(74,222,128,0.12)";
  return "rgba(234,179,8,0.08)";
}

function rsiColor(rsi) {
  if (!Number.isFinite(rsi)) return "#888";
  if (rsi >= 70) return "#ef4444";
  if (rsi >= 60) return "#f97316";
  if (rsi <= 30) return "#22c55e";
  if (rsi <= 40) return "#4ade80";
  return "#fff";
}

function slopeBg(slope) {
  if (!Number.isFinite(slope)) return "transparent";
  if (slope > 3)  return "rgba(34,197,94,0.20)";
  if (slope > 1)  return "rgba(74,222,128,0.12)";
  if (slope < -3) return "rgba(239,68,68,0.22)";
  if (slope < -1) return "rgba(249,115,22,0.15)";
  return "rgba(234,179,8,0.07)";
}

function slopeColor(slope) {
  if (!Number.isFinite(slope)) return "#888";
  if (slope > 3)  return "#22c55e";
  if (slope > 1)  return "#4ade80";
  if (slope < -3) return "#ef4444";
  if (slope < -1) return "#f97316";
  return "#ffff";
}

function deltaBg(v) {
  if (!Number.isFinite(v)) return "transparent";
  if (v > 5)  return "rgba(34,197,94,0.18)";
  if (v < -5) return "rgba(239,68,68,0.20)";
  if (v < 0)  return "rgba(249,115,22,0.12)";
  return "transparent";
}

function deltaColor(v) {
  if (!Number.isFinite(v)) return "#888";
  if (v > 5)  return "#4ade80";
  if (v < -5) return "#ef4444";
  if (v < 0)  return "#f97316";
  return "#ffff";
}

const fmt = (v, d = 1) =>
  v == null || !Number.isFinite(Number(v)) ? "—"
  : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

// ─── HeatCell ─────────────────────────────────────────────────────────────────

function HeatCell({ bg, color, value }) {
  return (
    <div className="im-cell" style={{ background: bg, color: color ?? "#ccc" }}>
      {value}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function IndicatorsMatrix() {
  const { data, ready } = useMT5Data();
  const indicators = data?.indicators ?? null;
  const spread     = data?.asset?.spread ?? null;
  const validSpread = Number.isFinite(spread) && spread > 0;

  const tfMap = useMemo(() => {
    if (!indicators) return {};
    const out = {};
    TFS.forEach(tf => {
      out[tf] = {
        rsi:   indicators.rsi?.[tf]      ?? null,
        slope: indicators.rsiSlope?.[tf] ?? null,
        atr:   indicators.atr?.[tf]      ?? null,
        range: indicators.range?.[tf]    ?? null,
        high:  indicators.high?.[tf]     ?? null,
        low:   indicators.low?.[tf]      ?? null,
      };
    });
    return out;
  }, [indicators]);

  if (!ready || !indicators) return <div className="im-panel">Loading…</div>;

  return (
    <div className="im-panel">
      <div className="im-grid">

        {/* HEADER ROW */}
        <div className="im-row-label" />
        {TFS.map(tf => (
          <div key={tf} className="im-header">{tf}</div>
        ))}

        {/* SIGNAL */}
        <div className="im-row-label">Signal</div>
        {TFS.map(tf => {
          const d   = tfMap[tf] ?? {};
          const sig = IndicatorsEngine.getTradeSignal({ slope: d.slope, rsi: d.rsi });
          return <HeatCell key={tf} bg="transparent" color={signalColor(sig)} value={sig ?? "—"} />;
        })}

        {/* RSI */}
        <div className="im-row-label">RSI</div>
        {TFS.map(tf => {
          const v = tfMap[tf]?.rsi;
          return <HeatCell key={tf} bg={rsiBg(v)} color={rsiColor(v)} value={Number.isFinite(v) ? Math.round(v) : "—"} />;
        })}

        {/* RSI ZONE */}
        <div className="im-row-label">RSI Zone</div>
        {TFS.map(tf => {
          const d    = tfMap[tf] ?? {};
          const zone = IndicatorsEngine.getRsiZone?.(d.rsi) ?? { zone: "—", cls: "" };
          return <HeatCell key={tf} bg="transparent" color={signalColor(zone.zone)} value={zone.zone} />;
        })}

        {/* SLOPE */}
        <div className="im-row-label">Slope</div>
        {TFS.map(tf => {
          const v = tfMap[tf]?.slope;
          return <HeatCell key={tf} bg="transparent" color={slopeColor(v)} value={fmt(v, 1)} />;
        })}

        {/* DIRECTION */}
        <div className="im-row-label">Direction</div>
        {TFS.map(tf => {
          const d   = tfMap[tf] ?? {};
          const dir = IndicatorsEngine.classifySlope(d.slope);
          return <HeatCell key={tf} bg="transparent" color={signalColor(dir.signal)} value={dir.signal ?? "—"} />;
        })}

        {/* ATR / SPREAD */}
        <div className="im-row-label">ATR/Spread</div>
        {TFS.map(tf => {
          const d = tfMap[tf] ?? {};
          const v = Number.isFinite(d.atr) && validSpread ? d.atr / spread : null;
          return <HeatCell key={tf} bg="transparent" color="#ffff" value={Number.isFinite(v) ? Math.round(v) : "—"} />;
        })}

        {/* RANGE / SPREAD */}
        <div className="im-row-label">Range/Spread</div>
        {TFS.map(tf => {
          const d = tfMap[tf] ?? {};
          const v = Number.isFinite(d.range) && validSpread ? d.range / spread : null;
          return <HeatCell key={tf} bg="transparent" color="#ffff" value={Number.isFinite(v) ? Math.round(v) : "—"} />;
        })}

        {/* DELTA RANGE */}
        <div className="im-row-label">Delta Range</div>
        {TFS.map(tf => {
          const d   = tfMap[tf] ?? {};
          const atr = Number.isFinite(d.atr)   && validSpread ? d.atr   / spread : null;
          const rng = Number.isFinite(d.range)  && validSpread ? d.range / spread : null;
          const v   = Number.isFinite(atr) && Number.isFinite(rng) ? atr - rng : null;
          return <HeatCell key={tf} bg={deltaBg(v)} color={deltaColor(v)} value={Number.isFinite(v) ? Math.round(v) : "—"} />;
        })}

        {/* HIGH */}
        <div className="im-row-label">High</div>
        {TFS.map(tf => {
          const v = tfMap[tf]?.high;
          return <HeatCell key={tf} bg="transparent" color="#ffff" value={fmt(v, 2)} />;
        })}

        {/* LOW */}
        <div className="im-row-label">Low</div>
        {TFS.map(tf => {
          const v = tfMap[tf]?.low;
          return <HeatCell key={tf} bg="transparent" color="#ffff" value={fmt(v, 2)} />;
        })}

      </div>
    </div>
  );
}
