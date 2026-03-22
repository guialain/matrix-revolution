import { useState, useMemo } from "react";
import "../../styles/stylesmatrixanalysis/closedtrades.css";

// ─── SortHeader ──────────────────────────────────────────────────────────────

function SortHeader({ col, label, style, sortCol, sortDir, onSort }) {
  return (
    <span
      className="ct-col-sort"
      onClick={() => onSort(col)}
      style={{ color: sortCol === col ? "#ffd88a" : "#f5c26b", ...style }}
    >
      {label}{sortCol === col ? (sortDir === "desc" ? " ▼" : " ▲") : ""}
    </span>
  );
}

// ─── TradeRow ─────────────────────────────────────────────────────────────────

function TradeRow({ trade, rank }) {
  const pnl      = trade.pnl_eur ?? 0;
  const dateOnly = trade.close_time?.split(" ")[0]?.replace(/\./g, "/") ?? "—";
  const timeOnly = trade.close_time?.split(" ")[1]?.slice(0, 5) ?? "—";
  const swap     = trade.swap ?? 0;

  return (
    <div className={`ct-trade-row${rank % 2 === 0 ? " even" : ""}`}>
      <span className="ct-trade-rank">{rank}</span>
      <span className="ct-trade-symbol">{trade.symbol}</span>
      <span className={trade.side === "BUY" ? "ct-trade-side-buy" : "ct-trade-side-sell"}>{trade.side}</span>
      <span className="ct-trade-lots">{trade.lots ?? "—"}</span>
      <span className="ct-trade-open">{trade.open_price ?? "—"}</span>
      <span className="ct-trade-date">{dateOnly}</span>
      <span className="ct-trade-time">{timeOnly}</span>
      <span className={swap < 0 ? "ct-trade-swap-neg" : swap > 0 ? "ct-trade-swap-pos" : "ct-trade-swap-zero"}>
        {Number(swap).toFixed(2)}
      </span>
      <span className={`ct-trade-pnl${pnl >= 0 ? " pos" : " neg"}`}>
        {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}€
      </span>
    </div>
  );
}

// ─── ClosedTrades ────────────────────────────────────────────────────────────

export default function ClosedTrades({ trades = [], loading = false }) {
  const [sortCol, setSortCol] = useState("time");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (sortCol === "symbol") return sortDir === "asc" ? (a.symbol ?? "").localeCompare(b.symbol ?? "") : (b.symbol ?? "").localeCompare(a.symbol ?? "");
      if (sortCol === "side")   return sortDir === "asc" ? (a.side ?? "").localeCompare(b.side ?? "")     : (b.side ?? "").localeCompare(a.side ?? "");
      if (sortCol === "time")   return sortDir === "asc" ? (a.close_time ?? "").localeCompare(b.close_time ?? "") : (b.close_time ?? "").localeCompare(a.close_time ?? "");
      let va, vb;
      if (sortCol === "pnl_abs") { va = Math.abs(a.pnl_eur ?? 0); vb = Math.abs(b.pnl_eur ?? 0); }
      else if (sortCol === "pnl")  { va = a.pnl_eur ?? 0;    vb = b.pnl_eur ?? 0; }
      else if (sortCol === "lots") { va = a.lots ?? 0;         vb = b.lots ?? 0; }
      else if (sortCol === "open") { va = a.open_price ?? 0;   vb = b.open_price ?? 0; }
      else { va = 0; vb = 0; }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [trades, sortCol, sortDir]);

  const handleSort = (col) => {
    setSortDir(sortCol === col && sortDir === "desc" ? "asc" : "desc");
    setSortCol(col);
  };

  if (loading)        return <div className="ct-loading">Chargement des trades…</div>;
  if (!trades.length) return <div className="ct-empty">Aucun trade fermé</div>;

  const sh = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="ct-container">
      <div className="ct-header">
        <span className="ct-header-title">Closed Trades</span>
        <span className="ct-header-count">{trades.length}</span>
      </div>

      <div className="ct-scroll">
        <div className="ct-table-header">
          <span className="ct-col-label">#</span>
          <SortHeader col="symbol" label="Symbole" {...sh} />
          <SortHeader col="side"   label="Side"    {...sh} />
          <SortHeader col="lots"   label="Lots"    {...sh} />
          <SortHeader col="open"   label="Open"    {...sh} />
          <SortHeader col="time"   label="Date"    {...sh} />
          <SortHeader col="time"   label="Heure"   {...sh} />
          <span className="ct-col-label">Swap</span>
          <SortHeader col="pnl"    label="PnL"     {...sh} style={{ textAlign: "right" }} />
        </div>

        {sorted.map((t, i) => (
          <TradeRow key={t.ticket} trade={t} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
