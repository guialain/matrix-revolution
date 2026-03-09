// chart (remonter à src/components)
import VerticalTube from "../charts/VerticalTube";

// styles (remonter à src/, puis stylespages)
import "../../styles/stylesterminalMT5/accounthealth.css";

export default function AccountHealth({ account = {}, totalExposure = 0 }) {
  // =========================
  // RAW ACCOUNT METRICS
  // =========================
  const balance = Number(account.balance || 0);
  const equity  = Number(account.equity  || 0);
  const pnl     = Number(account.pnl     || 0);

  // =========================
  // 1) Margin Level (MT5 %)
  // =========================
  const MARGIN_REF_PCT = 2000;
  const marginLevel = Number(account.marginLevel || 0);
  const marginLiquidLevel = Math.min(marginLevel / MARGIN_REF_PCT, 1);

  // =========================
  // 2) Drawdown réel
  // =========================
  const drawdown = balance > 0
    ? Math.max(0, Math.min(1, (balance - equity) / balance))
    : 0;

  // =========================
  // 3) PnL Pressure
  // =========================
  const pnlPressure = balance > 0
    ? Math.max(0, Math.min(1, Math.abs(Math.min(0, pnl)) / balance))
    : 0;

  // =========================
  // 4) Leverage Used (JS)
  // =========================
  const leverageUsed = equity > 0 ? totalExposure / equity : 0;
  const LEVERAGE_REF = 30;
  const leverageRisk = Math.min(leverageUsed / LEVERAGE_REF, 1);

  // =========================
  // 5) Equity Ratio
  // =========================
  const equityRatio = balance > 0
    ? Math.max(0, Math.min(1, equity / balance))
    : 0;

  // =========================
  // 6) Overall Risk (pondéré)
  // =========================
  const hasExposure = totalExposure > 0;

  const effectiveMarginRisk    = hasExposure ? (1 - marginLiquidLevel) : 0;
  const effectivePnlPressure   = hasExposure ? pnlPressure : 0;
  const effectiveLeverageRisk  = hasExposure ? leverageRisk : 0;

  const overallRisk = Math.min(
    effectiveMarginRisk   * 0.25 +
    effectivePnlPressure  * 0.10 +
    effectiveLeverageRisk * 0.65,
    1
  );

  // =========================
  // FORMATTERS
  // =========================
  const formatEUR = (v) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(v);

  // =========================
  // COLORS
  // =========================
  const COLOR_V = "#2ecc71";
  const COLOR_J = "#f1c40f";
  const COLOR_O = "#f39c12";
  const COLOR_R = "#e74c3c";

  const RISK_V = 0.50;
  const RISK_J = 0.60;
  const RISK_O = 0.70;

  const MARGIN_V = 1000;
  const MARGIN_J = 750;
  const MARGIN_O = 500;

  const LEV_V = 10;
  const LEV_J = 15;
  const LEV_O = 20;

  const getRiskColor = (v) => {
    if (v >= RISK_O) return COLOR_R;
    if (v >= RISK_J) return COLOR_O;
    if (v >= RISK_V) return COLOR_J;
    return COLOR_V;
  };

  const getEquityColor = (ratio) => {
    if (ratio >= 1.00) return COLOR_V;
    if (ratio >= 0.97) return COLOR_J;
    if (ratio >= 0.90) return COLOR_O;
    return COLOR_R;
  };

  const getMarginColor = (ml) => {
    if (ml < MARGIN_O) return COLOR_R;
    if (ml < MARGIN_J) return COLOR_O;
    if (ml < MARGIN_V) return COLOR_J;
    return COLOR_V;
  };

  const getLeverageColor = (lev) => {
    if (lev >= LEV_O) return COLOR_R;
    if (lev >= LEV_J) return COLOR_O;
    if (lev >= LEV_V) return COLOR_J;
    return COLOR_V;
  };


// Equity
const equityState =
  equityRatio >= 1.0 ? "safe"
  : equityRatio >= 0.97 ? "safe"
  : equityRatio >= 0.90 ? "warning"
  : "danger";

// Margin %
const marginState =
  marginLevel >= 1000 ? "safe"
  : marginLevel >= 750 ? "warning"
  : "danger";

// Leverage
const leverageState =
  leverageUsed >= 20 ? "danger"
  : leverageUsed >= 15 ? "warning"
  : "safe";

// Risk Overall
const riskState =
  overallRisk >= 0.7 ? "danger"
  : overallRisk >= 0.6 ? "warning"
  : "safe";



  return (
    <div className="dashboard-card dashboard-health">
      <div className="card-title">Account Health</div>

      <div className="health-tubes">
        <div className="health-tube">
          <VerticalTube
            label="Risk Overall"
            value={overallRisk}
            displayValue={`${Math.round(overallRisk * 100)}%`}
            color={getRiskColor(overallRisk)}
            valueState={riskState}
          />
        </div>

        <div className="health-tube">
          <VerticalTube
            label="Equity"
            value={equityRatio}
            displayValue={formatEUR(equity)}
            color={getEquityColor(equityRatio)}
            valueState={equityState}
          />
        </div>

        <div className="health-tube">
          <VerticalTube
            label="Margin %"
            value={marginLiquidLevel}
            displayValue={`${marginLevel.toFixed(0)}%`}
            color={getMarginColor(marginLevel)}
            valueState={riskState}
          />
        </div>

        <div className="health-tube">
          <VerticalTube
            label="Leverage"
            value={leverageRisk}
            displayValue={`x${leverageUsed.toFixed(1)}`}
            color={getLeverageColor(leverageUsed)}
            valueState={riskState}
          />
        </div>
      </div>
    </div>
  );
}
