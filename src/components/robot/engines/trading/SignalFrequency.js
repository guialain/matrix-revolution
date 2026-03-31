const API_BASE = typeof window !== "undefined"
  ? (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)
  : "http://localhost:3001";

// Cooldown configurable (default 5 min, persisted in localStorage)
const COOLDOWN_OPTIONS = [0, 1, 5, 10, 15, 30, 45, 60]; // minutes

function loadCooldownMinutes() {
  try {
    const v = parseInt(localStorage.getItem("neo_cooldown_min"), 10);
    return COOLDOWN_OPTIONS.includes(v) ? v : 1;
  } catch { return 1; }
}

let cooldownMin = loadCooldownMinutes();

let frequencyCache = {};   // key → timestamp
let lastFetch = 0;

function refreshFrequency() {
  const now = Date.now();
  if (now - lastFetch < 2000) return; // throttle fetches
  lastFetch = now;
  fetch(`${API_BASE}/api/signals/frequency`, { credentials: "include" })
    .then(res => res.ok ? res.json() : {})
    .then(data => {
      // Merge: keep local entries that are newer than server (race-safe)
      const merged = { ...data };
      for (const [k, v] of Object.entries(frequencyCache)) {
        if (v > (merged[k] ?? 0)) merged[k] = v;
      }
      frequencyCache = merged;
    })
    .catch(() => {});
}

const SignalFrequency = {
  COOLDOWN_OPTIONS,

  getCooldownMinutes() {
    return cooldownMin;
  },

  setCooldownMinutes(min) {
    if (!COOLDOWN_OPTIONS.includes(min)) return;
    cooldownMin = min;
    try { localStorage.setItem("neo_cooldown_min", String(min)); } catch {}
  },

  canEmit(key) {
    if (cooldownMin === 0) return true;
    refreshFrequency();
    const last = frequencyCache[key];
    if (!last) return true;
    return (Date.now() - last) >= cooldownMin * 60 * 1000;
  },

  getCooldownRemaining(key) {
    if (cooldownMin === 0) return 0;
    refreshFrequency();
    const last = frequencyCache[key];
    if (!last) return 0;
    const remaining = (cooldownMin * 60 * 1000) - (Date.now() - last);
    return remaining > 0 ? remaining : 0;
  },

  recordCooldown(key) {
    frequencyCache[key] = Date.now();
    fetch(`${API_BASE}/api/signals/cooldown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ symbol: key })
    }).catch(() => {});
  },

  clearCooldown(key) {
    delete frequencyCache[key];
  }
};

export default SignalFrequency;
