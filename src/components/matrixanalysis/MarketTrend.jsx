import React from "react";
import useMT5Data from "../../hooks/useMT5Data";
import {
  getIntradayLevelBySymbol,
  getSlopeLevel,
  getD1State,
  getRsiZone,
  getZscoreZone,
} from "../../utils/marketLevels.js";
import "../../styles/stylesmatrixanalysis/markettrend.css";

// ── ABBREVIATIONS ─────────────────────────────────────────────────────────

const D1_ABBR = {
  D1_STRONG_UP:    "STR+",
  D1_FADING_UP:    "FAD+",
  D1_EMERGING_UP:  "EMR+",
  D1_FLAT:         "FLAT",
  D1_EMERGING_DOWN:"EMR-",
  D1_FADING_DOWN:  "FAD-",
  D1_STRONG_DOWN:  "STR-",
};

const LVL_ABBR = {
  SPIKE_UP:      "SPK+",
  EXPLOSIVE_UP:  "EXP+",
  STRONG_UP:     "STR+",
  SOFT_UP:       "SFT+",
  NEUTRE:        "FLAT",
  SOFT_DOWN:     "SFT-",
  STRONG_DOWN:   "STR-",
  EXPLOSIVE_DOWN:"EXP-",
  SPIKE_DOWN:    "SPK-",
};

// ── BADGE CSS CLASSES ─────────────────────────────────────────────────────

const D1_CSS = {
  D1_STRONG_UP:    "mb-str-up",
  D1_FADING_UP:    "mb-sft-up",
  D1_EMERGING_UP:  "mb-emr",
  D1_FLAT:         "mb-flat",
  D1_EMERGING_DOWN:"mb-emr",
  D1_FADING_DOWN:  "mb-sft-dn",
  D1_STRONG_DOWN:  "mb-str-dn",
};

const LVL_CSS = {
  SPIKE_UP:      "mb-str-up",
  EXPLOSIVE_UP:  "mb-str-up",
  STRONG_UP:     "mb-str-up",
  SOFT_UP:       "mb-sft-up",
  NEUTRE:        "mt-level-flat",
  SOFT_DOWN:     "mb-sft-dn",
  STRONG_DOWN:   "mb-str-dn",
  EXPLOSIVE_DOWN:"mb-str-dn",
  SPIKE_DOWN:    "mb-str-dn",
};

const RSI_CSS = {
  EXTREME_LOW: "mv-xlow",
  LOW_MID:     "mv-low",
  MID_HIGH:    "mv-high",
  EXTREME_HIGH:"mv-xhigh",
  UNKNOWN:     "mv-neut",
};

const Z_CSS = {
  EXTREME_LOW:  "mv-xlow",
  VERY_LOW:     "mv-vlow",
  LOW:          "mv-low",
  SLIGHTLY_LOW: "mv-slow",
  NEUTRAL:      "mv-neut",
  SLIGHTLY_HIGH:"mv-shigh",
  HIGH:         "mv-high",
  VERY_HIGH:    "mv-vhigh",
  EXTREME_HIGH: "mv-xhigh",
  UNKNOWN:      "mv-neut",
};

// ── PROGRESS BAR ──────────────────────────────────────────────────────────

function ProgressBar({ value, maxVal }) {
  const pct   = Math.min((Math.abs(value) / (maxVal || 1)) * 100, 100);
  const isPos = value >= 0;
  const color = isPos ? "#00ff88" : "#ff3d5a";
  return (
    <div className="mt-progbar-track">
      <div
        className="mt-progbar-fill"
        style={{
          left:       isPos ? "50%" : `calc(50% - ${pct / 2}%)`,
          width:      `${pct / 2}%`,
          background: color,
          boxShadow:  `0 0 6px ${color}`,
        }}
      />
    </div>
  );
}

// ── REGIME BADGE ──────────────────────────────────────────────────────────

function RegimeBadge({ level, abbrMap, cssMap }) {
  const abbr = abbrMap[level] ?? "---";
  const cls  = cssMap[level]  ?? "mb-flat";
  return <span className={`mt-mbadge ${cls}`}>{abbr}</span>;
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function MarketTrend() {
  const { data, ready } = useMT5Data();

  if (!ready || !data?.macro?.slots) {
    return (
      <div className="markettrend-panel markettrend-loading">
        <span className="mt-live-dot" />
        MARKET TREND — loading…
      </div>
    );
  }

  const slots = data.macro.slots;
  const mw    = data.marketWatch ?? [];

  // Map for O(1) lookup instead of repeated find()
  const mwMap = new Map(mw.map(r => [r.symbol, r]));

  const maxAbs = Math.max(
    ...slots.map(slot => {
      const r = mwMap.get(slot.symbol) ?? {};
      const v = Number(r.intraday_change);
      return Math.abs(Number.isFinite(v) ? v : 0);
    })
  ) || 1;

  return (
    <div className="markettrend-panel">

      {/* ── HEADER BAR ── */}
      <div className="mt-topbar">
        <div className="mt-topbar-left">
          <span className="mt-live-dot" />
          <span className="mt-title">MARKET TREND</span>
        </div>
        <span className="mt-topbar-time">
          {new Date().toLocaleTimeString("fr-FR", {
            hour:   "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* ── COLUMN HEADERS ── */}
      <div className="mt-col-headers">
        <div className="mt-ch mt-ch-asset">ASSET</div>
        <div className="mt-ch mt-ch-pct">DAILY%</div>
        <div className="mt-ch mt-ch-reg">D1</div>
        <div className="mt-ch mt-ch-reg">INTRA</div>
        <div className="mt-ch mt-ch-reg">H4</div>
        <div className="mt-ch mt-ch-reg">H1</div>
        <div className="mt-ch mt-ch-rsi">RSI</div>
        <div className="mt-ch mt-ch-z">Z</div>
      </div>

      {/* ── ROWS ── */}
      <div className="mt-rows">
        {slots.map((slot, i) => {
          const symbol = slot.symbol;
          const raw    = mwMap.get(symbol) ?? {};
          const _chg   = Number(raw.intraday_change);
          const change = Number.isFinite(_chg) ? _chg : null;
          const dir    = change > 0 ? "up" : change < 0 ? "down" : "flat";


          const d1State  = getD1State(raw.slope_d1_s0, raw.dslope_d1);
          // null quand la donnée brute est absente → RegimeBadge retombe sur "---"
          const intraLvl = raw.intraday_change == null ? null : getIntradayLevelBySymbol(raw.intraday_change, symbol);
          const h4Lvl    = raw.slope_h4_s0     == null ? null : getSlopeLevel(raw.slope_h4_s0, symbol);
          const h1Lvl    = raw.slope_h1_s0     == null ? null : getSlopeLevel(raw.slope_h1_s0, symbol);

          const rsiVal  = Number.isFinite(Number(raw.rsi_h1_s0))   ? Number(raw.rsi_h1_s0)   : null;
          const zVal    = Number.isFinite(Number(raw.zscore_h1_s0)) ? Number(raw.zscore_h1_s0) : null;
          const rsiZone = getRsiZone(rsiVal);
          const zZone   = getZscoreZone(zVal);

          const isLast = i === slots.length - 1;

          return (
            <React.Fragment key={i}>
              <div className="mt-row">

                <div className="mt-cell mt-asset">{symbol || "—"}</div>

                <div className="mt-cell mt-pct">
                  <span className={`mt-pct-value mt-${dir}`}>
                    {change != null
                      ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
                      : "—"}
                  </span>
                  {change != null && <ProgressBar value={change} maxVal={maxAbs} />}
                </div>

                <div className="mt-cell mt-regime">
                  <RegimeBadge level={d1State} abbrMap={D1_ABBR} cssMap={D1_CSS} />
                </div>

                <div className="mt-cell mt-regime">
                  <RegimeBadge level={intraLvl} abbrMap={LVL_ABBR} cssMap={LVL_CSS} />
                </div>

                <div className="mt-cell mt-regime">
                  <RegimeBadge level={h4Lvl} abbrMap={LVL_ABBR} cssMap={LVL_CSS} />
                </div>

                <div className="mt-cell mt-regime">
                  <RegimeBadge level={h1Lvl} abbrMap={LVL_ABBR} cssMap={LVL_CSS} />
                </div>

                <div className={`mt-cell mt-mval ${RSI_CSS[rsiZone] ?? "mv-neut"}`}>
                  {rsiVal != null ? rsiVal.toFixed(0) : "—"}
                </div>

                <div className={`mt-cell mt-mval ${Z_CSS[zZone] ?? "mv-neut"}`}>
                  {zVal != null ? zVal.toFixed(2) : "—"}
                </div>

              </div>
              {!isLast && <div className="mt-separator" />}
            </React.Fragment>
          );
        })}
      </div>

    </div>
  );
}
