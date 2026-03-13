const COOLDOWN_MS = 5 * 60 * 1000;
const lastEmitted = new Map(); // symbol → timestamp ms

const SignalFrequency = {
  register(symbol, now = Date.now()) {
    lastEmitted.set(symbol, now);
  },
  canEmit(symbol, now = Date.now()) {
    const last = lastEmitted.get(symbol);
    if (!last) return true;
    return (now - last) >= COOLDOWN_MS;
  }
};

export default SignalFrequency;
