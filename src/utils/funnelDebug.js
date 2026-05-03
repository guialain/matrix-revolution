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
  // === Pipeline V10R amont (TopOpportunities_V10R) ===
  'marketWatchTotal',     // rows entrants
  'hourGatePass',         // après filtre GlobalMarketHours
  'atrCapPass',           // après filtre ATR cap (volatility eligibility)
  'spikeWait',            // WAIT spike émis (H1 ou IC)
  'greyZoneWait',         // WAIT zone grise émis
  'nonGreyZone',          // rows en zone non-grise (entrée routing)
  'exhTested',            // EXH tenté (zone Forte ou Extreme)
  'exhValid',             // EXH validé par evaluateExhRoute
  'contTested',           // CONT testé pour un side
  'contGateD1Block',      // bloqué par Gate D1
  'contGateICWait',       // bloqué par Gate IC (mode 'wait')
  'contGateH1Fail',       // bloqué par Gate H1
  'contValid',            // CONT validé (avant emit)
  'v10rEmit',             // émission finale par V10R (par opp pushée)

  // === Pipeline aval (RobotCore + SignalFilters) ===
  'eligibilityIn',
  'eligibilityOut',
  'signalFiltersIn',
  'gate1Pass',
  'gate2Pass',
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
  const clamp0 = n => Math.max(0, n);
  const rows = [];

  // === Pipeline V10R amont ===
  rows.push({ stage: 'marketWatchTotal',  in: c.marketWatchTotal,  out: c.marketWatchTotal });
  rows.push({ stage: 'hourGatePass',      in: c.marketWatchTotal,  out: c.hourGatePass });
  rows.push({ stage: 'atrCapPass',        in: c.hourGatePass,      out: c.atrCapPass });
  rows.push({ stage: 'spikeWait',         in: c.atrCapPass,        out: c.spikeWait });
  rows.push({ stage: 'greyZoneWait',      in: c.atrCapPass,        out: c.greyZoneWait });
  rows.push({ stage: 'nonGreyZone',       in: c.atrCapPass,        out: c.nonGreyZone });

  rows.push({ stage: 'exhTested',         in: c.nonGreyZone,       out: c.exhTested });
  rows.push({ stage: 'exhValid',          in: c.exhTested,         out: c.exhValid });

  rows.push({ stage: 'contTested',        in: c.nonGreyZone,       out: c.contTested });
  rows.push({ stage: 'contGateD1Block',   in: c.contTested,                                                                  out: c.contGateD1Block });
  rows.push({ stage: 'contGateICWait',    in: clamp0(c.contTested - c.contGateD1Block),                                      out: c.contGateICWait });
  rows.push({ stage: 'contGateH1Fail',    in: clamp0(c.contTested - c.contGateD1Block - c.contGateICWait),                   out: c.contGateH1Fail });
  rows.push({ stage: 'contValid',         in: clamp0(c.contTested - c.contGateD1Block - c.contGateICWait - c.contGateH1Fail), out: c.contValid });

  rows.push({ stage: 'v10rEmit',          in: c.exhValid + c.contValid, out: c.v10rEmit });

  // === Pipeline aval RobotCore + SignalFilters ===
  rows.push({ stage: 'eligibilityIn',     in: c.v10rEmit,         out: c.eligibilityIn });
  rows.push({ stage: 'eligibilityOut',    in: c.eligibilityIn,    out: c.eligibilityOut });
  rows.push({ stage: 'signalFiltersIn',   in: c.eligibilityOut,   out: c.signalFiltersIn });
  rows.push({ stage: 'gate1Pass',         in: c.signalFiltersIn,  out: c.gate1Pass });
  rows.push({ stage: 'gate2Pass',         in: c.gate1Pass,        out: c.gate2Pass });
  rows.push({ stage: 'validOut',          in: c.gate2Pass,        out: c.validOut });
  rows.push({ stage: 'waitOut',           in: c.signalFiltersIn,  out: c.waitOut });

  return rows;
}

export function dump() {
  if (!enabled()) return;
  const f = _f;
  const summary =
    `mw=${f.marketWatchTotal} hour=${f.hourGatePass} atr=${f.atrCapPass} ` +
    `| spk=${f.spikeWait} grey=${f.greyZoneWait} nonG=${f.nonGreyZone} ` +
    `| exh=${f.exhTested}/${f.exhValid} ` +
    `| cont=${f.contTested} d1Bk=${f.contGateD1Block} icW=${f.contGateICWait} h1F=${f.contGateH1Fail} contOk=${f.contValid} ` +
    `| EMIT=${f.v10rEmit} ` +
    `| elig=${f.eligibilityOut} g1=${f.gate1Pass} g2=${f.gate2Pass} VALID=${f.validOut} WAIT=${f.waitOut}`;
  // eslint-disable-next-line no-console
  console.log('%c[funnel]', 'background:#222;color:#bada55;padding:2px 6px;border-radius:3px;font-weight:bold', summary);
  // eslint-disable-next-line no-console
  console.table(buildRows());
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
