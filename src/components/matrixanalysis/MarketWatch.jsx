// ============================================================================
// MARKET WATCH groupé par classe d'actif
// Source : marketWatch complet
// Colonnes : SYMBOL | SIGNAL | DAILY% | RSI H1 | ZSCORE H1 | SLOPE H1
// ============================================================================

import { useMemo, Fragment } from "react";
import useMT5Data from "../../hooks/useMT5Data";
import { classifyOpp } from "../marketopportunities/ZoneClassification";
import "../../styles/stylesmatrixanalysis/marketwatch.css";

// ============================================================================
// CONFIG
// ============================================================================

const GROUP_ORDER = ["FX", "INDEX", "CRYPTO", "METAL", "ENERGY", "AGRI"];

const GROUP_LABEL = {
  FX:     "FX",
  INDEX:  "INDEX",
  CRYPTO: "CRYPTO",
  METAL:  "METAL",
  ENERGY: "ENERGY",
  AGRI:   "AGRI",
};

// Mapping bucket → texte chip + classe CSS de couleur
const BUCKET_CHIP = {
  EXH_BUY:   { text: "EXH BUY",   cls: "mw-chip-exh-buy"   },
  EXH_SELL:  { text: "EXH SELL",  cls: "mw-chip-exh-sell"  },
  CONT_BUY:  { text: "CONT BUY",  cls: "mw-chip-cont-buy"  },
  CONT_SELL: { text: "CONT SELL", cls: "mw-chip-cont-sell" },
  GRISE:     { text: "GRISE",     cls: "mw-chip-grise"     },
};

const BLOCKED_CHIP = {
  'wait-spike':    { text: "SPK", cls: "mw-chip-blocked mw-chip-spike"   },
  'wait-atr':      { text: "ATR", cls: "mw-chip-blocked mw-chip-atr"     },
  'wait-hours':    { text: "HRS", cls: "mw-chip-blocked mw-chip-hours"   },
  'wait-exh-only': { text: "EXH", cls: "mw-chip-blocked mw-chip-exhonly" },
};

// ============================================================================
// HELPERS
// ============================================================================

function normalizeClass(cls) {
  if (!cls) return null;
  if (cls === "OIL_GAS") return "ENERGY";
  if (GROUP_ORDER.includes(cls)) return cls;
  return null;
}

function fmtNum(v, d = 2) {
  return Number.isFinite(v) ? v.toFixed(d) : "—";
}

function clsDaily(v) {
  if (!Number.isFinite(v)) return "";
  return v > 0 ? "mw-pos" : v < 0 ? "mw-neg" : "";
}

function clsRSI(v) {
  if (!Number.isFinite(v)) return "";
  if (v > 70) return "mw-rsi-high";
  if (v < 30) return "mw-rsi-low";
  return "";
}

function clsZscore(v) {
  if (!Number.isFinite(v)) return "";
  if (v > 2.0)  return "mw-z-high";
  if (v < -2.0) return "mw-z-low";
  return "";
}

function clsSlope(v) {
  if (!Number.isFinite(v)) return "";
  if (v > 1.0)  return "mw-slope-up";
  if (v < -1.0) return "mw-slope-down";
  return "";
}

// ============================================================================
// SIGNAL CHIP (inline component)
// ============================================================================

function SignalChip({ opp }) {
  if (!opp) return <span className="mw-chip-none">—</span>;

  const cls = classifyOpp(opp);
  if (!cls) return <span className="mw-chip-none">—</span>;

  if (cls.bucket === 'BLOCKED') {
    const meta = BLOCKED_CHIP[opp.waitReason] ?? { text: '?', cls: 'mw-chip-blocked' };
    return <span className={`mw-chip ${meta.cls}`}>{meta.text}</span>;
  }

  const meta = BUCKET_CHIP[cls.bucket];
  if (!meta) return <span className="mw-chip-none">—</span>;

  const dimCls = cls.mode === 'dim' ? 'mw-chip-dim' : '';
  return <span className={`mw-chip ${meta.cls} ${dimCls}`}>{meta.text}</span>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TopMoversPanel({ onSwitchSymbol, topOpportunities }) {

  const { data, ready } = useMT5Data();

  // Map symbol → opp (V10R) : valids tradables d'abord, puis blocked en fallback.
  const opMap = useMemo(() => {
    const m = new Map();
    for (const opp of topOpportunities?.list ?? []) {
      if (opp?.engine === 'V10R' && opp.symbol) m.set(opp.symbol, opp);
    }
    for (const opp of topOpportunities?.blocked ?? []) {
      if (opp?.engine === 'V10R' && opp.symbol && !m.has(opp.symbol)) m.set(opp.symbol, opp);
    }
    return m;
  }, [topOpportunities]);

  const groups = useMemo(() => {

    const scan = Array.isArray(data?.marketWatch)
      ? data.marketWatch
      : [];

    const map = {};

    for (const r of scan) {

      const cls = normalizeClass(r.assetclass);
      if (!cls) continue;

      if (!Number.isFinite(r.price)) continue;

      if (!map[cls]) map[cls] = [];

      map[cls].push({
        symbol: r.symbol,
        intraday_change: r.intraday_change ?? null,
        rsi_h1: r.rsi_h1_s0 ?? null,
        zscore_h1: r.zscore_h1_s0 ?? null,
        slope_h1: r.slope_h1_s0 ?? null,
      });
    }

    // tri par Zscore absolu (scanner trading)
    for (const cls of Object.keys(map)) {

      map[cls].sort(
        (a, b) =>
          Math.abs(b.zscore_h1 ?? 0) -
          Math.abs(a.zscore_h1 ?? 0)
      );
    }

    return map;

  }, [data]);

  const lastUpdate = data?.time?.timestamp ?? null;

  if (!ready)
    return <div className="panel panel-topmovers">Loading…</div>;

  return (
    <div className="panel panel-topmovers">

      {/* HEADER */}
      <div className="panel-header">
        <div className="panel-title-group">
          <h3>MARKET WATCH</h3>
        </div>

        {lastUpdate && (
          <span className="timestamp">
            {new Date(lastUpdate * 1000).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* TABLE */}
      <div className="stack">

        {GROUP_ORDER.some(cls => groups[cls]?.length) ? (

          <table className="mw-table">

            <thead>
              <tr>
                <th>SYMBOL</th>
                <th>SIGNAL</th>
                <th>DAILY%</th>
                <th>RSI H1</th>
                <th>ZSCORE</th>
                <th>SLOPE</th>
              </tr>
            </thead>

            <tbody>

              {GROUP_ORDER.map(cls => {

                const rows = groups[cls];
                if (!rows?.length) return null;

                return (

                  <Fragment key={cls}>

                    <tr className="mw-sep-row">
                      <td colSpan={6} className="mw-group-title">
                        {GROUP_LABEL[cls]}
                      </td>
                    </tr>

                    {rows.map(r => (

                      <tr
                        key={r.symbol}
                        className="tm-row-clickable"
                        onClick={() => onSwitchSymbol?.(r.symbol)}
                      >

                        <td className="sym">
                          {r.symbol}
                        </td>

                        <td className="mw-signal-cell">
                          <SignalChip opp={opMap.get(r.symbol)} />
                        </td>

                        <td className={clsDaily(r.intraday_change)}>
                          {Number.isFinite(r.intraday_change)
                            ? (r.intraday_change > 0 ? "+" : "")
                              + fmtNum(r.intraday_change)
                              + "%"
                            : "—"}
                        </td>

                        <td className={clsRSI(r.rsi_h1)}>
                          {fmtNum(r.rsi_h1, 1)}
                        </td>

                        <td className={clsZscore(r.zscore_h1)}>
                          {fmtNum(r.zscore_h1, 2)}
                        </td>

                        <td className={clsSlope(r.slope_h1)}>
                          {fmtNum(r.slope_h1, 2)}
                        </td>

                      </tr>

                    ))}

                  </Fragment>

                );

              })}

            </tbody>

          </table>

        ) : (

          <div className="empty">
            No market data
          </div>

        )}

      </div>

    </div>
  );
}
