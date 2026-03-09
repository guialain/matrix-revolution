export default function VerticalTube({
  label,
  value = 0,
  displayValue = null,
  color = "#ffffff",
  inverse = false,
  valueState = null,
  maxHeightRatio = 1
}) {
  const VIEWBOX_WIDTH = 90;
  const VIEWBOX_HEIGHT = 250;

  const TUBE_X = 16;
  const TUBE_WIDTH = 55;
  const TUBE_RADIUS = 10;

  const TUBE_TOP = 20;
  const TUBE_HEIGHT = 180;

  const clamped = Math.max(0, Math.min(1, value));
  const effectiveValue = inverse ? 1 - clamped : clamped;

  const fillHeight = effectiveValue * TUBE_HEIGHT;
  const fillY = TUBE_TOP + (TUBE_HEIGHT - fillHeight);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="vertical-tube"
      style={{
        transform: `scaleY(${maxHeightRatio})`,
        transformOrigin: "bottom"
      }}
      role="img"
    >
      {displayValue !== null && (
        <text
          x={VIEWBOX_WIDTH / 2}
          y={14}
          textAnchor="middle"
          className={`tube-value ${valueState ?? ""}`}
        >
          {displayValue}
        </text>
      )}

      <rect
        x={TUBE_X}
        y={TUBE_TOP}
        width={TUBE_WIDTH}
        height={TUBE_HEIGHT}
        rx={TUBE_RADIUS}
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,215,120,0.35)"
      />

      <rect
        x={TUBE_X}
        y={fillY}
        width={TUBE_WIDTH}
        height={fillHeight}
        rx={TUBE_RADIUS}
        fill={color}
        opacity="0.85"
      />

      <rect
        x={TUBE_X + 5}
        y={TUBE_TOP + 6}
        width={8}
        height={TUBE_HEIGHT - 12}
        rx={4}
        fill="rgba(255,255,255,0.15)"
        pointerEvents="none"
      />

      <text
        x={VIEWBOX_WIDTH / 2}
        y={TUBE_TOP + TUBE_HEIGHT + 18}
        textAnchor="middle"
        fill="#f5c26b"
        fontSize="11"
        fontWeight="600"
      >
        {label}
      </text>
    </svg>
  );
}
