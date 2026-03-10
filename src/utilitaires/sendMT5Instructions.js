// ============================================================================
// MT5 INSTRUCTIONS BRIDGE — NEO MATRIX
// Rôle : envoyer des ordres OPEN et CLOSE vers MT5 via l’API Node
// ============================================================================

const API_BASE = "https://matrix-revolution.onrender.com/api";

// ============================================================================
// OPEN POSITION
// ============================================================================
export function sendOrderToMT5(order) {
  if (!order?.symbol || !order?.side || !order?.lots) {
    return Promise.reject(new Error(`sendOrderToMT5 abort — symbol:${order?.symbol} side:${order?.side} lots:${order?.lots}`));
  }

  console.log("[BRIDGE] sendOrderToMT5()", order);

  return fetch(`${API_BASE}/mt5order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol: order.symbol,
      side: order.side,              // BUY | SELL
      lots: order.lots,
      sl: order.sl,
      tp: order.tp,
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

  return fetch(`${API_BASE}/mt5close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticket: close.ticket,
      volume: close.volume ?? null,
      userId: "NeoTrader",
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

  return fetch(`${API_BASE}/mt5switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      source: "NEO_MATRIX",
      timestamp: Date.now()
    })
  });
}

