// ============================================================================
// useRobotCore.js
// Rôle : Projection UI propre du RobotCore (NEO + TRINITY)
// ============================================================================

import { useMemo } from "react";
import RobotCore from "../components/robot/RobotCore";

// ---------------------------------------------------------------------------
// ÉTAT PAR DÉFAUT (SAFE UI)
// ---------------------------------------------------------------------------
const EMPTY = {
  finalDecision: "WAIT",

  structureSignal: "Neutral",
  structureAlign:  "Unknown",

  dominantSignal: "Neutral",
  dominantAlign:  "Unknown",

  timingSignal: "Neutral",
  timingAlign:  "Unknown",

  noiseLevel: null,
  macroRegime: null,

  topOpportunities: null,

  allowed: false,
  validOpportunities: [],
  waitOpportunities: [],
  closePositions: [],

  _raw: null
};

// ---------------------------------------------------------------------------
// HOOK
// ---------------------------------------------------------------------------
export default function useRobotCore(snapshot) {
  return useMemo(() => {
    if (!snapshot) return EMPTY;

    const result = RobotCore.run(snapshot);
    if (!result) return EMPTY;

    const neo     = result.neo ?? {};
    const trinity = result.trinity ?? {};
    const asset   = neo.asset ?? {};
    const macro   = asset.macro ?? {};

    // -----------------------------------------------------------------------
    // NORMALISATION TRINITY (SAFE – NON DESTRUCTIVE)
    // -----------------------------------------------------------------------
    const validOps = Array.isArray(trinity.validOpportunities)
      ? trinity.validOpportunities.map(op => ({ ...op }))
      : [];

    const waitOps = Array.isArray(trinity.waitOpportunities)
      ? trinity.waitOpportunities.map(op => ({ ...op }))
      : [];

    const closeOps = Array.isArray(trinity.closePositions)
      ? trinity.closePositions.map(p => ({
          symbol:     p.symbol,
          side:       p.side,
          urgency:    p.urgency,
          reason:     p.reason,
          pnl_atr_h1: p.pnl_atr_h1,
          pnl_atr_h4: p.pnl_atr_h4
        }))
      : [];

    const allowed = Boolean(trinity.allowed);

    // -----------------------------------------------------------------------
    // PROJECTION UI
    // -----------------------------------------------------------------------
    return {
      finalDecision: result.finalDecision ?? "WAIT",

      structureSignal: asset.structure?.signal    ?? "Neutral",
      structureAlign:  asset.structure?.alignment ?? "Unknown",

      dominantSignal: asset.dominant?.signal    ?? "Neutral",
      dominantAlign:  asset.dominant?.alignment ?? "Unknown",

      timingSignal: asset.timing?.signal    ?? "Neutral",
      timingAlign:  asset.timing?.alignment ?? "Unknown",

      noiseLevel: asset.noise?.confidence ?? null,
      macroRegime: macro.regime ?? null,

      topOpportunities: neo.topOpportunities ?? null,

      allowed,
      validOpportunities: validOps,
      waitOpportunities:  waitOps,
      closePositions:     closeOps,

      _raw: { neo, trinity }
    };
  }, [snapshot]);
}
