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
// SIGNAL LOGGER — dedup en memoire par signal_id (symbol_side_emittedAt)
// Fire-and-forget POST vers /api/log_signal pour CSV signals_log.csv
// ---------------------------------------------------------------------------
const loggedSignalIds = new Set();

function buildSignalId(opp) {
  return `${opp.symbol}_${opp.side}_${opp.emittedAt}`;
}

function buildSignalLogPayload(opp, verdict) {
  return {
    signal_id:       buildSignalId(opp),
    // Format ISO 8601 UTC pour lisibilite Excel/pandas (vs ms epoch -> 1.7E+12)
    emittedAt:       Number.isFinite(opp.emittedAt) ? new Date(opp.emittedAt).toISOString() : "",
    loggedAt:        new Date().toISOString(),
    verdict,                                  // "VALID" ou "WAIT"
    wait_reason:     opp.wait_reason || "",
    symbol:          opp.symbol,
    side:            opp.side,
    mode:            opp.mode,
    route:           opp.route,
    score:           opp.score,
    entry_zscore_h1: opp.zscore_h1_s0 ?? opp.entry_zscore_h1 ?? null,
    intraday_class:  opp.intradayLevel ?? opp.intraday_class ?? null,
    d1_state:        opp.d1State ?? opp.d1_state ?? null,
    slope_h1_s0:     opp.slope_h1_s0,
    dslope_h1_s0:    opp.dslope_h1_s0,
    slope_m5_s0:     opp.slope_m5_s0,
    slope_m5:        opp.slope_m5,
    dslope_m5_s0:    opp.dslope_m5_s0,
    is_vshape_m5:    opp.is_vshape_m5,
    rsi_m5_s0:       opp.rsi_m5_s0,
    zscore_m5:       opp.zscore_m5,
    middle_h1:       opp.middle_h1,
    sigma_h1:        opp.sigma_h1,
    spread:          opp.spread ?? null,
    // TP/SL distances appliquees (miroir computeSLTP : max(sigma_delta, spread_mult * spread))
    tp_used:         computeTpUsed(opp),
    sl_used:         computeSlUsed(opp),
  };
}

// Miroir de la logique computeSLTP (DealingRoom + useAutoTrader) — sortie en distance abs.
function computeTpUsed(opp) {
  const sigma  = Number(opp?.sigma_h1);
  const spread = Number(opp?.spread);
  const tpSigma  = Number.isFinite(sigma) ? 0.4 * sigma : null;
  const tpMin    = Number.isFinite(spread) && spread > 0 ? 4 * spread : null;
  if (tpSigma === null && tpMin === null) return null;
  if (tpSigma === null) return tpMin;
  if (tpMin   === null) return tpSigma;
  return Math.max(tpSigma, tpMin);
}
function computeSlUsed(opp) {
  const sigma  = Number(opp?.sigma_h1);
  const spread = Number(opp?.spread);
  const slSigma  = Number.isFinite(sigma) ? 1.6 * sigma : null;
  const slMin    = Number.isFinite(spread) && spread > 0 ? 16 * spread : null;
  if (slSigma === null && slMin === null) return null;
  if (slSigma === null) return slMin;
  if (slMin   === null) return slSigma;
  return Math.max(slSigma, slMin);
}

function logSignal(opp, verdict) {
  if (!opp?.symbol || !opp?.side || !opp?.emittedAt) return;
  const id = buildSignalId(opp);
  if (loggedSignalIds.has(id)) return;
  loggedSignalIds.add(id);
  const payload = buildSignalLogPayload(opp, verdict);
  fetch(`${API_BASE}/api/log_signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// ÉTAT PAR DÉFAUT (SAFE UI)
// ---------------------------------------------------------------------------
const EMPTY = {
  finalDecision: "WAIT",

  macroRegime: null,

  topOpportunities: null,

  allowed: false,
  validOpportunities: [],
  waitOpportunities: [],

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
      // Don't publish signals that are in cooldown
      if (!SignalFrequency.canEmit(key)) return false;
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

    // Logger CSV — dedup en memoire (signal_id), fire-and-forget
    valid.forEach(op => logSignal(op, "VALID"));
    wait.forEach(op  => logSignal(op, "WAIT"));
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
    // PERSIST VALID OPS (30s active, then EXPIRED until next scan)
    // -----------------------------------------------------------------------
    const now = Date.now();
    const SIGNAL_TTL_MS = 30_000;

    for (const op of validOps) {
      const key = `${op.symbol}_${op.side}`;
      persistedValid.current[key] = { op, expiresAt: now + SIGNAL_TTL_MS };
    }

    const finalValidOps = [];
    const expiredOps = [];
    const EXPIRED_GRACE_MS = SIGNAL_TTL_MS; // garde les expired 30s supplémentaires pour l'affichage, puis purge

    for (const [key, entry] of Object.entries(persistedValid.current)) {
      if (entry.expiresAt > now) {
        finalValidOps.push(entry.op);
      } else if (now - entry.expiresAt < EXPIRED_GRACE_MS) {
        expiredOps.push({ ...entry.op, state: "EXPIRED" });
      } else {
        delete persistedValid.current[key]; // purge définitive après 2×TTL
      }
    }

    const allowed = finalValidOps.length > 0;

    // -----------------------------------------------------------------------
    // PROJECTION UI
    // -----------------------------------------------------------------------
    return {
      finalDecision: allowed ? "VALID" : "WAIT",

      macroRegime: macro.regime ?? null,

      topOpportunities: neo.topOpportunities ?? null,

      allowed,
      validOpportunities: finalValidOps,
      expiredOpportunities: expiredOps,
      waitOpportunities:  waitOps,

      _raw: { neo, trinity }
    };
  }, [coreResult, signals]);
}
