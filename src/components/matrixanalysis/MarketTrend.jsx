import React from "react";
import useMT5Data from "../../hooks/useMT5Data";
import "../../styles/stylesmatrixanalysis/markettrend.css";

/* ─── PROGRESS BAR ──────────────────────────────────────────────────────── */

function ProgressBar({ value, maxVal }) {
  const pct   = Math.min((Math.abs(value) / (maxVal || 1)) * 100, 100);
  const isPos = value >= 0;
  const color = isPos ? "#00ff88" : "#ff3d5a";
  return (
    <div className="mt-progbar-track">
      <div
        className="mt-progbar-fill"
        style={{
          left:       isPos ? "50%" : `calc(50% - ${pct / 2}%)`,
          width:      `${pct / 2}%`,
          background: color,
          boxShadow:  `0 0 6px ${color}`,
        }}
      />
    </div>
  );
}

/* ─── DIR BADGE ─────────────────────────────────────────────────────────── */

function DirBadge({ direction }) {
  const label = direction === "up" ? "BULL" : direction === "down" ? "BEAR" : "FLAT";
  return (
    <span className={`mt-badge mt-badge-${direction}`}>
      {label}
    </span>
  );
}

/* ─── MAIN COMPONENT ────────────────────────────────────────────────────── */

export default function MarketTrend() {
  const { data, ready } = useMT5Data();

  if (!ready || !data?.macro?.slots) {
    return (
      <div className="markettrend-panel markettrend-loading">
        <span className="mt-live-dot" />
        MARKET TREND — loading…
      </div>
    );
  }

  const rows   = data.macro.slots;
  const maxAbs = Math.max(...rows
    .map(r => Math.abs(Number.isFinite(r.intraday_change) ? r.intraday_change : 0))
  ) || 1;

  return (
    <div className="markettrend-panel">

      {/* ── HEADER BAR ── */}
      <div className="mt-topbar">
        <div className="mt-topbar-left">
          <span className="mt-live-dot" />
          <span className="mt-title">MARKET TREND</span>
        </div>
        <span className="mt-topbar-time">
          {new Date().toLocaleTimeString("fr-FR", {
            hour:   "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* ── COLUMN HEADERS ── */}
      <div className="mt-col-headers">
        <div className="mt-ch mt-ch-asset">ASSET</div>
        <div className="mt-ch mt-ch-bid">BID</div>
        <div className="mt-ch mt-ch-pct">DAILY %</div>
        <div className="mt-ch mt-ch-dir">DIR</div>
      </div>

      {/* ── ROWS ── */}
      <div className="mt-rows">
        {rows.map((row, i) => {
          const bid    = Number.isFinite(row.bid)            ? row.bid            : null;
          const change = Number.isFinite(row.intraday_change) ? row.intraday_change : null;
          const direction =
            change > 0 ? "up" :
            change < 0 ? "down" :
            "flat";

          const isLast = i === rows.length - 1;

          return (
            <React.Fragment key={i}>
              <div className="mt-row">

                {/* ASSET */}
                <div className="mt-cell mt-asset">
                  {row.symbol || "—"}
                </div>

                {/* BID */}
                <div className="mt-cell mt-bid">
                  {bid != null
                    ? bid.toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                    : "—"}
                </div>

                {/* DAILY % */}
                <div className="mt-cell mt-pct">
                  <span className={`mt-pct-value mt-${direction}`}>
                    {change != null
                      ? `${change > 0 ? "+" : ""}${change.toFixed(2)} %`
                      : "—"}
                  </span>
                  {change != null && (
                    <ProgressBar value={change} maxVal={maxAbs} />
                  )}
                </div>

                {/* DIR BADGE */}
                <div className="mt-cell mt-dir">
                  <DirBadge direction={direction} />
                </div>

              </div>

              {/* SÉPARATEUR */}
              {!isLast && <div className="mt-separator" />}
            </React.Fragment>
          );
        })}
      </div>

    </div>
  );
}
