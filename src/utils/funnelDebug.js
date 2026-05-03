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
  return STAGES.map(stage => ({ stage, count: _f[stage] }));
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
