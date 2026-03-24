import { useState, useMemo, useEffect } from "react";
import "../../styles/stylesmatrixanalysis/performance.css";

// ─── date helpers ────────────────────────────────────────────────────────────

const PRESETS = [
  { key: "day",    label: "Jour" },
  { key: "week",   label: "Semaine" },
  { key: "month",  label: "Mois" },
  { key: "all",    label: "Tout" },
  { key: "custom", label: "Custom" },
];

/** Parse "2026.03.24 01:41:00" or "2026/03/24 01:41:00" → Date */
function parseCloseTime(ct) {
  if (!ct) return null;
  const s = ct.replace(/[./]/g, "-");        // "2026-03-24 01:41:00"
  const d = new Date(s.replace(" ", "T"));   // "2026-03-24T01:41:00"
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function filterTrades(trades, preset, customFrom, customTo) {
  if (preset === "all") return trades;

  const now = new Date();
  let from, to;

  if (preset === "custom") {
    from = customFrom ? startOfDay(new Date(customFrom)) : null;
    to   = customTo   ? new Date(new Date(customTo).setHours(23, 59, 59, 999)) : null;
  } else if (preset === "day") {
    from = startOfDay(now);
    to   = null;
  } else if (preset === "week") {
    from = new Date(now.getTime() - 7 * 86400 * 1000);
    to   = null;
  } else if (preset === "month") {
    from = new Date(now.getTime() - 30 * 86400 * 1000);
    to   = null;
  } else {
    from = null;
    to   = null;
  }

  return trades.filter(t => {
    const d = parseCloseTime(t.close_time);
    if (!d) return false;
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
}

// ─── stats ───────────────────────────────────────────────────────────────────

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
    pf: isFinite(pf) ? +pf.toFixed(2) : "\u221e",
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

export default function Performance({ account, trades = [], onFilteredTrades }) {
  const [preset, setPreset]         = useState("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");

  const filtered = useMemo(
    () => filterTrades(trades, preset, customFrom, customTo),
    [trades, preset, customFrom, customTo]
  );

  useEffect(() => {
    onFilteredTrades?.(filtered);
  }, [filtered, onFilteredTrades]);

  const s = useMemo(() => computeStats(filtered, account), [filtered, account]);

  if (!s) {
    return (
      <div className="perf-container">
        <div className="perf-header">
          <span className="perf-header-title">Performance</span>
        </div>
        <div className="perf-filter-bar">
          {PRESETS.map(p => (
            <button
              key={p.key}
              className={`perf-filter-btn${preset === p.key ? " active" : ""}`}
              onClick={() => setPreset(p.key)}
            >{p.label}</button>
          ))}
          {preset === "custom" && (
            <div className="perf-custom-dates">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span className="perf-custom-sep">&rarr;</span>
              <input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
          <span className="perf-filter-count">0 trades</span>
        </div>
        <div className="perf-empty">Aucun trade sur cette p&eacute;riode</div>
      </div>
    );
  }

  const pnlColor = s.total    >= 0   ? "#4ade80" : "#f87171";
  const pfColor  = s.pf === "\u221e" || s.pf >= 1.5 ? "#4ade80" : s.pf >= 1 ? "#facc15" : "#f87171";
  const wrColor  = s.winRate  >= 55  ? "#4ade80" : s.winRate >= 45 ? "#facc15" : "#f87171";

  return (
    <div className="perf-container">
      <div className="perf-header">
        <span className="perf-header-title">Performance</span>
        <span className="perf-header-date">{filtered.length} trades</span>
      </div>

      <div className="perf-filter-bar">
        {PRESETS.map(p => (
          <button
            key={p.key}
            className={`perf-filter-btn${preset === p.key ? " active" : ""}`}
            onClick={() => setPreset(p.key)}
          >{p.label}</button>
        ))}
        {preset === "custom" && (
          <div className="perf-custom-dates">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span className="perf-custom-sep">&rarr;</span>
            <input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)} />
          </div>
        )}
        <span className="perf-filter-count">{filtered.length} trades</span>
      </div>

      <div className="perf-kpi-grid">
        <StatBox label="PnL Total"       value={`${s.total >= 0 ? "+" : ""}${s.total.toFixed(0)}\u20ac`}                           sub={`${s.winners}W / ${s.losers}L`}      color={pnlColor} />
        <StatBox label="Trades"          value={s.count}                                                                        sub={`${s.winRate}% win rate`} />
        <StatBox label="Win Rate"        value={`${s.winRate}%`}                                                                sub={`${s.winners} gagnants`}             color={wrColor} />
        <StatBox label="Profit Factor"   value={s.pf}                                                                           sub="gains / pertes"                      color={pfColor} />
        <StatBox label="Drawdown Max"    value={`-${s.maxDD}\u20ac`}                                                                 color="#f87171" />
        <StatBox label="Expectancy"      value={`${s.expectancy >= 0 ? "+" : ""}${s.expectancy}\u20ac`}                             sub="par trade"  color={s.expectancy >= 0 ? "#4ade80" : "#f87171"} />
        <StatBox label="Meilleur Trade"  value={`+${s.best.pnl_eur.toFixed(0)}\u20ac`}                                              sub={s.best.symbol}  color="#4ade80" />
        <StatBox label="Pire Trade"      value={`${s.worst.pnl_eur.toFixed(0)}\u20ac`}                                              sub={`${s.worst.symbol} ${s.worst.side}`} color="#f87171" />
        <StatBox label="Capital Initial" value={s.capitalInitial != null ? `${s.capitalInitial.toFixed(0)}\u20ac` : "\u2014"} />
        <StatBox label="Capital Final"   value={s.capitalFinal   != null ? `${s.capitalFinal.toFixed(0)}\u20ac`   : "\u2014"} />
        <StatBox label="Performance"     value={s.performance    != null ? `${s.performance >= 0 ? "+" : ""}${s.performance}%` : "\u2014"} sub="p\u00e9riode" color={s.performance >= 0 ? "#4ade80" : "#f87171"} />
      </div>
    </div>
  );
}
