// ============================================================================
// funnelDebug.js — counters par étage du pipeline V8R + RobotCore + SignalFilters
//
// Activation : localStorage.setItem('debug.funnel', '1')
//   ou globalThis.__funnelDebug = true (instantané, sans reload)
// Désactivation : localStorage.removeItem('debug.funnel') (et reset window flag)
//
// Inspecter en live : window.__funnel.snapshot()  /  window.__funnel.dump()
// ============================================================================

const STAGES = [
  'marketWatchTotal',
  'matchRouteOut',
  'selectRouteOut',
  'nullGuardFail',
  'zoneUnknownFail',
  'slopeZoneFail',
  'dslopeFail',
  'zscoreCapFail',
  'checkConditionsOut',
  'v8rEmitTrue',
  'v8rEmitWait',
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
  const f = _f;
  const nullGuardIn  = f.selectRouteOut;
  const zoneUnkIn    = nullGuardIn - f.nullGuardFail;
  const slopeZoneIn  = zoneUnkIn - f.zoneUnknownFail;
  const dslopeIn     = slopeZoneIn - f.slopeZoneFail;
  const zscoreCapIn  = dslopeIn - f.dslopeFail;
  return [
    { stage: 'marketWatch total',          in: f.marketWatchTotal,    out: f.marketWatchTotal },
    { stage: 'matchRoute (RSI×zscore)',    in: f.marketWatchTotal,    out: f.matchRouteOut },
    { stage: 'selectRoute (D1+IC)',        in: f.matchRouteOut,       out: f.selectRouteOut },
    { stage: 'checkCond null guard',       in: nullGuardIn,           out: nullGuardIn - f.nullGuardFail },
    { stage: 'checkCond zone unknown',     in: zoneUnkIn,             out: zoneUnkIn - f.zoneUnknownFail },
    { stage: 'checkCond slope_zone',       in: slopeZoneIn,           out: slopeZoneIn - f.slopeZoneFail },
    { stage: 'checkCond dslope_h1',        in: dslopeIn,              out: dslopeIn - f.dslopeFail },
    { stage: 'checkCond zscore_h1_s0',     in: zscoreCapIn,           out: f.checkConditionsOut },
    { stage: 'V8R emit (true)',            in: f.checkConditionsOut,  out: f.v8rEmitTrue },
    { stage: 'V8R emit (WAIT inline)',     in: f.marketWatchTotal,    out: f.v8rEmitWait },
    { stage: 'AssetEligibility',           in: f.eligibilityIn,       out: f.eligibilityOut },
    { stage: 'SignalFilters in',           in: f.eligibilityOut,      out: f.signalFiltersIn },
    { stage: 'Gate 1 (M5 overextended)',   in: f.signalFiltersIn,     out: f.gate1Pass },
    { stage: 'Gate 2 (M5 setup OK)',       in: f.gate1Pass,           out: f.gate2Pass },
    { stage: 'VALID final',                in: f.gate2Pass,           out: f.validOut },
    { stage: 'WAIT final',                 in: f.signalFiltersIn,     out: f.waitOut },
  ];
}

export function dump() {
  if (!enabled()) return;
  const f = _f;
  const summary = `mw=${f.marketWatchTotal} match=${f.matchRouteOut} sel=${f.selectRouteOut} | null=${f.nullGuardFail} zUnk=${f.zoneUnknownFail} slz=${f.slopeZoneFail} ds=${f.dslopeFail} z=${f.zscoreCapFail} | chk=${f.checkConditionsOut} v8r=${f.v8rEmitTrue} elig=${f.eligibilityOut} g1=${f.gate1Pass} g2=${f.gate2Pass} VALID=${f.validOut} WAIT=${f.waitOut}`;
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
