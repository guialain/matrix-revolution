// ============================================================================
// SignalCooldown.js — TradeCooldown (5 min fixed after order sent)
//
// register(symbol) → called in TerminalMT5 handleOrderSent()
// canEmit(symbol)  → checked in SignalFilters after score
// ============================================================================

const COOLDOWN_MS = 5 * 60 * 1000;

const lastTime = new Map();

function canEmit(symbol) {
  const last = lastTime.get(symbol);
  if (last === undefined) return true;
  return Date.now() - last > COOLDOWN_MS;
}

function register(symbol) {
  lastTime.set(symbol, Date.now());
}

function reset(symbol) {
  lastTime.delete(symbol);
}

function resetAll() {
  lastTime.clear();
}

export const TradeCooldown = { canEmit, register, reset, resetAll };

export default TradeCooldown;
