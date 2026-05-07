// ============================================================================
// ZoneClassification.jsx — Panel "ASSETS TRENDS" (6 sous-blocs)
//
// Source : core.topOpportunities.list (opps V10R + waits avec waitReason)
//
// Buckets :
//   EXH BUY / EXH SELL / CONT BUY / CONT SELL  : valids (plein) + waits CONT (dimmés + dot orange)
//   GRISE                                       : valids (wait-grey)
//   BLOCKED                                     : wait-spike / wait-hours / wait-atr / wait-exh-only
// ============================================================================

import React, { useMemo } from "react";
import { getD1State, getH1State } from "../../utils/marketLevels";

const REASON_TAG = {
  'wait-exh-only': { tag: 'EXH', cls: 'zc-blk-exh'   },
  'wait-spike':    { tag: 'SPK', cls: 'zc-blk-spike' },
  'wait-atr':      { tag: 'ATR', cls: 'zc-blk-atr'   },
  'wait-hours':    { tag: 'HRS', cls: 'zc-blk-hours' },
};

// Labels compacts D1/H1 (5 caractères max)
const TF_LABEL = {
  D1_STRONG_UP:    'STR↑', D1_FADING_UP:    'FAD↑', D1_EMERGING_UP:   'EMR↑',
  D1_FLAT:         'FLAT',
  D1_EMERGING_DOWN:'EMR↓', D1_FADING_DOWN:  'FAD↓', D1_STRONG_DOWN:   'STR↓',
  H1_STRONG_UP:    'STR↑', H1_FADING_UP:    'FAD↑', H1_EMERGING_UP:   'EMR↑',
  H1_FLAT:         'FLAT',
  H1_EMERGING_DOWN:'EMR↓', H1_FADING_DOWN:  'FAD↓', H1_STRONG_DOWN:   'STR↓',
};

function tfStateClass(state) {
  if (!state) return 'tf-flat';
  if (state.endsWith('_UP'))   return 'tf-up';
  if (state.endsWith('_DOWN')) return 'tf-down';
  return 'tf-flat';
}

function fmtPct(v) {
  if (!Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function fmtSetup(signalType) {
  if (signalType === 'EXHAUSTION')   return 'REV';
  if (signalType === 'CONTINUATION') return 'CONT';
  return '—';
}

const REASON_ORDER = { 'wait-exh-only': 0, 'wait-spike': 1, 'wait-atr': 2, 'wait-hours': 3 };

export function classifyOpp(opp) {
  if (opp.type === 'EXHAUSTION') {
    if (opp.side === 'BUY')  return { bucket: 'EXH_BUY',   mode: 'valid' };
    if (opp.side === 'SELL') return { bucket: 'EXH_SELL',  mode: 'valid' };
  }
  if (opp.type === 'CONTINUATION') {
    if (opp.side === 'BUY')  return { bucket: 'CONT_BUY',  mode: 'valid' };
    if (opp.side === 'SELL') return { bucket: 'CONT_SELL', mode: 'valid' };
  }
  const wr = opp.waitReason;
  if (wr === 'wait-exh' || wr === 'wait-exh-pending') {
    // Candidat EXH (L1 OK, L2 fail) ou retournement amorcé pas mûr (L1.3/L1.4 timing fail)
    // dim dans EXH_BUY/EXH_SELL selon side
    if (opp.side === 'BUY')  return { bucket: 'EXH_BUY',   mode: 'dim' };
    if (opp.side === 'SELL') return { bucket: 'EXH_SELL',  mode: 'dim' };
    return null;
  }
  if (typeof wr === 'string' && wr.startsWith('wait-cont-')) {
    if (opp.zone === 'HAUTE' || opp.zone === 'NORMALE_HAUTE') return { bucket: 'CONT_BUY',  mode: 'dim' };
    if (opp.zone === 'BASSE' || opp.zone === 'NORMALE_BASSE') return { bucket: 'CONT_SELL', mode: 'dim' };
    return null;
  }
  if (wr === 'wait-grey') return { bucket: 'GRISE', mode: 'valid' };
  if (wr === 'wait-spike' || wr === 'wait-hours' || wr === 'wait-atr' || wr === 'wait-exh-only') {
    return { bucket: 'BLOCKED', mode: 'blocked' };
  }
  return null;
}

function HeatChip(props) {
  const { symbol, zscore, dim, onClick,
          intraday, score, signalType,
          d1State, h1State, sigmaRatio, rsi_h1, dslope_h1 } = props;

  const hasZ = Number.isFinite(zscore);
  const force = hasZ ? Math.min(Math.abs(zscore) / 3, 1) * 100 : 0;

  // Compact = symbole + intraday% (au lieu du zscore)
  const intradayCls = !Number.isFinite(intraday) ? 'intraday-na'
                    : intraday > 0 ? 'intraday-pos'
                    : intraday < 0 ? 'intraday-neg'
                    : 'intraday-zero';

  // Tooltip values
  const scoreStr = Number.isFinite(score) && score > 0 ? Math.round(score) : '—';
  const setupStr = fmtSetup(signalType);
  const d1Lbl    = TF_LABEL[d1State] ?? '—';
  const h1Lbl    = TF_LABEL[h1State] ?? '—';
  const sigStr   = Number.isFinite(sigmaRatio) ? sigmaRatio.toFixed(4) : '—';
  const rsiStr   = Number.isFinite(rsi_h1)     ? rsi_h1.toFixed(1)     : '—';
  const dsStr    = Number.isFinite(dslope_h1)
                    ? (dslope_h1 >= 0 ? `+${dslope_h1.toFixed(4)}` : dslope_h1.toFixed(4))
                    : '—';

  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`zc-chip ${dim ? 'zc-chip-dim' : ''} ${onClick ? 'zc-chip-clickable' : ''}`}
      onClick={onClick ? () => onClick(symbol) : undefined}
    >
      {dim && <span className="zc-chip-dot" />}
      <span className="zc-chip-row">
        <span className="zc-chip-symbol">{symbol}</span>
        <span className={`zc-chip-intraday ${intradayCls}`}>{fmtPct(intraday)}</span>
      </span>
      <span className="zc-chip-bar">
        <span className="zc-chip-bar-fill" style={{ width: `${force}%` }} />
      </span>

      {/* TOOLTIP — affiché au hover via CSS */}
      <span className="zc-tooltip" role="tooltip">
        <span className="zc-tt-row zc-tt-header">
          <span className="zc-tt-sym">{symbol}</span>
          <span className={`zc-tt-intraday ${intradayCls}`}>{fmtPct(intraday)}</span>
        </span>
        <span className="zc-tt-sep" />
        <span className="zc-tt-row">
          <span className="zc-tt-cell"><span className="zc-tt-lbl">Score</span><span className="zc-tt-val zc-tt-score">{scoreStr}</span></span>
          <span className="zc-tt-cell"><span className="zc-tt-lbl">Setup</span><span className="zc-tt-val">{setupStr}</span></span>
        </span>
        <span className="zc-tt-row">
          <span className="zc-tt-cell"><span className="zc-tt-lbl">D1</span><span className={`zc-tt-val ${tfStateClass(d1State)}`}>{d1Lbl}</span></span>
          <span className="zc-tt-cell"><span className="zc-tt-lbl">H1</span><span className={`zc-tt-val ${tfStateClass(h1State)}`}>{h1Lbl}</span></span>
        </span>
        <span className="zc-tt-row">
          <span className="zc-tt-cell"><span className="zc-tt-lbl">σ-ratio</span><span className="zc-tt-val">{sigStr}</span></span>
          <span className="zc-tt-cell"><span className="zc-tt-lbl">RSI-H1</span><span className="zc-tt-val">{rsiStr}</span></span>
        </span>
        <span className="zc-tt-row">
          <span className="zc-tt-cell zc-tt-cell-full"><span className="zc-tt-lbl">dSlope-H1</span><span className="zc-tt-val">{dsStr}</span></span>
        </span>
      </span>
    </Tag>
  );
}

function BlockedChip({ symbol, zscore, waitReason }) {
  const meta = REASON_TAG[waitReason] ?? { tag: '?', cls: '' };
  const hasZ = Number.isFinite(zscore);
  const zStr = hasZ ? (zscore >= 0 ? `+${zscore.toFixed(2)}` : zscore.toFixed(2)) : null;

  return (
    <span className={`zc-chip zc-chip-blocked ${meta.cls}`}>
      <span className="zc-chip-row">
        <span className="zc-chip-symbol">{symbol}</span>
        <span className="zc-chip-tag">{meta.tag}</span>
      </span>
      {zStr !== null && (
        <span className="zc-chip-row">
          <span className="zc-chip-zscore">{zStr}</span>
        </span>
      )}
    </span>
  );
}

function Section({ title, bucket, cls, onPillClick }) {
  const total = bucket.valid.length + bucket.dim.length;
  return (
    <div className={`zc-section ${cls}`}>
      <div className="zc-section-header">
        <span className="zc-section-title">{title}</span>
        <span className="zc-section-count">{total}</span>
      </div>
      <div className="zc-symbols">
        {total === 0
          ? <span className="zc-empty">—</span>
          : <>
              {bucket.valid.map((item, i) => (
                <HeatChip key={`v-${item.symbol}-${i}`} {...item} dim={false} onClick={onPillClick} />
              ))}
              {bucket.dim.map((item, i) => (
                <HeatChip key={`d-${item.symbol}-${item.waitReason ?? ''}-${i}`} {...item} dim={true} onClick={onPillClick} />
              ))}
            </>
        }
      </div>
    </div>
  );
}

function SectionBlocked({ title, bucket, cls }) {
  const total = bucket.blocked.length;
  return (
    <div className={`zc-section ${cls}`}>
      <div className="zc-section-header">
        <span className="zc-section-title">{title}</span>
        <span className="zc-section-count">{total}</span>
      </div>
      <div className="zc-symbols">
        {total === 0
          ? <span className="zc-empty">—</span>
          : bucket.blocked.map((item, i) => (
              <BlockedChip key={`b-${item.symbol}-${item.waitReason}-${i}`} {...item} />
            ))
        }
      </div>
    </div>
  );
}

function ZoneClassification({ topOpportunities, marketWatch = null, onPillClick = null }) {
  const buckets = useMemo(() => {
    const out = {
      EXH_BUY:   { valid: [], dim: [], blocked: [] },
      EXH_SELL:  { valid: [], dim: [], blocked: [] },
      CONT_BUY:  { valid: [], dim: [], blocked: [] },
      CONT_SELL: { valid: [], dim: [], blocked: [] },
      GRISE:     { valid: [], dim: [], blocked: [] },
      BLOCKED:   { valid: [], dim: [], blocked: [] },
    };

    // Index marketWatch par symbole pour enrichissement live (intraday, sigma, rsi, dslope)
    const mwIdx = new Map();
    if (Array.isArray(marketWatch)) {
      for (const r of marketWatch) if (r?.symbol) mwIdx.set(r.symbol, r);
    }

    const list = topOpportunities?.list ?? [];
    for (const opp of list) {
      if (opp?.engine !== 'V10R') continue;
      const r = classifyOpp(opp);
      if (!r) continue;

      const mw = mwIdx.get(opp.symbol) ?? null;

      const atr_m15  = Number(mw?.atr_m15);
      const close    = Number(mw?.price ?? mw?.close_m5_s1);
      const sigmaRatio = (Number.isFinite(atr_m15) && Number.isFinite(close) && close > 0)
        ? atr_m15 / close
        : null;

      const slope_d1_s0  = Number(mw?.slope_d1_s0);
      const dslope_d1_s0 = Number(mw?.dslope_d1_s0);
      const slope_h1     = Number(mw?.slope_h1);
      const dslope_h1    = Number(mw?.dslope_h1);

      const item = {
        symbol:     opp.symbol,
        zscore:     Number(opp.zscore_h1_s0),
        side:       opp.side ?? null,
        waitReason: opp.waitReason ?? null,

        // Enrichissement tooltip
        intraday:    Number(mw?.intraday_change),
        score:       Number(opp.score),
        signalType:  opp.signalType ?? opp.type ?? null,
        d1State:     getD1State(slope_d1_s0, dslope_d1_s0),
        h1State:     getH1State(slope_h1, dslope_h1),
        sigmaRatio,
        rsi_h1:      Number(mw?.rsi_h1),
        dslope_h1:   Number.isFinite(dslope_h1) ? dslope_h1 : null,
      };
      out[r.bucket][r.mode].push(item);
    }

    const byForceDesc = (a, b) => Math.abs(b.zscore) - Math.abs(a.zscore);
    Object.values(out).forEach(b => {
      b.valid.sort(byForceDesc);
      b.dim.sort(byForceDesc);
    });
    out.BLOCKED.blocked.sort((a, b) => {
      const ra = REASON_ORDER[a.waitReason] ?? 99;
      const rb = REASON_ORDER[b.waitReason] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.symbol.localeCompare(b.symbol);
    });

    return out;
  }, [topOpportunities]);

  return (
    <div className="zone-classification">
      <div className="zc-header">
        <span className="zc-title">ASSETS TRENDS</span>
      </div>

      <Section title="EXH BUY"   bucket={buckets.EXH_BUY}   cls="zc-exh-buy"   onPillClick={onPillClick} />
      <Section title="EXH SELL"  bucket={buckets.EXH_SELL}  cls="zc-exh-sell"  onPillClick={onPillClick} />
      <Section title="CONT BUY"  bucket={buckets.CONT_BUY}  cls="zc-cont-buy"  onPillClick={onPillClick} />
      <Section title="CONT SELL" bucket={buckets.CONT_SELL} cls="zc-cont-sell" onPillClick={onPillClick} />
      <Section title="GRISE"     bucket={buckets.GRISE}     cls="zc-grey"      onPillClick={onPillClick} />
      <SectionBlocked title="BLOCKED" bucket={buckets.BLOCKED} cls="zc-blocked" />
    </div>
  );
}

export default ZoneClassification;
