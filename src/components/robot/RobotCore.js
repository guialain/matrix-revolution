// ============================================================================
// RobotCore.js — TRINITY OFFICIEL (NEO + TRINITY)
// Rôle : Orchestrateur central
//  - NEO : vision, scoring, opportunités
//  - TRINITY : réalité marché, filtres, timing, bonus
// AUCUNE logique métier lourde ici (orchestration uniquement)
// ============================================================================

// ================= MARKET / ASSET ======================
// TopOpportunities supprimé — remplacé par continuation.js + reversal.js
import ContinuationStrategy from "./engines/opportunities/continuation";
import ReversalStrategy     from "./engines/opportunities/reversal";
import AssetBrain       from "./engines/asset/AssetBrain";

// ================= CONFIDENCE / SCORING =================
import AnalysisScore       from "./engines/confidence/AnalysisScore";
import AnalysisConfidence  from "./engines/confidence/AnalysisConfidence";
import OpportunityRanking  from "./engines/confidence/OpportunityRanking";

// ================= DECISION (NEO) =======================
import TradingBrain        from "./engines/decision/TradingBrain";
import SignalExplanation   from "./engines/decision/SignalExplanation";
import AssetEligibility from "./engines/trading/AssetEligibility";

// ================= PORTFOLIO / RISK =====================
import AccountRisk          from "./engines/management/AccountRisk";
import ExposureDistribution from "./engines/management/ExposureDistribution";
import PortfolioManager     from "./engines/management/PortfolioManager";

// ================= TRINITY FILTERS ======================

import SignalFilters    from "./engines/trading/SignalFilters";

// ============================================================================
// UTIL — VOLATILITY BONUS (TRINITY)
// ============================================================================
function volatilityBonus(volatilityLevel, side) {
  switch (volatilityLevel) {
    case "med":   return side === "BUY" ? +2 : -2;
    case "high":  return side === "BUY" ? +5 : -5;
    case "explo": return side === "BUY" ? +1 : -1;
    default:      return 0;
  }
}

// ============================================================================
// CORE
// ============================================================================
const RobotCore = {

  run(snapshot) {
    if (!snapshot) return null;

    const now = new Date();

    // ======================================================================
    // PHASE 1 — NEO (VISION PURE, INFORMATIF)
    // ======================================================================

    // --- 1.1 Analyse factuelle de l’actif
    const asset = AssetBrain.analyze({
      asset:      snapshot.asset,
      indicators: snapshot.indicators,
      macro:      snapshot.macro
    });

    // --- 1.2 Détection brute des opportunités (continuation + reversal)
    const topRows = (snapshot.marketWatch ?? []).map(row => ({
      symbol:      row.symbol,
      timestamp:   null,
      price:       row.price        ?? null,
      close:       row.price        ?? null,
      slope_h1:    row.slope_h1     ?? null,
      dslope_h1:   row.dslope_h1    ?? null,
      zscore_h1:   row.zscore_h1    ?? null,
      dz_h1:       row.dz_h1        ?? null,
      rsi_h1:      row.rsi_h1       ?? null,
      atr_h1:      row.atr_h1       ?? null,
      atr_m15:     row.atr_m15      ?? null,
      slope_m5:    row.slope_m5     ?? null,
      dslope_m5:   row.dslope_m5    ?? null,
      zscore_m5:   row.zscore_m5    ?? null,
      drsi_m5:     row.drsi_m5      ?? null,
      rsi_m5:      row.rsi_m5       ?? null,
      rsi_h1_min5: row.rsi_h1_min5  ?? null,
      rsi_h1_max5: row.rsi_h1_max5  ?? null,
      intraday_change: row.intraday_change ?? null,
    }));

    const allOpps = [];
    for (const row of topRows) {
      if (!row.symbol) continue;
      allOpps.push(
        ...ContinuationStrategy.evaluate([row], { scoreMin: 12 }),
        ...ReversalStrategy.evaluate([row], { scoreMin: 12 })
      );
    }

    const detected = { mainTF: "H1", rankMode: "multi", list: allOpps };

    // --- 1.3 Scoring / confiance / ranking (NEO informatif)
    const score      = AnalysisScore.evaluate(asset, detected);
    const confidence = AnalysisConfidence.evaluate(score);

    const ranking = OpportunityRanking.evaluate({
      market: detected,
      asset,
      score
    });

    const brain = TradingBrain.decide({
      asset,
      market: detected,
      confidence,
      ranking
    });

    const explanation = SignalExplanation.build({
      asset,
      market: detected,
      brain
    });

    // ======================================================================
    // PHASE 1.5 — ELIGIBILITY & VOLATILITY (TRINITY DIAGNOSTIC)
    // ======================================================================

    const detectedList = Array.isArray(detected?.list)
      ? detected.list
      : [];

    const tradableMarket    = [];
    const notTradableMarket = [];

    for (const op of detectedList) {

      const symbol = op?.symbol;
      if (!symbol) continue;

      // 🔍 retrouver la ligne brute marketWatch
      const rawRow = (snapshot.marketWatch ?? []).find(r => r.symbol === symbol);



      // Snapshot ciblé par actif
      const opSnapshot = {
        ...snapshot,
        asset: {
          ...(snapshot.asset ?? {}),
          symbol
        }
      };

      const eligibility = AssetEligibility.check(opSnapshot, now);

      const volatilityLevel =
        eligibility?.context?.volatilityLevel ?? "unknown";

      const volatilityRatio =
        eligibility?.context?.volatilityRatio ?? null;

      // 🔑 BONUS VOLATILITÉ (TRINITY)
      const volBonus = volatilityBonus(volatilityLevel, op.side);

      const enriched = {
        ...op,

        // 🔥 données brutes injectées depuis marketWatch
        rsi_h1:   rawRow?.rsi_h1   ?? null,
        slope_h1: rawRow?.slope_h1 ?? null,
        rsi_m5:   rawRow?.rsi_m5   ?? null,
        slope_m5: rawRow?.slope_m5 ?? null,


        eligibility,

        // état volatilité aplati
        volatilityLevel,
        volatilityRatio,

        // 🔑 SCORE FINAL TRINITY
        score: op.score + volBonus,

        scores: {
          ...op.scores,
          vol: volBonus
        }
      };

      const finalScore = op.score + volBonus;

      const reason = !eligibility?.eligible
        ? "ELIGIBILITY"
        : finalScore < 30
        ? "LOW_SCORE"
        : "OK";

      if (eligibility?.eligible) {
        tradableMarket.push(enriched);
      } else {
        notTradableMarket.push(enriched);
      }
    }

    // --- Exposition complète côté NEO (UI)
    const neo = {
      asset,
      score,
      confidence,
      ranking,
      explanation,

      topOpportunities: {
        ...detected,
        list:    tradableMarket,     // candidats TRINITY
        blocked: notTradableMarket   // diagnostic marché
      }
    };

    // ======================================================================
    // PHASE 2 — TRINITY (RÉALITÉ, TIMING, FILTRES)
    // ======================================================================

    const accountRisk = AccountRisk.evaluate(snapshot.account);
    const exposure    = ExposureDistribution.evaluate(snapshot.openPositions);

    const portfolio = PortfolioManager.evaluate({
      account:   snapshot.account,
      positions: snapshot.openPositions,
      market:    snapshot.asset
    });

    const closePositions = portfolio?.closePositions ?? [];

    // --- Filtrage timing / structure (H1, M15, etc.)
    const filtered = SignalFilters.evaluate({
      opportunities: tradableMarket
    });

    const {
      validOpportunities   = [],
      waitOpportunities    = [],
      blockedOpportunities = []
    } = filtered ?? {};


    const allowed = validOpportunities.length > 0;

    const trinity = {
      accountRisk,
      exposure,
      portfolio,
      closePositions,

      allowed,
      blockers: [],

      validOpportunities,
      waitOpportunities,
      blockedOpportunities
    };

    // ======================================================================
    // FINAL (FLATTENED CORE FOR UI)
    // ======================================================================

    return {
      // --- keep structured blocks (debug / future)
      neo,
      trinity,

      // --- UI expected fields (flat)
      finalDecision: allowed ? "VALID" : "WAIT",

      // === ASSET (AssetBrain) ===
      structureSignal: asset?.structureSignal ?? null,
      structureAlign:  asset?.structureAlign ?? null,

      dominantSignal:  asset?.dominantSignal ?? null,
      dominantAlign:   asset?.dominantAlign ?? null,

      timingSignal:    asset?.timingSignal ?? null,
      timingAlign:     asset?.timingAlign ?? null,

      noiseLevel:      asset?.noiseLevel ?? null,
      macroRegime:     asset?.macroRegime ?? null,

      // === NEO outputs ===
      topOpportunities: neo.topOpportunities,

      // === TRINITY outputs ===
      accountRisk,
      exposure,
      portfolio,
      closePositions,

      allowed,
      blockers: trinity.blockers ?? [],

      validOpportunities,
      waitOpportunities,
      blockedOpportunities
    };

  }
};

export default RobotCore;
