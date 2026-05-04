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
  'exhTested',            // EXH testé (zone HAUTE/BASSE/EXTREME)
  'exhL1Pass',            // L1 OK (= L2_OK ou L2_FAIL)
  'exhL1FailNormal',      // L1 fail en zone HAUTE/BASSE → bascule CONT
  'exhL1FailExtreme',     // L1 fail en zone EXTREME → wait-exh-only
  'exhL2Pass',            // L2 OK = valid EXH émise
  'exhL2Fail',            // L1 OK + L2 fail = wait-exh
  'contTested',           // rows entrées dans la branche CONT (1 par row)
  'contGateD1Block',      // deepest stage reached = D1
  'contGateICWait',       // deepest stage reached = IC
  'contGateH1Fail',       // deepest stage reached = H1
  'contValid',            // au moins 1 side validé = valid CONT émise
  'v10rEmit',             // total opps V10R émises (= exhL2Pass + contValid)

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

  // === EXH ===
  rows.push({ stage: 'exhTested',         in: c.nonGreyZone,       out: c.exhTested });
  // Cascade L1 (3 buckets exclusifs par row) : in = restant après les buckets précédents
  rows.push({ stage: 'exhL1Pass',         in: c.exhTested,         out: c.exhL1Pass });
  let exhIn = max0(c.exhTested - c.exhL1Pass);
  rows.push({ stage: 'exhL1FailNormal',   in: exhIn,               out: c.exhL1FailNormal });
  exhIn = max0(exhIn - c.exhL1FailNormal);
  rows.push({ stage: 'exhL1FailExtreme',  in: exhIn,               out: c.exhL1FailExtreme });
  // Cascade L2 (2 buckets exclusifs par row, à partir de exhL1Pass)
  rows.push({ stage: 'exhL2Pass',         in: c.exhL1Pass,         out: c.exhL2Pass });
  rows.push({ stage: 'exhL2Fail',         in: max0(c.exhL1Pass - c.exhL2Pass), out: c.exhL2Fail });

  // === CONT ===
  // Note : contTested.in = (nonGreyZone en NORMALE_*) + exhL1FailNormal
  // Pas séparable proprement sans nouveau compteur dédié — donc in=out pour ce stage.
  rows.push({ stage: 'contTested',        in: c.contTested,        out: c.contTested });
  // Cascade CONT (4 buckets exclusifs par row, deepest stage reached)
  rows.push({ stage: 'contGateD1Block',   in: c.contTested,        out: c.contGateD1Block });
  let contIn = max0(c.contTested - c.contGateD1Block);
  rows.push({ stage: 'contGateICWait',    in: contIn,              out: c.contGateICWait });
  contIn = max0(contIn - c.contGateICWait);
  rows.push({ stage: 'contGateH1Fail',    in: contIn,              out: c.contGateH1Fail });
  contIn = max0(contIn - c.contGateH1Fail);
  rows.push({ stage: 'contValid',         in: contIn,              out: c.contValid });

  // === Emit V10R ===
  rows.push({ stage: 'v10rEmit',          in: c.exhL2Pass + c.contValid, out: c.v10rEmit });

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
    `| EXH t=${f.exhTested} L1ok=${f.exhL1Pass}(N=${f.exhL1FailNormal}/E=${f.exhL1FailExtreme}) L2=${f.exhL2Pass}/${f.exhL2Fail} ` +
    `| CONT t=${f.contTested} d1=${f.contGateD1Block} ic=${f.contGateICWait} h1=${f.contGateH1Fail} ok=${f.contValid} ` +
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
