import "../../styles/stylesterminalMT5/accounthealth.css";

export default function AccountHealth({ account = {}, totalExposure = 0 }) {

  const balance     = Number(account.balance     || 0);
  const equity      = Number(account.equity      || 0);
  const pnl         = Number(account.pnl         || 0);
  const marginLevel = Number(account.marginLevel || 0);
  const margin      = Number(account.margin      || 0);

  const leverageUsed = equity > 0 ? totalExposure / equity : 0;
  const drawdown     = balance > 0 ? Math.max(0, (balance - equity) / balance) : 0;

  const fmtEUR = v => `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString("fr-FR")}€`;
  const fmtK   = v => `${(v / 1000).toFixed(1)}k€`;

  // ── color thresholds ──
  const green  = "#00ff88";
  const yellow = "#f1c40f";
  const orange = "#f39c12";
  const red    = "#ff3d5a";

  function riskColor(ratio) {
    if (ratio < 0.3) return green;
    if (ratio < 0.5) return yellow;
    if (ratio < 0.7) return orange;
    return red;
  }

  function pnlColor(v) {
    return v >= 0 ? green : red;
  }

  function marginColor(ml) {
    if (ml >= 1000) return green;
    if (ml >= 750)  return yellow;
    if (ml >= 500)  return orange;
    return red;
  }

  // ── bar pct (0–1) ──
  const ddPct  = Math.min(drawdown, 1);
  const eqPct  = balance > 0 ? Math.min(equity / balance, 1) : 0;
  const mlPct  = Math.min(marginLevel / 2000, 1);
  const levPct = Math.min(leverageUsed / 30, 1);
  const pnlPct = balance > 0 ? Math.min(Math.abs(pnl) / balance, 1) : 0;

  const metrics = [
    {
      label: "Balance",
      pct:   1,
      color: green,
      value: fmtK(balance),
    },
    {
      label: "Equity",
      pct:   eqPct,
      color: riskColor(1 - eqPct),
      value: fmtK(equity),
    },
    {
      label: "Margin Lvl",
      pct:   mlPct,
      color: marginColor(marginLevel),
      value: `${Math.round(marginLevel)}%`,
    },
    {
      label: "Leverage",
      pct:   levPct,
      color: riskColor(levPct),
      value: `x${leverageUsed.toFixed(1)}`,
    },
    {
      label: "PnL",
      pct:   pnlPct,
      color: pnlColor(pnl),
      value: fmtEUR(pnl),
    },
  ];

  return (
    <div className="ah-container">
      <div className="ah-title">ACCOUNT HEALTH</div>
      <div className="ah-metrics">
        {metrics.map(m => (
          <div key={m.label} className="ah-row">
            <span className="ah-label">{m.label}</span>
            <div className="ah-track">
              <div
                className="ah-fill"
                style={{ width: `${Math.round(m.pct * 100)}%`, background: m.color }}
              />
            </div>
            <span className="ah-value" style={{ color: m.color }}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
