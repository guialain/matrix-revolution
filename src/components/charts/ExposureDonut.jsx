import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Customized, Sector } from "recharts";

// ============================================================================
// CONFIG
// ============================================================================
const CONFIG = {
  innerRadius: 55,
  outerRadius: 105,
  padAngle: 2,
  startAngle: 180,
  endAngle: -180
};

const EXPLODE_RATIO  = 0.25;
const EXPLODE_OFFSET = 8;
const MAX_EXPLODED   = 2;

// ============================================================================
// SLICE COLORS — DARK GOLD / GRAPHITE (FINAL)
// ============================================================================
const SLICE_COLORS = [
  "#520fa4cb", // Dark Gold — dominant
  "#d19826cf", // Deep Violet
  "#2f642f", // Steel
  "#2980b9", // Deep Blue
  "#bf4751", // Muted Teal
  "#eee3e3"  // Graphite / Others
];

// ============================================================================
// EXPLODED SLICE (SAFE)
// ============================================================================
const renderExplodedShape = (props) => {
  const RAD = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill
  } = props;

  const tx = Math.sin(-RAD * midAngle) * EXPLODE_OFFSET;
  const ty = Math.cos(-RAD * midAngle) * EXPLODE_OFFSET;

  return (
    <g transform={`translate(${tx}, ${ty})`}>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function ExposureDonut({ data }) {

  // --------------------------------------------------------------------------
  // SAFETY
  // --------------------------------------------------------------------------
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // --------------------------------------------------------------------------
  // NORMALIZE DATA (COLORS)
  // --------------------------------------------------------------------------
  const exposureData = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        color: SLICE_COLORS[i] || "#555555"
      })),
    [data]
  );

  // --------------------------------------------------------------------------
  // CALCULATIONS
  // --------------------------------------------------------------------------
  const { total, legendData, explodedIndexes } = useMemo(() => {
    const total = exposureData.reduce(
      (s, d) => s + Number(d.value || 0),
      0
    );

    const legendData = exposureData.map(d => ({
      key: d.key,
      color: d.color,
      value: Number(d.value || 0),
      pct: total > 0 ? Math.round((d.value / total) * 100) : 0
    }));

    const explodedIndexes = exposureData
      .map((d, i) => ({
        i,
        ratio: total > 0 ? d.value / total : 0
      }))
      .filter(d => d.ratio >= EXPLODE_RATIO)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, MAX_EXPLODED)
      .map(d => d.i);

    return { total, legendData, explodedIndexes };
  }, [exposureData]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="donut-layout">

      {/* =========================
          DONUT
         ========================= */}
      <PieChart width={270} height={230}>
        <Pie
          data={exposureData}
          dataKey="value"
          cx={125}
          cy={100}
          innerRadius={CONFIG.innerRadius}
          outerRadius={CONFIG.outerRadius}
          paddingAngle={CONFIG.padAngle}
          startAngle={CONFIG.startAngle}
          endAngle={CONFIG.endAngle}
          isAnimationActive={false}
          activeShape={renderExplodedShape}
          activeIndex={explodedIndexes}
        >
          {exposureData.map(d => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Pie>

        {/* =========================
            CENTER LABEL
           ========================= */}
        <Customized
          component={() => (
            <g pointerEvents="none">
              <text
                x={130}
                y={105}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f5c26b"
                fontSize={12}
                fontWeight={600}
                style={{ letterSpacing: "0.08em" }}
              >
                EXPOSURE
              </text>
            </g>
          )}
        />
      </PieChart>

      {/* =========================
          LEGEND
         ========================= */}
      <div className="donut-legend">
        {legendData.map(l => (
          <div
            key={`legend-${l.key}`}
            className={`legend-row ${l.key === "Others" ? "others" : ""}`}
          >
            <span
              className="legend-dot"
              style={{ backgroundColor: l.color }}
            />
            <span className="legend-key">{l.key}</span>
            <span className="legend-pct">{l.pct} %</span>
            <span className="legend-value">
              {Math.round(l.value).toLocaleString("fr-FR")} €
            </span>
          </div>
        ))}

        <div className="legend-total">
          <span>TOTAL EXPOSURE</span>
          <span>{Math.round(total).toLocaleString("fr-FR")} €</span>
        </div>
      </div>

    </div>
  );
}
