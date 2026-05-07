// ============================================================================
// ActivePosition.jsx — affichage compact de la position en cours
// Rendu uniquement si une position est active. Sinon parent ne l'instancie pas.
// Exit guards : indicatifs (armed quand GUARD_ENABLED dans useExitGuards).
// ============================================================================

function fmt(v, digits = 2) {
  if (!Number.isFinite(Number(v))) return "—";
  return Number(v).toFixed(digits);
}

export default function ActivePosition({ position }) {
  if (!position) return null;

  const pnl   = Number(position.pnl_eur ?? 0);
  const pnlCls = pnl > 0 ? "ma-ap-pnl-pos" : pnl < 0 ? "ma-ap-pnl-neg" : "ma-ap-pnl-zero";
  const side  = String(position.side ?? "").toUpperCase();

  const dur = Number(position.duration_h);
  const durStr = Number.isFinite(dur)
    ? (dur >= 1 ? `${dur.toFixed(1)}h` : `${Math.round(dur * 60)}min`)
    : "—";

  return (
    <div className="ma-active-position">
      <div className="ma-ap-header">
        <span className="ma-ap-title">ACTIVE POSITION</span>
        <span className="ma-ap-ticket">#{position.ticket ?? "—"}</span>
      </div>

      <div className="ma-ap-row-main">
        <span className="ma-ap-sym">{position.symbol}</span>
        <span className={`ma-ap-side ma-ap-side-${side.toLowerCase()}`}>{side}</span>
        <span className="ma-ap-lots">{fmt(position.lots, 2)} lot</span>
        <span className={`ma-ap-pnl ${pnlCls}`}>
          {pnl >= 0 ? "+" : ""}{fmt(pnl, 2)} €
        </span>
      </div>

      <div className="ma-ap-row-meta">
        <span className="ma-ap-meta-cell">
          <span className="ma-ap-meta-label">Today</span>
          <span className="ma-ap-meta-val">{fmt(position.intraday_change, 2)}%</span>
        </span>
        <span className="ma-ap-meta-cell">
          <span className="ma-ap-meta-label">Held</span>
          <span className="ma-ap-meta-val">{durStr}</span>
        </span>
        <span className="ma-ap-meta-cell">
          <span className="ma-ap-meta-label">RSI-H1</span>
          <span className="ma-ap-meta-val">{fmt(position.rsi_h1, 1)}</span>
        </span>
        <span className="ma-ap-meta-cell">
          <span className="ma-ap-meta-label">PnL/ATR</span>
          <span className="ma-ap-meta-val">{fmt(position.pnl_atr_h1, 2)}</span>
        </span>
      </div>

      <div className="ma-ap-row-guards">
        <span className="ma-ap-guard ma-ap-guard-armed">EXTREME-M1 · armed</span>
        <span className="ma-ap-guard ma-ap-guard-armed">TIMEOUT-GREEN · armed</span>
      </div>
    </div>
  );
}
