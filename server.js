import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { decodeJwt } from "jose";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// ============================================================================
// NUM HELPER (safe number)
// ============================================================================

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ============================================================================
// USERS & TOKENS
// ============================================================================

const USERS_PATH = path.join(path.resolve(), "users.json");
let USERS = {};

function loadUsers() {
  try {
    USERS = JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
  } catch (err) {
    console.error("⚠️ Failed to load users.json:", err.message);
  }
}
loadUsers();
console.log(`✅ users.json loaded — ${Object.keys(USERS).length} users:`, Object.keys(USERS));

// Build reverse lookup: token → email
function tokenToEmail(token) {
  for (const [email, u] of Object.entries(USERS)) {
    if (u.token === token) return email;
  }
  return null;
}

function emailToToken(email) {
  return USERS[email.toLowerCase()]?.token ?? null;
}

// Owner email — always uses local MT5 files, never agent queue
const OWNER_EMAIL = "guialain777@gmail.com";

// ============================================================================
// AGENTS CACHE (multi-user: keyed by token)
// ============================================================================

const AGENTS_CACHE = {};   // { token: { account, asset, indicators, macro, scan, openpositions, closedtrades, lastUpdate } }
const AGENTS_QUEUE = {};   // { token: [ { action, payload } ] }

// ============================================================================
// MT5 LOCAL FILES (fallback for local dev / owner)
// ============================================================================

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/" +
  "9B101088254A9C260A9790D5079A7B11/MQL5/Files";

const FILES = {
  account:       "neo_account.csv",
  asset:         "neo_asset.csv",
  indicators:    "neo_indicators.csv",
  macro:         "neo_macro.csv",
  scan:          "neo_market_scan.csv",
  openpositions: "neo_openpositions.csv",
  closedtrades:  "neo_closedtrades.csv",
};

// ============================================================================
// GLOBAL CACHE
// ============================================================================

const CACHE = {
  account:      null,
  asset:        null,
  indicators:   null,
  macro:        null,
  scan:         [],
  openpositions:[],
  closedtrades: [],
  lastUpdate:   0
};

// ============================================================================
// CSV UTILITIES
// ============================================================================

function readLastRowCSV(filePath) {

  if (!fs.existsSync(filePath)) return null;

  try {

    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content) return null;

    const lines = content.split(/\r?\n/);
    if (lines.length < 2) return null;

    const headers = lines[0].split(";");

    let lastLine = "";

    for (let i = lines.length - 1; i > 0; i--) {

      lastLine = lines[i] + lastLine;

      if (lastLine.split(";").length >= headers.length) break;
    }

    const values = lastLine.split(";");

    if (values.length < headers.length) return null;

    const obj = {};

    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });

    return obj;

  } catch {
    return null;
  }
}

function readAllRowsCSV(filePath) {

  if (!fs.existsSync(filePath)) return [];

  try {

    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content) return [];

    const lines = content.split(/\r?\n/);

    if (lines.length < 2) return [];

    const headers = lines[0].split(";");

    return lines.slice(1).map(line => {

      const values = line.split(";");

      const obj = {};

      headers.forEach((h, i) => {
        obj[h] = values[i] ?? "";
      });

      return obj;

    });

  } catch {
    return [];
  }
}

// ============================================================================
// CACHE UPDATE (background polling every 1s)
// ============================================================================

function updateCache() {

  const accountRaw     = readLastRowCSV(path.join(MT5_DIR, FILES.account));
  const assetRaw       = readLastRowCSV(path.join(MT5_DIR, FILES.asset));
  const indiRaw        = readLastRowCSV(path.join(MT5_DIR, FILES.indicators));
  const macroRaw       = readLastRowCSV(path.join(MT5_DIR, FILES.macro));
  const scanRaw        = readAllRowsCSV(path.join(MT5_DIR, FILES.scan));
  const openPosRaw     = readAllRowsCSV(path.join(MT5_DIR, FILES.openpositions));
  const closedRaw      = readAllRowsCSV(path.join(MT5_DIR, FILES.closedtrades));

  if (accountRaw)        CACHE.account      = accountRaw;
  if (assetRaw)          CACHE.asset        = assetRaw;
  if (indiRaw)           CACHE.indicators   = indiRaw;
  if (macroRaw)          CACHE.macro        = macroRaw;
  if (scanRaw?.length)   CACHE.scan         = scanRaw;
  if (openPosRaw?.length) CACHE.openpositions = openPosRaw;
  if (closedRaw?.length) CACHE.closedtrades = closedRaw;

  CACHE.lastUpdate = Date.now();
}

setInterval(updateCache, 1000);
console.log("⏳ Loading MT5 data...");
updateCache();
console.log("✅ MT5 cache ready (local polling active)");

// ============================================================================
// TIMEFRAME MAPPER
// ============================================================================

function mapTF(raw, key) {

  if (!raw) return null;

  return {
    M1: num(raw[`${key}_m1`]),
    M5: num(raw[`${key}_m5`]),
    M15: num(raw[`${key}_m15`]),
    M30: num(raw[`${key}_m30`]),
    H1: num(raw[`${key}_h1`]),
    H4: num(raw[`${key}_h4`]),
    D1: num(raw[`${key}_d1`]),
    W1: num(raw[`${key}_w1`]),
    MN: num(raw[`${key}_mn`])
  };
}

// ============================================================================
// AGENT PUSH (remote user pushes CSV data)
// ============================================================================

app.post("/api/agent/push", (req, res) => {
  const token = req.headers["x-agent-token"];
  if (!token || !tokenToEmail(token)) {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }

  const { account, asset, indicators, macro, scan, openpositions, closedtrades } = req.body ?? {};

  AGENTS_CACHE[token] = {
    account:       account ?? null,
    asset:         asset ?? null,
    indicators:    indicators ?? null,
    macro:         macro ?? null,
    scan:          scan ?? [],
    openpositions: openpositions ?? [],
    closedtrades:  closedtrades ?? [],
    lastUpdate:    Date.now(),
  };

  res.json({ status: "OK" });
});

// ============================================================================
// AGENT ORDERS (remote user polls for pending commands)
// ============================================================================

app.get("/api/agent/orders", (req, res) => {
  const token = req.query.token || req.headers["x-agent-token"];
  if (!token || !tokenToEmail(token)) {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }

  const orders = AGENTS_QUEUE[token] ?? [];
  AGENTS_QUEUE[token] = [];

  res.json({ orders });
});

// ============================================================================
// RESOLVE USER CACHE (from Cloudflare Access email header)
// ============================================================================

function resolveEmail(req) {
  // 1. Cloudflare Access header (production)
  const cfEmail = req.headers["cf-access-authenticated-user-email"];
  if (cfEmail) return cfEmail;

  // 2. Decode CF_Authorization JWT cookie (no signature verification)
  const cfJwt = req.cookies?.CF_Authorization;
  if (cfJwt) {
    try {
      const claims = decodeJwt(cfJwt);
      if (claims.email) return claims.email;
    } catch (err) {
      console.error("[resolveEmail] JWT decode error:", err.message);
    }
  }

  // 3. Test/dev fallback header
  const devEmail = req.headers["x-user-email"];
  if (devEmail) return devEmail;

  return null;
}

function isOwner(email) {
  return email && email.toLowerCase() === OWNER_EMAIL;
}

function resolveUserCache(req) {
  const email = resolveEmail(req);

  // Owner always uses local CACHE
  if (isOwner(email)) {
    console.log(`[resolveUser] email=${email} → OWNER LOCAL`);
    return { cache: CACHE, token: null, email, remote: false };
  }

  const token = email ? emailToToken(email) : null;

  if (token && AGENTS_CACHE[token]) {
    console.log(`[resolveUser] email=${email} token=${token} → REMOTE`);
    return { cache: AGENTS_CACHE[token], token, email, remote: true };
  }

  console.log(`[resolveUser] email=${email ?? "none"} token=${token ?? "none"} → LOCAL fallback`);
  return { cache: CACHE, token: null, email: email ?? null, remote: false };
}

function resolveUserToken(req) {
  const email = resolveEmail(req);

  // Owner always writes locally, never to AGENTS_QUEUE
  if (isOwner(email)) return { token: null, email };

  if (email) {
    const token = emailToToken(email);
    if (token) return { token, email };
  }
  return { token: null, email: email ?? null };
}

// ============================================================================
// MAIN MATRIX API
// ============================================================================

app.get("/api/mt5data", (req, res) => {

  try {

    const { cache } = resolveUserCache(req);

    const accountRaw = cache.account;
    const assetRaw   = cache.asset;
    const indiRaw    = cache.indicators;
    const macroRaw   = cache.macro;
    const openPosRaw = cache.openpositions ?? [];

    const matrix = {

      time: {
        timestamp: num(accountRaw?.ms),
        cacheAge: Date.now() - (cache.lastUpdate || 0)
      },

      account: accountRaw && {
        balance: num(accountRaw.balance),
        equity: num(accountRaw.equity),
        marginUsed: num(accountRaw.margin),
        freeMargin: num(accountRaw.free_margin),
        marginLevel: num(accountRaw.margin_level),
        pnl: num(accountRaw.pnl)
      },

      openPositions: openPosRaw.map(p => {

        const spread  = num(p.spread);
        const pnl_pts = num(p.pnl_pts);
        const atr_h1  = num(p.atr_h1);
        const atr_h4  = num(p.atr_h4);
        const atr_d1  = num(p.atr_d1);

        return {
          ticket:   num(p.ticket),
          magic:    num(p.magic),
          symbol:   p.symbol,
          side:     p.side,
          open_time: p.open_time,
          intraday_change: num(p.intraday_change),
          lots:     num(p.lots),
          contract_size: num(p.contract_size),
          profit_currency: p.profit_currency,
          eur_rate: num(p.eur_rate),
          notional: num(p.notional),
          notional_eur: num(p.notional_eur),
          pnl_eur:  num(p.pnl_eur),
          pnl_pts,
          spread,
          atr_h1,
          atr_h4,
          atr_d1,
          rsi_h1:   num(p.rsi_h1),
          pnl_spread:
            spread && spread > 0
              ? Math.round(pnl_pts / spread)
              : null,
          pnl_atr_h1:
            atr_h1 && atr_h1 > 0
              ? Number((pnl_pts / atr_h1).toFixed(2))
              : null,
          pnl_atr_h4:
            atr_h4 && atr_h4 > 0
              ? Number((pnl_pts / atr_h4).toFixed(2))
              : null,
          pnl_atr_d1:
            atr_d1 && atr_d1 > 0
              ? Number((pnl_pts / atr_d1).toFixed(2))
              : null
        };
      }),

      asset: assetRaw && {
        symbol:       assetRaw.symbol,
        asset_class:  assetRaw.assetclass ?? assetRaw.asset_class ?? null,
        digits:       num(assetRaw.digits),
        bid:          num(assetRaw.bid),
        ask:          num(assetRaw.ask),
        spread:       num(assetRaw.spread),
        intraday_change: num(assetRaw.intraday_change),
        atr_m15_weighted: num(assetRaw.atr_m15_weighted),
        volume_min:   num(assetRaw.volume_min),
        volume_max:   num(assetRaw.volume_max),
        volume_step:  num(assetRaw.volume_step),
        contract_size: num(assetRaw.contract_size),
        tick_size:    num(assetRaw.tick_size),
        tick_value:   num(assetRaw.tick_value),
        stops_level:  num(assetRaw.stops_level),
        ts:           assetRaw.ts,
        ms:           num(assetRaw.ms)
      },

      indicators: indiRaw && {
        rsi:      mapTF(indiRaw, "rsi"),
        rsiSlope: mapTF(indiRaw, "rsislope"),
        atr:      mapTF(indiRaw, "atr"),
        range:    mapTF(indiRaw, "range"),
        high:     mapTF(indiRaw, "high"),
        low:      mapTF(indiRaw, "low")
      },

      macro: macroRaw && {
        slots: Array.from({ length: 6 }, (_, i) => ({
          symbol:          macroRaw[`symbol_${i}`],
          bid:             num(macroRaw[`bid_${i}`]),
          intraday_change: num(macroRaw[`intraday_change_${i}`])
        }))
      },

      marketWatch: (cache.scan ?? [])
        .filter(r => r.symbol)
        .map(r => ({
          symbol:          r.symbol,
          assetclass:      r.assetclass || null,
          price:           num(r.price),
          close:           num(r.close),
          intraday_change: num(r.intraday_change),
          rsi_h1:          num(r.rsi_h1),
          slope_h1:        num(r.slope_h1),
          dslope_h1:       num(r.dslope_h1),
          zscore_h1:       num(r.zscore_h1),
          dz_h1:           num(r.dz_h1),
          atr_h1:          num(r.atr_h1),
          rsi_m5:          num(r.rsi_m5),
          slope_m5:        num(r.slope_m5),
          dslope_m5:       num(r.dslope_m5),
          zscore_m5:       num(r.zscore_m5),
          drsi_m5:         num(r.drsi_m5),
          rsi_h1_min5:     num(r.rsi_h1_min5),
          rsi_h1_max5:     num(r.rsi_h1_max5),
          atr_m15:         num(r.atr_m15),
          spread:          num(r.spread),
        }))
    };

    res.json(matrix);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "MATRIX_API_ERROR" });
  }
});

// ============================================================================
// CLOSED TRADES API
// ============================================================================

app.get("/api/closedtrades", (req, res) => {
  try {
    const { cache } = resolveUserCache(req);
    const raw = cache.closedtrades ?? [];

    const trades = raw.map(t => ({
      ticket:     num(t.ticket),
      symbol:     t.symbol,
      side:       t.side,
      lots:       num(t.lots),
      open_price: num(t.open_price),
      pnl_eur:    num(t.pnl_eur),
      commission: num(t.commission),
      swap:       num(t.swap),
      close_time: t.close_time,
    }));

    res.json({ trades });

  } catch (err) {
    console.error("CLOSED TRADES API ERROR:", err);
    res.status(500).json({ error: "CLOSED_TRADES_ERROR" });
  }
});

// ============================================================================
// WHOAMI
// ============================================================================

app.get("/api/whoami", (req, res) => {
  const email = resolveEmail(req);
  const token = email ? emailToToken(email) : null;
  const hasCache = token ? !!AGENTS_CACHE[token] : false;

  res.json({
    email:    email ?? "none",
    token:    token ? `${token.slice(0, 12)}...` : "none",
    source:   req.headers["cf-access-authenticated-user-email"]
                ? "cf-header"
                : req.cookies?.CF_Authorization
                  ? "cf-jwt"
                  : req.headers["x-user-email"]
                    ? "x-user-email"
                    : "none",
    hasCache,
  });
});

// ============================================================================
// DEBUG CACHE
// ============================================================================

app.get("/api/debug/cache", (req, res) => {
  res.json({
    lastUpdate:    CACHE.lastUpdate,
    cacheAge:      Date.now() - (CACHE.lastUpdate || 0),
    scanRows:      CACHE.scan?.length ?? 0,
    openPositions: CACHE.openpositions?.length ?? 0,
    closedTrades:  CACHE.closedtrades?.length ?? 0,
  });
});



// ============================================================================
// MT5 ORDER EXECUTION (write to local CSV)
// ============================================================================

app.post("/api/mt5order", (req, res) => {
  try {
    const { symbol, side, lots, sl, tp, tf, source, timestamp } = req.body ?? {};

    if (!symbol || !side || !Number.isFinite(lots) || !Number.isFinite(sl) || !Number.isFinite(tp)) {
      return res.status(400).json({ error: "INVALID_ORDER_PAYLOAD", payload: req.body });
    }

    if (side !== "BUY" && side !== "SELL") {
      return res.status(400).json({ error: "INVALID_SIDE", side });
    }

    const order = {
      symbol, side, lots, sl, tp,
      tf:        tf ?? null,
      source:    source ?? "NEO_MATRIX",
      timestamp: timestamp ?? Date.now()
    };

    const { token } = resolveUserToken(req);

    if (token) {
      // Remote user: queue command for agent pickup
      if (!AGENTS_QUEUE[token]) AGENTS_QUEUE[token] = [];
      AGENTS_QUEUE[token].push({ action: "ORDER", payload: order });
    } else {
      // Local fallback: write directly
      const filePath = path.join(MT5_DIR, "neo_order.json");
      fs.writeFileSync(filePath, JSON.stringify(order));
    }

    res.json({ status: "OK", message: "Order queued", order });

  } catch (err) {
    console.error("MT5 ORDER API ERROR:", err);
    res.status(500).json({ error: "MT5_ORDER_BRIDGE_ERROR" });
  }
});

// ============================================================================
// MT5 CLOSE POSITION (write to local CSV)
// ============================================================================

app.post("/api/mt5close", (req, res) => {
  try {
    const { ticket, symbol, volume } = req.body ?? {};

    if (!ticket) {
      return res.status(400).json({ error: "INVALID_CLOSE_PAYLOAD", reason: "Missing ticket", payload: req.body });
    }

    const closeCmd = {
      action:    "CLOSE",
      ticket:    Number(ticket),
      volume:    volume ?? null,
      source:    "NEO_MATRIX",
      timestamp: Date.now()
    };

    if (symbol) closeCmd.symbol = symbol;

    const { token } = resolveUserToken(req);

    if (token) {
      if (!AGENTS_QUEUE[token]) AGENTS_QUEUE[token] = [];
      AGENTS_QUEUE[token].push({ action: "CLOSE", payload: closeCmd });
    } else {
      const filePath = path.join(MT5_DIR, "neo_close.json");
      fs.writeFileSync(filePath, JSON.stringify(closeCmd));
    }

    res.json({ status: "OK", message: "Close queued", closeCmd });

  } catch (err) {
    console.error("MT5 CLOSE API ERROR:", err);
    res.status(500).json({ error: "MT5_CLOSE_BRIDGE_ERROR" });
  }
});

// ============================================================================
// MT5 SYMBOL SWITCH (write to local CSV)
// ============================================================================

app.post("/api/mt5switch", (req, res) => {
  try {
    const { symbol } = req.body ?? {};

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "INVALID_SYMBOL", payload: req.body });
    }

    const { token, email } = resolveUserToken(req);

    if (token) {
      if (!AGENTS_QUEUE[token]) AGENTS_QUEUE[token] = [];
      AGENTS_QUEUE[token].push({ action: "SWITCH", payload: { symbol: symbol.trim() } });
      console.log(`[mt5switch] email=${email} token=${token} symbol=${symbol} → AGENTS_QUEUE`);
    } else {
      const filePath = path.join(MT5_DIR, "neo_symbol.txt");
      fs.writeFileSync(filePath, symbol.trim());
      console.log(`[mt5switch] email=${email ?? "none"} token=none symbol=${symbol} → LOCAL file`);
    }

    res.json({ status: "OK", message: "Switch queued", symbol });

  } catch (err) {
    console.error("MT5 SWITCH API ERROR:", err);
    res.status(500).json({ error: "MT5_SWITCH_ERROR" });
  }
});

// ============================================================================
// SIGNALS STORE (persistent signal state)
// ============================================================================

const signalFrequency = {}; // keyed by token
const signalsStore = {};    // keyed by token

function getSignalKey(req) {
  const { token } = resolveUserToken(req);
  return token ?? "owner";
}

function ensureSignalBuckets(key) {
  signalFrequency[key] = signalFrequency[key] ?? {};
  signalsStore[key] = signalsStore[key] ?? { validOpportunities: [], waitOpportunities: [], lastUpdate: 0 };
}

// POST /api/signals/publish — called by useRobotCore via frontend
app.post("/api/signals/publish", (req, res) => {
  const key = getSignalKey(req);
  ensureSignalBuckets(key);

  const { validOpportunities = [], waitOpportunities = [] } = req.body;
  const now = Date.now();

  // Keep only fresh signals (< 60s)
  const fresh = validOpportunities.filter(op => op.emittedAt && (now - op.emittedAt) < 30000);

  // Update frequency map for each valid signal
  for (const op of fresh) {
    if (op.symbol) signalFrequency[key][op.symbol] = now;
  }

  signalsStore[key].validOpportunities = fresh;
  signalsStore[key].waitOpportunities = waitOpportunities;
  signalsStore[key].lastUpdate = now;

  res.json({ ok: true, valid: fresh.length, wait: waitOpportunities.length });
});

// GET /api/signals — returns current signal store for user
app.get("/api/signals", (req, res) => {
  const key = getSignalKey(req);
  ensureSignalBuckets(key);
  res.json(signalsStore[key]);
});

// GET /api/signals/frequency — returns frequency map for user
app.get("/api/signals/frequency", (req, res) => {
  const key = getSignalKey(req);
  ensureSignalBuckets(key);
  res.json(signalFrequency[key]);
});

// ============================================================================
// STATIC FRONTEND (Vite build)
// ============================================================================

const __root = path.resolve();
app.use(express.static(path.join(__root, "dist")));
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__root, "dist", "index.html"));
});

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ NEO MATRIX API running on http://localhost:${PORT}`);
  console.log("🔥 Background polling active (1s)");
});
