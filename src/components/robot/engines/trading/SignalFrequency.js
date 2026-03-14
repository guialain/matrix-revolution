const API_BASE = typeof window !== "undefined"
  ? (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)
  : "http://localhost:3001";

const COOLDOWN_MS = 5 * 60 * 1000;

let frequencyCache = {};   // symbol → timestamp
let lastFetch = 0;

function refreshFrequency() {
  const now = Date.now();
  if (now - lastFetch < 2000) return; // throttle fetches
  lastFetch = now;
  fetch(`${API_BASE}/api/signals/frequency`, { credentials: "include" })
    .then(res => res.ok ? res.json() : {})
    .then(data => { frequencyCache = data; })
    .catch(() => {});
}

const SignalFrequency = {
  canEmit(symbol) {
    refreshFrequency(); // fire-and-forget, uses cached data
    const last = frequencyCache[symbol];
    if (!last) return true;
    return (Date.now() - last) >= COOLDOWN_MS;
  },
  // register is handled server-side via publish
  register() {},
  _setCache(symbol, timestamp) {
    frequencyCache[symbol] = timestamp;
  }
};

export default SignalFrequency;
