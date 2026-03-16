// ============================================================================
// useRobotCore.js
// Rôle : Projection UI propre du RobotCore (NEO + TRINITY)
//        + fetch signals from /api/signals every 800ms
// ============================================================================

import { useMemo, useState, useEffect, useRef } from "react";
import RobotCore from "../components/robot/RobotCore";
import SignalFrequency from "../components/robot/engines/trading/SignalFrequency";

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : window.location.origin;

// ---------------------------------------------------------------------------
// PUBLISH THROTTLE — 15s per symbol to avoid flooding /api/signals/publish
// ---------------------------------------------------------------------------
const PUBLISH_COOLDOWN_MS = 15_000;

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
  const lastPublishRef = useRef({});    // { "SYMBOL_SIDE": timestampMs }
  const persistedValid = useRef({});    // { "SYMBOL_SIDE": { op, expiresAt } }

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

  // POST signals to server (fire-and-forget, throttled per symbol)
  useEffect(() => {
    if (!coreResult) return;
    const trinity = coreResult.trinity ?? {};
    const valid = trinity.validOpportunities ?? [];
    const wait  = trinity.waitOpportunities ?? [];
    if (!valid.length && !wait.length) return;

    const now = Date.now();
    const last = lastPublishRef.current;

    const throttledValid = valid.filter(op => {
      const key = `${op.symbol}_${op.side}`;
      if (last[key] && (now - last[key]) < PUBLISH_COOLDOWN_MS) return false;
      last[key] = now;
      return true;
    });

    // Always publish wait ops (lightweight), but only fresh valid ops
    if (!throttledValid.length && !wait.length) return;

    fetch(`${API_BASE}/api/signals/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ validOpportunities: throttledValid, waitOpportunities: wait }),
    }).catch(() => {});
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
    const validOps = [];
    const cooldownOps = [];

    signals.validOpportunities.forEach(op => {
      const key = `${op.symbol}_${op.side}`;
      if (SignalFrequency.canEmit(key)) {
        validOps.push({ ...op });
      } else {
        cooldownOps.push({
          ...op,
          state: "WAIT_COOLDOWN",
          waitReason: "COOLDOWN",
          cooldownRemaining: SignalFrequency.getCooldownRemaining(key)
        });
      }
    });

    const waitOps = [
      ...signals.waitOpportunities.map(op => ({ ...op })),
      ...cooldownOps
    ];

    // -----------------------------------------------------------------------
    // PERSIST VALID OPS (survive 15s between cycles)
    // -----------------------------------------------------------------------
    const now = Date.now();

    for (const op of validOps) {
      const key = `${op.symbol}_${op.side}`;
      if (!persistedValid.current[key]) {
        persistedValid.current[key] = { op, expiresAt: now + 15000 };
      } else {
        persistedValid.current[key].op = op; // update data, keep original expiry
      }
    }

    const finalValidOps = Object.values(persistedValid.current)
      .filter(({ expiresAt }) => expiresAt > now)
      .map(({ op }) => op);

    for (const key of Object.keys(persistedValid.current)) {
      if (persistedValid.current[key].expiresAt <= now) {
        delete persistedValid.current[key];
      }
    }

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

    const allowed = finalValidOps.length > 0;

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
      validOpportunities: finalValidOps,
      waitOpportunities:  waitOps,
      closePositions:     closeOps,

      _raw: { neo, trinity }
    };
  }, [coreResult, signals]);
}
