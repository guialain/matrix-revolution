import { useMemo } from "react";
import useClosedTrades from "../../hooks/useClosedTrades";
import "../../styles/stylesmatrixanalysis/performance.css";

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
    <div className="perf-stat-box">
      <span className="perf-stat-label">{label}</span>
      <span className="perf-stat-value" style={{ color: color ?? "#f5c26b" }}>{value}</span>
      {sub && <span className="perf-stat-sub">{sub}</span>}
    </div>
  );
}

// ─── Performance ─────────────────────────────────────────────────────────────

export default function Performance({ account }) {
  const { trades } = useClosedTrades(5000);
  const s = useMemo(() => computeStats(trades, account), [trades, account]);

  if (!s) return null;

  const pnlColor = s.total    >= 0   ? "#4ade80" : "#f87171";
  const pfColor  = s.pf === "∞" || s.pf >= 1.5 ? "#4ade80" : s.pf >= 1 ? "#facc15" : "#f87171";
  const wrColor  = s.winRate  >= 55  ? "#4ade80" : s.winRate >= 45 ? "#facc15" : "#f87171";

  return (
    <div className="perf-container">
      <div className="perf-header">
        <span className="perf-header-title">Performance</span>
        <span className="perf-header-date">{new Date().toLocaleDateString("fr-FR")}</span>
      </div>

      <div className="perf-kpi-grid">
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
    </div>
  );
}
