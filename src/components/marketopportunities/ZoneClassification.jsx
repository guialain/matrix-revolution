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

const REASON_TAG = {
  'wait-exh-only': { tag: 'EXH', cls: 'zc-blk-exh'   },
  'wait-spike':    { tag: 'SPK', cls: 'zc-blk-spike' },
  'wait-atr':      { tag: 'ATR', cls: 'zc-blk-atr'   },
  'wait-hours':    { tag: 'HRS', cls: 'zc-blk-hours' },
};

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

function HeatChip({ symbol, zscore, dim }) {
  const hasZ = Number.isFinite(zscore);
  const force = hasZ ? Math.min(Math.abs(zscore) / 3, 1) * 100 : 0;
  const zStr  = hasZ ? (zscore >= 0 ? `+${zscore.toFixed(2)}` : zscore.toFixed(2)) : '—';

  return (
    <span className={`zc-chip ${dim ? 'zc-chip-dim' : ''}`}>
      {dim && <span className="zc-chip-dot" />}
      <span className="zc-chip-row">
        <span className="zc-chip-symbol">{symbol}</span>
        <span className="zc-chip-zscore">{zStr}</span>
      </span>
      <span className="zc-chip-bar">
        <span className="zc-chip-bar-fill" style={{ width: `${force}%` }} />
      </span>
    </span>
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

function Section({ title, bucket, cls }) {
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
                <HeatChip key={`v-${item.symbol}-${i}`} {...item} dim={false} />
              ))}
              {bucket.dim.map((item, i) => (
                <HeatChip key={`d-${item.symbol}-${item.waitReason ?? ''}-${i}`} {...item} dim={true} />
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

function ZoneClassification({ topOpportunities }) {
  const buckets = useMemo(() => {
    const out = {
      EXH_BUY:   { valid: [], dim: [], blocked: [] },
      EXH_SELL:  { valid: [], dim: [], blocked: [] },
      CONT_BUY:  { valid: [], dim: [], blocked: [] },
      CONT_SELL: { valid: [], dim: [], blocked: [] },
      GRISE:     { valid: [], dim: [], blocked: [] },
      BLOCKED:   { valid: [], dim: [], blocked: [] },
    };

    const list = topOpportunities?.list ?? [];
    for (const opp of list) {
      if (opp?.engine !== 'V10R') continue;
      const r = classifyOpp(opp);
      if (!r) continue;
      const item = {
        symbol:     opp.symbol,
        zscore:     Number(opp.zscore_h1_s0),
        side:       opp.side ?? null,
        waitReason: opp.waitReason ?? null,
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

      <Section title="EXH BUY"   bucket={buckets.EXH_BUY}   cls="zc-exh-buy"   />
      <Section title="EXH SELL"  bucket={buckets.EXH_SELL}  cls="zc-exh-sell"  />
      <Section title="CONT BUY"  bucket={buckets.CONT_BUY}  cls="zc-cont-buy"  />
      <Section title="CONT SELL" bucket={buckets.CONT_SELL} cls="zc-cont-sell" />
      <Section title="GRISE"     bucket={buckets.GRISE}     cls="zc-grey"      />
      <SectionBlocked title="BLOCKED" bucket={buckets.BLOCKED} cls="zc-blocked" />
    </div>
  );
}

export default ZoneClassification;
