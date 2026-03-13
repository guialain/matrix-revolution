// ============================================================================
// SignalCooldown.js — Two-tier cooldown system
//
//   Level 1 — DetectionCooldown  (M1 = 60 s)  used in continuation / reversal
//             → avoids duplicate detections on the same asset
//
//   Level 2 — TradeCooldown      (M5 = 300 s) used in SignalFilters
//             → 1 tradable signal per asset per M5 candle
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

// Legacy default export = TradeCooldown (backward compat)
export default TradeCooldown;
