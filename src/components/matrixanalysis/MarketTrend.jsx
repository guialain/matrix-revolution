import React from "react";
import useMT5Data from "../../hooks/useMT5Data";
import "../../styles/stylesmatrixanalysis/markettrend.css";

export default function MarketTrend() {

  const { data, ready } = useMT5Data();

  if (!ready || !data?.macro?.slots) {
    return <div className="markettrend-panel">Market Trend — loading…</div>;
  }

  const rows = data.macro.slots;

  return (
    <div className="markettrend-panel">

      {/* HEADER */}
      <div className="markettrend-header-row">
        <div className="markettrend-header-col">Asset</div>
        <div className="markettrend-header-col">Bid</div>
        <div className="markettrend-header-col">Daily %</div>
        <div className="markettrend-header-col">Dir</div>
      </div>

      {/* ROWS */}
      {rows.map((row, i) => {

        const bid = Number.isFinite(row.bid) ? row.bid : null;
        const change = Number.isFinite(row.intraday_change)
          ? row.intraday_change
          : null;

        const direction =
          change > 0 ? "up" :
          change < 0 ? "down" :
          "flat";

        const dirIcon =
          direction === "up" ? "▲" :
          direction === "down" ? "▼" :
          "▶";

        return (
          <div key={i} className="markettrend-row">

            <div className="markettrend-name">
              {row.symbol || "—"}
            </div>

            <div className="markettrend-num">
              {bid != null ? bid.toFixed(2) : "—"}
            </div>

            <div className={`markettrend-num markettrend-${direction}`}>
              {change != null ? `${change.toFixed(2)} %` : "—"}
            </div>

            <div className={`markettrend-dir markettrend-${direction}`}>
              {dirIcon}
            </div>

          </div>
        );
      })}

    </div>
  );
}
