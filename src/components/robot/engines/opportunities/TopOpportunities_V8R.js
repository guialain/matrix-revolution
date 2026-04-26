// ============================================================================
// TopOpportunities_V8R.js — H1 ROUTER V8R
//
// RESOLVE = D1 alignment + IC (intradayChange) + slopeH1Level + dslopeH1 → TYPE
// (PHASE A : H4 substitue par H1, redondances a dedupliquer en Phase B)
//
// EXHAUSTION = trade CONTRE l'IC (pas un retournement de marché)
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
import { getSlopeConfig } from "../config/SlopeConfig.js";
import {
  getIntradayLevel,
  getSlopeLevel,
  getD1State,
  getSlopeD1Zone,
  getAlignmentD1,
} from "../../../../utils/marketLevels.js";
import { scoreExhaustionBuy, scoreExhaustionSell, scoreContinuationBuy, scoreContinuationSell } from "./ScoreEngine.js";
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
  // getH1Conditions — seuils techniques H1 selon mode × type × side
  //
  // Inputs :
  //   side : 'BUY' ou 'SELL'
  //   mode : 'strict' | 'normal' | 'soft' | 'relaxed'
  //   type : 'CONTINUATION' ou 'EXHAUSTION'
  //
  // Output : objet avec 8 champs (valeurs null si non applicables)
  //   h1_s0_min, h1_s0_max               : zones cibles slope_h1_s0
  //   h1_dslope_min, h1_dslope_max       : bornes dslope_h1
  //   h1_dslope_min_v_shape,
  //   h1_dslope_max_v_shape              : bornes V-shape (CONT seulement)
  //   zscoreCap, zscoreFloor             : bornes zscore_h1_s0
  // ============================================================================
  function getH1Conditions(side, mode, type) {
    // CONT BUY (h1_s0 doit etre haut, dslope positif requis, V-shape autorise)
    if (type === 'CONTINUATION' && side === 'BUY') {
      if (mode === 'strict')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: 1.5,  h1_dslope_max: 3.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 5,  zscoreCap: 1.5,  zscoreFloor: null };
      if (mode === 'normal')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: 0.5,  h1_dslope_max: 3.5,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 6,  zscoreCap: 1.75, zscoreFloor: null };
      if (mode === 'soft')    return { h1_s0_min: 'flat',      h1_s0_max: null, h1_dslope_min: -1.0, h1_dslope_max: 4.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 8,  zscoreCap: 2.0,  zscoreFloor: null };
      if (mode === 'relaxed') return { h1_s0_min: 'down_weak', h1_s0_max: null, h1_dslope_min: -1.5, h1_dslope_max: 5.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 10, zscoreCap: 2.5,  zscoreFloor: null };
    }

    // CONT SELL (miroir CONT BUY)
    if (type === 'CONTINUATION' && side === 'SELL') {
      if (mode === 'strict')  return { h1_s0_min: null, h1_s0_max: 'down_weak', h1_dslope_min: -3.0, h1_dslope_max: -1.5, h1_dslope_min_v_shape: -5,  h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.5 };
      if (mode === 'normal')  return { h1_s0_min: null, h1_s0_max: 'down_weak', h1_dslope_min: -3.5, h1_dslope_max: -0.5, h1_dslope_min_v_shape: -6,  h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.75 };
      if (mode === 'soft')    return { h1_s0_min: null, h1_s0_max: 'flat',      h1_dslope_min: -4.0, h1_dslope_max: 1.0,  h1_dslope_min_v_shape: -8,  h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.0 };
      if (mode === 'relaxed') return { h1_s0_min: null, h1_s0_max: 'up_weak',   h1_dslope_min: -5.0, h1_dslope_max: 1.5,  h1_dslope_min_v_shape: -10, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.5 };
    }

    // EXH BUY (h1_s0 doit etre bas, dslope deja en remontee, anti-spike retournement)
    if (type === 'EXHAUSTION' && side === 'BUY') {
      if (mode === 'strict')  return { h1_s0_min: null, h1_s0_max: 'down_strong', h1_dslope_min: 1.5,  h1_dslope_max: 5,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.5 };
      if (mode === 'normal')  return { h1_s0_min: null, h1_s0_max: 'down_weak',   h1_dslope_min: 1.0,  h1_dslope_max: 6,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -2.0 };
      if (mode === 'soft')    return { h1_s0_min: null, h1_s0_max: 'flat',        h1_dslope_min: 0.5,  h1_dslope_max: 8,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.75 };
      if (mode === 'relaxed') return { h1_s0_min: null, h1_s0_max: 'up_weak',     h1_dslope_min: -0.5, h1_dslope_max: 10, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: -1.5 };
    }

    // EXH SELL (miroir EXH BUY)
    if (type === 'EXHAUSTION' && side === 'SELL') {
      if (mode === 'strict')  return { h1_s0_min: 'up_strong', h1_s0_max: null, h1_dslope_min: -5,  h1_dslope_max: -1.5, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 2.5,  zscoreFloor: null };
      if (mode === 'normal')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: -6,  h1_dslope_max: -1.0, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 2.0,  zscoreFloor: null };
      if (mode === 'soft')    return { h1_s0_min: 'flat',      h1_s0_max: null, h1_dslope_min: -8,  h1_dslope_max: -0.5, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 1.75, zscoreFloor: null };
      if (mode === 'relaxed') return { h1_s0_min: 'down_weak', h1_s0_max: null, h1_dslope_min: -10, h1_dslope_max: 0.5,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: 1.5,  zscoreFloor: null };
    }

    // Safety net : combinaison invalide
    return { h1_s0_min: null, h1_s0_max: null, h1_dslope_min: null, h1_dslope_max: null, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null, zscoreCap: null, zscoreFloor: null };
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
  // checkConditions — verifie que les conditions techniques H1 + zscore
  // passent pour la route deja selectionnee par selectRoute.
  //
  // Inputs :
  //   slope_h1        : slope H1 historique (s1)
  //   slope_h1_s0     : slope H1 actuel (s0)
  //   dslope_h1       : variation H1 (s0 - s1)
  //   zscore_h1_s0    : zscore H1 actuel
  //   conditions      : objet retourne par getH1Conditions
  //   side            : 'BUY' ou 'SELL'
  //   symbol          : pour la classification (getSlopeLevel)
  //
  // Output : true si toutes les conditions passent, false sinon.
  // ============================================================================

  const ZONE_RANK = {
    'down_extreme': -3,
    'down_strong':  -2,
    'down_weak':    -1,
    'flat':          0,
    'up_weak':       1,
    'up_strong':     2,
    'up_extreme':    3,
  };

  function checkConditions(slope_h1, slope_h1_s0, dslope_h1, zscore_h1_s0, conditions, side, symbol) {
    // Validations preliminaires : valeurs presentes
    if (slope_h1_s0 === null || dslope_h1 === null || zscore_h1_s0 === null) return false;

    // Etape 1 : zone slope_h1_s0
    const zone_s0 = getSlopeLevel(slope_h1_s0, symbol);
    const zone_s0_rank = ZONE_RANK[zone_s0];
    if (zone_s0_rank === undefined) return false;

    if (conditions.h1_s0_min !== null) {
      const min_rank = ZONE_RANK[conditions.h1_s0_min];
      if (zone_s0_rank < min_rank) return false;
    }
    if (conditions.h1_s0_max !== null) {
      const max_rank = ZONE_RANK[conditions.h1_s0_max];
      if (zone_s0_rank > max_rank) return false;
    }

    // Etape 2 : dslope_h1 selon V-shape ou cas normal
    const isVShape = (side === 'BUY'  && slope_h1 !== null && slope_h1 < 0)
                  || (side === 'SELL' && slope_h1 !== null && slope_h1 > 0);

    if (isVShape) {
      if (side === 'BUY') {
        const cap = conditions.h1_dslope_max_v_shape !== null
          ? conditions.h1_dslope_max_v_shape
          : conditions.h1_dslope_max;
        if (cap !== null && dslope_h1 > cap) return false;
        if (conditions.h1_dslope_min !== null && dslope_h1 < conditions.h1_dslope_min) return false;
      } else {
        const floor = conditions.h1_dslope_min_v_shape !== null
          ? conditions.h1_dslope_min_v_shape
          : conditions.h1_dslope_min;
        if (floor !== null && dslope_h1 < floor) return false;
        if (conditions.h1_dslope_max !== null && dslope_h1 > conditions.h1_dslope_max) return false;
      }
    } else {
      if (conditions.h1_dslope_min !== null && dslope_h1 < conditions.h1_dslope_min) return false;
      if (conditions.h1_dslope_max !== null && dslope_h1 > conditions.h1_dslope_max) return false;
    }

    // Etape 3 : zscore_h1_s0
    if (conditions.zscoreCap !== null && zscore_h1_s0 > conditions.zscoreCap) return false;
    if (conditions.zscoreFloor !== null && zscore_h1_s0 < conditions.zscoreFloor) return false;

    return true;
  }

  // ============================================================================
  // matchRoute V2 — generateur de candidats RSI x zscore
  //
  // Nouvelle architecture : matchRoute propose 0, 1 ou 2 candidats selon
  // la combinaison RSI x zscore. La validation finale (D1 + IC) sera faite
  // par selectRoute (B-7b).
  //
  // Inputs :
  //   rsi_h1_s0    : RSI H1 actuel
  //   zscore_h1_s0 : zscore H1 actuel
  //
  // Output : Array<{ route, side, type }>
  //   route : nom de la route
  //   side  : 'BUY' ou 'SELL'
  //   type  : 'CONTINUATION' ou 'EXHAUSTION'
  //
  // Note : les EXHAUSTION sont type='EXHAUSTION' (pari sur retournement),
  //        les CONT sont type='CONTINUATION' (pari sur poursuite).
  // ============================================================================

  function matchRoute(rsi_h1_s0, zscore_h1_s0) {
    if (rsi_h1_s0 === null || zscore_h1_s0 === null) return [];

    const rsi    = rsi_h1_s0;
    const zscore = zscore_h1_s0;

    // Zone 0-28 : extreme oversold
    if (rsi < 28) {
      if (zscore < -2) {
        return [
          { route: "BUY-[0-28]-EXHAUSTION", side: "BUY", type: "EXHAUSTION" }
        ];
      }
      return [];
    }

    // Zone 28-50 : low-mid
    if (rsi >= 28 && rsi < 50) {
      if (zscore < -0.5) {
        return [
          { route: "SELL-[28-50]-CONT",        side: "SELL", type: "CONTINUATION" },
          { route: "BUY-[28-50]-EXHAUSTION",   side: "BUY",  type: "EXHAUSTION" },
        ];
      }
      return [];
    }

    // Zone 50-72 : mid-high
    if (rsi >= 50 && rsi < 72) {
      if (zscore > 0.5) {
        return [
          { route: "BUY-[50-72]-CONT",         side: "BUY",  type: "CONTINUATION" },
          { route: "SELL-[50-72]-EXHAUSTION",  side: "SELL", type: "EXHAUSTION" },
        ];
      }
      return [];
    }

    // Zone 72-100 : extreme overbought
    if (rsi >= 72) {
      if (zscore > 2) {
        return [
          { route: "SELL-[72-100]-EXHAUSTION", side: "SELL", type: "EXHAUSTION" }
        ];
      }
      return [];
    }

    return [];
  }

  // ============================================================================
  // selectRoute — gate D1 alignment + IC
  //
  // Prend les candidats de matchRoute V2 et tranche selon le contexte D1+IC.
  // Renvoie le premier candidat qui passe le gate, ou null si aucun.
  //
  // Inputs :
  //   candidates    : Array<{ route, side, type }> de matchRoute V2
  //   slope_d1_s1   : slope D1 historique
  //   slope_d1_s0   : slope D1 actuelle
  //   intradayLevel : niveau IC classifie
  //
  // Output : { route, side, type } ou null
  //
  // Logique :
  //   1. Calcule l'alignement D1 (s1 + s0)
  //   2. Pour chaque candidat dans l'ordre :
  //      - D1 alignment doit autoriser le side
  //      - IC ne doit pas etre contre le trend
  //      - Premier candidat valide est retourne
  //   3. Aucun candidat valide → null
  // ============================================================================

  const D1_ALIGNMENTS_BUY  = new Set(['aligned_up', 'transition_up', 'inversion_up', 'fade_up']);
  const D1_ALIGNMENTS_SELL = new Set(['aligned_down', 'transition_down', 'inversion_down', 'fade_down']);
  const IC_BEARISH_BLOCK_BUY  = new Set(['SOFT_DOWN', 'STRONG_DOWN', 'EXPLOSIVE_DOWN', 'SPIKE_DOWN']);
  const IC_BULLISH_BLOCK_SELL = new Set(['SOFT_UP', 'STRONG_UP', 'EXPLOSIVE_UP', 'SPIKE_UP']);

  function selectRoute(candidates, slope_d1_s1, slope_d1_s0, intradayLevel) {
    if (!candidates || candidates.length === 0) return null;

    const zone_s1 = getSlopeD1Zone(slope_d1_s1);
    const zone_s0 = getSlopeD1Zone(slope_d1_s0);
    const alignment = getAlignmentD1(zone_s1, zone_s0);
    if (alignment === null) return null;

    for (const c of candidates) {
      if (c.side === 'BUY') {
        if (!D1_ALIGNMENTS_BUY.has(alignment)) continue;
        if (IC_BEARISH_BLOCK_BUY.has(intradayLevel)) continue;
        return c;
      }
      if (c.side === 'SELL') {
        if (!D1_ALIGNMENTS_SELL.has(alignment)) continue;
        if (IC_BULLISH_BLOCK_SELL.has(intradayLevel)) continue;
        return c;
      }
    }
    return null;
  }

  // ============================================================================
  // detectSpike — pre-filtre spike multi-source (H1 + IC)
  //
  // Detecte un mouvement extreme sur 2 sources possibles :
  //   - slope_h1_s0 (|valeur| >= 8) : spike H1
  //   - intradayLevel SPIKE_UP/SPIKE_DOWN : spike intraday
  // Si les 2 sources sont actives, H1 prime.
  //
  // Inputs :
  //   slope_h1_s0   : niveau H1 actuel
  //   intradayLevel : niveau IC classifie
  //
  // Output : { isSpike: bool, direction: 'up'|'down'|null, source: 'h1'|'ic'|null }
  //
  // Usage : un spike haussier kill les BUY (autorise SELL pour fade),
  //         un spike baissier kill les SELL (autorise BUY pour fade).
  //         Champ source informe l'UI de l'origine du spike.
  // ============================================================================

  const SPIKE_H1_THRESHOLD = 8;

  function detectSpike(slope_h1_s0, intradayLevel) {
    // Source H1 prioritaire
    if (slope_h1_s0 !== null) {
      if (slope_h1_s0 >=  SPIKE_H1_THRESHOLD) return { isSpike: true, direction: 'up',   source: 'h1' };
      if (slope_h1_s0 <= -SPIKE_H1_THRESHOLD) return { isSpike: true, direction: 'down', source: 'h1' };
    }

    // Source IC en fallback
    if (intradayLevel === 'SPIKE_UP')   return { isSpike: true, direction: 'up',   source: 'ic' };
    if (intradayLevel === 'SPIKE_DOWN') return { isSpike: true, direction: 'down', source: 'ic' };

    return { isSpike: false, direction: null, source: null };
  }

  // ============================================================================
  // getMode — calcul du mode base sur D1 alignment + IC
  //
  // Architecture : cascade de cas explicites par (D1 alignment x IC level).
  // Plus de table H1, plus de default fourre-tout.
  //
  // Inputs :
  //   side          : 'BUY' ou 'SELL'
  //   intradayLevel : niveau IC classifie
  //   slope_d1_s1   : slope D1 historique
  //   slope_d1_s0   : slope D1 actuelle
  //   alignment     : alignement D1 (aligned_up, aligned_down, transition_up,
  //                   transition_down, inversion_up, inversion_down,
  //                   fade_up, fade_down)
  //
  // Output : 'relaxed' | 'soft' | 'normal' | 'strict'
  // ============================================================================

  const D1_STRONG_ZONES_UP   = new Set(['up_strong', 'up_extreme']);
  const D1_STRONG_ZONES_DOWN = new Set(['down_strong', 'down_extreme']);
  const IC_BULLISH_LEVELS = { 'EXPLOSIVE_UP': 'EXPLOSIVE', 'STRONG_UP': 'STRONG', 'SOFT_UP': 'SOFT' };
  const IC_BEARISH_LEVELS = { 'EXPLOSIVE_DOWN': 'EXPLOSIVE', 'STRONG_DOWN': 'STRONG', 'SOFT_DOWN': 'SOFT' };

  function getMode(side, intradayLevel, slope_d1_s1, slope_d1_s0, alignment) {
    // R1 : IC NEUTRE -> strict
    if (intradayLevel === 'NEUTRE') return 'strict';

    // Determiner le niveau IC dans le sens du trade
    // (selectRoute filtre deja IC contre le trend, mais defense en profondeur)
    const icLevels = side === 'BUY' ? IC_BULLISH_LEVELS : IC_BEARISH_LEVELS;
    const icLevel = icLevels[intradayLevel];
    if (!icLevel) return 'strict'; // safety : IC ni dans le sens ni NEUTRE

    // Determiner les zones D1 fortes pour le side
    const strongZones = side === 'BUY' ? D1_STRONG_ZONES_UP : D1_STRONG_ZONES_DOWN;

    // Branche aligned (R2, R3, R4)
    if (alignment === 'aligned_up' || alignment === 'aligned_down') {
      const zone_s1 = getSlopeD1Zone(slope_d1_s1);
      const zone_s0 = getSlopeD1Zone(slope_d1_s0);

      // R2 : zones les 2 strong/extreme
      if (strongZones.has(zone_s1) && strongZones.has(zone_s0)) return 'relaxed';

      // R3, R4 : aligned mixte (au moins 1 weak)
      if (icLevel === 'SOFT')                              return 'normal'; // R3
      if (icLevel === 'STRONG' || icLevel === 'EXPLOSIVE') return 'soft';   // R4
    }

    // Branche transition (R5, R6, R7)
    if (alignment === 'transition_up' || alignment === 'transition_down') {
      if (icLevel === 'EXPLOSIVE') return 'soft';   // R5
      if (icLevel === 'STRONG')    return 'normal'; // R6
      if (icLevel === 'SOFT')      return 'strict'; // R7
    }

    // Branche inversion (R8, R9)
    if (alignment === 'inversion_up' || alignment === 'inversion_down') {
      if (icLevel === 'EXPLOSIVE') return 'normal'; // R8
      return 'strict'; // R9 : STRONG ou SOFT
    }

    // Branche fade (R10, R11, R12)
    if (alignment === 'fade_up' || alignment === 'fade_down') {
      if (icLevel === 'EXPLOSIVE') return 'soft';   // R10
      if (icLevel === 'STRONG')    return 'normal'; // R11
      if (icLevel === 'SOFT')      return 'strict'; // R12
    }

    // Safety net : alignment imprevu (aligned_flat ou null) → strict
    return 'strict';
  }

  // ============================================================================
  // ROUTE => SIGNAL PHASE
  // ============================================================================
  const ROUTE_PHASE = {
    // EXHAUSTION
    "BUY-[0-28]-EXHAUSTION":    "EXTREME_LOW",
    "BUY-[28-50]-EXHAUSTION":   "LOW_MID",
    "SELL-[50-72]-EXHAUSTION":  "MID_HIGH",
    "SELL-[72-100]-EXHAUSTION": "EXTREME_HIGH",
    // CONT
    "BUY-[50-72]-CONT":         "MID_HIGH",
    "SELL-[28-50]-CONT":        "LOW_MID",
    // WAIT
    "WAIT": "WAIT",
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
      verbose: Boolean(opts?.verbose), // logs par row ([D1], [EXHAUSTION], [CHECK FAIL], …)
    };

    let opps = [];

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
      const antiSpikeH1S0 = num(slopeCfg?.antiSpikeH1S0) ?? 8;
      const atrH1Cap      = num(riskCfg?.atrH1Cap);

      // Gate ATR — filtre volatilité extrême (> 4x cap)
      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 4 * atrH1Cap) continue;

      // ============================================================================
      // ZONE GRISE ZSCORE — emit WAIT signal informatif
      // Rows ou |zscore_h1_s0| sous 0.5 (ou null) ne sont pas tradables.
      // On emet un WAIT pour informer le consommateur aval (UI/debug).
      // ============================================================================
      const _zscore_h1_s0_check = num(row?.zscore_h1_s0);
      const isGreyZone = (_zscore_h1_s0_check === null) ||
                         (_zscore_h1_s0_check > -0.5 && _zscore_h1_s0_check < 0.5);

      if (isGreyZone) {
        opps.push({
          type:        null,
          mode:        null,
          regime:      "WAIT",
          route:       "WAIT",
          signalPhase: "WAIT",
          engine:      "V8R",
          index:       i,
          timestamp:   row?.timestamp,
          symbol,
          side:        null,
          signalType:  null,
          score:       0,
          breakdown:   {},
          isWait:      true,
          zscore_h1_s0: _zscore_h1_s0_check,
        });
        continue;
      }

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

      // Pre-filtre spike multi-source (H1 + IC) — emit payload WAIT a l'UI
      const _spike = detectSpike(_slope_h1_s0, intradayLevel);
      if (_spike.isSpike) {
        opps.push({
          type:            'WAIT',
          waitReason:      'spike',
          symbol,
          timestamp:       row?.timestamp,
          slope_h1_s0:     _slope_h1_s0,
          intradayLevel,
          spike_direction: _spike.direction,
          spike_source:    _spike.source,
          blocked_side:    _spike.direction === 'up' ? 'BUY' : 'SELL',
        });
      }

      // Skip side correspondant au sens du spike (l'autre side reste autorise pour fade)
      const _skipBuy  = _spike.isSpike && _spike.direction === 'up';
      const _skipSell = _spike.isSpike && _spike.direction === 'down';

      const _dslope_h1_live   = (_slope_h1_s0 !== null && _slope_h1 !== null)
        ? _slope_h1_s0 - _slope_h1
        : null;

      const args = [
        num(row?.rsi_h1_s0),
        _dslope_h1_live,        // ← live au lieu du CSV
        num(row?.zscore_h1_s0),
        _slope_h1_s0,
      ];

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

      // Etape 3 : matchRoute V2 — candidats RSI x zscore
      const allCandidates = matchRoute(num(row?.rsi_h1_s0), num(row?.zscore_h1_s0));

      // Etape 4 : filtrage selon skipBuy / skipSell (du pre-filtre detectSpike)
      const candidates = allCandidates.filter(c => {
        if (c.side === 'BUY'  && _skipBuy)  return false;
        if (c.side === 'SELL' && _skipSell) return false;
        return true;
      });

      // Etape 5 : selectRoute — choisit selon D1 + IC
      const selected = selectRoute(candidates, _slope_d1, _sd1s0, intradayLevel);
      if (!selected) continue;

      // Etape 6 : getMode (D1 + IC, sans H1)
      signalMode = getMode(selected.side, intradayLevel, _slope_d1, _sd1s0, _alignmentD1);
      signalType = selected.type;

      if (TOP_CFG.verbose) {
        console.log(`[ROUTE] ${symbol} side=${selected.side} type=${signalType} route=${selected.route} mode=${signalMode}`);
      }

      // Etape 8 : validation des conditions techniques sur la route selectionnee
      const conditions = getH1Conditions(selected.side, signalMode, selected.type);
      const conditionsOk = checkConditions(
        _slope_h1,
        _slope_h1_s0,
        _dslope_h1_live,
        num(row?.zscore_h1_s0),
        conditions,
        selected.side,
        symbol
      );

      if (!conditionsOk) continue;

      // La route est deja determinee par selectRoute, on cree match a partir de selected
      match = { route: selected.route, side: selected.side };

      if (TOP_CFG.verbose) {
        console.log(`[D1] ${symbol} d1State=${d1State} slope_d1_s0=${_sd1s0?.toFixed(2)} dslope_d1_live=${_dslope_d1_live?.toFixed(2)} (csv=${num(row?.dslope_d1)?.toFixed(2)}) → SELL_gate=${_dslope_d1_live !== null ? (_dslope_d1_live < -0.5 ? 'OK' : 'BLOCK') : 'null'} BUY_gate=${_dslope_d1_live !== null ? (_dslope_d1_live > 0.5 ? 'OK' : 'BLOCK') : 'null'}`);
        if (d1State === "D1_EMERGING_DOWN" || d1State === "D1_EMERGING_UP")
          console.log(`[D1_EMERGING] ${symbol} d1State=${d1State} → signalType=${signalType} signalMode=${signalMode}`);
        if (match.route?.includes("EXHAUSTION")) {
          console.log(`[EXHAUSTION] ${symbol} route=${match.route} mode=${signalMode} slope_h1_s0=${_slope_h1_s0?.toFixed(2)} dslope_h1_live=${_dslope_h1_live?.toFixed(2)} csv=${num(row?.dslope_h1)?.toFixed(2)}`);
        }
      }

      if (signalType === "EXHAUSTION" && riskCfg.exhaustionEnabled === false) continue;

      const scoreRow = {
        symbol,
        slope_h1:             num(row?.slope_h1),
        dslope_h1:            _dslope_h1_live,
        zscore_h1:            num(row?.zscore_h1),
        rsi_h1:               num(row?.rsi_h1),
        rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
        intraday_change:      intra,
        atr_m15:              num(row?.atr_m15),
        close:                num(row?.close),
      };

      let scored;
      if      (signalType === "EXHAUSTION"     && match.side === "BUY")  scored = scoreExhaustionBuy(scoreRow);
      else if (signalType === "EXHAUSTION"     && match.side === "SELL") scored = scoreExhaustionSell(scoreRow);
      else if (signalType === "CONTINUATION" && match.side === "BUY")  scored = scoreContinuationBuy(scoreRow);
      else if (signalType === "CONTINUATION" && match.side === "SELL") scored = scoreContinuationSell(scoreRow);
      else scored = { total: 50, breakdown: {} };

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

        // H1 s0
        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),
        middle_h1:    num(row?.middle_h1),
        sigma_h1:     num(row?.sigma_h1),

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
      let cTotal = 0, cNonGrey = 0, cSelectRoute = 0, cExhaustionKill = 0, cScore = 0, cCheckConditions = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sym = row?.symbol;
        if (!sym) continue;
        cTotal++;

        // Skip WAIT pour le funnel (ils bypassent la pipeline classique)
        const _zscore_dbg = num(row?.zscore_h1_s0);
        const _isGreyDbg = (_zscore_dbg === null) ||
                           (_zscore_dbg > -0.5 && _zscore_dbg < 0.5);
        if (_isGreyDbg) continue;

        const _riskCfg     = getRiskConfig(sym);
        const _intCfg      = INTRADAY_CONFIG[sym] ?? INTRADAY_CONFIG.default;
        const _slopeCfg    = getSlopeConfig(sym);
        const _antiSpike   = num(_slopeCfg?.antiSpikeH1S0) ?? 8;

        // Anti-spike H1 retire (Phase B-2b) — compteur conserve pour funnel
        const _slope_h1_s0_dbg = num(row?.slope_h1_s0);
        const _slope_h1_dbg    = num(row?.slope_h1);
        const _dslope_h1_dbg   = (_slope_h1_s0_dbg !== null && _slope_h1_dbg !== null)
          ? _slope_h1_s0_dbg - _slope_h1_dbg
          : null;
        cNonGrey++;

        const intra         = num(row?.intraday_change);
        const intradayLevel = getIntradayLevel(intra, _intCfg);

        const _dbg_sd1s0    = num(row?.slope_d1_s0);
        const _dbg_slope_d1 = num(row?.slope_d1);

        // Calcul alignement D1 pour le gate
        const _dbg_alignmentD1 = getAlignmentD1(
          getSlopeD1Zone(_dbg_slope_d1),
          getSlopeD1Zone(_dbg_sd1s0)
        );
        const _dbg_candidates = matchRoute(num(row?.rsi_h1_s0), num(row?.zscore_h1_s0));
        const _dbg_selected = selectRoute(_dbg_candidates, _dbg_slope_d1, _dbg_sd1s0, intradayLevel);
        if (!_dbg_selected) continue;
        cSelectRoute++;

        const activeSide = _dbg_selected.side;
        const activeType = _dbg_selected.type;
        const activeMode = getMode(activeSide, intradayLevel, _dbg_slope_d1, _dbg_sd1s0, _dbg_alignmentD1);
        if (activeType === "EXHAUSTION" && _riskCfg.exhaustionEnabled === false) continue;
        cExhaustionKill++;

        // Score debug = miroir exact de la prod (ScoreEngine.scoreXxx)
        const _dbg_scoreRow = {
          symbol: sym,
          slope_h1:             num(row?.slope_h1),
          dslope_h1:            _dslope_h1_dbg,
          zscore_h1:            num(row?.zscore_h1),
          rsi_h1:               num(row?.rsi_h1),
          rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
          rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
          intraday_change:      intra,
          atr_m15:              num(row?.atr_m15),
          close:                num(row?.close),
        };

        let _dbg_scored;
        if      (activeType === "EXHAUSTION"   && activeSide === "BUY")  _dbg_scored = scoreExhaustionBuy(_dbg_scoreRow);
        else if (activeType === "EXHAUSTION"   && activeSide === "SELL") _dbg_scored = scoreExhaustionSell(_dbg_scoreRow);
        else if (activeType === "CONTINUATION" && activeSide === "BUY")  _dbg_scored = scoreContinuationBuy(_dbg_scoreRow);
        else if (activeType === "CONTINUATION" && activeSide === "SELL") _dbg_scored = scoreContinuationSell(_dbg_scoreRow);
        else _dbg_scored = { total: 50, breakdown: {} };

        const score = Math.round(_dbg_scored.total ?? 0);
        if (score < TOP_CFG.scoreMin) continue;
        cScore++;

        const conditions = getH1Conditions(activeSide, activeMode, activeType);
        const conditionsOk = checkConditions(
          _slope_h1_dbg,
          _slope_h1_s0_dbg,
          _dslope_h1_dbg,
          num(row?.zscore_h1_s0),
          conditions,
          activeSide,
          sym
        );

        if (!conditionsOk) {
          if (TOP_CFG.verbose) {
            const rsi    = num(row?.rsi_h1_s0);
            const zscore = num(row?.zscore_h1_s0);
            console.log(`[CHECK FAIL] mode=${activeMode} type=${activeType} side=${activeSide} | rsi=${rsi?.toFixed(1)} z=${zscore?.toFixed(2)} slope_h1=${_slope_h1_dbg?.toFixed(2)} slope_h1_s0=${_slope_h1_s0_dbg?.toFixed(2)} dslope_h1=${_dslope_h1_dbg?.toFixed(2)}`);
          }
          continue;
        }

        cCheckConditions++;
      }

      console.info("TOPOPP V8R", { total_rows: rows.length, signals: opps.length });

      console.table({
        "0 — total rows":             { count: cTotal,          pct: "100%" },
        "1 — non-grey rows":          { count: cNonGrey,      pct: ((cNonGrey/cTotal)*100).toFixed(1)+"%" },
        "2 — after selectRoute":      { count: cSelectRoute,        pct: ((cSelectRoute/cNonGrey)*100).toFixed(1)+"%" },
        "3 — after exhaustionKill":   { count: cExhaustionKill, pct: ((cExhaustionKill/cSelectRoute)*100).toFixed(1)+"%" },
        "4 — after scoreMin":         { count: cScore,          pct: ((cScore/cExhaustionKill)*100).toFixed(1)+"%" },
        "5 — after checkConditions":  { count: cCheckConditions,          pct: ((cCheckConditions/cScore)*100).toFixed(1)+"%" },
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_V8R;