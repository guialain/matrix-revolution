// ============================================================================
// zoneClassifier.js — Helpers de classification de zone zscore_h1_s0
// Partagés entre TopOpportunities_V10R et l'UI.
// ============================================================================

export function getZscoreH1Zone(zscore) {
  if (zscore === null || zscore === undefined || !Number.isFinite(Number(zscore))) {
    return 'UNKNOWN';
  }
  const v = Number(zscore);
  if (v >  +2.9)  return 'EXTREME_HAUTE';
  if (v >  +1.5)  return 'HAUTE';
  if (v >  +0.5)  return 'NORMALE_HAUTE';
  if (v >= -0.5)  return 'GRISE';
  if (v >  -1.5)  return 'NORMALE_BASSE';
  if (v >= -2.9)  return 'BASSE';
  return 'EXTREME_BASSE';
}

export function bucketZone(zone) {
  if (zone === 'GRISE') return 'GREY';
  if (zone === 'EXTREME_BASSE' || zone === 'BASSE')  return 'EXH_BUY';
  if (zone === 'EXTREME_HAUTE' || zone === 'HAUTE')  return 'EXH_SELL';
  if (zone === 'NORMALE_HAUTE') return 'CONT_BUY';
  if (zone === 'NORMALE_BASSE') return 'CONT_SELL';
  return 'UNKNOWN';
}
