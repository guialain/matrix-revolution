// ============================================================================
// RobotCore.js — TRINITY OFFICIEL (NEO + TRINITY)
// Rôle : Orchestrateur central
//  - NEO : vision, scoring, opportunités
//  - TRINITY : réalité marché, filtres, timing, bonus
// AUCUNE logique métier lourde ici (orchestration uniquement)
// ============================================================================

// ================= MARKET / ASSET ======================
import TopOpportunities_V8R from "./engines/opportunities/TopOpportunities_V8R";
import AssetBrain       from "./engines/asset/AssetBrain";

// ================= DECISION (NEO) =======================
import AssetEligibility from "./engines/trading/AssetEligibility";

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
      assetclass:  row.assetclass   ?? null,
      timestamp:   row.timestamp    ?? null,
      price:       row.price        ?? null,
      close:       row.close        ?? row.price ?? null,
      // D1
      rsi_d1:      row.rsi_d1      ?? null,
      slope_d1:    row.slope_d1    ?? null,
      dslope_d1:   row.dslope_d1   ?? null,
      drsi_d1:     row.drsi_d1     ?? null,
      rsi_d1_s0:   row.rsi_d1_s0   ?? null,
      slope_d1_s0: row.slope_d1_s0 ?? null,
      drsi_d1_s0:  row.drsi_d1_s0  ?? null,
      // D1 OHLC (bougie en cours)
      open_d1:     row.open_d1     ?? null,
      high_d1:     row.high_d1     ?? null,
      low_d1:      row.low_d1      ?? null,
      close_d1:    row.close_d1    ?? null,
      // H4
      slope_h4:    row.slope_h4     ?? null,
      slope_h4_s0: row.slope_h4_s0  ?? null,
      dslope_h4:   row.dslope_h4    ?? null,
      drsi_h4:     row.drsi_h4      ?? null,
      drsi_h4_s0:  row.drsi_h4_s0   ?? null,
      rsi_h4_s0:   row.rsi_h4_s0    ?? null,
      zscore_h4:   row.zscore_h4    ?? null,
      zscore_h4_s0:row.zscore_h4_s0 ?? null,
      // H1 s1
      slope_h1:    row.slope_h1     ?? null,
      dslope_h1:   row.dslope_h1    ?? null,
      zscore_h1:   row.zscore_h1    ?? null,
      dz_h1:       row.dz_h1        ?? null,
      drsi_h1:     row.drsi_h1      ?? null,
      rsi_h1:      row.rsi_h1       ?? null,
      atr_h1:      row.atr_h1       ?? null,
      rsi_h1_previouslow3:  row.rsi_h1_previouslow3  ?? null,
      rsi_h1_previoushigh3: row.rsi_h1_previoushigh3 ?? null,
      zscore_h1_min3:       row.zscore_h1_min3       ?? null,
      zscore_h1_max3:       row.zscore_h1_max3       ?? null,
      // H1 s0
      rsi_h1_s0:   row.rsi_h1_s0    ?? null,
      slope_h1_s0: row.slope_h1_s0  ?? null,
      drsi_h1_s0:  row.drsi_h1_s0   ?? null,
      zscore_h1_s0:row.zscore_h1_s0 ?? null,
      middle_h1:   row.middle_h1    ?? null,
      sigma_h1:    row.sigma_h1     ?? null,
      // M15
      atr_m15:     row.atr_m15      ?? null,
      rsi_m15:     row.rsi_m15      ?? null,
      slope_m15:   row.slope_m15    ?? null,
      dslope_m15:  row.dslope_m15   ?? null,
      // M5 s1
      slope_m5:    row.slope_m5     ?? null,
      dslope_m5:   row.dslope_m5    ?? null,
      zscore_m5:   row.zscore_m5    ?? null,
      drsi_m5:     row.drsi_m5      ?? null,
      rsi_m5:      row.rsi_m5       ?? null,
      // M5 s0
      rsi_m5_s0:   row.rsi_m5_s0    ?? null,
      slope_m5_s0: row.slope_m5_s0  ?? null,
      drsi_m5_s0:  row.drsi_m5_s0   ?? null,
      zscore_m5_s0:row.zscore_m5_s0 ?? null,
      // Other
      intraday_change: row.intraday_change ?? null,
    }));

    // Architecture multi-traders : spacing technique moteur (1 min, anti-rafale)
    // distinct du cooldown UI personnel géré par SignalFrequency côté trader.
    // Un signal valide est republié toutes les 1 min tant qu'il persiste,
    // pour permettre au trader de le voir même s'il ne regarde pas en temps réel.
    const allOpps = TopOpportunities_V8R.evaluate(topRows, { minSignalSpacingMinutes: 1, scoreMin: 0 });

    const detected = { mainTF: "H1", rankMode: "multi", list: allOpps };

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

      if (eligibility?.eligible) {
        tradableMarket.push(enriched);
      } else {
        notTradableMarket.push(enriched);
      }
    }

    // --- Exposition complète côté NEO (UI)
    const neo = {
      asset,

      topOpportunities: {
        ...detected,
        list:    tradableMarket,     // candidats TRINITY
        blocked: notTradableMarket   // diagnostic marché
      }
    };

    // ======================================================================
    // PHASE 2 — TRINITY (FILTRES TIMING M5)
    // ======================================================================

    const filtered = SignalFilters.evaluate({
      opportunities: tradableMarket
    });

    const {
      validOpportunities: rawValid = [],
      waitOpportunities:  rawWait  = []
    } = filtered ?? {};

    // Stamp each opp with emittedAt only if not already set
    const stampEmittedAt = op => ({ ...op, emittedAt: op.emittedAt ?? Date.now() });
    const validOpportunities = rawValid.map(stampEmittedAt);
    const waitOpportunities  = rawWait.map(stampEmittedAt);

    const allowed = validOpportunities.length > 0;

    const trinity = {
      allowed,
      validOpportunities,
      waitOpportunities,
    };

    // ======================================================================
    // FINAL — useRobotCore consomme uniquement neo + trinity
    // ======================================================================

    return { neo, trinity };

  }
};

export default RobotCore;
