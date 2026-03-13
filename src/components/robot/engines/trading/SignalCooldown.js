// ============================================================================
// SignalCooldown.js — TradeCooldown (M5 candle snap)
//
// register(symbol) → called in TerminalMT5 handleOrderSent()
// canEmit(symbol)  → checked in SignalFilters after score
// Blocks until next M5 candle boundary after order sent.
// ============================================================================

const COOLDOWN_MS = 5 * 60 * 1000;

const lastTime = new Map();

function candleSnap() {
  const now = Date.now();
  return now - (now % COOLDOWN_MS);
}

function canEmit(symbol) {
  const last = lastTime.get(symbol);
  if (last === undefined) return true;
  return candleSnap() > last;
}

function register(symbol) {
  lastTime.set(symbol, candleSnap());
}

function reset(symbol) {
  lastTime.delete(symbol);
}

function resetAll() {
  lastTime.clear();
}

export const TradeCooldown = { canEmit, register, reset, resetAll };

export default TradeCooldown;
