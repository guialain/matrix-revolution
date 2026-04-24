// ============================================================================
// TopOpportunities_V8R.js — H1 ROUTER V8R
//
// RESOLVE = D1 alignment + IC (intradayChange) + slopeH1Level + dslopeH1 → TYPE
// (PHASE A : H4 substitue par H1, redondances a dedupliquer en Phase B)
//
// REVERSAL = trade CONTRE l'IC (pas un retournement de marché)
//   IC baissier + H4 haussier = pullback dans uptrend H4 → REV BUY
//   IC haussier + H4 baissier = rally dans downtrend H4  → REV SELL
//   IC haussier + H4 haussier = trend aligné             → CONT BUY
//   (miroir pour SELL)
//
//   IC                   slopeH4       dslopeH4      => TYPE
//   ──────────────────────────────────────────────────────────
//   UP/STRONG/EXP_UP     UP/STRONG_UP  NEUTRE/UP+    => CONT  BUY
//   DOWN/STRONG/EXP_DOWN UP/STRONG_UP  NEUTRE/UP+    => REV   BUY  (IC dip, H4 tient)
//   SPIKE_DOWN           UP/STRONG_UP  NEUTRE/UP+    => REV   BUY  spike
//   DOWN/*               UP/STRONG_UP  DOWN-         => WAIT  (H4 perd momentum)
//   SPIKE_UP             DOWN/STR_DOWN NEUTRE/DOWN-  => REV   SELL spike
//   NEUTRE               *             UP+           => EARLY BUY
//   NEUTRE               *             DOWN-         => EARLY SELL
//   slopeH4 SPIKE/NEUTRE                            => WAIT
//
// H1 → timing seulement (route RSI Gate 2)
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";
import { getSlopeConfig, getSlopeClass } from "../config/SlopeConfig.js";
import {
  getIntradayLevel,
  getSlopeLevel,
  getD1State,
  getSlopeD1Zone,
  getAlignmentD1,
  DSLOPE_D1_ANTI_SPIKE,
} from "../../../../utils/marketLevels.js";
import { getLateEntryThreshold, getVolatilityRegime } from "../config/VolatilityConfig.js";
import { resolveH1Alignment, combineMode } from "./H1Alignment.js";
import { scoreReversalBuy, scoreReversalSell, scoreContinuationBuy, scoreContinuationSell } from "./ScoreEngine.js";
import GlobalMarketHours from "../trading/GlobalMarketHours.js";
import { resolveMarket } from "../trading/AssetEligibility.js";

// ============================================================================
// SPACING TECHNIQUE MOTEUR (ne pas confondre avec cooldown UI) :
// Le paramètre minSignalSpacingMinutes géré par applyDedupeAndSpacing est
// un spacing TECHNIQUE fixe (1 min par défaut, anti-rafale). Son rôle :
// empêcher la publication de doublons sur ticks rapprochés (robot qui
// tourne aux 5-10 sec), tout en laissant republier un signal persistant
// à chaque minute pour donner au trader la chance de le voir.
//
// Le cooldown personnalisé par utilisateur (5/10/15 min selon préférence)
// est géré au niveau de la couche trader via SignalFrequency.js, PAS ici.
// Ne pas fusionner les deux : ils ont des rôles distincts.
// ============================================================================

const TopOpportunities_V8R = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // D1 FRAMEWORK V2 — classifiers + alignement + résolveurs
  // Remplace les anciennes matrices D1_BUY_MATRIX/D1_SELL_MATRIX et les gates
  // _gate:"buy"/"sell" par une architecture 3 couches :
  //   1. getSlopeD1Zone(s1, s0) → zones symétriques (down_extreme → up_extreme)
  //   2. getAlignmentD1(s1, s0) → 9 classes (aligned/transition/fade/inversion)
  //   3. 9 résolveurs par classe + fallback H4 legacy pour aligned_flat
  // Anti-spike |dslope_d1| ≥ 5 appliqué en amont.
  // ============================================================================

  function resolveAlignedUp(dslope_d1_live, dslope_d1_s0, side) {
    if (dslope_d1_live === null) return null;

    // Side BUY = CONTINUATION aligné D1 (comportement existant)
    if (side === 'BUY') {
      if (dslope_d1_live <= -5.00) return null;
      if (dslope_d1_live >= +1.50) return { side: 'BUY', mode: 'relaxed', type: 'CONTINUATION' };
      if (dslope_d1_live >= -0.50) return { side: 'BUY', mode: 'normal',  type: 'CONTINUATION' };
      if (dslope_d1_live >= -1.50) return { side: 'BUY', mode: 'soft',    type: 'CONTINUATION' };
      return { side: 'BUY', mode: 'strict', type: 'CONTINUATION' };
    }

    // Side SELL = contra-D1, autorisé uniquement si dslope_d1_s0 < -1.5
    if (side === 'SELL') {
      if (dslope_d1_s0 !== null && dslope_d1_s0 < -1.5) {
        return { side: 'SELL', mode: 'strict', type: 'REVERSAL' };
      }
      return null;
    }
    return null;
  }

  function resolveAlignedDown(dslope_d1_live, dslope_d1_s0, side) {
    if (dslope_d1_live === null) return null;

    // Side SELL = CONTINUATION aligné D1 (comportement existant)
    if (side === 'SELL') {
      if (dslope_d1_live >= +5.00) return null;
      if (dslope_d1_live <= -1.50) return { side: 'SELL', mode: 'relaxed', type: 'CONTINUATION' };
      if (dslope_d1_live <= +0.50) return { side: 'SELL', mode: 'normal',  type: 'CONTINUATION' };
      if (dslope_d1_live <= +1.50) return { side: 'SELL', mode: 'soft',    type: 'CONTINUATION' };
      return { side: 'SELL', mode: 'strict', type: 'CONTINUATION' };
    }

    // Side BUY = contra-D1, autorisé uniquement si dslope_d1_s0 > +1.5
    if (side === 'BUY') {
      if (dslope_d1_s0 !== null && dslope_d1_s0 > 1.5) {
        return { side: 'BUY', mode: 'strict', type: 'REVERSAL' };
      }
      return null;
    }
    return null;
  }

  function resolveTransitionUp(dslope_d1) {
    if (dslope_d1 === null) return null;
    if (dslope_d1 >= +1.50) return { side: 'BUY', mode: 'normal', type: 'EARLY' };
    if (dslope_d1 >= +0.50) return { side: 'BUY', mode: 'strict', type: 'EARLY' };
    return null;
  }

  function resolveTransitionDown(dslope_d1) {
    if (dslope_d1 === null) return null;
    if (dslope_d1 <= -1.50) return { side: 'SELL', mode: 'normal', type: 'EARLY' };
    if (dslope_d1 <= -0.50) return { side: 'SELL', mode: 'strict', type: 'EARLY' };
    return null;
  }

  function resolveInversionUp(icGroup, slope_d1_s0) {
    switch (icGroup) {
      case 'IC_UP':
        return { side: 'BUY', mode: 'normal', type: 'REVERSAL' };
      case 'IC_NEUTRE':
        return (slope_d1_s0 !== null && slope_d1_s0 >= 2.20)
          ? { side: 'BUY', mode: 'strict', type: 'REVERSAL' }
          : null;
      default:
        return null; // IC_SPIKE_UP / IC_DOWN / IC_SPIKE_DOWN
    }
  }

  function resolveInversionDown(icGroup, slope_d1_s0) {
    switch (icGroup) {
      case 'IC_DOWN':
        return { side: 'SELL', mode: 'normal', type: 'REVERSAL' };
      case 'IC_NEUTRE':
        return (slope_d1_s0 !== null && slope_d1_s0 <= -2.20)
          ? { side: 'SELL', mode: 'strict', type: 'REVERSAL' }
          : null;
      default:
        return null;
    }
  }

  // Sets réutilisés par resolveFadeUp/Down pour la confirmation IC_NEUTRE
  const H4_BULLISH    = new Set(['SOFT_UP', 'STRONG_UP', 'EXPLOSIVE_UP']);
  const H4_BEARISH    = new Set(['SOFT_DOWN', 'STRONG_DOWN', 'EXPLOSIVE_DOWN']);
  const H1_UP_ZONES   = new Set(['up_weak', 'up_strong', 'up_extreme']);
  const H1_DOWN_ZONES = new Set(['down_weak', 'down_strong', 'down_extreme']);

  function resolveFadeUp(icGroup, zone_s1, slopeH4Level, slope_h1_s0, symbol, side) {
    const s1Extreme = zone_s1 === 'up_extreme';
    const s1Strong  = zone_s1 === 'up_strong';
    switch (icGroup) {
      case 'IC_DOWN':
        return s1Extreme ? null : { side: 'SELL', mode: 'strict', type: 'REVERSAL' };
      case 'IC_UP':
        return s1Extreme
          ? { side: 'BUY', mode: 'normal', type: 'EARLY' }
          : { side: 'BUY', mode: 'strict', type: 'EARLY' };
      case 'IC_SPIKE_UP':
        return (s1Extreme || s1Strong)
          ? { side: 'BUY', mode: 'normal', type: 'REVERSAL' }
          : { side: 'BUY', mode: 'strict', type: 'REVERSAL' };
      case 'IC_NEUTRE': {
        // SELL EARLY strict si H4 bearish + H1 s0 dans zone down_*
        if (side !== 'SELL') return null;
        if (!H4_BEARISH.has(slopeH4Level)) return null;
        const zone_h1_s0 = getSlopeClass(slope_h1_s0, symbol);
        if (!H1_DOWN_ZONES.has(zone_h1_s0)) return null;
        return { side: 'SELL', mode: 'strict', type: 'EARLY', fadeNeutreOk: true, h1_s0_zone: zone_h1_s0 };
      }
      default:
        return null; // IC_SPIKE_DOWN
    }
  }

  function resolveFadeDown(icGroup, zone_s1, slopeH4Level, slope_h1_s0, symbol, side) {
    const s1Extreme = zone_s1 === 'down_extreme';
    const s1Strong  = zone_s1 === 'down_strong';
    switch (icGroup) {
      case 'IC_UP':
        return s1Extreme ? null : { side: 'BUY', mode: 'strict', type: 'REVERSAL' };
      case 'IC_DOWN':
        return s1Extreme
          ? { side: 'SELL', mode: 'normal', type: 'EARLY' }
          : { side: 'SELL', mode: 'strict', type: 'EARLY' };
      case 'IC_SPIKE_DOWN':
        return (s1Extreme || s1Strong)
          ? { side: 'SELL', mode: 'normal', type: 'REVERSAL' }
          : { side: 'SELL', mode: 'strict', type: 'REVERSAL' };
      case 'IC_NEUTRE': {
        // BUY EARLY strict si H4 bullish + H1 s0 dans zone up_*
        if (side !== 'BUY') return null;
        if (!H4_BULLISH.has(slopeH4Level)) return null;
        const zone_h1_s0 = getSlopeClass(slope_h1_s0, symbol);
        if (!H1_UP_ZONES.has(zone_h1_s0)) return null;
        return { side: 'BUY', mode: 'strict', type: 'EARLY', fadeNeutreOk: true, h1_s0_zone: zone_h1_s0 };
      }
      default:
        return null; // IC_SPIKE_UP
    }
  }

  function computeIcGroup(intradayLevel) {
    if (intradayLevel === "SPIKE_UP")                                                                           return "IC_SPIKE_UP";
    if (intradayLevel === "SOFT_UP"   || intradayLevel === "STRONG_UP"   || intradayLevel === "EXPLOSIVE_UP")   return "IC_UP";
    if (intradayLevel === "NEUTRE")                                                                             return "IC_NEUTRE";
    if (intradayLevel === "SOFT_DOWN" || intradayLevel === "STRONG_DOWN" || intradayLevel === "EXPLOSIVE_DOWN") return "IC_DOWN";
    return "IC_SPIKE_DOWN";
  }

  // ============================================================================
  // resolve3D V2 — dispatcher framework D1 + fallback H4 (aligned_flat)
  //   Input  : (intradayLevel, slopeH4Level, dslopeH4, side, thr,
  //             slope_d1_s1, slope_d1_s0, dslope_d1_live)
  //   Output : { type, mode } ou null (block)
  // ============================================================================
  function resolve3D(intradayLevel, slopeH4Level, dslopeH4, side, thr = 1.0,
                    slope_d1_s1 = null, slope_d1_s0 = null, dslope_d1_live = null,
                    dslope_d1_s0 = null, slope_h1_s0 = null, symbol = null) {

    // Anti-spike dslope_d1 global (anti-FOMO)
    if (dslope_d1_live !== null) {
      if (side === 'BUY'  && dslope_d1_live >=  DSLOPE_D1_ANTI_SPIKE) return null;
      if (side === 'SELL' && dslope_d1_live <= -DSLOPE_D1_ANTI_SPIKE) return null;
    }

    // Classification D1 : zones s1/s0 + alignement
    const zone_s1   = getSlopeD1Zone(slope_d1_s1);
    const zone_s0   = getSlopeD1Zone(slope_d1_s0);
    const alignment = getAlignmentD1(zone_s1, zone_s0);
    if (alignment === null) return null;

    const icGroup = computeIcGroup(intradayLevel);

    // Dispatcher : résolveur selon classe d'alignement
    let d1Resolved = null;
    switch (alignment) {
      case 'aligned_up':      d1Resolved = resolveAlignedUp(dslope_d1_live, dslope_d1_s0, side); break;
      case 'aligned_down':    d1Resolved = resolveAlignedDown(dslope_d1_live, dslope_d1_s0, side); break;
      case 'transition_up':   d1Resolved = resolveTransitionUp(dslope_d1_live); break;
      case 'transition_down': d1Resolved = resolveTransitionDown(dslope_d1_live); break;
      case 'inversion_up':    d1Resolved = resolveInversionUp(icGroup, slope_d1_s0); break;
      case 'inversion_down':  d1Resolved = resolveInversionDown(icGroup, slope_d1_s0); break;
      case 'fade_up':         d1Resolved = resolveFadeUp(icGroup, zone_s1, slopeH4Level, slope_h1_s0, symbol, side); break;
      case 'fade_down':       d1Resolved = resolveFadeDown(icGroup, zone_s1, slopeH4Level, slope_h1_s0, symbol, side); break;
      case 'aligned_flat':    break; // null → fallback H4 legacy ci-dessous
    }

    // Side mismatch → block
    if (d1Resolved !== null && d1Resolved.side !== side) return null;
    // Non-flat + null résolveur → block
    if (d1Resolved === null && alignment !== 'aligned_flat') return null;

    // D1 a résolu → retour direct
    if (d1Resolved !== null) {
      return { type: d1Resolved.type, mode: d1Resolved.mode };
    }

    // aligned_flat : fallback H4 legacy (mode 'normal')
    const h4Up   = slopeH4Level === "SOFT_UP"   || slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP";
    const h4Down = slopeH4Level === "SOFT_DOWN" || slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";
    const dh4Up   = dslopeH4 !== null && dslopeH4 >=  thr;
    const dh4Down = dslopeH4 !== null && dslopeH4 <= -thr;
    const dh4OkBuy  = dh4Up   || (!dh4Up && !dh4Down);
    const dh4OkSell = dh4Down || (!dh4Up && !dh4Down);
    const isUpIC   = intradayLevel === "SOFT_UP"   || intradayLevel === "STRONG_UP"   || intradayLevel === "EXPLOSIVE_UP";
    const isDownIC = intradayLevel === "SOFT_DOWN" || intradayLevel === "STRONG_DOWN" || intradayLevel === "EXPLOSIVE_DOWN";
    const DEFAULT_MODE = 'normal';

    if (side === 'BUY') {
      if (intradayLevel === "NEUTRE")
        return (dslopeH4 !== null && dslopeH4 >= 2.0) ? { type: "EARLY", mode: DEFAULT_MODE } : null;
      if (intradayLevel === "SPIKE_DOWN")
        return h4Up && dh4OkBuy ? { type: "REVERSAL", mode: "spike" } : null;
      if (!h4Up) return null;
      if (isUpIC)   return dh4OkBuy ? { type: "CONTINUATION", mode: DEFAULT_MODE } : null;
      if (isDownIC) return dh4OkBuy ? { type: "REVERSAL",     mode: DEFAULT_MODE } : null;
      return null;
    }
    if (side === 'SELL') {
      if (intradayLevel === "NEUTRE")
        return (dslopeH4 !== null && dslopeH4 <= -2.0) ? { type: "EARLY", mode: DEFAULT_MODE } : null;
      if (intradayLevel === "SPIKE_UP")
        return h4Down && dh4OkSell ? { type: "REVERSAL", mode: "spike" } : null;
      if (!h4Down) return null;
      if (isDownIC) return dh4OkSell ? { type: "CONTINUATION", mode: DEFAULT_MODE } : null;
      if (isUpIC)   return dh4OkSell ? { type: "REVERSAL",     mode: DEFAULT_MODE } : null;
      return null;
    }
    return null;
  }

  // ============================================================================
  // MODE — qualité du setup (IC × slopeH4 × dslopeH4)
  //   conf=3 → relaxed | conf=2 → soft | conf=1 → normal | conf=0 → strict
  // ============================================================================
  const STRONG_UP_LEVELS   = ["STRONG_UP","EXPLOSIVE_UP","SPIKE_UP"];
  const STRONG_DOWN_LEVELS = ["STRONG_DOWN","EXPLOSIVE_DOWN","SPIKE_DOWN"];

  function computeMode(type, side, intradayLevel, slopeH4Level, dslopeH4, thr) {
    const dh4Confirm = side === "BUY"
      ? (dslopeH4 !== null && dslopeH4 >= thr)
      : (dslopeH4 !== null && dslopeH4 <= -thr);

    const icStrong = side === "BUY"
      ? (type === "REVERSAL" ? STRONG_DOWN_LEVELS.includes(intradayLevel) : STRONG_UP_LEVELS.includes(intradayLevel))
      : (type === "REVERSAL" ? STRONG_UP_LEVELS.includes(intradayLevel)   : STRONG_DOWN_LEVELS.includes(intradayLevel));

    const h4Strong = side === "BUY"
      ? (slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP")
      : (slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN");

    const conf = [icStrong, h4Strong, dh4Confirm].filter(Boolean).length;
    if (conf === 3) return "relaxed";
    if (conf === 2) return "soft";
    if (conf >= 1)  return "normal";
    return "strict";
  }

  // ============================================================================
  // NOUVEAU GATE V2 — calcul du mode base sur D1 + IC + H1
  //
  // Architecture :
  //   1. Bypass D1+IC : si D1 fortement aligne ET IC confirme dans le sens
  //      → relaxed (sauf cas faibles → normal)
  //   2. Sinon : lookup dans la table H1 (zone_h1_s1 x zone_h1_s0)
  //   3. Default si zones non classifiables : strict
  //
  // Inputs :
  //   side                 : 'BUY' ou 'SELL'
  //   intradayLevel        : niveau IC classifie
  //   slope_d1_s1          : slope D1 historique
  //   slope_d1_s0          : slope D1 actuelle
  //   d1Alignment          : alignement D1 (aligned_up, aligned_down, etc.)
  //   slope_h1             : slope H1 historique
  //   slope_h1_s0          : slope H1 actuelle
  //   symbol               : symbole pour getSlopeClass / getSlopeD1Zone
  //
  // Output : 'relaxed' | 'soft' | 'normal' | 'strict'
  // ============================================================================

  const IC_BULLISH_CONFIRMED = ['SOFT_UP', 'STRONG_UP', 'EXPLOSIVE_UP'];
  const IC_BEARISH_CONFIRMED = ['SOFT_DOWN', 'STRONG_DOWN', 'EXPLOSIVE_DOWN'];
  const D1_UP_ZONES   = ['up_weak', 'up_strong', 'up_extreme'];
  const D1_DOWN_ZONES = ['down_weak', 'down_strong', 'down_extreme'];

  // Table H1 BUY : H1_TABLE_BUY[zone_h1_s1][zone_h1_s0] = mode
  const H1_TABLE_BUY = {
    down_extreme: { down_extreme:'block',  down_strong:'strict', down_weak:'soft',   flat:'normal', up_weak:'relaxed', up_strong:'relaxed', up_extreme:'block' },
    down_strong:  { down_extreme:'block',  down_strong:'block',  down_weak:'strict', flat:'soft',   up_weak:'normal',  up_strong:'relaxed', up_extreme:'block' },
    down_weak:    { down_extreme:'block',  down_strong:'block',  down_weak:'block',  flat:'strict', up_weak:'normal',  up_strong:'relaxed', up_extreme:'block' },
    flat:         { down_extreme:'block',  down_strong:'block',  down_weak:'block',  flat:'block',  up_weak:'normal',  up_strong:'soft',    up_extreme:'block' },
    up_weak:      { down_extreme:'block',  down_strong:'block',  down_weak:'block',  flat:'strict', up_weak:'normal',  up_strong:'relaxed', up_extreme:'relaxed' },
    up_strong:    { down_extreme:'block',  down_strong:'block',  down_weak:'block',  flat:'strict', up_weak:'soft',    up_strong:'normal',  up_extreme:'relaxed' },
    up_extreme:   { down_extreme:'block',  down_strong:'block',  down_weak:'block',  flat:'strict', up_weak:'strict',  up_strong:'soft',    up_extreme:'normal' },
  };

  // Table H1 SELL (miroir)
  const H1_TABLE_SELL = {
    down_extreme: { down_extreme:'normal',  down_strong:'soft',    down_weak:'strict', flat:'block',  up_weak:'block',   up_strong:'block',   up_extreme:'block' },
    down_strong:  { down_extreme:'relaxed', down_strong:'normal',  down_weak:'soft',   flat:'strict', up_weak:'block',   up_strong:'block',   up_extreme:'block' },
    down_weak:    { down_extreme:'relaxed', down_strong:'relaxed', down_weak:'normal', flat:'strict', up_weak:'block',   up_strong:'block',   up_extreme:'block' },
    flat:         { down_extreme:'block',   down_strong:'soft',    down_weak:'normal', flat:'block',  up_weak:'block',   up_strong:'block',   up_extreme:'block' },
    up_weak:      { down_extreme:'block',   down_strong:'relaxed', down_weak:'normal', flat:'strict', up_weak:'block',   up_strong:'block',   up_extreme:'block' },
    up_strong:    { down_extreme:'block',   down_strong:'relaxed', down_weak:'normal', flat:'soft',   up_weak:'strict',  up_strong:'block',   up_extreme:'block' },
    up_extreme:   { down_extreme:'block',   down_strong:'relaxed', down_weak:'relaxed', flat:'normal', up_weak:'soft',   up_strong:'strict',  up_extreme:'block' },
  };

  function computeModeV2(side, intradayLevel, slope_d1_s1, slope_d1_s0, d1Alignment, slope_h1, slope_h1_s0, symbol) {
    // ========================================
    // Bypass 1 : BUY confirme par D1 + IC
    // ========================================
    if (side === 'BUY' && IC_BULLISH_CONFIRMED.includes(intradayLevel) && d1Alignment === 'aligned_up') {
      const zone_d1_s1 = getSlopeD1Zone(slope_d1_s1);
      const zone_d1_s0 = getSlopeD1Zone(slope_d1_s0);

      if (D1_UP_ZONES.includes(zone_d1_s1) && D1_UP_ZONES.includes(zone_d1_s0)) {
        const d1S0Weak = (zone_d1_s0 === 'up_weak');
        const icSoft   = (intradayLevel === 'SOFT_UP');

        if (d1S0Weak && icSoft) return 'normal';
        return 'relaxed';
      }
    }

    // ========================================
    // Bypass 2 : SELL confirme par D1 + IC (miroir)
    // ========================================
    if (side === 'SELL' && IC_BEARISH_CONFIRMED.includes(intradayLevel) && d1Alignment === 'aligned_down') {
      const zone_d1_s1 = getSlopeD1Zone(slope_d1_s1);
      const zone_d1_s0 = getSlopeD1Zone(slope_d1_s0);

      if (D1_DOWN_ZONES.includes(zone_d1_s1) && D1_DOWN_ZONES.includes(zone_d1_s0)) {
        const d1S0Weak = (zone_d1_s0 === 'down_weak');
        const icSoft   = (intradayLevel === 'SOFT_DOWN');

        if (d1S0Weak && icSoft) return 'normal';
        return 'relaxed';
      }
    }

    // ========================================
    // Default : lookup table H1 par side
    // ========================================
    const zone_h1_s1 = getSlopeClass(slope_h1, symbol);
    const zone_h1_s0 = getSlopeClass(slope_h1_s0, symbol);

    if (zone_h1_s1 === null || zone_h1_s0 === null) return 'strict';

    const table = (side === 'BUY') ? H1_TABLE_BUY : H1_TABLE_SELL;
    const row   = table[zone_h1_s1];
    if (!row) return 'strict';

    const mode = row[zone_h1_s0];
    if (!mode) return 'strict';

    // 'block' dans la table → strict (le gate ne tue pas, juste restrictif)
    if (mode === 'block') return 'strict';

    return mode;
  }

  // ============================================================================
  // GATE PRESETS — spike > relaxed > soft > normal > strict
  // dslopeMin / dslopeRev = seuils sur dslope_h1 (variation slope H1)
  // antiSpike             = seuil |dslope_h1| max par asset (slopeCfg.antiSpikeH1S0)
  // ============================================================================
  function buildGates(side, mode, type, antiSpike) {
    const isRev = (type === "REVERSAL");

    if (type === "EARLY") {
      return {
        dslopeMin: 0.3, dslopeRev: 0.1, zRev: 99,
        dslopeThr: 0.3,
        z3050: 1.8, z5070: 1.8,
        slopeH1Min:  0.5,   // slope_h1_s0 dans le sens du trade
        dslopeH1Min: 0.3,   // dslope_h1 confirme accélération H1
        antiSpike,
      };
    }

    if (mode === "spike") {
      return {
        dslopeMin: 0, dslopeRev: 0, zRev: 99,
        dslopeThr: 0,
        z3050: 99, z5070: 99,
        antiSpike,
      };
    }

    if (mode === "relaxed") {
      return isRev ? {
        dslopeMin: 0, dslopeRev: 0, zRev: 99,
        dslopeThr: 0,
        z3050: 99, z5070: 99,
        antiSpike,
      } : {
        dslopeMin: 0, dslopeRev: 0, zRev: 99,
        dslopeThr: 0,
        z3050: 2.3, z5070: 2.3,
        antiSpike,
      };
    }

    if (mode === "soft") {
      return isRev ? {
        dslopeMin: 0.2, dslopeRev: 0.1, zRev: 99,
        dslopeThr: 0.2,
        z3050: 99, z5070: 99,
        antiSpike,
      } : {
        dslopeMin: 0.2, dslopeRev: 0.1, zRev: 99,
        dslopeThr: 0.2,
        z3050: 1.8, z5070: 1.8,
        antiSpike,
      };
    }

    if (mode === "normal") {
      return isRev ? {
        dslopeMin: 0.3, dslopeRev: 0.2, zRev: 99,
        dslopeThr: 0.3,
        z3050: 99, z5070: 99,
        antiSpike,
      } : {
        dslopeMin: 0.3, dslopeRev: 0.2, zRev: 99,
        dslopeThr: 0.3,
        z3050: 1.8, z5070: 1.8,
        antiSpike,
      };
    }

    // STRICT
    return isRev ? {
      dslopeMin: 0.5, dslopeRev: 0.3, zRev: 99,
      dslopeThr: 0.5,
      z3050: 99, z5070: 99,
      antiSpike,
    } : {
      dslopeMin: 0.5, dslopeRev: 0.3, zRev: 99,
      dslopeThr: 0.5,
      z3050: 1.6, z5070: 1.6,
      antiSpike,
    };
  }

  // ============================================================================
  // GATE ACCÉLÉRATION — cohérence directionnelle dslope_h1_live
  // Seuil signe : la métrique doit aller dans le sens du trade
  // (Phase B-1 : doublon dslopeH4 retiré, params type/intradayLevel supprimés)
  // ============================================================================
  function accelContextGate(side, dslope_h1_live) {
    if (dslope_h1_live === null) return true;
    if (side === "BUY"  && dslope_h1_live < 0) return false;
    if (side === "SELL" && dslope_h1_live > 0) return false;
    return true;
  }

  // ============================================================================
  // SPACING / DEDUPE
  // ============================================================================
  function minutesBetween(tsA, tsB) {
    if (!tsA || !tsB) return null;
    const toDate = (ts) => {
      const [d, t] = String(ts).split(" ");
      if (!d || !t) return null;
      const dt = new Date(`${d.replace(/\./g, "-")}T${t}:00`);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const a = toDate(tsA), b = toDate(tsB);
    if (!a || !b) return null;
    return Math.abs((a.getTime() - b.getTime()) / 60000);
  }

  function makeKey(opp) {
    return [opp?.symbol ?? "", opp?.route ?? "", opp?.side ?? ""].join("|");
  }

  function applyDedupeAndSpacing(opps, cfg) {
    const out = [];
    const seen = new Map();
    const minSpacingMin = num(cfg?.minSignalSpacingMinutes) ?? 0;
    const maxSignals    = num(cfg?.maxSignals) ?? Infinity;

    for (const opp of opps) {
      if (out.length >= maxSignals) break;
      const key = makeKey(opp);
      const lastTs = seen.get(key);
      if (minSpacingMin > 0 && lastTs) {
        const dt = minutesBetween(opp.timestamp, lastTs);
        if (dt !== null && dt < minSpacingMin) continue;
      }
      seen.set(key, opp.timestamp);
      out.push(opp);
    }
    return out;
  }

  // ============================================================================
  // NIVEAU 2 — BUY ROUTES
  // dslope_h1   = momentum live H1
  // slope_h1_s0 = orientation H1 courante (EXHAUSTION + EARLY)
  // g.antiSpike = seuil |dslope_h1| max pour zones [28-72]
  // ============================================================================
  function matchBuyRoute(rsi_h1_s0, dslope_h1, zscore_h1_s0, slope_h1_s0, range_ratio_h1, g, signalType, lateEntryThr = 0.8) {
    if (rsi_h1_s0 === null || dslope_h1 === null || zscore_h1_s0 === null) return null;

    const rsi    = rsi_h1_s0;
    const zscore = zscore_h1_s0;

    // Late entry gate — bougie H1 courante trop étendue vs ATR, seuil adaptatif par régime volatilité
    const isLateEntry = range_ratio_h1 !== null && range_ratio_h1 > lateEntryThr;

    // EARLY : slope_h1_s0 + dslope_h1 requis
    const slopeOk  = g.slopeH1Min  == null || (slope_h1_s0 !== null && slope_h1_s0 >  g.slopeH1Min);
    const dslopeOk = g.dslopeH1Min == null || (dslope_h1   !== null && dslope_h1   >  g.dslopeH1Min);

    // ── EXHAUSTION (priorité haute) ──────────────────────────────────────────
    // Tendance baissière installée (slope_h1_s0 < -0.5) qui s'épuise
    // (dslope_h1 > 1.5 = forte accélération en sens inverse)

    // BUY [0-28] EXHAUSTION
    if (rsi < 28
     && !isLateEntry
     && slope_h1_s0 !== null && slope_h1_s0 < -0.5
     && dslope_h1 > 1.5
     && zscore < g.zRev)
      return { route: "BUY-[0-28]-EXHAUSTION", side: "BUY", modeOverride: "relaxed" };

    // BUY [28-50] EXHAUSTION
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && slope_h1_s0 !== null && slope_h1_s0 < -0.5
     && dslope_h1 > 1.5
     && zscore < g.z3050)
      return { route: "BUY-[28-50]-EXHAUSTION", side: "BUY", modeOverride: "normal" };

    // BUY [50-72] EXHAUSTION
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && slope_h1_s0 !== null && slope_h1_s0 < -0.5
     && dslope_h1 > 1.5
     && zscore < g.z5070)
      return { route: "BUY-[50-72]-EXHAUSTION", side: "BUY", modeOverride: "strict" };

    // ── CONT-RESUME (après EXHAUSTION, avant routes normales) ────────────────
    // Reprise continuation H1 dans le sens du trade — dslope_h1 seul suffit,
    // pas de contrainte slope_h1_s0.

    // BUY [28-50] CONT-RESUME — bloqué si EARLY (pas de tendance établie à reprendre)
    if (signalType !== "EARLY"
     && rsi >= 28 && rsi < 50
     && !isLateEntry
     && dslope_h1 > 1.5
     && zscore < g.z3050)
      return { route: "BUY-[28-50]-CONT-RESUME", side: "BUY", modeOverride: "relaxed" };

    // BUY [50-72] CONT-RESUME — bloqué si EARLY
    if (signalType !== "EARLY"
     && rsi >= 50 && rsi < 72
     && !isLateEntry
     && dslope_h1 > 1.5
     && zscore < g.z5070)
      return { route: "BUY-[50-72]-CONT-RESUME", side: "BUY", modeOverride: "soft" };

    // ── ROUTES NORMALES ──────────────────────────────────────────────────────

    // BUY [0-28] — extreme oversold
    if (rsi < 28
     && dslope_h1 > g.dslopeMin
     && dslope_h1 > g.dslopeRev
     && zscore < g.zRev
     && slopeOk && dslopeOk)
      return { route: "BUY-[0-28]", side: "BUY" };

    // BUY [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && zscore < g.z3050
     && dslope_h1 > g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "BUY-[28-50]", side: "BUY" };

    // BUY [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && zscore < g.z5070
     && dslope_h1 > g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "BUY-[50-72]", side: "BUY" };

    return null;
  }

  // ============================================================================
  // SELL ROUTES (miroir)
  // ============================================================================
  function matchSellRoute(rsi_h1_s0, dslope_h1, zscore_h1_s0, slope_h1_s0, range_ratio_h1, g, signalType, lateEntryThr = 0.8) {
    if (rsi_h1_s0 === null || dslope_h1 === null || zscore_h1_s0 === null) return null;

    const rsi    = rsi_h1_s0;
    const zscore = zscore_h1_s0;

    // Late entry gate — bougie H1 courante trop étendue vs ATR, seuil adaptatif par régime volatilité
    const isLateEntry = range_ratio_h1 !== null && range_ratio_h1 > lateEntryThr;

    // EARLY : slope_h1_s0 + dslope_h1 requis
    const slopeOk  = g.slopeH1Min  == null || (slope_h1_s0 !== null && slope_h1_s0 < -g.slopeH1Min);
    const dslopeOk = g.dslopeH1Min == null || (dslope_h1   !== null && dslope_h1   < -g.dslopeH1Min);

    // ── EXHAUSTION (priorité haute) ──────────────────────────────────────────
    // Tendance haussière installée (slope_h1_s0 > 0.5) qui s'épuise
    // (dslope_h1 < -1.5 = forte accélération en sens inverse)

    // SELL [72-100] EXHAUSTION
    if (rsi >= 72
     && !isLateEntry
     && slope_h1_s0 !== null && slope_h1_s0 > 0.5
     && dslope_h1 < -1.5
     && zscore > -g.zRev)
      return { route: "SELL-[72-100]-EXHAUSTION", side: "SELL", modeOverride: "relaxed" };

    // SELL [50-72] EXHAUSTION
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && slope_h1_s0 !== null && slope_h1_s0 > 0.5
     && dslope_h1 < -1.5
     && zscore > -g.z3050)
      return { route: "SELL-[50-72]-EXHAUSTION", side: "SELL", modeOverride: "normal" };

    // SELL [28-50] EXHAUSTION
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && slope_h1_s0 !== null && slope_h1_s0 > 0.5
     && dslope_h1 < -1.5
     && zscore > -g.z5070)
      return { route: "SELL-[28-50]-EXHAUSTION", side: "SELL", modeOverride: "strict" };

    // ── CONT-RESUME (après EXHAUSTION, avant routes normales) ────────────────
    // Reprise continuation baissière H1 — dslope_h1 seul suffit,
    // pas de contrainte slope_h1_s0.

    // SELL [50-72] CONT-RESUME — bloqué si EARLY (pas de tendance établie à reprendre)
    if (signalType !== "EARLY"
     && rsi >= 50 && rsi < 72
     && !isLateEntry
     && dslope_h1 < -1.5
     && zscore > -g.z3050)
      return { route: "SELL-[50-72]-CONT-RESUME", side: "SELL", modeOverride: "relaxed" };

    // SELL [28-50] CONT-RESUME — bloqué si EARLY
    if (signalType !== "EARLY"
     && rsi >= 28 && rsi < 50
     && !isLateEntry
     && dslope_h1 < -1.5
     && zscore > -g.z5070)
      return { route: "SELL-[28-50]-CONT-RESUME", side: "SELL", modeOverride: "soft" };

    // ── ROUTES NORMALES ──────────────────────────────────────────────────────

    // SELL [72-100] — extreme overbought
    if (rsi >= 72
     && dslope_h1 < -g.dslopeMin
     && dslope_h1 < -g.dslopeRev
     && zscore > -g.zRev
     && slopeOk && dslopeOk)
      return { route: "SELL-[72-100]", side: "SELL" };

    // SELL [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && !isLateEntry
     && zscore > -g.z3050
     && dslope_h1 < -g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "SELL-[50-72]", side: "SELL" };

    // SELL [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && !isLateEntry
     && zscore > -g.z5070
     && dslope_h1 < -g.dslopeThr
     && Math.abs(dslope_h1) < g.antiSpike
     && slopeOk && dslopeOk)
      return { route: "SELL-[28-50]", side: "SELL" };

    return null;
  }

  // ============================================================================
  // ROUTE => SIGNAL PHASE
  // ============================================================================
  const ROUTE_PHASE = {
    "BUY-[0-28]":    "EXTREME_LOW",
    "BUY-[28-50]":   "LOW_MID",
    "BUY-[50-72]":   "MID_HIGH",
    "SELL-[72-100]": "EXTREME_HIGH",
    "SELL-[50-72]":  "MID_HIGH",
    "SELL-[28-50]":  "LOW_MID",
    // EXHAUSTION
    "BUY-[0-28]-EXHAUSTION":    "EXTREME_LOW",
    "BUY-[28-50]-EXHAUSTION":   "LOW_MID",
    "BUY-[50-72]-EXHAUSTION":   "MID_HIGH",
    "SELL-[72-100]-EXHAUSTION": "EXTREME_HIGH",
    "SELL-[50-72]-EXHAUSTION":  "MID_HIGH",
    "SELL-[28-50]-EXHAUSTION":  "LOW_MID",
    // CONT-RESUME
    "BUY-[28-50]-CONT-RESUME":  "LOW_MID",
    "BUY-[50-72]-CONT-RESUME":  "MID_HIGH",
    "SELL-[50-72]-CONT-RESUME": "MID_HIGH",
    "SELL-[28-50]-CONT-RESUME": "LOW_MID",
  };

  // ============================================================================
  // MAIN
  // ============================================================================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const TOP_CFG = {
      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals:              num(opts?.maxSignals) ?? Infinity,
      scoreMin: num(opts?.scoreMin) ?? 0,
      debug:   Boolean(opts?.debug),   // funnel agrégé (console.info + table + breakdown)
      verbose: Boolean(opts?.verbose), // logs par row ([D1], [EXHAUSTION], [g7 FAIL], …)
    };

    let opps = [];

    // Compteurs H1 alignment (étape 1 aligned + étape 2a extrêmes)
    const h1Counters = {
      aligned_up: 0, aligned_down: 0, aligned_flat: 0,
      deferred: 0, blocked_side_mismatch: 0,
      extreme_resolved: 0, extreme_blocked: 0,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const symbol   = row?.symbol;
      if (!symbol) continue;

      // Gate horaire — filtre marché fermé (inclus symbolOverrides ex: WHEAT)
      const marketKey = resolveMarket(row?.assetclass);
      if (!GlobalMarketHours.check(marketKey, new Date(), symbol).allowed) continue;

      const riskCfg  = getRiskConfig(symbol);
      const intCfg   = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
      const slopeCfg = getSlopeConfig(symbol);
      const dslopeH4Thr     = slopeCfg.dslopeH4Thr ?? 0.3;
      const antiSpikeH1S0 = num(slopeCfg?.antiSpikeH1S0) ?? 8;
      const atrH1Cap      = num(riskCfg?.atrH1Cap);

      // Gate ATR — filtre volatilité extrême (> 4x cap)
      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 4 * atrH1Cap) continue;

      const intra = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      const slope_h1_raw_for_level = num(row?.slope_h1_s0) !== null
        ? num(row.slope_h1_s0) : num(row?.slope_h1);
      const slopeH4Level = getSlopeLevel(slope_h1_raw_for_level, symbol);

      // dslopeH4 = ancienne metrique H4, maintenant alimentee par H1
      // Sera dedupliquee en Phase B avec _dslope_h1_live
      const dslopeH4 = (num(row?.slope_h1_s0) !== null && num(row?.slope_h1) !== null)
        ? num(row.slope_h1_s0) - num(row.slope_h1)
        : null;

      // D1 state — module la résolution BUY + SELL (miroir)
      // dslope_d1_live = slope_d1_s0 - slope_d1 (s0 vs s1 fermée)
      // La colonne dslope_d1_s0 n'existe pas dans le CSV
      // Même approche que dslope_h1_live
      const _sd1s0          = num(row?.slope_d1_s0);
      const _slope_d1       = num(row?.slope_d1);
      const _dslope_d1_live = (_sd1s0 !== null && _slope_d1 !== null)
        ? _sd1s0 - _slope_d1
        : null;
      const _dslope_d1_s0 = num(row?.dslope_d1_s0); // CSV : s0 vs s(-1), utilisé pour le contra-D1
      const d1State = (_sd1s0 !== null && _dslope_d1_live !== null)
        ? getD1State(_sd1s0, _dslope_d1_live)
        : "D1_FLAT";

      const range_ratio_h1 = num(row?.range_ratio_h1);

      // dslope_h1 live = slope_h1_s0 - slope_h1 (s0 vs s1 fermée)
      // Plus réactif que la colonne CSV (s1-s2 = deux bougies fermées)
      // Avance le timing d'entrée d'une bougie H1
      const _slope_h1_s0      = num(row?.slope_h1_s0);
      const _slope_h1         = num(row?.slope_h1);
      const _dslope_h1_live   = (_slope_h1_s0 !== null && _slope_h1 !== null)
        ? _slope_h1_s0 - _slope_h1
        : null;
      if (_dslope_h1_live !== null && Math.abs(_dslope_h1_live) >= antiSpikeH1S0) continue;

      const args = [
        num(row?.rsi_h1_s0),
        _dslope_h1_live,        // ← live au lieu du CSV
        num(row?.zscore_h1_s0),
        _slope_h1_s0,
        range_ratio_h1,
      ];

      // Late entry threshold adaptatif selon régime volatilité
      const _atr_m15 = num(row?.atr_m15);
      const _close   = num(row?.close);
      const _volRegime = getVolatilityRegime(symbol, _atr_m15, _close);
      const lateEntryThr = getLateEntryThreshold(symbol, _atr_m15, _close);
      const _isLate = range_ratio_h1 !== null && range_ratio_h1 > lateEntryThr;
      if (_isLate) console.log(`[LATE_ENTRY] ${symbol} regime=${_volRegime} thr=${lateEntryThr} range_ratio=${range_ratio_h1?.toFixed(2)}`);

      let match = null;
      let signalType = null;
      let signalMode = null;

      // D1 V2 classification (logging + résolveur interne)
      const _zoneS1 = getSlopeD1Zone(_slope_d1);
      const _zoneS0 = getSlopeD1Zone(_sd1s0);
      const _alignmentD1 = getAlignmentD1(_zoneS1, _zoneS0);
      if (TOP_CFG.verbose) {
        console.log(`[D1_V2] ${symbol} alignment=${_alignmentD1} zone_s1=${_zoneS1} zone_s0=${_zoneS0} dslope_live=${_dslope_d1_live?.toFixed(2)} dslope_s0=${_dslope_d1_s0?.toFixed(2)}`);

        // Sanity check : cohérence signe(dslope) vs progression zones s1→s0
        if (_dslope_d1_live !== null && _zoneS1 !== null && _zoneS0 !== null) {
          const zoneRank = {
            'down_extreme': 0, 'down_strong': 1, 'down_weak': 2, 'flat': 3,
            'up_weak': 4, 'up_strong': 5, 'up_extreme': 6
          };
          const rankDiff = zoneRank[_zoneS0] - zoneRank[_zoneS1];
          const signMismatch = (rankDiff > 0 && _dslope_d1_live < 0) ||
                               (rankDiff < 0 && _dslope_d1_live > 0);
          if (signMismatch) {
            console.warn(`[D1_V2 INCOHERENCE] ${symbol} zone_s1=${_zoneS1} zone_s0=${_zoneS0} dslope=${_dslope_d1_live.toFixed(2)} slope_d1=${_slope_d1} slope_d1_s0=${_sd1s0}`);
          }
        }
      }

      const buyRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "BUY", 1.0, _slope_d1, _sd1s0, _dslope_d1_live, _dslope_d1_s0, _slope_h1_s0, symbol);
      if (buyRes) {
        if (TOP_CFG.verbose && buyRes.fadeNeutreOk) {
          console.log(`[FADE_NEUTRE_OK] ${symbol} ${_alignmentD1} IC_NEUTRE H4=${slopeH4Level} H1_s0=${buyRes.h1_s0_zone} → BUY EARLY strict`);
        }
        if (TOP_CFG.verbose && buyRes.type === 'REVERSAL'
            && (_alignmentD1 === 'aligned_up' || _alignmentD1 === 'aligned_down')) {
          console.log(`[D1_CONTRA] ${symbol} alignment=${_alignmentD1} → BUY ${buyRes.mode} REVERSAL (dslope_s0=${_dslope_d1_s0?.toFixed(2)})`);
        }
        const buyMode = buyRes.mode ?? computeMode(
          buyRes.type, "BUY", intradayLevel, slopeH4Level, dslopeH4, dslopeH4Thr);
        const gBuy = buildGates("BUY", buyMode, buyRes.type, antiSpikeH1S0);
        match = matchBuyRoute(...args, gBuy, buyRes.type, lateEntryThr);
        if (match) { signalType = buyRes.type; signalMode = match.modeOverride ?? buyMode; }
      }

      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "SELL", 1.0, _slope_d1, _sd1s0, _dslope_d1_live, _dslope_d1_s0, _slope_h1_s0, symbol);
        if (sellRes) {
          if (TOP_CFG.verbose && sellRes.fadeNeutreOk) {
            console.log(`[FADE_NEUTRE_OK] ${symbol} ${_alignmentD1} IC_NEUTRE H4=${slopeH4Level} H1_s0=${sellRes.h1_s0_zone} → SELL EARLY strict`);
          }
          if (TOP_CFG.verbose && sellRes.type === 'REVERSAL'
              && (_alignmentD1 === 'aligned_up' || _alignmentD1 === 'aligned_down')) {
            console.log(`[D1_CONTRA] ${symbol} alignment=${_alignmentD1} → SELL ${sellRes.mode} REVERSAL (dslope_s0=${_dslope_d1_s0?.toFixed(2)})`);
          }
          const sellMode = sellRes.mode ?? computeMode(
            sellRes.type, "SELL", intradayLevel, slopeH4Level, dslopeH4, dslopeH4Thr);
          const gSell = buildGates("SELL", sellMode, sellRes.type, antiSpikeH1S0);
          match = matchSellRoute(...args, gSell, sellRes.type, lateEntryThr);
          if (match) { signalType = sellRes.type; signalMode = match.modeOverride ?? sellMode; }
        }
      }

      if (!match) continue;

      // --- H1 alignment layer (aligned + extrêmes) ---
      const h1Result = resolveH1Alignment(_slope_h1, _slope_h1_s0, match.side, symbol);

      // Cellule extrême bloquée pour ce side → kill
      if (h1Result?.block) {
        h1Counters.extreme_blocked++;
        if (TOP_CFG.verbose) {
          console.log(`[H1_EXTREME_BLOCK] ${symbol} ${h1Result.zone_s1}×${h1Result.zone_s0} side=${match.side}`);
        }
        continue;
      }

      if (h1Result && !h1Result.skip && !h1Result.deferred) {
        if (h1Result.side !== match.side) {
          h1Counters.blocked_side_mismatch++;
          continue;
        }
        const prevMode = signalMode;
        signalMode = combineMode(signalMode, h1Result.mode);
        if (h1Result.extreme) {
          h1Counters.extreme_resolved++;
          if (TOP_CFG.verbose) {
            console.log(`[H1_EXTREME] ${symbol} ${h1Result.zone_s1}×${h1Result.zone_s0} → ${h1Result.side} ${h1Result.mode} | combined mode: ${prevMode} → ${signalMode}`);
          }
        } else {
          h1Counters[`aligned_${h1Result.side === 'BUY' ? 'up' : 'down'}`]++;
          if (TOP_CFG.verbose) {
            console.log(`[H1_ALIGN] ${symbol} zone_s1=${h1Result.zone_s1} zone_s0=${h1Result.zone_s0} → ${h1Result.side} ${h1Result.mode} | combined mode: ${prevMode} → ${signalMode}`);
          }
        }
      } else if (h1Result?.skip) {
        h1Counters.aligned_flat++;
      } else if (h1Result?.deferred) {
        h1Counters.deferred++;
      }

      if (TOP_CFG.verbose) {
        console.log(`[D1] ${symbol} d1State=${d1State} slope_d1_s0=${_sd1s0?.toFixed(2)} dslope_d1_live=${_dslope_d1_live?.toFixed(2)} (csv=${num(row?.dslope_d1)?.toFixed(2)}) → SELL_gate=${_dslope_d1_live !== null ? (_dslope_d1_live < -0.5 ? 'OK' : 'BLOCK') : 'null'} BUY_gate=${_dslope_d1_live !== null ? (_dslope_d1_live > 0.5 ? 'OK' : 'BLOCK') : 'null'}`);
        if (signalMode === "spike" && (d1State === "D1_FADING_UP" || d1State === "D1_FADING_DOWN"))
          console.log(`[D1_SPIKE] ${symbol} d1State=${d1State} → REVERSAL spike forcé par D1`);
        if (d1State === "D1_EMERGING_DOWN" || d1State === "D1_EMERGING_UP")
          console.log(`[D1_EMERGING] ${symbol} d1State=${d1State} → signalType=${signalType} signalMode=${signalMode}`);
        if (signalMode === "spike" && (d1State === "D1_STRONG_UP" || d1State === "D1_STRONG_DOWN"))
          console.log(`[D1_STRONG_SPIKE] ${symbol} d1State=${d1State} → REVERSAL spike contra D1_STRONG`);
        if (signalMode !== "spike" && (d1State === "D1_STRONG_UP" || d1State === "D1_STRONG_DOWN"))
          console.log(`[D1_STRONG_CONT] ${symbol} d1State=${d1State} dslope_d1_live=${_dslope_d1_live?.toFixed(2)} → unchanged strict`);
        if (match.route?.includes("EXHAUSTION")) {
          console.log(`[EXHAUSTION] ${symbol} route=${match.route} mode=${signalMode} slope_h1_s0=${_slope_h1_s0?.toFixed(2)} dslope_h1_live=${_dslope_h1_live?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)}`);
        }
        if (match.route?.includes("CONT-RESUME")) {
          console.log(`[CONT-RESUME] ${symbol} route=${match.route} mode=${signalMode} dslope_h1_live=${_dslope_h1_live?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)} zscore_h1_s0=${num(row?.zscore_h1_s0)?.toFixed(2)}`);
        }
        if (range_ratio_h1 !== null && range_ratio_h1 > 0.8) {
          console.log(`[LATE_ENTRY] ${symbol} range_ratio_h1=${range_ratio_h1?.toFixed(2)} isLateEntry=true`);
        }
      }

      if (signalMode !== "spike" && !accelContextGate(match.side, _dslope_h1_live)) continue;

      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const scoreRow = {
        symbol,
        type: signalType, side: match.side,
        slope_h1:             num(row?.slope_h1),
        dslope_h1:            _dslope_h1_live,
        zscore_h1:            num(row?.zscore_h1),
        rsi_h1:               num(row?.rsi_h1),
        rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
        zscore_h1_min3:       num(row?.zscore_h1_min3),
        zscore_h1_max3:       num(row?.zscore_h1_max3),
        intraday_change:      intra,
        atr_m15:              num(row?.atr_m15),
        close:                num(row?.close),
      };

      let scored;
      if      (signalType === "REVERSAL"     && match.side === "BUY")  scored = scoreReversalBuy(scoreRow);
      else if (signalType === "REVERSAL"     && match.side === "SELL") scored = scoreReversalSell(scoreRow);
      else if (signalType === "CONTINUATION" && match.side === "BUY")  scored = scoreContinuationBuy(scoreRow);
      else if (signalType === "CONTINUATION" && match.side === "SELL") scored = scoreContinuationSell(scoreRow);
      else scored = { total: signalType === "EARLY" ? 70 : 50, breakdown: {} };

      const score     = Math.round(scored.total ?? 0);
      const breakdown = scored.breakdown ?? {};

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type:        signalType,
        mode:        signalMode,
        regime:      `${signalType}_${match.side}`,
        route:       match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine:      "V8R",
        index:       i,
        timestamp:   row?.timestamp,
        symbol,
        side:        match.side,
        signalType,
        score,
        breakdown,
        intradayLevel,
        slopeH4Level,
        d1State,

        // D1
        slope_d1_s0:    _sd1s0,
        dslope_d1_live: _dslope_d1_live,   // live = slope_d1_s0 - slope_d1
        dslope_d1_csv:  num(row?.dslope_d1), // original CSV pour debug

        // H4
        slope_h4:    num(row?.slope_h4),
        dslope_h4:   num(row?.dslope_h4),
        rsi_h4_s0:   num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        dslopeH4:    dslopeH4,

        // H1 s1
        rsi_h1:         num(row?.rsi_h1),
        slope_h1:       num(row?.slope_h1),
        dslope_h1:      _dslope_h1_live,      // live = slope_h1_s0 - slope_h1
        dslope_h1_csv:  num(row?.dslope_h1),  // original CSV pour debug
        zscore_h1:      num(row?.zscore_h1),
        dz_h1:          num(row?.dz_h1),
        atr_h1:         num(row?.atr_h1),
        zscore_h1_min3: num(row?.zscore_h1_min3),
        zscore_h1_max3: num(row?.zscore_h1_max3),

        // H1 s0
        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        // M15
        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        // M5 s1
        rsi_m5:    num(row?.rsi_m5),
        slope_m5:  num(row?.slope_m5),
        dslope_m5: num(row?.dslope_m5),
        zscore_m5: num(row?.zscore_m5),

        // M5 s0
        rsi_m5_s0:    num(row?.rsi_m5_s0),
        slope_m5_s0:  num(row?.slope_m5_s0),
        zscore_m5_s0: num(row?.zscore_m5_s0),

        close:           num(row?.close),
        intraday_change: intra,
        exhaustion:      match.route?.includes("EXHAUSTION")   ?? false,
        contResume:      match.route?.includes("CONT-RESUME")  ?? false,
        range_ratio_h1,
      });
    }

    opps.sort((a, b) => {
      const sa = a.score ?? 0, sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    // ============================================================================
    // DEBUG PIPELINE
    // ============================================================================
    if (TOP_CFG.debug) {
      let cTotal = 0, cAntiSpike = 0, cResolve = 0, cAccelGate = 0, cReversalKill = 0, cScore = 0, cFinal = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sym = row?.symbol;
        if (!sym) continue;
        cTotal++;

        const _riskCfg     = getRiskConfig(sym);
        const _intCfg      = INTRADAY_CONFIG[sym] ?? INTRADAY_CONFIG.default;
        const _slopeCfg    = getSlopeConfig(sym);
        const _dslopeH4Thr   = _slopeCfg.dslopeH4Thr ?? 0.3;
        const _antiSpike   = num(_slopeCfg?.antiSpikeH1S0) ?? 8;

        // Anti-spike mirror of evaluate(): only dslope_h1_live
        const _slope_h1_s0_dbg = num(row?.slope_h1_s0);
        const _slope_h1_dbg    = num(row?.slope_h1);
        const _dslope_h1_dbg   = (_slope_h1_s0_dbg !== null && _slope_h1_dbg !== null)
          ? _slope_h1_s0_dbg - _slope_h1_dbg
          : null;
        if (_dslope_h1_dbg !== null && Math.abs(_dslope_h1_dbg) >= _antiSpike) continue;
        cAntiSpike++;

        const intra         = num(row?.intraday_change);
        const intradayLevel = getIntradayLevel(intra, _intCfg);
        const slope_h1_raw_for_level_dbg = num(row?.slope_h1_s0) !== null
          ? num(row.slope_h1_s0) : num(row?.slope_h1);
        const slopeH4Level  = getSlopeLevel(slope_h1_raw_for_level_dbg, sym);
        const _ds0 = num(row?.slope_h1_s0);
        const _ds1 = num(row?.slope_h1);
        const _dsh4 = (_ds0 !== null && _ds1 !== null) ? _ds0 - _ds1 : null;

        const _dbg_sd1s0    = num(row?.slope_d1_s0);
        const _dbg_slope_d1 = num(row?.slope_d1);
        const _dbg_dslope_d1 = (_dbg_sd1s0 !== null && _dbg_slope_d1 !== null)
          ? _dbg_sd1s0 - _dbg_slope_d1
          : null;
        const _dbg_dslope_d1_s0 = num(row?.dslope_d1_s0);
        const _dbg_d1State = (_dbg_sd1s0 !== null && _dbg_dslope_d1 !== null)
          ? getD1State(_dbg_sd1s0, _dbg_dslope_d1) : "D1_FLAT";

        const _dbg_slope_h1_s0 = _slope_h1_s0_dbg;
        const buyRes  = resolve3D(intradayLevel, slopeH4Level, _dsh4, "BUY",  1.0, _dbg_slope_d1, _dbg_sd1s0, _dbg_dslope_d1, _dbg_dslope_d1_s0, _dbg_slope_h1_s0, sym);
        const sellRes = resolve3D(intradayLevel, slopeH4Level, _dsh4, "SELL", 1.0, _dbg_slope_d1, _dbg_sd1s0, _dbg_dslope_d1, _dbg_dslope_d1_s0, _dbg_slope_h1_s0, sym);
        if (!buyRes && !sellRes) continue;
        cResolve++;

        const activeRes   = buyRes ?? sellRes;
        const activeSide  = buyRes ? "BUY" : "SELL";
        const activeMode  = activeRes.mode ?? computeMode(activeRes.type, activeSide, intradayLevel, slopeH4Level, _dsh4, _dslopeH4Thr);
        if (activeMode !== "spike" && !accelContextGate(activeSide, _dslope_h1_dbg)) continue;
        cAccelGate++;

        if (activeRes.type === "REVERSAL" && _riskCfg.reversalEnabled === false) continue;
        cReversalKill++;

        const score = activeRes.type === "REVERSAL" ? 80
                    : activeRes.type === "EARLY"    ? 70
                    : Math.max(0, Math.round(
                        Math.abs(num(row?.slope_h1) ?? 0) * 50 +
                        Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
                      ));
        if (score < TOP_CFG.scoreMin) continue;
        cScore++;

        const _dbg_args = [
          num(row?.rsi_h1_s0),
          _dslope_h1_dbg,
          num(row?.zscore_h1_s0),
          _slope_h1_s0_dbg,
          num(row?.range_ratio_h1),
        ];
        const g = buildGates(activeSide, activeMode, activeRes.type, _antiSpike);
        const routeMatch = activeSide === "BUY"
          ? matchBuyRoute(..._dbg_args, g)
          : matchSellRoute(..._dbg_args, g);

        if (!routeMatch) {
          if (TOP_CFG.verbose) {
            const rsi      = num(row?.rsi_h1_s0);
            const zscore   = num(row?.zscore_h1_s0);
            const zone     = rsi < 28 ? "0-28" : rsi < 50 ? "28-50" : rsi < 72 ? "50-72" : "72+";
            console.log(`[g7 FAIL] mode=${activeMode} type=${activeRes.type} side=${activeSide} zone=${zone} | rsi=${rsi?.toFixed(1)} z=${zscore?.toFixed(2)} dslope_h1_live=${_dslope_h1_dbg?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)}`);
          }
          continue;
        }

        cFinal++;
      }

      console.info("TOPOPP V8R", { total_rows: rows.length, signals: opps.length });
      console.log("H1 alignment breakdown:", h1Counters);

      console.table({
        "0 — total rows":         { count: cTotal,        pct: "100%" },
        "1 — after anti-spike":   { count: cAntiSpike,    pct: ((cAntiSpike/cTotal)*100).toFixed(1)+"%" },
        "2 — after resolve3D":    { count: cResolve,      pct: ((cResolve/cAntiSpike)*100).toFixed(1)+"%" },
        "3 — after accelGate":    { count: cAccelGate,    pct: ((cAccelGate/cResolve)*100).toFixed(1)+"%" },
        "4 — after reversalKill": { count: cReversalKill, pct: ((cReversalKill/cAccelGate)*100).toFixed(1)+"%" },
        "5 — after scoreMin":     { count: cScore,        pct: ((cScore/cReversalKill)*100).toFixed(1)+"%" },
        "6 — after matchRoute":   { count: cFinal,        pct: ((cFinal/cScore)*100).toFixed(1)+"%" },
      });

      const resolveBreakdown = {
        CONTINUATION_BUY: 0, CONTINUATION_SELL: 0,
        REVERSAL_BUY: 0,     REVERSAL_SELL: 0,
        EARLY_BUY: 0,        EARLY_SELL: 0,
      };
      for (const row of rows) {
        const _sym  = row?.symbol;
        const _ic   = INTRADAY_CONFIG[_sym] ?? INTRADAY_CONFIG.default;
        const _sc   = getSlopeConfig(_sym);
        const _thr  = _sc.dslopeH4Thr ?? 0.3;
        const intra = num(row?.intraday_change);
        const il  = getIntradayLevel(intra, _ic);
        const sh4  = getSlopeLevel(num(row?.slope_h1_s0) ?? num(row?.slope_h1), _sym);
        const _s0  = num(row?.slope_h1_s0), _s1 = num(row?.slope_h1);
        const dsh4 = (_s0 !== null && _s1 !== null) ? _s0 - _s1 : null;
        const _bk_sd1     = num(row?.slope_d1_s0);
        const _bk_sl_d1   = num(row?.slope_d1);
        const _bk_dsd1    = (_bk_sd1 !== null && _bk_sl_d1 !== null) ? _bk_sd1 - _bk_sl_d1 : null;
        const _bk_dsd1_s0 = num(row?.dslope_d1_s0);
        const _bk_d1      = (_bk_sd1 !== null && _bk_dsd1 !== null) ? getD1State(_bk_sd1, _bk_dsd1) : "D1_FLAT";
        const _bk_sh1s0 = num(row?.slope_h1_s0);
        const br  = resolve3D(il, sh4, dsh4, "BUY",  1.0, _bk_sl_d1, _bk_sd1, _bk_dsd1, _bk_dsd1_s0, _bk_sh1s0, _sym);
        const sr  = resolve3D(il, sh4, dsh4, "SELL", 1.0, _bk_sl_d1, _bk_sd1, _bk_dsd1, _bk_dsd1_s0, _bk_sh1s0, _sym);
        if (br) resolveBreakdown[`${br.type}_BUY`]  = (resolveBreakdown[`${br.type}_BUY`]  ?? 0) + 1;
        if (sr) resolveBreakdown[`${sr.type}_SELL`] = (resolveBreakdown[`${sr.type}_SELL`] ?? 0) + 1;
      }
      console.log("resolve3D breakdown:", resolveBreakdown);
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_V8R;