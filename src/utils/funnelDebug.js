// ============================================================================
// funnelDebug.js — counters par étage du pipeline V10R + RobotCore + SignalFilters
//
// Activation : localStorage.setItem('debug.funnel', '1')
//   ou globalThis.__funnelDebug = true (instantané, sans reload)
// Désactivation : localStorage.removeItem('debug.funnel') (et reset window flag)
//
// Inspecter en live : window.__funnel.snapshot()  /  window.__funnel.dump()
// ============================================================================

export const STAGES = [
  // === Pipeline V10R amont ===
  'marketWatchTotal',
  'hourGatePass',
  'atrCapPass',
  'spikeBlock',           // wait-spike émis
  'greyZone',             // wait-grey émis
  'nonGreyZone',          // entrée routing EXH/CONT

  // === EXH BUY (zones BASSE / NORMALE_BASSE / EXTREME_BASSE) ===
  'exhBuy_tested',
  'exhBuy_L1Pass',
  'exhBuy_L1Fail',
  'exhBuy_L2Pass',        // valid EXH BUY émise
  'exhBuy_L2Fail',        // wait-exh BUY émis

  // === EXH SELL (zones HAUTE / NORMALE_HAUTE / EXTREME_HAUTE) ===
  'exhSell_tested',
  'exhSell_L1Pass',
  'exhSell_L1Fail',
  'exhSell_L2Pass',
  'exhSell_L2Fail',

  // === CONT BUY (deepest stage reached par side) ===
  'contBuy_tested',
  'contBuy_D1Block',
  'contBuy_ICWait',
  'contBuy_H1Fail',
  'contBuy_Valid',

  // === CONT SELL ===
  'contSell_tested',
  'contSell_D1Block',
  'contSell_ICWait',
  'contSell_H1Fail',
  'contSell_Valid',

  // === Emit ===
  'v10rEmit',             // = exhBuy_L2Pass + exhSell_L2Pass + contBuy_Valid + contSell_Valid

  // === Pipeline aval RobotCore + SignalFilters ===
  'eligibilityIn',
  'eligibilityOut',
  'signalFiltersIn',
  'm5OverextPass',        // Gate 1 M5 overextended
  'm5SetupPass',          // Gate 2 M5 setup
  'validOut',
  'waitOut',
];

const _f = {};
STAGES.forEach(s => { _f[s] = 0; });

function enabled() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__funnelDebug === true) return true;
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('debug.funnel') === '1';
    }
  } catch { /* noop */ }
  return false;
}

export function reset() {
  STAGES.forEach(s => { _f[s] = 0; });
}

export function inc(key, n = 1) {
  if (!enabled()) return;
  _f[key] = (_f[key] ?? 0) + n;
}

function buildRows() {
  const c = _f;
  const rows = [];

  // === Pipeline V10R amont ===
  rows.push({ stage: 'marketWatchTotal',  in: c.marketWatchTotal,  out: c.marketWatchTotal });
  rows.push({ stage: 'hourGatePass',      in: c.marketWatchTotal,  out: c.hourGatePass });
  rows.push({ stage: 'atrCapPass',        in: c.hourGatePass,      out: c.atrCapPass });

  // 3 buckets exclusifs après atrCapPass
  rows.push({ stage: 'spikeBlock',        in: c.atrCapPass,        out: c.spikeBlock });
  rows.push({ stage: 'greyZone',          in: c.atrCapPass,        out: c.greyZone });
  rows.push({ stage: 'nonGreyZone',       in: c.atrCapPass,        out: c.nonGreyZone });

  const max0 = n => Math.max(0, n);

  // === EXH BUY cascade ===
  rows.push({ stage: 'exhBuy_tested',  in: c.exhBuy_tested,  out: c.exhBuy_tested });
  rows.push({ stage: 'exhBuy_L1Pass',  in: c.exhBuy_tested,  out: c.exhBuy_L1Pass });
  rows.push({ stage: 'exhBuy_L1Fail',  in: max0(c.exhBuy_tested - c.exhBuy_L1Pass), out: c.exhBuy_L1Fail });
  rows.push({ stage: 'exhBuy_L2Pass',  in: c.exhBuy_L1Pass,  out: c.exhBuy_L2Pass });
  rows.push({ stage: 'exhBuy_L2Fail',  in: max0(c.exhBuy_L1Pass - c.exhBuy_L2Pass), out: c.exhBuy_L2Fail });

  // === EXH SELL cascade ===
  rows.push({ stage: 'exhSell_tested', in: c.exhSell_tested, out: c.exhSell_tested });
  rows.push({ stage: 'exhSell_L1Pass', in: c.exhSell_tested, out: c.exhSell_L1Pass });
  rows.push({ stage: 'exhSell_L1Fail', in: max0(c.exhSell_tested - c.exhSell_L1Pass), out: c.exhSell_L1Fail });
  rows.push({ stage: 'exhSell_L2Pass', in: c.exhSell_L1Pass, out: c.exhSell_L2Pass });
  rows.push({ stage: 'exhSell_L2Fail', in: max0(c.exhSell_L1Pass - c.exhSell_L2Pass), out: c.exhSell_L2Fail });

  // === CONT BUY cascade (deepest stage reached) ===
  rows.push({ stage: 'contBuy_tested',  in: c.contBuy_tested, out: c.contBuy_tested });
  rows.push({ stage: 'contBuy_D1Block', in: c.contBuy_tested, out: c.contBuy_D1Block });
  let cBuyIn = max0(c.contBuy_tested - c.contBuy_D1Block);
  rows.push({ stage: 'contBuy_ICWait',  in: cBuyIn, out: c.contBuy_ICWait });
  cBuyIn = max0(cBuyIn - c.contBuy_ICWait);
  rows.push({ stage: 'contBuy_H1Fail',  in: cBuyIn, out: c.contBuy_H1Fail });
  cBuyIn = max0(cBuyIn - c.contBuy_H1Fail);
  rows.push({ stage: 'contBuy_Valid',   in: cBuyIn, out: c.contBuy_Valid });

  // === CONT SELL cascade ===
  rows.push({ stage: 'contSell_tested',  in: c.contSell_tested, out: c.contSell_tested });
  rows.push({ stage: 'contSell_D1Block', in: c.contSell_tested, out: c.contSell_D1Block });
  let cSellIn = max0(c.contSell_tested - c.contSell_D1Block);
  rows.push({ stage: 'contSell_ICWait',  in: cSellIn, out: c.contSell_ICWait });
  cSellIn = max0(cSellIn - c.contSell_ICWait);
  rows.push({ stage: 'contSell_H1Fail',  in: cSellIn, out: c.contSell_H1Fail });
  cSellIn = max0(cSellIn - c.contSell_H1Fail);
  rows.push({ stage: 'contSell_Valid',   in: cSellIn, out: c.contSell_Valid });

  // === Emit V10R ===
  rows.push({ stage: 'v10rEmit', in: c.exhBuy_L2Pass + c.exhSell_L2Pass + c.contBuy_Valid + c.contSell_Valid, out: c.v10rEmit });

  // === Pipeline aval ===
  rows.push({ stage: 'eligibilityIn',     in: c.v10rEmit,          out: c.eligibilityIn });
  rows.push({ stage: 'eligibilityOut',    in: c.eligibilityIn,     out: c.eligibilityOut });
  rows.push({ stage: 'signalFiltersIn',   in: c.eligibilityOut,    out: c.signalFiltersIn });
  rows.push({ stage: 'm5OverextPass',     in: c.signalFiltersIn,   out: c.m5OverextPass });
  rows.push({ stage: 'm5SetupPass',       in: c.m5OverextPass,     out: c.m5SetupPass });
  rows.push({ stage: 'validOut',          in: c.m5SetupPass,       out: c.validOut });
  rows.push({ stage: 'waitOut',           in: c.signalFiltersIn,   out: c.waitOut });

  return rows.map(r => ({ ...r, pass: Math.max(0, (r.in ?? 0) - (r.out ?? 0)) }));
}

export function dump() {
  if (!enabled()) return;
  const f = _f;
  const summary =
    `mw=${f.marketWatchTotal} hour=${f.hourGatePass} atr=${f.atrCapPass} ` +
    `| spk=${f.spikeBlock} grey=${f.greyZone} nonG=${f.nonGreyZone} ` +
    `| EXH-BUY t=${f.exhBuy_tested} L1=${f.exhBuy_L1Pass}/${f.exhBuy_L1Fail} L2=${f.exhBuy_L2Pass}/${f.exhBuy_L2Fail} ` +
    `| EXH-SELL t=${f.exhSell_tested} L1=${f.exhSell_L1Pass}/${f.exhSell_L1Fail} L2=${f.exhSell_L2Pass}/${f.exhSell_L2Fail} ` +
    `| CONT-BUY t=${f.contBuy_tested} d1=${f.contBuy_D1Block} ic=${f.contBuy_ICWait} h1=${f.contBuy_H1Fail} ok=${f.contBuy_Valid} ` +
    `| CONT-SELL t=${f.contSell_tested} d1=${f.contSell_D1Block} ic=${f.contSell_ICWait} h1=${f.contSell_H1Fail} ok=${f.contSell_Valid} ` +
    `| EMIT=${f.v10rEmit} elig=${f.eligibilityOut} m5o=${f.m5OverextPass} m5s=${f.m5SetupPass} ` +
    `VALID=${f.validOut} WAIT=${f.waitOut}`;
  // eslint-disable-next-line no-console
  console.log('%c[funnel]', 'background:#222;color:#bada55;padding:2px 6px;border-radius:3px;font-weight:bold', summary);
  // eslint-disable-next-line no-console
  console.table(buildRows());

  // Sanity check : signalFiltersIn doit égaler validOut + waitOut (rows perdues = bug)
  if (Math.abs(f.signalFiltersIn - f.validOut - f.waitOut) > 0) {
    // eslint-disable-next-line no-console
    console.warn('[funnel] signalFiltersIn != validOut + waitOut', {
      in: f.signalFiltersIn, valid: f.validOut, wait: f.waitOut,
      delta: f.signalFiltersIn - f.validOut - f.waitOut,
    });
  }
}

export function snapshot() {
  return { ..._f };
}

// Expose debug API en console pour inspection interactive :
//   window.__funnel.snapshot() / window.__funnel.dump()
//   window.__funnelDebug = true  (force activation sans localStorage)
if (typeof window !== 'undefined') {
  window.__funnel = { reset, inc, dump, snapshot, enabled, _stages: STAGES };
}
