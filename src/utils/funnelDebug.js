// ============================================================================
// funnelDebug.js — counters par étage du pipeline V8R + RobotCore + SignalFilters
//
// Activation : localStorage.setItem('debug.funnel', '1')
// Désactivation : localStorage.removeItem('debug.funnel')
//
// Usage :
//   import * as funnel from '../../utils/funnelDebug';
//   funnel.reset();   // début de tick (V8R.evaluate)
//   funnel.inc('matchRouteOut');
//   funnel.dump();    // fin de tick (SignalFilters.evaluate)
// ============================================================================

const STAGES = [
  'marketWatchTotal',
  'matchRouteOut',
  'selectRouteOut',
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
    return typeof window !== 'undefined'
      && window.localStorage
      && window.localStorage.getItem('debug.funnel') === '1';
  } catch { return false; }
}

export function reset() {
  STAGES.forEach(s => { _f[s] = 0; });
}

export function inc(key, n = 1) {
  if (!enabled()) return;
  _f[key] = (_f[key] ?? 0) + n;
}

export function dump() {
  if (!enabled()) return;
  const f = _f;
  // Ordre réel d'exécution dans V8R.checkConditions : slope_zone → dslope → zscore
  const slopeZoneIn  = f.selectRouteOut;
  const dslopeIn     = slopeZoneIn - f.slopeZoneFail;
  const zscoreCapIn  = dslopeIn - f.dslopeFail;
  const rows = [
    { stage: 'marketWatch total',          in: f.marketWatchTotal, out: f.marketWatchTotal },
    { stage: 'matchRoute (RSI×zscore)',    in: f.marketWatchTotal, out: f.matchRouteOut },
    { stage: 'selectRoute (D1+IC)',        in: f.matchRouteOut,    out: f.selectRouteOut },
    { stage: 'checkCond slope_zone',       in: slopeZoneIn,        out: slopeZoneIn - f.slopeZoneFail },
    { stage: 'checkCond dslope_h1',        in: dslopeIn,           out: dslopeIn - f.dslopeFail },
    { stage: 'checkCond zscore_h1_s0',     in: zscoreCapIn,        out: f.checkConditionsOut },
    { stage: 'V8R emit (true)',            in: f.checkConditionsOut, out: f.v8rEmitTrue },
    { stage: 'V8R emit (WAIT inline)',     in: f.marketWatchTotal, out: f.v8rEmitWait },
    { stage: 'AssetEligibility',           in: f.eligibilityIn,    out: f.eligibilityOut },
    { stage: 'SignalFilters in',           in: f.eligibilityOut,   out: f.signalFiltersIn },
    { stage: 'Gate 1 (M5 overextended)',   in: f.signalFiltersIn,  out: f.gate1Pass },
    { stage: 'Gate 2 (M5 setup OK)',       in: f.gate1Pass,        out: f.gate2Pass },
    { stage: 'VALID final',                in: f.gate2Pass,        out: f.validOut },
    { stage: 'WAIT final',                 in: f.signalFiltersIn,  out: f.waitOut },
  ];
  // eslint-disable-next-line no-console
  console.groupCollapsed('[funnel]');
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.groupEnd();
}
