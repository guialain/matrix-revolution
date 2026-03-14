// ============================================================================
//  INDICATORS MATRIX — Heatmap version
// ============================================================================

import React, { useMemo } from "react";
import useMT5Data from "../../hooks/useMT5Data";
import "../../styles/stylesmatrixanalysis/indicatorsmatrix.css";
import IndicatorsEngine from "../robot/engines/IndicatorsEngine";

const TFS = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

// ─── color helpers ───────────────────────────────────────────────────────────

function signalBg() { return "transparent"; }

function signalColor(signal) {
  if (!signal) return "#ffe9c2";
  const s = signal.toLowerCase();
  if (s.includes("strong buy")  || s === "strong up")   return "#22c55e";
  if (s.includes("buy")         || s === "up")           return "#4ade80";
  if (s.includes("neutral"))                             return "#eab308";
  if (s.includes("sell")        || s === "down")         return "#f97316";
  if (s.includes("strong sell") || s === "strong down")  return "#ef4444";
  return "#ffe9c2";
}

function rsiBg() { return "transparent"; }

function rsiColor(rsi) {
  if (!Number.isFinite(rsi)) return "#ffe9c2";
  if (rsi >= 70) return "#ef4444";
  if (rsi >= 60) return "#f97316";
  if (rsi <= 30) return "#22c55e";
  if (rsi <= 40) return "#4ade80";
  return "#ffe9c2";
}

function slopeBg() { return "transparent"; }

function slopeColor(slope) {
  if (!Number.isFinite(slope)) return "#ffe9c2";
  if (slope > 3)  return "#22c55e";
  if (slope > 1)  return "#4ade80";
  if (slope < -3) return "#ef4444";
  if (slope < -1) return "#f97316";
  return "#ffe9c2";
}

function deltaBg() { return "transparent"; }

function rsiZoneColor(zone) {
  if (!zone) return "#ffe9c2";
  if (zone === "Achat extrême")  return "#ea3030";
  if (zone === "Survente")       return "#f97316";
  if (zone === "Basse")          return "#e47527";
  if (zone === "Neutre")         return "#ffe9c2";
  if (zone === "Haute")          return "#e47527";
  if (zone === "Surachat")       return "#ec6c11";
  if (zone === "Vente extrême")  return "#ea3030";
  return "#ffe9c2";
}

function deltaColor(v) {
  if (!Number.isFinite(v)) return "#ffe9c2";
  if (v > 5)  return "#4ade80";
  if (v < -5) return "#ef4444";
  if (v < 0)  return "#f97316";
  return "#ffe9c2";
}

const fmt = (v, d = 1) =>
  v == null || !Number.isFinite(Number(v)) ? "—"
  : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

// ─── HeatCell ─────────────────────────────────────────────────────────────────

function HeatCell({ bg, color, value }) {
  return (
    <div className="im-cell" style={{ background: bg, color: color ?? "#ffe9c2" }}>
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
        <div className="im-row-label im-header">NEOMATRIX</div>
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
          return <HeatCell key={tf} bg="transparent" color={rsiZoneColor(zone.zone)} value={zone.zone} />;
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
          return <HeatCell key={tf} bg="transparent" color="#ffe9c2" value={Number.isFinite(v) ? Math.round(v) : "—"} />;
        })}

        {/* RANGE / SPREAD */}
        <div className="im-row-label">Range/Spread</div>
        {TFS.map(tf => {
          const d = tfMap[tf] ?? {};
          const v = Number.isFinite(d.range) && validSpread ? d.range / spread : null;
          return <HeatCell key={tf} bg="transparent" color="#ffe9c2" value={Number.isFinite(v) ? Math.round(v) : "—"} />;
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
          return <HeatCell key={tf} bg="transparent" color="#ffe9c2" value={fmt(v, 2)} />;
        })}

        {/* LOW */}
        <div className="im-row-label">Low</div>
        {TFS.map(tf => {
          const v = tfMap[tf]?.low;
          return <HeatCell key={tf} bg="transparent" color="#ffe9c2" value={fmt(v, 2)} />;
        })}

      </div>
    </div>
  );
}
