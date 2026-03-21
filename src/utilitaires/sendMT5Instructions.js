// ============================================================================
// MT5 INSTRUCTIONS BRIDGE — NEO MATRIX
// Rôle : envoyer des ordres OPEN et CLOSE vers MT5 via l’API Node
// ============================================================================

import { getRiskConfig } from "../components/robot/engines/config/RiskConfig";

const API_BASE = window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin;

const API = `${API_BASE}/api`;

// ============================================================================
// TICK ROUNDING — final guard before dispatch
// ============================================================================
function roundToTick(price, tickSize) {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return price;
  const digits = Math.max(0, Math.ceil(-Math.log10(tickSize)));
  return Number((Math.round(price / tickSize) * tickSize).toFixed(digits));
}

// ============================================================================
// OPEN POSITION
// ============================================================================
export function sendOrderToMT5(order) {
  if (!order?.symbol || !order?.side || !order?.lots) {
    return Promise.reject(new Error(`sendOrderToMT5 abort — symbol:${order?.symbol} side:${order?.side} lots:${order?.lots}`));
  }

  // Final tick rounding — ensures SL/TP are always on valid price levels
  const tick = getRiskConfig(order.symbol)?.tickSize;
  const sl = roundToTick(order.sl, tick);
  const tp = roundToTick(order.tp, tick);

  console.log("[BRIDGE] sendOrderToMT5()", { ...order, sl, tp });

  return fetch(`${API}/mt5order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol: order.symbol,
      side: order.side,              // BUY | SELL
      lots: order.lots,
      sl,
      tp,
      slDist: order.slDist ?? null,
      tpDist: order.tpDist ?? null,
      tf: order.signalTF ?? null,
      source: "NEO_MATRIX",
      timestamp: Date.now()
    })
  });
}

// ============================================================================
// CLOSE POSITION
// ============================================================================
export function sendCloseToMT5(close) {
  console.log("[BRIDGE] sendCloseToMT5()", close);

  if (!close?.ticket) {
    console.warn("[BRIDGE] missing ticket, abort");
    return null;
  }

  return fetch(`${API}/mt5close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      ticket: close.ticket,
      volume: close.volume ?? null,
      source: "NEO_MATRIX",
      timestamp: Date.now()
    })
  });
}

// ============================================================================
// SWITCH SYMBOL
// ============================================================================

export function sendSwitchSymbol(symbol) {
  if (!symbol) return null;

  return fetch(`${API}/mt5switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol,
      source: "NEO_MATRIX",
      timestamp: Date.now()
    })
  });
}

