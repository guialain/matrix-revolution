// ============================================================================
// useRobotCore.js
// Rôle : Projection UI propre du RobotCore (NEO + TRINITY)
//        + fetch signals from /api/signals every 800ms
// ============================================================================

import { useMemo, useState, useEffect } from "react";
import RobotCore from "../components/robot/RobotCore";
import SignalFrequency from "../components/robot/engines/trading/SignalFrequency";

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : window.location.origin;

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

  const [signals, setSignals] = useState({ validOpportunities: [], waitOpportunities: [] });

  // Fetch signals from server every 800ms
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/signals`, { credentials: "include" });
        if (res.ok && active) {
          const data = await res.json();
          setSignals({
            validOpportunities: data.validOpportunities ?? [],
            waitOpportunities:  data.waitOpportunities ?? [],
          });
        }
      } catch { /* silent */ }
    }

    poll();
    const id = setInterval(poll, 800);
    return () => { active = false; clearInterval(id); };
  }, []);

  // RobotCore.run() — synchrone, pure computation
  const coreResult = useMemo(() => {
    if (!snapshot) return null;
    return RobotCore.run(snapshot);
  }, [snapshot]);

  // POST signals to server (fire-and-forget, outside render)
  useEffect(() => {
    if (!coreResult) return;
    const trinity = coreResult.trinity ?? {};
    const valid = trinity.validOpportunities ?? [];
    const wait  = trinity.waitOpportunities ?? [];
    if (!valid.length && !wait.length) return;

    fetch(`${API_BASE}/api/signals/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ validOpportunities: valid, waitOpportunities: wait }),
    }).catch(() => {});

    // Update local frequency cache immediately
    valid.forEach(op => {
      if (op.symbol) SignalFrequency._setCache(op.symbol, Date.now());
    });
  }, [coreResult]);

  // Merge: core analysis + server signals
  return useMemo(() => {
    if (!coreResult) return EMPTY;

    const neo     = coreResult.neo ?? {};
    const trinity = coreResult.trinity ?? {};
    const asset   = neo.asset ?? {};
    const macro   = asset.macro ?? {};

    // -----------------------------------------------------------------------
    // SIGNALS FROM SERVER (authoritative)
    // -----------------------------------------------------------------------
    const validOps = signals.validOpportunities.map(op => ({ ...op }));
    const waitOps  = signals.waitOpportunities.map(op => ({ ...op }));

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

    const allowed = validOps.length > 0;

    // -----------------------------------------------------------------------
    // PROJECTION UI
    // -----------------------------------------------------------------------
    return {
      finalDecision: allowed ? "VALID" : "WAIT",

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
  }, [coreResult, signals]);
}
