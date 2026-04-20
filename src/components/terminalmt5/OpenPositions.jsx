// ============================================================================
// OPEN POSITIONS — Neo Matrix (LIVE TABLE)
// ============================================================================

import React, { useEffect, useMemo, useState, useRef } from "react";
const API_BASE = window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin;

import "../../styles/stylesterminalMT5/openpositions.css";
import { sendCloseToMT5 } from "../../utilitaires/sendMT5Instructions";
import MaxHoldGuard from "../robot/engines/management/MaxHoldGuard";

// ============================================================================
// COMPONENT
// ============================================================================

export default function OpenPositions() {

  // =========================
  // STATE
  // =========================
  const [positions, setPositions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "open_time", direction: "desc" });
  const [closingTicket, setClosingTicket] = useState(null);
  const [maxHoldAlerts, setMaxHoldAlerts] = useState([]);
  const closedByGuardRef = React.useRef(new Set());

  // =========================
  // FETCH MT5 DATA
  // =========================
  useEffect(() => {
    const fetchData = () => {
      fetch(`${API_BASE}/api/mt5data`, { credentials: "include" })
        .then(r => r.json())
        .then(d => setPositions(d.openPositions || []))
        .catch(() => setPositions([]));
    };

    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, []);

  // =========================
  // MAX HOLD GUARD — auto-close expired positions
  // =========================
  useEffect(() => {
    if (!positions.length) { setMaxHoldAlerts([]); return; }

    const toClose = MaxHoldGuard.evaluate(positions);
    setMaxHoldAlerts(toClose);

    for (const alert of toClose) {
      if (closedByGuardRef.current.has(alert.ticket)) continue;
      closedByGuardRef.current.add(alert.ticket);
      console.warn(`⏰ ${alert.reason} | ${alert.symbol} ${alert.side} ticket=${alert.ticket} hold=${alert.duration_h.toFixed(1)}h (max=${alert.maxHoldH}h)`);
      sendCloseToMT5({ ticket: alert.ticket })
        .catch(err => console.error("[MaxHoldGuard] close error:", err));
    }

    // Cleanup stale tickets from ref
    const activeTickets = new Set(positions.map(p => p.ticket));
    for (const t of closedByGuardRef.current) {
      if (!activeTickets.has(t)) closedByGuardRef.current.delete(t);
    }
  }, [positions]);

  // =========================
  // CLEAN + ENRICH
  // =========================
  const enrichedPositions = useMemo(() => (
    positions
      .filter(p => p?.symbol)
      .map(p => ({
        ...p,
        side: p.side?.toUpperCase?.() ?? null,
        duration_h: computeDurationHours(p.open_time)
      }))
  ), [positions]);

  // =========================
  // SORTING
  // =========================
  function requestSort(key) {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function SortArrow({ column }) {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  }

  const rows = useMemo(() => {
    if (!sortConfig.key) return enrichedPositions;

    return [...enrichedPositions].sort((a, b) => {
      const A = a[sortConfig.key];
      const B = b[sortConfig.key];

      if (A == null) return 1;
      if (B == null) return -1;

      if (typeof A === "number") {
        return sortConfig.direction === "asc" ? A - B : B - A;
      }

      return sortConfig.direction === "asc"
        ? String(A).localeCompare(String(B))
        : String(B).localeCompare(String(A));
    });
  }, [enrichedPositions, sortConfig]);

  // =========================
  // ACTIONS
  // =========================
function closePosition(p, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  console.log("[UI] closePosition()", {
    ticket: p?.ticket,
    symbol: p?.symbol,
    closingTicket,
    isDisabled: closingTicket === p?.ticket
  });

  if (!p?.ticket || closingTicket === p.ticket) return;

  setClosingTicket(p.ticket);

  const req = sendCloseToMT5({ ticket: p.ticket });

  console.log("[UI] sendCloseToMT5 returned:", req);

  Promise.resolve(req)
    .then(async (res) => {
      console.log("[UI] fetch resolved:", res?.status, res?.ok);
      if (res && typeof res.json === "function") {
        const j = await res.json().catch(() => null);
        console.log("[UI] response json:", j);
      }
    })
    .catch((err) => console.error("[UI] fetch error:", err))
    .finally(() => setClosingTicket(null));
}


  // =========================
  // RENDER
  // =========================
  return (
    <div className="open-positions">
      <div className="open-positions-title">OPEN POSITIONS ({rows.length})</div>


      <div className="portfolio-table-wrapper">
        <table className="portfolio-table">

          <thead>
            <tr>
              <th>Close</th>
              <th onClick={() => requestSort("symbol")}>
                Symbol<SortArrow column="symbol" />
              </th>
              <th onClick={() => requestSort("open_time")}>
                Open<SortArrow column="open_time" />
              </th>
              <th onClick={() => requestSort("side")}>
                Side<SortArrow column="side" />
              </th>
              <th onClick={() => requestSort("lots")}>
                Lots<SortArrow column="lots" />
              </th>
              <th onClick={() => requestSort("intraday_change")}>
                Today<SortArrow column="intraday_change" />
              </th>
              <th onClick={() => requestSort("duration_h")}>
                Durée<SortArrow column="duration_h" />
              </th>
              <th onClick={() => requestSort("pnl_eur")}>
                PnL<SortArrow column="pnl_eur" />
              </th>
              <th onClick={() => requestSort("rsi_h1")}>
                RSI-H1<SortArrow column="rsi_h1" />
              </th>
              <th onClick={() => requestSort("pnl_spread")}>
                PnL-Sprd<SortArrow column="pnl_spread" />
              </th>
              <th onClick={() => requestSort("pnl_atr_h1")}>
                PnL/ATR-H1<SortArrow column="pnl_atr_h1" />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p, i) => (
              <tr key={p.ticket ?? `${p.symbol}-${p.open_time}-${i}`}>

{/* CLOSE */}

<td
  className="close-cell"
  onClick={(e) => closePosition(p, e)}
  style={{ cursor: "pointer" }}
  title="Close position"
>
  <CloseIcon
    state={
      p.pnl_eur > 0 ? "pos" :
      p.pnl_eur < 0 ? "neg" :
      "neutral"
    }
  />
</td>




                <td>{p.symbol}</td>

                <td>{fmtOpenTime(p.open_time)}</td>

                <td
                  className={
                    p.side === "BUY" ? "buy" :
                    p.side === "SELL" ? "sell" :
                    "neutral"
                  }
                >
                  {p.side ?? "—"}
                </td>

                <td>{p.lots != null ? Number(p.lots).toFixed(3) : "—"}</td>

                <td className={p.intraday_change >= 0 ? "pos" : "neg"}>
                  {p.intraday_change != null ? `${p.intraday_change.toFixed(2)}%` : "—"}
                </td>

                <td className={maxHoldAlerts.some(a => a.ticket === p.ticket) ? "maxhold-alert" : ""}>
                  {p.duration_h != null ? `${p.duration_h.toFixed(1)}h` : "—"}
                  {maxHoldAlerts.some(a => a.ticket === p.ticket) && " ⏰"}
                </td>

                <td className={p.pnl_eur >= 0 ? "pos" : "neg"}>
                  {formatEUR(p.pnl_eur)}
                </td>

                <td
                  className={
                    p.rsi_h1 > 67 || p.rsi_h1 < 33
                      ? "rsi-strong"
                      : "rsi-neutral"
                  }
                >
                  {Number.isFinite(p.rsi_h1) ? Math.round(p.rsi_h1) : "—"}
                </td>

                <td className={p.pnl_spread >= 0 ? "pos" : "neg"}>
                  {p.pnl_spread != null ? p.pnl_spread.toFixed(0) : "—"}
                </td>

                <td
                  className={
                    p.pnl_atr_h1 > 0 ? "pos" :
                    p.pnl_atr_h1 < 0 ? "neg" :
                    "neutral"
                  }
                >
                  {Number.isFinite(p.pnl_atr_h1)
                    ? `${(p.pnl_atr_h1 * 100).toFixed(0)}%`
                    : "—"}
                </td>

              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/** Format open_time: same day → "HH:MM", else → "MM/DD HH:MM" */
function fmtOpenTime(open_time) {
  if (!open_time) return "—";
  const d = new Date(open_time.replace(/\./g, "-").replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mo}/${dd} ${hh}:${mm}`;
}

function computeDurationHours(open_time) {
  if (!open_time) return null;
  const ts = open_time.replace(/\./g, "-");
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3_600_000;
}

function formatEUR(v) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(0)} €`;
}

function formatNumberSmart(v, maxDecimals = 5) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(maxDecimals).replace(/\.?0+$/, "");
}

// ============================================================================
// ICONS
// ============================================================================

function CloseIcon({ state }) {
  return (
    <svg
      className={`close-icon ${state}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3 10.6 10.6 16.9 4.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
