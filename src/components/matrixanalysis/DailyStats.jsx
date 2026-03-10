import { useState, useMemo } from "react";
import useClosedTrades from "../../hooks/useClosedTrades";
import "../../styles/stylesmatrixanalysis/dailystats.css";

// ─── helpers ────────────────────────────────────────────────────────────────

function computeStats(trades, account) {
  if (!trades.length) return null;

  const ordered = [...trades].sort(
    (a, b) => (a.close_time ?? "").localeCompare(b.close_time ?? "")
  );

  const pnls      = ordered.map(t => t.pnl_eur ?? 0);
  const total     = pnls.reduce((a, b) => a + b, 0);
  const winners   = ordered.filter(t => (t.pnl_eur ?? 0) > 0);
  const losers    = ordered.filter(t => (t.pnl_eur ?? 0) < 0);
  const grossWin  = winners.reduce((a, t) => a + (t.pnl_eur ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + (t.pnl_eur ?? 0), 0));
  const pf        = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  let peak = 0, cum = 0, maxDD = 0;
  for (const p of pnls) {
    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  const expectancy     = ordered.length ? +(total / ordered.length).toFixed(2) : 0;
  const capitalFinal   = account?.equity ?? null;
  const capitalInitial = account?.balance != null ? +(account.balance - total).toFixed(2) : null;
  const performance    = capitalInitial && capitalInitial > 0
    ? +((total / capitalInitial) * 100).toFixed(2) : null;
  const best  = ordered.reduce((a, b) => (b.pnl_eur ?? 0) > (a.pnl_eur ?? 0) ? b : a);
  const worst = ordered.reduce((a, b) => (b.pnl_eur ?? 0) < (a.pnl_eur ?? 0) ? b : a);

  return {
    total: +total.toFixed(2),
    count: ordered.length,
    winRate: ordered.length ? +((winners.length / ordered.length) * 100).toFixed(1) : 0,
    pf: isFinite(pf) ? +pf.toFixed(2) : "∞",
    maxDD: +maxDD.toFixed(2),
    expectancy,
    capitalInitial,
    capitalFinal,
    performance,
    best,
    worst,
    winners: winners.length,
    losers:  losers.length,
  };
}

// ─── StatBox ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, color }) {
  return (
    <div className="ds-stat-box">
      <span className="ds-stat-label">{label}</span>
      <span className="ds-stat-value" style={{ color: color ?? "#f5c26b" }}>{value}</span>
      {sub && <span className="ds-stat-sub">{sub}</span>}
    </div>
  );
}

// ─── SortHeader ──────────────────────────────────────────────────────────────

function SortHeader({ col, label, style, sortCol, sortDir, onSort }) {
  return (
    <span
      className="ds-col-sort"
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
    <div className={`ds-trade-row${rank % 2 === 0 ? " even" : ""}`}>
      <span className="ds-trade-rank">{rank}</span>
      <span className="ds-trade-symbol">{trade.symbol}</span>
      <span className={trade.side === "BUY" ? "ds-trade-side-buy" : "ds-trade-side-sell"}>{trade.side}</span>
      <span className="ds-trade-lots">{trade.lots ?? "—"}</span>
      <span className="ds-trade-open">{trade.open_price ?? "—"}</span>
      <span className="ds-trade-date">{dateOnly}</span>
      <span className="ds-trade-time">{timeOnly}</span>
      <span className={swap < 0 ? "ds-trade-swap-neg" : swap > 0 ? "ds-trade-swap-pos" : "ds-trade-swap-zero"}>
        {Number(swap).toFixed(2)}
      </span>
      <span className={`ds-trade-pnl${pnl >= 0 ? " pos" : " neg"}`}>
        {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}€
      </span>
    </div>
  );
}

// ─── DailyStats ──────────────────────────────────────────────────────────────

export default function DailyStats({ account }) {
  const { trades, loading } = useClosedTrades(5000);
  const [sortCol, setSortCol] = useState("pnl_abs");
  const [sortDir, setSortDir] = useState("desc");

  const s = useMemo(() => computeStats(trades, account), [trades, account]);

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

  if (loading)        return <div className="ds-loading">Chargement des trades…</div>;
  if (!trades.length) return <div className="ds-empty">Aucun trade fermé</div>;

  const pnlColor = s.total    >= 0   ? "#4ade80" : "#f87171";
  const pfColor  = s.pf === "∞" || s.pf >= 1.5 ? "#4ade80" : s.pf >= 1 ? "#facc15" : "#f87171";
  const wrColor  = s.winRate  >= 55  ? "#4ade80" : s.winRate >= 45 ? "#facc15" : "#f87171";

  const sh = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="ds-container">

      {/* HEADER */}
      <div className="ds-header">
        <span className="ds-header-title">Performance</span>
        <span className="ds-header-date">{new Date().toLocaleDateString("fr-FR")}</span>
      </div>

      {/* KPI GRID */}
      <div className="ds-kpi-grid">
        <StatBox label="PnL Total"       value={`${s.total >= 0 ? "+" : ""}${s.total.toFixed(0)}€`}                           sub={`${s.winners}W / ${s.losers}L`}      color={pnlColor} />
        <StatBox label="Trades"          value={s.count}                                                                        sub={`${s.winRate}% win rate`} />
        <StatBox label="Win Rate"        value={`${s.winRate}%`}                                                                sub={`${s.winners} gagnants`}             color={wrColor} />
        <StatBox label="Profit Factor"   value={s.pf}                                                                           sub="gains / pertes"                      color={pfColor} />
        <StatBox label="Drawdown Max"    value={`-${s.maxDD}€`}                                                                 color="#f87171" />
        <StatBox label="Expectancy"      value={`${s.expectancy >= 0 ? "+" : ""}${s.expectancy}€`}                             sub="par trade"  color={s.expectancy >= 0 ? "#4ade80" : "#f87171"} />
        <StatBox label="Meilleur Trade"  value={`+${s.best.pnl_eur.toFixed(0)}€`}                                              sub={s.best.symbol}  color="#4ade80" />
        <StatBox label="Pire Trade"      value={`${s.worst.pnl_eur.toFixed(0)}€`}                                              sub={`${s.worst.symbol} ${s.worst.side}`} color="#f87171" />
        <StatBox label="Capital Initial" value={s.capitalInitial != null ? `${s.capitalInitial.toFixed(0)}€` : "—"} />
        <StatBox label="Capital Final"   value={s.capitalFinal   != null ? `${s.capitalFinal.toFixed(0)}€`   : "—"} />
        <StatBox label="Performance"     value={s.performance    != null ? `${s.performance >= 0 ? "+" : ""}${s.performance}%` : "—"} sub="du jour" color={s.performance >= 0 ? "#4ade80" : "#f87171"} />
      </div>

      {/* TABLE */}
      <div className="ds-table">
        <div className="ds-table-header">
          <span className="ds-col-label">#</span>
          <SortHeader col="symbol" label="Symbole" {...sh} />
          <SortHeader col="side"   label="Side"    {...sh} />
          <SortHeader col="lots"   label="Lots"    {...sh} />
          <SortHeader col="open"   label="Open"    {...sh} />
          <SortHeader col="time"   label="Date"    {...sh} />
          <SortHeader col="time"   label="Heure"   {...sh} />
          <span className="ds-col-label">Swap</span>
          <SortHeader col="pnl"    label="PnL"     {...sh} style={{ textAlign: "right" }} />
        </div>

        {sorted.map((t, i) => (
          <TradeRow key={t.ticket} trade={t} rank={i + 1} />
        ))}
      </div>

    </div>
  );
}
