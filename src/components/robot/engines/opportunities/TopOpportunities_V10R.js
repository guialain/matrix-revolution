// ============================================================================
// TopOpportunities_V10R.js — H1 ROUTER V10R (zscore-centric, EXH + CONT)
//
// Architecture : 7 zones zscore_h1 (5 nommees + grise + 2 extremes)
//   z > +2.9          → EXTREME_HAUTE  → SELL EXH only
//   +1.5 < z <= +2.9  → HAUTE          → SELL EXH | BUY CONT
//   +0.5 < z <= +1.5  → NORMALE_HAUTE  → SELL EXH | BUY CONT | SELL CONT
//   -0.5 <= z <= +0.5 → GRISE          → WAIT
//   -1.5 < z < -0.5   → NORMALE_BASSE  → BUY EXH  | BUY CONT | SELL CONT
//   -2.9 <= z <= -1.5 → BASSE          → BUY EXH | SELL CONT
//   z < -2.9          → EXTREME_BASSE  → BUY EXH only
//
// EXH : 2 niveaux (L1 candidat + L2 affinage). Si L2 OK → emit valid.
//       Si L1 OK + L2 fail → push wait-exh (candidat identifié).
//       Si L1 fail + EXTREME → wait-exh-only. Si L1 fail + HAUTE/BASSE → bascule CONT.
// CONT : cascade evaluateGateD1 → evaluateGateIC → evaluateGateH1.
//
// waitReasons exposés :
//   wait-grey, wait-spike, wait-hours, wait-atr   (filtres globaux amont)
//   wait-exh         (candidat EXH L1 OK mais L2 fail)
//   wait-exh-only    (L1 fail en zone EXTREME, sans fallback CONT)
//   wait-cont-d1, wait-cont-ic, wait-cont-h1     (gates CONT, deepest stage reached)
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";
import { getSlopeConfig, getSlopeClass } from "../config/SlopeConfig.js";
import { getIntradayLevel } from "../../../../utils/marketLevels.js";
import GlobalMarketHours from "../trading/GlobalMarketHours.js";
import { resolveMarket } from "../trading/AssetEligibility.js";
import { scoreOpportunity } from "./ScoreEngine.js";
import * as funnel from "../../../../utils/funnelDebug.js";
import { getZscoreH1Zone } from "../../../../utils/zoneClassifier.js";

const TopOpportunities_V10R = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // Nom de route CONT : <zone_lowercase>_<side>_CONT
  function getCONTRouteName(zone, side) {
    const zoneLower = {
      'EXTREME_HAUTE':  'extreme_haute',
      'HAUTE':          'haute',
      'NORMALE_HAUTE':  'normale_haute',
      'NORMALE_BASSE':  'normale_basse',
      'BASSE':          'basse',
      'EXTREME_BASSE':  'extreme_basse',
    };
    return `${zoneLower[zone] ?? zone.toLowerCase()}_${side}_CONT`;
  }

  // Gate D1 — seuils et sets IC pour tie-breaker (utilisés par evaluateGateD1)
  const GATE_D1_SLOPE_THRESHOLD       = 0.3;
  const GATE_D1_DSLOPE_THRESHOLD      = 0.5;
  const GATE_D1_S0_CONFIRM_THRESHOLD  = 0.5;  // seuil de confirmation live pour le tie-breaker

  const IC_BULLISH_FOR_TIEBREAKER = new Set(['SOFT_UP',   'STRONG_UP',   'EXPLOSIVE_UP']);
  const IC_BEARISH_FOR_TIEBREAKER = new Set(['SOFT_DOWN', 'STRONG_DOWN', 'EXPLOSIVE_DOWN']);

  // ============================================================================
  // Gate IC — seuils dsigma_ratio_h1_pct et matrices IC × dsigma -> mode
  // ============================================================================

  // Seuils de classification dsigma_ratio_h1_pct (cross-asset, percentiles empiriques)
  const DSIGMA_THRESHOLDS = {
    COMPRESSION_FORTE: -15,  // x <= -15
    CONTRACTION:        -5,  // -15 < x <= -5
    STABLE_LOW:         -5,  // -5 < x < +5  (zone neutre)
    STABLE_HIGH:         5,
    EXPANSION:          15,  // +5 <= x < +15
    // EXPLOSION : x >= +15
  };

  // Mapping IC level brut -> categorie collapsee (5 niveaux)
  //   EXPLOSIVE_DOWN, STRONG_DOWN -> 'STRONG_DOWN'
  //   SOFT_DOWN -> 'SOFT_DOWN'
  //   NEUTRE -> 'NEUTRE'
  //   SOFT_UP -> 'SOFT_UP'
  //   STRONG_UP, EXPLOSIVE_UP -> 'STRONG_UP'
  //   SPIKE_*, autres -> 'NEUTRE' (fallback safe)

  // Matrices side x IC x dsigma -> mode
  // Lignes : IC level (5 categories collapsees)
  // Colonnes : dsigma level (5 categories)
  //   compression_forte, contraction, stable, expansion, explosion
  const GATE_IC_BUY_MATRIX = {
    STRONG_DOWN: { compression_forte: 'wait',   contraction: 'wait',   stable: 'wait',   expansion: 'wait',    explosion: 'wait'    },
    SOFT_DOWN:   { compression_forte: 'wait',   contraction: 'wait',   stable: 'strict', expansion: 'normal',  explosion: 'wait'    },
    NEUTRE:      { compression_forte: 'wait',   contraction: 'wait',   stable: 'strict', expansion: 'soft',    explosion: 'relaxed' },
    SOFT_UP:     { compression_forte: 'wait',   contraction: 'strict', stable: 'normal', expansion: 'relaxed', explosion: 'soft'    },
    STRONG_UP:   { compression_forte: 'wait',   contraction: 'strict', stable: 'soft',   expansion: 'normal',  explosion: 'wait'    },
  };

  const GATE_IC_SELL_MATRIX = {
    STRONG_DOWN: { compression_forte: 'wait',   contraction: 'strict', stable: 'soft',   expansion: 'normal',  explosion: 'wait'    },
    SOFT_DOWN:   { compression_forte: 'wait',   contraction: 'strict', stable: 'normal', expansion: 'relaxed', explosion: 'soft'    },
    NEUTRE:      { compression_forte: 'wait',   contraction: 'wait',   stable: 'strict', expansion: 'soft',    explosion: 'relaxed' },
    SOFT_UP:     { compression_forte: 'wait',   contraction: 'wait',   stable: 'strict', expansion: 'normal',  explosion: 'wait'    },
    STRONG_UP:   { compression_forte: 'wait',   contraction: 'wait',   stable: 'wait',   expansion: 'wait',    explosion: 'wait'    },
  };

  // ============================================================================
  // EXH — matrices IC × dsigma par zone (binaire OK / BLOCK)
  //
  // Lignes : IC level (3 categories admises pour EXH)
  // Colonnes : dsigma level (5 categories — meme classification que Gate IC)
  // Valeur true = OK (le couple IC/dsigma autorise EXH)
  // Valeur false = BLOCK
  //
  // Logique :
  //   - Stable bloque dans tous les cas (incoherence : mouvement IC sans signature sigma)
  //   - SOFT (preuve moderee) : exige contraction nette de sigma (comp_forte ou contraction)
  //   - STRONG/EXPLOSIVE (preuve forte) : tolerent expansion et explosion (climax/capitulation)
  // ============================================================================

  // Zone BASSE / HAUTE (z = forte mais non extreme)
  const EXH_MATRIX_FORTE_BUY = {
    SOFT_DOWN:      { compression_forte: true,  contraction: true,  stable: false, expansion: false, explosion: false },
    STRONG_DOWN:    { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
    EXPLOSIVE_DOWN: { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
  };

  const EXH_MATRIX_FORTE_SELL = {
    SOFT_UP:        { compression_forte: true,  contraction: true,  stable: false, expansion: false, explosion: false },
    STRONG_UP:      { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
    EXPLOSIVE_UP:   { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
  };

  // Zone EXTREME_BASSE / EXTREME_HAUTE (SOFT non admis)
  const EXH_MATRIX_EXTREME_BUY = {
    STRONG_DOWN:    { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
    EXPLOSIVE_DOWN: { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
  };

  const EXH_MATRIX_EXTREME_SELL = {
    STRONG_UP:      { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
    EXPLOSIVE_UP:   { compression_forte: true,  contraction: true,  stable: false, expansion: true,  explosion: true  },
  };

  // ============================================================================
  // Gate H1 — mapping zones slope_h1_s0 vers rangs ordonnes
  // ============================================================================
  const H1_ZONE_RANK = {
    'down_extreme': -3,
    'down_strong':  -2,
    'down_weak':    -1,
    'flat':          0,
    'up_weak':       1,
    'up_strong':     2,
    'up_extreme':    3,
  };

  // ============================================================================
  // 1. getZscoreH1Zone — importé depuis ../../../../utils/zoneClassifier.js
  //    (classification 5 zones + grise + 2 extremes, partagé avec l'UI)
  // ============================================================================

  // Helper local : classifie dsigma_ratio_h1_pct selon les memes seuils que Gate IC.
  function classifyDsigmaForExh(dsigmaRatioPct) {
    if (dsigmaRatioPct === null || !Number.isFinite(dsigmaRatioPct)) return null;
    if (dsigmaRatioPct <= DSIGMA_THRESHOLDS.COMPRESSION_FORTE)        return 'compression_forte';
    if (dsigmaRatioPct <= DSIGMA_THRESHOLDS.CONTRACTION)              return 'contraction';
    if (dsigmaRatioPct <  DSIGMA_THRESHOLDS.STABLE_HIGH)              return 'stable';
    if (dsigmaRatioPct <  DSIGMA_THRESHOLDS.EXPANSION)                return 'expansion';
    return 'explosion';
  }

  // ============================================================================
  // 2. evaluateExhRoute — vérifie tous les filtres pour une route EXH donnée.
  //
  // Architecture 2 niveaux (early-return au premier fail dans chaque niveau) :
  //
  // === NIVEAU 1 — Classification candidat EXH ===
  //   1. RSI dual (rsi instantané + prev3) — uniforme Forte ET Extreme :
  //        SELL : rsi > 55 ET prevHigh3 > 68
  //        BUY  : rsi < 45 ET prevLow3  < 32
  //   2. slope_h1 (s1) selon zone et side (seuils signés) :
  //        BUY  Forte   : slope_h1 <= +1.5
  //        BUY  Extrême : slope_h1 <= -0.5
  //        SELL Forte   : slope_h1 >= -1.5
  //        SELL Extrême : slope_h1 >= +0.5
  //        Note : Forte est PLUS PERMISSIVE que Extrême (inversion volontaire).
  //   3. règle combinée dslope_h1_live + dsigma classe :
  //        BUY  : dslope_live ∈ [+0.5, +7.5[ ET dsigma ∈ {expansion, explosion}
  //        SELL : dslope_live ∈ ]-7.5, -0.5] ET dsigma ∈ {expansion, explosion}
  //        Logique : retournement mesurable sur slope live ET signature
  //        d'expansion sigma confirment l'épuisement (cap V-shape intégré).
  //   (zscore_h1_s0 déjà filtré par la classification de zone amont — pas re-testé)
  //
  // === NIVEAU 2 — Affinage ===
  //   1. Matrice IC × dsigma_classe par zone :
  //        Stable bloque toujours.
  //        Forte   : SOFT/STRONG/EXPLOSIVE_(DOWN|UP) admis. SOFT exige contraction.
  //        Extreme : seul STRONG/EXPLOSIVE admis. Plus permissif sur dsigma.
  //
  // === RETOURS ===
  //   { valid: true,  vshape, level: 'L2_OK' }                                     — tous OK
  //   { valid: false, vshape: false, level: 'L2_FAIL', candidateExh: true }        — L1 OK + L2 fail
  //   { valid: false, vshape: false, level: 'L1_FAIL' }                            — L1 fail (any reason)
  //
  // V-shape : marqueur informatif — slope_h1 fortement dans la zone "violente"
  //           (|slope| >= 2.7 Forte / >= 3.5 Extrême) + dslope dans le sens du
  //           retournement (>=0.5 BUY / <=-0.5 SELL, alignées avec L1.3).
  //           N'est plus garanti par construction depuis L1.2 signé.
  // ============================================================================
  function evaluateExhRoute(routeName, side, row, intradayLevel) {
    const slope_h1 = num(row?.slope_h1);
    const slope_s0 = num(row?.slope_h1_s0);
    const rsi      = num(row?.rsi_h1);
    const rsiPrevHigh3 = num(row?.rsi_h1_previoushigh3);
    const rsiPrevLow3  = num(row?.rsi_h1_previouslow3);
    const dsigma   = num(row?.dsigma_ratio_h1_pct);

    // Garde-fous null
    if (slope_h1 === null || slope_s0 === null || dsigma === null) {
      return { valid: false, vshape: false, level: 'L1_FAIL' };
    }
    if (side === 'SELL' && rsiPrevHigh3 === null) return { valid: false, vshape: false, level: 'L1_FAIL' };
    if (side === 'BUY'  && rsiPrevLow3  === null) return { valid: false, vshape: false, level: 'L1_FAIL' };
    if (rsi === null) return { valid: false, vshape: false, level: 'L1_FAIL' };

    const isExtreme = routeName === 'extreme_haute_SELL_EXH' || routeName === 'extreme_basse_BUY_EXH';
    const isForte   = routeName === 'haute_SELL_EXH'         || routeName === 'basse_BUY_EXH'
                  || routeName === 'normale_haute_SELL_EXH' || routeName === 'normale_basse_BUY_EXH';
    if (!isExtreme && !isForte) return { valid: false, vshape: false, level: 'L1_FAIL' };

    // ====================================
    // NIVEAU 1 — Classification candidat EXH
    // ====================================

    // L1.1 : RSI dual (uniforme Forte ET Extreme)
    if (side === 'SELL') {
      if (!(rsi > 55 && rsiPrevHigh3 > 68)) return { valid: false, vshape: false, level: 'L1_FAIL' };
    } else {
      if (!(rsi < 45 && rsiPrevLow3 < 32)) return { valid: false, vshape: false, level: 'L1_FAIL' };
    }

    // L1.2 : slope_h1 par zone ET side (seuils signés)
    //   BUY  Forte   : slope_h1 <= +1.5
    //   BUY  Extrême : slope_h1 <= -0.5
    //   SELL Forte   : slope_h1 >= -1.5
    //   SELL Extrême : slope_h1 >= +0.5
    if (side === 'SELL') {
      const minSlope = isExtreme ? 0.5 : -1.5;
      if (slope_h1 < minSlope) return { valid: false, vshape: false, level: 'L1_FAIL' };
    } else {
      const maxSlope = isExtreme ? -0.5 : 1.5;
      if (slope_h1 > maxSlope) return { valid: false, vshape: false, level: 'L1_FAIL' };
    }

    // L1.3 : règle combinée dslope_h1_live + dsigma classe
    //   BUY  : dslope_live ∈ [+0.5, +7.5[ ET dsigma ∈ {expansion, explosion}
    //   SELL : dslope_live ∈ ]-7.5, -0.5] ET dsigma ∈ {expansion, explosion}
    //   (cap V-shape intégré ici — ancien L2.1 supprimé)
    const dsigmaLevel = classifyDsigmaForExh(dsigma);
    if (dsigmaLevel === null) return { valid: false, vshape: false, level: 'L1_FAIL' };

    const dslope_live = slope_s0 - slope_h1;
    const dsigmaOk = dsigmaLevel === 'expansion' || dsigmaLevel === 'explosion';

    if (side === 'BUY') {
      if (!(dslope_live >= 0.5 && dslope_live < 7.5 && dsigmaOk)) {
        return { valid: false, vshape: false, level: 'L1_FAIL' };
      }
    } else {
      if (!(dslope_live > -7.5 && dslope_live <= -0.5 && dsigmaOk)) {
        return { valid: false, vshape: false, level: 'L1_FAIL' };
      }
    }

    // === À partir d'ici : L1 OK ===

    // ====================================
    // NIVEAU 2 — Affinage
    // ====================================

    // L2.1 : Matrice IC × dsigma classe (par zone)
    let matrix = null;
    if (side === 'SELL') {
      matrix = isExtreme ? EXH_MATRIX_EXTREME_SELL : EXH_MATRIX_FORTE_SELL;
    } else {
      matrix = isExtreme ? EXH_MATRIX_EXTREME_BUY : EXH_MATRIX_FORTE_BUY;
    }

    const icRow = matrix[intradayLevel];
    if (!icRow) return { valid: false, vshape: false, level: 'L2_FAIL', candidateExh: true };
    if (icRow[dsigmaLevel] !== true) return { valid: false, vshape: false, level: 'L2_FAIL', candidateExh: true };

    // V-shape : marqueur strict (slope dans la zone violente + dslope retournement).
    // Bornes dslope alignées sur L1.3 (>=0.5 BUY / <=-0.5 SELL).
    const vshapeMag = isExtreme ? 3.5 : 2.7;
    const vshape = (side === 'SELL' && slope_h1 >=  vshapeMag && dslope_live <= -0.5)
                || (side === 'BUY'  && slope_h1 <= -vshapeMag && dslope_live >=  0.5);

    return { valid: true, vshape, level: 'L2_OK' };
  }

  // ============================================================================
  // evaluateGateD1 — premier gate de validation pour les routes CONT.
  //
  // Inputs :
  //   slope_d1        : pente RSI D1 stable (s1, photo bougie D1 fermee hier)
  //   slope_d1_s0     : pente RSI D1 live (s0, photo bougie D1 en formation)
  //   dslope_d1_live  : slope_d1_s0 - slope_d1 (variation depuis hier)
  //   intradayLevel   : IC level deja classifie (sans SPIKE, filtre amont)
  //
  // Output : { buyAllowed, sellAllowed, reason }
  //
  // Logique :
  //   - Cas alignes (slope et dslope meme sens) -> autorise le sens
  //   - Cas early-trend (slope flat + dslope clairement directionnel) -> autorise le sens du dslope
  //   - Cas opposes (slope et dslope sens contraires) :
  //       Si IC va dans le sens du dslope ET slope_d1_s0 confirme le retournement
  //       (au-dela de +/-0.5 dans le sens du dslope) -> autorise le sens du dslope
  //       Sinon -> bloque (retrace technique probable, pas un vrai retournement)
  //   - Cas flat x flat -> bloque
  //
  // Le critere slope_d1_s0 dans les cas opposes evite de valider un trade
  // contra-tendance pendant un simple retrace technique d'une tendance D1
  // qui tient encore. Si slope_d1_s0 reste dans la zone de la tendance D1
  // stable, on n'autorise pas le retournement meme si IC le suggere.
  //
  // Ne s'applique PAS aux routes EXH (qui ont leur propre logique).
  // ============================================================================
  function evaluateGateD1(slope_d1, slope_d1_s0, dslope_d1_live, intradayLevel) {
    if (slope_d1 === null || !Number.isFinite(slope_d1) ||
        slope_d1_s0 === null || !Number.isFinite(slope_d1_s0) ||
        dslope_d1_live === null || !Number.isFinite(dslope_d1_live)) {
      return { buyAllowed: false, sellAllowed: false, reason: 'd1_null' };
    }

    const S  = slope_d1;
    const D  = dslope_d1_live;
    const TS = GATE_D1_SLOPE_THRESHOLD;
    const TD = GATE_D1_DSLOPE_THRESHOLD;

    // CAS 1 : slope haussier
    if (S >= TS) {
      if (D >= -TD) return { buyAllowed: true, sellAllowed: false, reason: 'aligned_up' };
      // Cas oppose : tie-breaker IC + confirmation slope_d1_s0 live
      if (IC_BEARISH_FOR_TIEBREAKER.has(intradayLevel)
          && slope_d1_s0 <= -GATE_D1_S0_CONFIRM_THRESHOLD) {
        return { buyAllowed: false, sellAllowed: true, reason: 'opposed_buy_to_sell' };
      }
      return { buyAllowed: false, sellAllowed: false, reason: 'opposed_blocked' };
    }

    // CAS 2 : slope baissier
    if (S <= -TS) {
      if (D <= TD) return { buyAllowed: false, sellAllowed: true, reason: 'aligned_down' };
      // Cas oppose : tie-breaker IC + confirmation slope_d1_s0 live
      if (IC_BULLISH_FOR_TIEBREAKER.has(intradayLevel)
          && slope_d1_s0 >= GATE_D1_S0_CONFIRM_THRESHOLD) {
        return { buyAllowed: true, sellAllowed: false, reason: 'opposed_sell_to_buy' };
      }
      return { buyAllowed: false, sellAllowed: false, reason: 'opposed_blocked' };
    }

    // CAS 3 : slope flat
    if (D >  TD) return { buyAllowed: true,  sellAllowed: false, reason: 'early_up' };
    if (D < -TD) return { buyAllowed: false, sellAllowed: true,  reason: 'early_down' };
    return { buyAllowed: false, sellAllowed: false, reason: 'flat_flat' };
  }

  // ============================================================================
  // evaluateGateIC — second gate de validation pour les routes CONT.
  //
  // Module le mode (strict/normal/soft/relaxed) selon le couple (IC, dsigma).
  // Retourne 'wait' pour bloquer le sens si le contexte est defavorable
  // meme apres autorisation par le Gate D1.
  //
  // Inputs :
  //   side             : 'BUY' ou 'SELL'
  //   intradayLevel    : niveau IC classifie (avant collapse)
  //   dsigmaRatioPct   : variation relative de sigma_h1 en pourcentage entier
  //
  // Output : { mode, icLevel, dsigmaLevel }
  //   mode : 'wait' | 'strict' | 'normal' | 'soft' | 'relaxed'
  //   icLevel, dsigmaLevel : pour debug/trace
  //
  // Logique :
  //   Avec TP court (0.4 sigma_h1), le risque principal n'est pas de manquer le mouvement
  //   mais d'entrer trop tard, juste avant l'epuisement.
  //
  //   - compression_forte (dsigma <= -15) : wait dans tous les cas (squeeze, pas d'amplitude)
  //   - contraction : prudent (mouvement s'essouffle)
  //   - stable : OUI mais pas le sweet spot (mouvement parcouru lentement)
  //   - expansion : SWEET SPOT BUY/SELL — sigma augmente, momentum installe
  //       Pic permissif (relaxed) a SOFT_UP cote BUY, SOFT_DOWN cote SELL
  //       STRONG aligne -> normal (durci par anticipation epuisement)
  //   - explosion : logique inverse — plus IC aligne fort + sigma en pic, plus on bloque
  //       Pic permissif (relaxed) a NEUTRE
  //       STRONG aligne -> wait (epuisement imminent)
  //
  //   Ne s'applique PAS aux routes EXH (qui ont leur propre logique).
  // ============================================================================
  function evaluateGateIC(side, intradayLevel, dsigmaRatioPct) {
    if (side !== 'BUY' && side !== 'SELL') {
      return { mode: 'wait', icLevel: 'UNKNOWN', dsigmaLevel: 'UNKNOWN' };
    }
    if (dsigmaRatioPct === null || !Number.isFinite(dsigmaRatioPct)) {
      return { mode: 'wait', icLevel: intradayLevel ?? 'UNKNOWN', dsigmaLevel: 'UNKNOWN' };
    }

    // Collapse IC level vers 5 categories
    let icLevel;
    switch (intradayLevel) {
      case 'EXPLOSIVE_DOWN':
      case 'STRONG_DOWN':    icLevel = 'STRONG_DOWN'; break;
      case 'SOFT_DOWN':      icLevel = 'SOFT_DOWN';   break;
      case 'NEUTRE':         icLevel = 'NEUTRE';      break;
      case 'SOFT_UP':        icLevel = 'SOFT_UP';     break;
      case 'EXPLOSIVE_UP':
      case 'STRONG_UP':      icLevel = 'STRONG_UP';   break;
      default:               icLevel = 'NEUTRE';
    }

    // Classification dsigma
    let dsigmaLevel;
    if (dsigmaRatioPct <= DSIGMA_THRESHOLDS.COMPRESSION_FORTE)        dsigmaLevel = 'compression_forte';
    else if (dsigmaRatioPct <= DSIGMA_THRESHOLDS.CONTRACTION)         dsigmaLevel = 'contraction';
    else if (dsigmaRatioPct <  DSIGMA_THRESHOLDS.STABLE_HIGH)         dsigmaLevel = 'stable';
    else if (dsigmaRatioPct <  DSIGMA_THRESHOLDS.EXPANSION)           dsigmaLevel = 'expansion';
    else                                                              dsigmaLevel = 'explosion';

    // Lookup matrice
    const matrix = side === 'BUY' ? GATE_IC_BUY_MATRIX : GATE_IC_SELL_MATRIX;
    const mode   = matrix[icLevel]?.[dsigmaLevel] ?? 'wait';

    return { mode, icLevel, dsigmaLevel };
  }

  // ============================================================================
  // getH1ConditionsCont — seuils techniques H1 pour CONT, par mode et side.
  //
  // Copie exacte des seuils CONT de V8R (sans zscoreCap/zscoreFloor qui font
  // double-emploi avec la classification de zone V10R).
  //
  // Champs retournes :
  //   h1_s0_min, h1_s0_max               : zones cibles slope_h1_s0 (cles ZONE_RANK)
  //   h1_dslope_min, h1_dslope_max       : bornes dslope_h1 cas normal
  //   h1_dslope_min_v_shape,
  //   h1_dslope_max_v_shape              : bornes V-shape (BUY: max etendu, SELL: min etendu)
  // ============================================================================
  function getH1ConditionsCont(side, mode) {
    // CONT BUY (h1_s0 doit etre haut, dslope positif requis, V-shape autorise)
    if (side === 'BUY') {
      if (mode === 'strict')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: -1.5, h1_dslope_max: 4.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 5  };
      if (mode === 'normal')  return { h1_s0_min: 'up_weak',   h1_s0_max: null, h1_dslope_min: -2.5, h1_dslope_max: 5.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 6  };
      if (mode === 'soft')    return { h1_s0_min: 'flat',      h1_s0_max: null, h1_dslope_min: -3.5, h1_dslope_max: 7.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 8  };
      if (mode === 'relaxed') return { h1_s0_min: 'down_weak', h1_s0_max: null, h1_dslope_min: -4.5, h1_dslope_max: 8.0,  h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: 10 };
    }

    // CONT SELL (miroir CONT BUY)
    if (side === 'SELL') {
      if (mode === 'strict')  return { h1_s0_min: null, h1_s0_max: 'down_weak', h1_dslope_min: -4.0, h1_dslope_max: 1.5, h1_dslope_min_v_shape: -5,  h1_dslope_max_v_shape: null };
      if (mode === 'normal')  return { h1_s0_min: null, h1_s0_max: 'down_weak', h1_dslope_min: -5.0, h1_dslope_max: 2.5, h1_dslope_min_v_shape: -6,  h1_dslope_max_v_shape: null };
      if (mode === 'soft')    return { h1_s0_min: null, h1_s0_max: 'flat',      h1_dslope_min: -7.0, h1_dslope_max: 3.5, h1_dslope_min_v_shape: -8,  h1_dslope_max_v_shape: null };
      if (mode === 'relaxed') return { h1_s0_min: null, h1_s0_max: 'up_weak',   h1_dslope_min: -8.0, h1_dslope_max: 4.5, h1_dslope_min_v_shape: -10, h1_dslope_max_v_shape: null };
    }

    // Safety net
    return { h1_s0_min: null, h1_s0_max: null, h1_dslope_min: null, h1_dslope_max: null, h1_dslope_min_v_shape: null, h1_dslope_max_v_shape: null };
  }

  // ============================================================================
  // evaluateGateH1 — troisieme gate de validation pour les routes CONT.
  //
  // Verifie que la micro-structure H1 (zone slope_h1_s0 + dslope_h1) confirme
  // le setup, selon le mode retourne par evaluateGateIC.
  //
  // Inputs :
  //   side            : 'BUY' ou 'SELL'
  //   mode            : 'strict' | 'normal' | 'soft' | 'relaxed' (du Gate IC)
  //   slope_h1        : pente RSI H1 stable (s1)
  //   slope_h1_s0     : pente RSI H1 live (s0)
  //   dslope_h1_live  : slope_h1_s0 - slope_h1
  //   symbol          : pour getSlopeClass
  //
  // Output : { valid, reason }
  //
  // Logique (copiee de V8R checkConditions, sans le check zscore) :
  //   1. Classification zone slope_h1_s0 via getSlopeClass + ZONE_RANK
  //      Doit etre dans [h1_s0_min, h1_s0_max] selon mode/side
  //   2. dslope_h1_live :
  //      - V-shape (slope_h1 oppose au sens du trade) : bornes V-shape
  //      - Normal : bornes h1_dslope_min/max
  //
  // Ne s'applique PAS aux routes EXH (qui ont leur propre logique).
  // ============================================================================
  function evaluateGateH1(side, mode, slope_h1, slope_h1_s0, dslope_h1_live, symbol) {
    if (side !== 'BUY' && side !== 'SELL') {
      return { valid: false, reason: 'h1_side_invalid' };
    }
    if (mode !== 'strict' && mode !== 'normal' && mode !== 'soft' && mode !== 'relaxed') {
      return { valid: false, reason: 'h1_mode_invalid' };
    }
    if (slope_h1_s0 === null || !Number.isFinite(slope_h1_s0) ||
        dslope_h1_live === null || !Number.isFinite(dslope_h1_live)) {
      return { valid: false, reason: 'h1_null' };
    }

    const conditions = getH1ConditionsCont(side, mode);

    // Etape 1 : zone slope_h1_s0
    const zone_s0 = getSlopeClass(slope_h1_s0, symbol);
    const zone_s0_rank = H1_ZONE_RANK[zone_s0];
    if (zone_s0_rank === undefined) {
      return { valid: false, reason: 'h1_zone_unknown' };
    }
    if (conditions.h1_s0_min !== null) {
      const min_rank = H1_ZONE_RANK[conditions.h1_s0_min];
      if (zone_s0_rank < min_rank) return { valid: false, reason: 'h1_slope_zone_below_min' };
    }
    if (conditions.h1_s0_max !== null) {
      const max_rank = H1_ZONE_RANK[conditions.h1_s0_max];
      if (zone_s0_rank > max_rank) return { valid: false, reason: 'h1_slope_zone_above_max' };
    }

    // Etape 2 : dslope_h1 selon V-shape ou cas normal
    const isVShape = (side === 'BUY'  && slope_h1 !== null && slope_h1 < 0)
                  || (side === 'SELL' && slope_h1 !== null && slope_h1 > 0);

    if (isVShape) {
      if (side === 'BUY') {
        const cap = conditions.h1_dslope_max_v_shape !== null
          ? conditions.h1_dslope_max_v_shape
          : conditions.h1_dslope_max;
        if (cap !== null && dslope_h1_live > cap) return { valid: false, reason: 'h1_dslope_above_vshape_max' };
        if (conditions.h1_dslope_min !== null && dslope_h1_live < conditions.h1_dslope_min) return { valid: false, reason: 'h1_dslope_below_min' };
      } else {
        const floor = conditions.h1_dslope_min_v_shape !== null
          ? conditions.h1_dslope_min_v_shape
          : conditions.h1_dslope_min;
        if (floor !== null && dslope_h1_live < floor) return { valid: false, reason: 'h1_dslope_below_vshape_min' };
        if (conditions.h1_dslope_max !== null && dslope_h1_live > conditions.h1_dslope_max) return { valid: false, reason: 'h1_dslope_above_max' };
      }
    } else {
      if (conditions.h1_dslope_min !== null && dslope_h1_live < conditions.h1_dslope_min) return { valid: false, reason: 'h1_dslope_below_min' };
      if (conditions.h1_dslope_max !== null && dslope_h1_live > conditions.h1_dslope_max) return { valid: false, reason: 'h1_dslope_above_max' };
    }

    return { valid: true, reason: 'h1_pass' };
  }

  // ============================================================================
  // 3. detectSpike — copié de V8R (H1 prioritaire, fallback IC)
  // ============================================================================
  const SPIKE_H1_THRESHOLD = 8;

  function detectSpike(slope_h1_s0, intradayLevel) {
    if (slope_h1_s0 !== null) {
      if (slope_h1_s0 >=  SPIKE_H1_THRESHOLD) return { isSpike: true, direction: 'up',   source: 'h1' };
      if (slope_h1_s0 <= -SPIKE_H1_THRESHOLD) return { isSpike: true, direction: 'down', source: 'h1' };
    }
    if (intradayLevel === 'SPIKE_UP')   return { isSpike: true, direction: 'up',   source: 'ic' };
    if (intradayLevel === 'SPIKE_DOWN') return { isSpike: true, direction: 'down', source: 'ic' };
    return { isSpike: false, direction: null, source: null };
  }

  // ============================================================================
  // 4. applyDedupeAndSpacing — copié de V8R
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
  // buildScoringRow — construit le row enrichi a passer a scoreOpportunity.
  //
  // Le ScoreEngine V10R attend les champs suivants :
  //   type, side, symbol
  //   rsi_h1, zscore_h1_s0, dsigma_ratio_h1_pct
  //   slope_h1, slope_h1_s0, dslope_h1_s0
  //   intraday_class, atr_m15, close_m5_s1
  //   reasonD1
  // ============================================================================
  function buildScoringRow(row, type, side, intradayLevel, reasonD1) {
    return {
      type,
      side,
      symbol: row.symbol,
      rsi_h1: num(row.rsi_h1),
      zscore_h1_s0: num(row.zscore_h1_s0),
      dsigma_ratio_h1_pct: num(row.dsigma_ratio_h1_pct),
      slope_h1: num(row.slope_h1),
      slope_h1_s0: num(row.slope_h1_s0),
      dslope_h1_s0: num(row.dslope_h1_s0),
      intraday_class: intradayLevel,
      atr_m15: num(row.atr_m15),
      close_m5_s1: num(row.close_m5_s1),
      reasonD1,
    };
  }

  // ============================================================================
  // 5. evaluate — main loop
  // ============================================================================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const TOP_CFG = {
      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals:              num(opts?.maxSignals) ?? Infinity,
      debug:   Boolean(opts?.debug),
      verbose: Boolean(opts?.verbose),
    };

    let opps = [];

    funnel.inc('marketWatchTotal', rows.length);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const symbol = row?.symbol;
      if (!symbol) continue;

      // Filtre amont 1 : gate horaire
      const marketKey = resolveMarket(row?.assetclass);
      if (!GlobalMarketHours.check(marketKey, new Date(), symbol).allowed) {
        opps.push({
          type: null, regime: 'WAIT', route: 'WAIT', signalPhase: 'WAIT',
          engine: 'V10R', isWait: true, waitReason: 'wait-hours',
          symbol, timestamp: row?.timestamp,
          zone: null, zscore_h1_s0: null, side: null, score: 0, breakdown: {},
        });
        continue;
      }
      funnel.inc('hourGatePass');

      const riskCfg  = getRiskConfig(symbol);
      const intCfg   = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
      const atrH1Cap = num(riskCfg?.atrH1Cap);

      // Filtre amont 2 : ATR cap (> 4× cap)
      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 4 * atrH1Cap) {
        opps.push({
          type: null, regime: 'WAIT', route: 'WAIT', signalPhase: 'WAIT',
          engine: 'V10R', isWait: true, waitReason: 'wait-atr',
          symbol, timestamp: row?.timestamp,
          zone: null, zscore_h1_s0: null, side: null, score: 0, breakdown: {},
          atr_h1: atrH1, atr_cap: atrH1Cap,
        });
        continue;
      }
      funnel.inc('atrCapPass');

      const intra         = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      const _slope_h1    = num(row?.slope_h1);
      const _slope_h1_s0 = num(row?.slope_h1_s0);
      const _dslope_h1_live = (_slope_h1_s0 !== null && _slope_h1 !== null)
        ? _slope_h1_s0 - _slope_h1
        : null;

      // Filtre amont 3+4 : spike H1 ou IC → emit WAIT + skip
      const _spike = detectSpike(_slope_h1_s0, intradayLevel);
      if (_spike.isSpike) {
        funnel.inc('spikeBlock');
        opps.push({
          type:            'WAIT',
          waitReason:      'wait-spike',
          engine:          'V10R',
          symbol,
          timestamp:       row?.timestamp,
          slope_h1_s0:     _slope_h1_s0,
          intradayLevel,
          spike_direction: _spike.direction,
          spike_source:    _spike.source,
          blocked_side:    _spike.direction === 'up' ? 'BUY' : 'SELL',
        });
        continue;
      }

      // Données D1 + dsigma pour les gates CONT
      const _slope_d1       = num(row?.slope_d1);
      const _slope_d1_s0    = num(row?.slope_d1_s0);
      const _dslope_d1_live = (_slope_d1_s0 !== null && _slope_d1 !== null)
        ? _slope_d1_s0 - _slope_d1
        : null;
      const _dsigma_ratio_h1_pct = num(row?.dsigma_ratio_h1_pct);

      // Classification zone zscore_h1_s0
      const _zscore_h1_s0 = num(row?.zscore_h1_s0);
      const zone = getZscoreH1Zone(_zscore_h1_s0);

      // Zone grise → WAIT
      if (zone === 'GRISE' || zone === 'UNKNOWN') {
        funnel.inc('greyZone');
        opps.push({
          type:        null,
          mode:        null,
          regime:      'WAIT',
          route:       'WAIT',
          signalPhase: 'WAIT',
          engine:      'V10R',
          isWait:      true,
          waitReason:  'wait-grey',
          index:       i,
          timestamp:   row?.timestamp,
          symbol,
          side:        null,
          signalType:  null,
          score:       0,
          breakdown:   {},
          zone,
          zscore_h1_s0: _zscore_h1_s0,
        });
        continue;
      }

      funnel.inc('nonGreyZone');

      // Détermination des routes EXH et CONT éligibles selon la zone
      let exhRoute = null, exhSide = null;
      const contSides = [];

      if (zone === 'EXTREME_HAUTE') {
        exhRoute = 'extreme_haute_SELL_EXH'; exhSide = 'SELL';
      } else if (zone === 'HAUTE') {
        exhRoute = 'haute_SELL_EXH';   exhSide = 'SELL';
        contSides.push('BUY');
      } else if (zone === 'NORMALE_HAUTE') {
        exhRoute = 'normale_haute_SELL_EXH'; exhSide = 'SELL';
        contSides.push('BUY', 'SELL');
      } else if (zone === 'NORMALE_BASSE') {
        exhRoute = 'normale_basse_BUY_EXH';  exhSide = 'BUY';
        contSides.push('BUY', 'SELL');
      } else if (zone === 'BASSE') {
        exhRoute = 'basse_BUY_EXH';    exhSide = 'BUY';
        contSides.push('SELL');
      } else if (zone === 'EXTREME_BASSE') {
        exhRoute = 'extreme_basse_BUY_EXH';  exhSide = 'BUY';
      }

      // Champs propagés du row (identiques pour EXH et CONT)
      const propagated = {
        // D1
        slope_d1_s0:    _slope_d1_s0,
        dslope_d1_s0:   num(row?.dslope_d1_s0),

        // H4
        slope_h4:       num(row?.slope_h4),
        dslope_h4_s0:   num(row?.dslope_h4_s0),
        rsi_h4_s0:      num(row?.rsi_h4_s0),
        slope_h4_s0:    num(row?.slope_h4_s0),

        // H1 s1
        rsi_h1:         num(row?.rsi_h1),
        slope_h1:       _slope_h1,
        dslope_h1_s0:   _dslope_h1_live,
        zscore_h1:      num(row?.zscore_h1),
        dz_h1:          num(row?.dz_h1),
        atr_h1:         atrH1,

        // H1 s0
        rsi_h1_s0:      num(row?.rsi_h1_s0),
        slope_h1_s0:    _slope_h1_s0,
        zscore_h1_s0:   _zscore_h1_s0,
        middle_h1:      num(row?.middle_h1),
        sigma_h1:       num(row?.sigma_h1),
        dsigma_ratio_h1_pct: _dsigma_ratio_h1_pct,

        // Broker
        spread:         num(row?.spread),

        // M15
        atr_m15:        num(row?.atr_m15),
        rsi_m15:        num(row?.rsi_m15),
        slope_m15:      num(row?.slope_m15),
        dslope_m15_s0:  num(row?.dslope_m15_s0),

        // M5 s1
        rsi_m5:         num(row?.rsi_m5),
        slope_m5:       num(row?.slope_m5),
        dslope_m5_s0:   num(row?.dslope_m5_s0),
        zscore_m5:      num(row?.zscore_m5),

        // M5 s0
        rsi_m5_s0:      num(row?.rsi_m5_s0),
        slope_m5_s0:    num(row?.slope_m5_s0),
        zscore_m5_s0:   num(row?.zscore_m5_s0),

        close_m5_s1:    num(row?.close_m5_s1),
        intraday_change: intra,
        range_ratio_h1: num(row?.range_ratio_h1),
      };

      // ====== 1. Test EXH (2 niveaux : L1 candidat + L2 affinage) ======
      let exhEmitted = false;
      let _exhFailed = false;
      if (exhRoute !== null) {
        funnel.inc('exhTested');
        const exhResult = evaluateExhRoute(exhRoute, exhSide, row, intradayLevel);
        if (exhResult.valid) {
          // L2_OK : push valid EXH (logique inchangée)
          funnel.inc('exhL1Pass');
          funnel.inc('exhL2Pass');
          if (riskCfg.exhaustionEnabled !== false) {
            // Récupérer reasonD1 pour le scoring (sans bloquer)
            const gateD1ForScoring = evaluateGateD1(_slope_d1, _slope_d1_s0, _dslope_d1_live, intradayLevel);
            const reasonD1 = gateD1ForScoring.reason;

            const scoringRow = buildScoringRow(row, 'EXHAUSTION', exhSide, intradayLevel, reasonD1);
            const scoreResult = scoreOpportunity(scoringRow);

            if (TOP_CFG.verbose) {
              console.log(`[V10R EXH] ${symbol} zone=${zone} side=${exhSide} route=${exhRoute} vshape=${exhResult.vshape} score=${scoreResult.total}`);
            }
            opps.push({
              type:        'EXHAUSTION',
              mode:        'strict',
              regime:      `EXHAUSTION_${exhSide}`,
              route:       exhRoute,
              signalPhase: exhRoute,
              engine:      'V10R',
              index:       i,
              timestamp:   row?.timestamp,
              symbol,
              side:        exhSide,
              signalType:  'EXHAUSTION',
              score:       scoreResult.total,
              score_brut:  scoreResult.total_brut,
              breakdown:   scoreResult.breakdown,
              reasonD1,
              zone,
              vshape:      exhResult.vshape,
              intradayLevel,
              ...propagated,
              exhaustion:  true,
            });
            funnel.inc('v10rEmit');
            exhEmitted = true;
          }
        } else if (exhResult.candidateExh) {
          // L1 OK + L2 fail : push wait-exh (candidat identifié, bloque la bascule CONT)
          funnel.inc('exhL1Pass');
          funnel.inc('exhL2Fail');
          opps.push({
            type: null, regime: 'WAIT', route: 'WAIT', signalPhase: 'WAIT',
            engine: 'V10R', isWait: true, waitReason: 'wait-exh',
            symbol, timestamp: row?.timestamp,
            zone, zscore_h1_s0: _zscore_h1_s0,
            side: exhSide, score: 0, breakdown: {},
          });
          exhEmitted = true;
        } else {
          // L1 fail : split selon zone (EXTREME=no CONT fallback, HAUTE/BASSE=bascule CONT)
          if (contSides.length === 0) funnel.inc('exhL1FailExtreme');
          else                         funnel.inc('exhL1FailNormal');
          _exhFailed = true;
        }
      }

      // ====== 2. Test CONT (si EXH non émis et CONT éligibles) ======
      // Flags par row : on incrémente une seule fois par row (pas par side)
      // pour éviter le double comptage BUY+SELL sur les zones NORMALE_*.
      let _contTestedFlag      = false;
      let _contGateD1BlockFlag = false;
      let _contGateICWaitFlag  = false;
      let _contGateH1FailFlag  = false;
      let _contValidFlag       = false;
      // Deepest stage reached parmi les sides testés (h1 > ic > d1)
      let _contDeepest         = null;
      let _contReasonD1        = null;
      const _stageRank = { d1: 1, ic: 2, h1: 3 };
      const _bumpDeepest = (s) => {
        if (!_contDeepest || _stageRank[s] > _stageRank[_contDeepest]) _contDeepest = s;
      };

      if (!exhEmitted && contSides.length > 0) {
        const gateD1 = evaluateGateD1(_slope_d1, _slope_d1_s0, _dslope_d1_live, intradayLevel);
        _contReasonD1 = gateD1.reason;

        for (const side of contSides) {
          _contTestedFlag = true;

          const allowed = (side === 'BUY')  ? gateD1.buyAllowed
                        : (side === 'SELL') ? gateD1.sellAllowed
                        : false;
          if (!allowed) {
            _contGateD1BlockFlag = true;
            _bumpDeepest('d1');
            continue;
          }

          const gateIC = evaluateGateIC(side, intradayLevel, _dsigma_ratio_h1_pct);
          if (gateIC.mode === 'wait') {
            _contGateICWaitFlag = true;
            _bumpDeepest('ic');
            continue;
          }

          const gateH1 = evaluateGateH1(side, gateIC.mode, _slope_h1, _slope_h1_s0, _dslope_h1_live, symbol);
          if (!gateH1.valid) {
            _contGateH1FailFlag = true;
            _bumpDeepest('h1');
            continue;
          }

          _contValidFlag = true;

          // V-shape CONT : slope_h1 stable opposé au sens du trade
          const vshape = (side === 'BUY'  && _slope_h1 !== null && _slope_h1 < 0)
                      || (side === 'SELL' && _slope_h1 !== null && _slope_h1 > 0);

          const route = getCONTRouteName(zone, side);
          const scoringRow = buildScoringRow(row, 'CONTINUATION', side, intradayLevel, gateD1.reason);
          const scoreResult = scoreOpportunity(scoringRow);

          if (TOP_CFG.verbose) {
            console.log(`[V10R CONT] ${symbol} zone=${zone} side=${side} mode=${gateIC.mode} route=${route} vshape=${vshape} score=${scoreResult.total}`);
          }

          opps.push({
            type:        'CONTINUATION',
            mode:        gateIC.mode,
            regime:      `CONTINUATION_${side}`,
            route,
            signalPhase: route,
            engine:      'V10R',
            index:       i,
            timestamp:   row?.timestamp,
            symbol,
            side,
            signalType:  'CONTINUATION',
            score:       scoreResult.total,
            score_brut:  scoreResult.total_brut,
            breakdown:   scoreResult.breakdown,
            reasonD1:    gateD1.reason,
            zone,
            vshape,
            intradayLevel,
            ...propagated,
            exhaustion:  false,
          });
          funnel.inc('v10rEmit');
        }
      }

      // === Décision du wait à exposer (1 par row max, valid > all wait) ===
      if (!exhEmitted && !_contValidFlag) {
        if (_contTestedFlag && _contDeepest) {
          // Wait CONT — deepest stage reached prime (h1 > ic > d1)
          const reason = _contDeepest === 'h1' ? 'wait-cont-h1'
                       : _contDeepest === 'ic' ? 'wait-cont-ic'
                       : 'wait-cont-d1';
          opps.push({
            type: null, regime: 'WAIT', route: 'WAIT', signalPhase: 'WAIT',
            engine: 'V10R', isWait: true, waitReason: reason,
            symbol, timestamp: row?.timestamp,
            zone, zscore_h1_s0: _zscore_h1_s0, side: null,
            score: 0, breakdown: {},
            reasonD1: _contReasonD1,
          });
        } else if (_exhFailed && contSides.length === 0) {
          // Wait EXH-only — zone EXTREME sans fallback CONT
          opps.push({
            type: null, regime: 'WAIT', route: 'WAIT', signalPhase: 'WAIT',
            engine: 'V10R', isWait: true, waitReason: 'wait-exh-only',
            symbol, timestamp: row?.timestamp,
            zone, zscore_h1_s0: _zscore_h1_s0, side: exhSide,
            score: 0, breakdown: {},
          });
        }
        // else : silent (cas !symbol défensif déjà filtré, exhDisabled config rare)
      }

      // Flush des flags CONT (1× par row, deepest stage reached prime)
      // contTested = contValid + contGateH1Fail + contGateICWait + contGateD1Block (4 buckets exclusifs)
      if (_contTestedFlag) {
        funnel.inc('contTested');
        if      (_contValidFlag)        funnel.inc('contValid');
        else if (_contDeepest === 'h1') funnel.inc('contGateH1Fail');
        else if (_contDeepest === 'ic') funnel.inc('contGateICWait');
        else if (_contDeepest === 'd1') funnel.inc('contGateD1Block');
      }
    }

    // Tri : score desc, puis timestamp desc
    opps.sort((a, b) => {
      const sa = a.score ?? 0, sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    console.log('[V10R-OUT]',
      'total=' + opps.length,
      'waits=' + opps.filter(o => o.waitReason).length,
      'reasons=' + JSON.stringify(opps.filter(o => o.waitReason).reduce((acc, o) => { acc[o.waitReason] = (acc[o.waitReason] || 0) + 1; return acc; }, {}))
    );

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_V10R;
