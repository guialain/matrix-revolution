// ============================================================================
// SignalCooldown.js — 1 signal max per M5 candle per symbol
// ============================================================================

const COOLDOWN_MS = 5 * 60 * 1000;

const lastSignalTime = new Map();

function getCurrentCandleTime(now) {
  const ms = typeof now === "number" ? now : Date.now();
  return ms - (ms % COOLDOWN_MS);
}

function canEmit(symbol, now) {
  const candle = getCurrentCandleTime(now);
  const last = lastSignalTime.get(symbol);
  return last === undefined || candle > last;
}

function register(symbol, now) {
  lastSignalTime.set(symbol, getCurrentCandleTime(now));
}

function reset(symbol) {
  lastSignalTime.delete(symbol);
}

function resetAll() {
  lastSignalTime.clear();
}

export default { canEmit, register, reset, resetAll };
