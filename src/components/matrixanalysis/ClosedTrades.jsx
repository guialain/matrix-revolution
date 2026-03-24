import { useState, useMemo } from "react";
import "../../styles/stylesmatrixanalysis/closedtrades.css";

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseMT5(ct) {
  if (!ct) return null;
  const d = new Date(ct.replace(/\./g, "-").replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function netPnl(t) {
  return (t.pnl_eur ?? 0) + (t.swap ?? 0) + (t.commission ?? 0);
}

function fmtDuration(open, close) {
  const o = parseMT5(open), c = parseMT5(close);
  if (!o || !c) return "\u2014";
  const min = Math.round((c - o) / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function fmtTime(ct) {
  if (!ct) return "\u2014";
  const parts = ct.split(" ");
  const date = (parts[0] ?? "").replace(/\./g, "/");
  const time = (parts[1] ?? "").slice(0, 5);
  return `${date} ${time}`;
}

// ─── filters ─────────────────────────────────────────────────────────────────

const PNL_FILTERS = [
  { key: "all",  label: "Tous" },
  { key: "win",  label: "Gains" },
  { key: "loss", label: "Pertes" },
];

// ─── SortHeader ──────────────────────────────────────────────────────────────

function SortHeader({ col, label, sortCol, sortDir, onSort }) {
  return (
    <span
      className="ct-col-sort"
      onClick={() => onSort(col)}
      style={{ color: sortCol === col ? "#ffd88a" : undefined }}
    >
      {label}{sortCol === col ? (sortDir === "desc" ? " \u25bc" : " \u25b2") : ""}
    </span>
  );
}

// ─── TradeRow ────────────────────────────────────────────────────────────────

function TradeRow({ trade, rank, equity }) {
  const pnl = netPnl(trade);

  return (
    <div className={`ct-trade-row${rank % 2 === 0 ? " even" : ""}`}>
      <span className="ct-cell ct-rank">{rank}</span>
      <span className="ct-cell ct-time">{fmtTime(trade.close_time)}</span>
      <span className="ct-cell ct-symbol">{trade.symbol}</span>
      <span className={`ct-cell ${trade.side === "BUY" ? "ct-side-buy" : "ct-side-sell"}`}>{trade.side}</span>
      <span className="ct-cell ct-lots">{trade.lots ?? "\u2014"}</span>
      <span className="ct-cell ct-price">{trade.open_price ?? "\u2014"}</span>
      <span className="ct-cell ct-price">{trade.close_price ?? "\u2014"}</span>
      <span className="ct-cell ct-dur">{fmtDuration(trade.open_time, trade.close_time)}</span>
      <span className={`ct-cell ct-pnl${pnl >= 0 ? " pos" : " neg"}`}>
        {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}\u20ac
      </span>
      <span className="ct-cell ct-equity">{equity != null ? `${equity.toFixed(0)}\u20ac` : "\u2014"}</span>
    </div>
  );
}

// ─── ClosedTrades ────────────────────────────────────────────────────────────

export default function ClosedTrades({ trades = [], loading = false, account }) {
  const [sortCol, setSortCol] = useState("time");
  const [sortDir, setSortDir] = useState("desc");
  const [pnlFilter, setPnlFilter] = useState("all");

  // PnL sub-filter (all/win/loss)
  const pnlFiltered = useMemo(() => {
    if (pnlFilter === "win")  return trades.filter(t => netPnl(t) > 0);
    if (pnlFilter === "loss") return trades.filter(t => netPnl(t) < 0);
    return trades;
  }, [trades, pnlFilter]);

  const sorted = useMemo(() => {
    return [...pnlFiltered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortCol === "symbol") return dir * (a.symbol ?? "").localeCompare(b.symbol ?? "");
      if (sortCol === "side")   return dir * (a.side ?? "").localeCompare(b.side ?? "");
      if (sortCol === "time")   return dir * (a.close_time ?? "").localeCompare(b.close_time ?? "");
      if (sortCol === "pnl")    return dir * (netPnl(a) - netPnl(b));
      if (sortCol === "lots")   return dir * ((a.lots ?? 0) - (b.lots ?? 0));
      if (sortCol === "dur") {
        const da = (parseMT5(a.close_time) ?? 0) - (parseMT5(a.open_time) ?? 0);
        const db = (parseMT5(b.close_time) ?? 0) - (parseMT5(b.open_time) ?? 0);
        return dir * (da - db);
      }
      return 0;
    });
  }, [pnlFiltered, sortCol, sortDir]);

  // Compute running equity (based on chronological order of ALL trades in the period)
  const equityMap = useMemo(() => {
    const chrono = [...trades].sort((a, b) => (a.close_time ?? "").localeCompare(b.close_time ?? ""));
    const initial = account?.balance != null
      ? account.balance - chrono.reduce((s, t) => s + netPnl(t), 0)
      : null;
    const map = new Map();
    let cum = initial ?? 0;
    for (const t of chrono) {
      cum += netPnl(t);
      map.set(t.ticket, +cum.toFixed(2));
    }
    return map;
  }, [trades, account]);

  const handleSort = (col) => {
    setSortDir(sortCol === col && sortDir === "desc" ? "asc" : "desc");
    setSortCol(col);
  };

  if (loading) return <div className="ct-loading">Chargement des trades\u2026</div>;
  if (!trades.length) return <div className="ct-empty">Aucun trade ferm\u00e9</div>;

  const sh = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="ct-container">
      <div className="ct-header">
        <span className="ct-header-title">Results</span>
        <div className="ct-pnl-filters">
          {PNL_FILTERS.map(f => (
            <button
              key={f.key}
              className={`ct-pnl-btn${pnlFilter === f.key ? " active" : ""}`}
              onClick={() => setPnlFilter(f.key)}
            >{f.label}</button>
          ))}
        </div>
        <span className="ct-header-count">{sorted.length}</span>
      </div>

      <div className="ct-scroll">
        <div className="ct-table-header">
          <span className="ct-col-label">#</span>
          <SortHeader col="time"   label="Timestamp" {...sh} />
          <SortHeader col="symbol" label="Symbol"    {...sh} />
          <SortHeader col="side"   label="Side"      {...sh} />
          <SortHeader col="lots"   label="Size"      {...sh} />
          <span className="ct-col-label">Open</span>
          <span className="ct-col-label">Close</span>
          <SortHeader col="dur"    label="Dur\u00e9e" {...sh} />
          <SortHeader col="pnl"    label="PnL\u20ac"  {...sh} />
          <span className="ct-col-label">Equity</span>
        </div>

        {sorted.map((t, i) => (
          <TradeRow
            key={t.ticket}
            trade={t}
            rank={i + 1}
            equity={equityMap.get(t.ticket) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
