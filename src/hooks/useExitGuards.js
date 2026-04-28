// ============================================================================
// useExitGuards.js
// Rôle : surveiller les openPositions, declencher fermeture auto sur RSI M1
//        extreme contre la position (en profit + warmup OK).
//        Anti-rafale : inFlight Set 10s par ticket.
//        Log fire-and-forget vers /api/log_exit (CSV exit_guards.csv).
// ============================================================================

import { useEffect, useRef } from "react";
import ExitOnExtremeM1 from "../components/robot/engines/management/ExitOnExtremeM1";
import { sendCloseToMT5 } from "../utilitaires/sendMT5Instructions";

// Kill-switch global : reactive apres fix MQL5 (rsi_m1_s0 desormais expose
// par TopMoversScanner_NEO recompile). Patch defensif rsi===0 conserve.
const GUARD_ENABLED = true;

const INFLIGHT_TIMEOUT_MS = 10_000;

const API_BASE = typeof window !== "undefined" && window.location?.hostname === "localhost"
  ? "http://localhost:3001"
  : (typeof window !== "undefined" ? window.location.origin : "");

export default function useExitGuards(snapshot) {
  const inFlight = useRef(new Map()); // ticket -> expiresAt (ms)

  useEffect(() => {
    if (!GUARD_ENABLED) return;
    if (!snapshot) return;

    const positions   = snapshot.openPositions ?? [];
    const marketWatch = snapshot.marketWatch   ?? [];
    if (!positions.length) return;

    const now = Date.now();

    // Purge inFlight expires
    for (const [ticket, exp] of inFlight.current) {
      if (exp < now) inFlight.current.delete(ticket);
    }

    const closes = ExitOnExtremeM1.evaluate(positions, marketWatch);
    if (!closes.length) return;

    for (const c of closes) {
      if (inFlight.current.has(c.ticket)) continue;
      inFlight.current.set(c.ticket, now + INFLIGHT_TIMEOUT_MS);

      // Fire close to MT5
      sendCloseToMT5({ ticket: c.ticket });

      // Log to CSV (fire-and-forget)
      const payload = {
        ticket:        c.ticket,
        symbol:        c.symbol,
        side:          c.side,
        opened_at:     toIso(c.opened_at),
        closed_at:     new Date(now).toISOString(),
        rsi_at_close:  c.rsi_at_close,
        pnl_pts:       c.pnl_pts,
        pnl_eur:       c.pnl_eur,
        spread_points: c.spread_points,
        reason:        c.reason,
      };
      fetch(`${API_BASE}/api/log_exit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body:    JSON.stringify(payload),
      }).catch(() => {});

      // eslint-disable-next-line no-console
      console.info(`[ExitGuard] ${c.symbol} ${c.side} ticket=${c.ticket} rsi_m1=${c.rsi_at_close.toFixed(1)} pnl=${c.pnl_pts}pts → CLOSE (${c.reason})`);
    }
  }, [snapshot]);
}

// MT5 format "2026.04.28 14:30" -> ISO UTC
function toIso(s) {
  if (!s) return "";
  const iso = String(s).replace(/\./g, "-");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(s);
}
