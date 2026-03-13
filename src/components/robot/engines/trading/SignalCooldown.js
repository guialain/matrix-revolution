// ============================================================================
// SignalCooldown.js — Two-tier cooldown
//
// DetectionCooldown (M1=60s)  — 1 signal VALID par asset par bougie M1
//   canEmit  → checked in SignalFilters after score
//   register → called in SignalFilters before VALID push
//
// TradeCooldown (M5=300s)  — bloque après ordre envoyé
//   canEmit  → checked in SignalFilters after score
//   register → called in TerminalMT5 handleOrderSent()
// ============================================================================

function createCooldown(intervalMs) {
  const lastTime = new Map();

  function getCandleTime(now) {
    const ms = typeof now === "number" ? now : Date.now();
    return ms - (ms % intervalMs);
  }

  function canEmit(symbol, now) {
    const candle = getCandleTime(now);
    const last = lastTime.get(symbol);
    return last === undefined || candle > last;
  }

  function register(symbol, now) {
    lastTime.set(symbol, getCandleTime(now));
  }

  function reset(symbol) {
    lastTime.delete(symbol);
  }

  function resetAll() {
    lastTime.clear();
  }

  return { canEmit, register, reset, resetAll };
}

export const DetectionCooldown = createCooldown(1 * 60 * 1000);   // M1
export const TradeCooldown     = createCooldown(5 * 60 * 1000);   // M5

export default TradeCooldown;
