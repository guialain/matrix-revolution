import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { decodeJwt } from "jose";
import Anthropic from "@anthropic-ai/sdk";
import nodeFetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import { getRiskConfig } from "./src/components/robot/engines/config/RiskConfig.js";
import { INTRADAY_CONFIG } from "./src/components/robot/engines/config/IntradayConfig.js";
const ALLOWED_SYMBOLS = [
  "EURUSD", "AUDUSD", "GBPUSD", "USDJPY", "USDCHF", "EURJPY", "GBPJPY", "AUDJPY",
  "GERMANY_40", "UK_100", "US_30", "US_500", "US_TECH100", "JAPAN_225",
  "BTCUSD", "BTCEUR", "BTCJPY", "ETHUSD",
  "GOLD", "SILVER",
  "CrudeOIL", "BRENT_OIL", "GASOLINE",
  "WHEAT",
];

// Use native fetch if available (Node 18+), otherwise node-fetch
const _fetch = globalThis.fetch ?? nodeFetch;

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

    const content = fs.readFileSync(filePath, "utf8").replace(/\0/g, "").trim();
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

    const content = fs.readFileSync(filePath, "utf8").replace(/\0/g, "").trim();
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

let lastScanTimestamp = null;        // gate: only update scan on new timestamp (~5s)

function updateCache() {

  const accountRaw     = readLastRowCSV(path.join(MT5_DIR, FILES.account));
  const assetRaw       = readLastRowCSV(path.join(MT5_DIR, FILES.asset));
  const indiRaw        = readLastRowCSV(path.join(MT5_DIR, FILES.indicators));
  const macroRaw       = readLastRowCSV(path.join(MT5_DIR, FILES.macro));
  const scanRaw        = readAllRowsCSV(path.join(MT5_DIR, FILES.scan));
  const openPosRaw     = readAllRowsCSV(path.join(MT5_DIR, FILES.openpositions));
  const closedRaw      = readAllRowsCSV(path.join(MT5_DIR, FILES.closedtrades));

  CACHE.account       = accountRaw;
  CACHE.asset         = assetRaw;
  CACHE.indicators    = indiRaw;
  CACHE.macro         = macroRaw;

  // Scan: only update when timestamp changes (~5s refresh from EA)
  const newTs = scanRaw?.[0]?.timestamp ?? null;
  if (newTs && newTs !== lastScanTimestamp) {
    CACHE.scan = scanRaw ?? [];
    lastScanTimestamp = newTs;
  }

  CACHE.openpositions = openPosRaw ?? [];
  CACHE.closedtrades  = closedRaw ?? [];

  CACHE.lastUpdate = Date.now();
}

setInterval(updateCache, 1000);
console.log("⏳ Loading MT5 data...");
updateCache();
console.log("✅ MT5 cache ready (local polling active)");

// ============================================================================
// TRAILING STOP (background, runs every 1s)
// Requires neo_openpositions.csv to expose `sl` column for full comparison.
// Until then, uses an in-process cache of last written SL per ticket.
// ============================================================================

const TRAILING_CACHE = {}; // { ticket: lastWrittenSL }

function runTrailingStop() {
  try {
    const positions = CACHE.openpositions ?? [];
    const scan      = CACHE.scan ?? [];
    if (!positions.length || !scan.length) return;

    const scanBySymbol = Object.fromEntries(
      scan.filter(r => r.symbol).map(r => [r.symbol, r])
    );

    for (const pos of positions) {
      const ticket = num(pos.ticket);
      const symbol = pos.symbol;
      const side   = pos.side;
      if (!ticket || !symbol || (side !== "BUY" && side !== "SELL")) continue;

      const scanRow = scanBySymbol[symbol];
      if (!scanRow) continue;

      const price  = num(scanRow.price);
      const atr_h1 = num(scanRow.atr_h1);
      if (!price || !atr_h1) continue;

      const config = getRiskConfig(symbol);
      const slAtr  = config?.slAtr;
      if (!slAtr) continue;

      const digits = num(scanRow.digits) ?? 5;
      const rawSL  = side === "BUY"
        ? price - atr_h1 * slAtr
        : price + atr_h1 * slAtr;
      const newSL  = Number(rawSL.toFixed(digits));

      // currentSL from CSV if exported, fallback to last written value
      const csvSL    = num(pos.sl) ?? 0;
      const lastSL   = TRAILING_CACHE[ticket] ?? csvSL;

      const improves = side === "BUY"
        ? newSL > lastSL
        : (lastSL === 0 || newSL < lastSL);

      if (!improves) continue;

      TRAILING_CACHE[ticket] = newSL;

      const modifyCmd = {
        action:    "MODIFY",
        ticket,
        symbol,
        sl:        newSL,
        source:    "NEO_TRAILING",
        timestamp: Date.now(),
      };

      const filePath = path.join(MT5_DIR, `neo_modify_${ticket}.json`);
      fs.writeFileSync(filePath, JSON.stringify(modifyCmd));
      console.log(`[TRAILING] ${symbol} ${side} ticket=${ticket} newSL=${newSL}`);
    }

    // Cleanup: remove closed tickets from cache
    const activeTickets = new Set(
      positions.map(p => num(p.ticket)).filter(Boolean)
    );
    for (const t of Object.keys(TRAILING_CACHE)) {
      if (!activeTickets.has(Number(t))) delete TRAILING_CACHE[t];
    }
  } catch (err) {
    console.error("[TRAILING_STOP] Error:", err.message);
  }
}

setInterval(runTrailingStop, 1000);

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
          timestamp:       r.timestamp || null,
          symbol:          r.symbol,
          assetclass:      r.assetclass || null,
          price:           num(r.price),
          close:           num(r.close),
          intraday_change: num(r.intraday_change),
          // D1
          rsi_d1:          num(r.rsi_d1),
          slope_d1:        num(r.slope_d1),
          dslope_d1:       num(r.dslope_d1),
          drsi_d1:         num(r.drsi_d1),
          rsi_d1_s0:       num(r.rsi_d1_s0),
          slope_d1_s0:     num(r.slope_d1_s0),
          drsi_d1_s0:      num(r.drsi_d1_s0),
          // H4
          rsi_h4:          num(r.rsi_h4),
          slope_h4:        num(r.slope_h4),
          dslope_h4:       num(r.dslope_h4),
          zscore_h4:       num(r.zscore_h4),
          dz_h4:           num(r.dz_h4),
          drsi_h4:         num(r.drsi_h4),
          rsi_h4_s0:       num(r.rsi_h4_s0),
          slope_h4_s0:     num(r.slope_h4_s0),
          drsi_h4_s0:      num(r.drsi_h4_s0),
          zscore_h4_s0:    num(r.zscore_h4_s0),
          // H1
          rsi_h1:          num(r.rsi_h1),
          slope_h1:        num(r.slope_h1),
          dslope_h1:       num(r.dslope_h1),
          zscore_h1:       num(r.zscore_h1),
          dz_h1:           num(r.dz_h1),
          drsi_h1:         num(r.drsi_h1),
          rsi_h1_s0:       num(r.rsi_h1_s0),
          slope_h1_s0:     num(r.slope_h1_s0),
          drsi_h1_s0:      num(r.drsi_h1_s0),
          zscore_h1_s0:    num(r.zscore_h1_s0),
          atr_h1:          num(r.atr_h1),
          rsi_h1_previouslow3:  num(r.rsi_h1_previouslow3),
          rsi_h1_previoushigh3: num(r.rsi_h1_previoushigh3),
          zscore_h1_min3:       num(r.zscore_h1_min3),
          zscore_h1_max3:       num(r.zscore_h1_max3),
          range_h1_s0:          num(r.range_h1_s0),
          range_ratio_h1:       num(r.range_ratio_h1),
          // M15
          rsi_m15:         num(r.rsi_m15),
          slope_m15:       num(r.slope_m15),
          dslope_m15:      num(r.dslope_m15),
          zscore_m15:      num(r.zscore_m15),
          drsi_m15:        num(r.drsi_m15),
          rsi_m15_s0:      num(r.rsi_m15_s0),
          slope_m15_s0:    num(r.slope_m15_s0),
          drsi_m15_s0:     num(r.drsi_m15_s0),
          zscore_m15_s0:   num(r.zscore_m15_s0),
          // M5
          rsi_m5:          num(r.rsi_m5),
          slope_m5:        num(r.slope_m5),
          dslope_m5:       num(r.dslope_m5),
          zscore_m5:       num(r.zscore_m5),
          drsi_m5:         num(r.drsi_m5),
          rsi_m5_s0:       num(r.rsi_m5_s0),
          slope_m5_s0:     num(r.slope_m5_s0),
          drsi_m5_s0:      num(r.drsi_m5_s0),
          zscore_m5_s0:    num(r.zscore_m5_s0),
          // Meta
          atr_m15:         num(r.atr_m15),
          spread:          num(r.spread),
          spread_points:   num(r.spread_points),
          tick_size:       num(r.tick_size),
          digits:          num(r.digits),
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
      ticket:      num(t.ticket),
      symbol:      t.symbol,
      side:        t.side,
      lots:        num(t.lots),
      open_price:  num(t.open_price),
      close_price: num(t.close_price),
      pnl_eur:     num(t.pnl_eur),
      commission:  num(t.commission),
      swap:        num(t.swap),
      open_time:   t.open_time,
      close_time:  t.close_time,
      position_id: num(t.position_id),
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
    const { symbol, side, lots, sl, tp, slDist, tpDist, tf, source, timestamp } = req.body ?? {};

    if (!symbol || !side || !Number.isFinite(lots) || !Number.isFinite(sl) || !Number.isFinite(tp)) {
      return res.status(400).json({ error: "INVALID_ORDER_PAYLOAD", payload: req.body });
    }

    if (side !== "BUY" && side !== "SELL") {
      return res.status(400).json({ error: "INVALID_SIDE", side });
    }

    const order = {
      symbol, side, lots, sl, tp,
      slDist:    Number.isFinite(slDist) ? slDist : null,
      tpDist:    Number.isFinite(tpDist) ? tpDist : null,
      tf:        tf ?? null,
      source:    source ?? "NEO_MATRIX",
      timestamp: timestamp ?? Date.now()
    };

    const { token, email } = resolveUserToken(req);

    if (token) {
      // Remote user: queue command for agent pickup
      if (!AGENTS_QUEUE[token]) AGENTS_QUEUE[token] = [];
      AGENTS_QUEUE[token].push({ action: "ORDER", payload: order });
      console.log(`[MT5ORDER] QUEUED for agent | email=${email} token=${token.slice(0,8)}… | ${side} ${symbol}`);
      res.json({ status: "OK", mode: "AGENT_QUEUE", email, order });
    } else {
      // Local: write file matching EA glob neo_order_*.json
      const filePath = path.join(MT5_DIR, `neo_order_${Date.now()}.json`);
      fs.writeFileSync(filePath, JSON.stringify(order));
      console.log(`[MT5ORDER] LOCAL file written | email=${email ?? "owner"} | ${side} ${symbol}`);
      res.json({ status: "OK", mode: "LOCAL_FILE", email, order });
    }

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

    const { token, email } = resolveUserToken(req);

    if (token) {
      if (!AGENTS_QUEUE[token]) AGENTS_QUEUE[token] = [];
      AGENTS_QUEUE[token].push({ action: "CLOSE", payload: closeCmd });
      console.log(`[MT5CLOSE] QUEUED for agent | email=${email} token=${token.slice(0,8)}… | ticket=${ticket}`);
      res.json({ status: "OK", mode: "AGENT_QUEUE", email, closeCmd });
    } else {
      const filePath = path.join(MT5_DIR, `neo_close_${Date.now()}.json`);
      fs.writeFileSync(filePath, JSON.stringify(closeCmd));
      console.log(`[MT5CLOSE] LOCAL file written | email=${email ?? "owner"} | ticket=${ticket}`);
      res.json({ status: "OK", mode: "LOCAL_FILE", email, closeCmd });
    }

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
  const existing = signalsStore[key].validOpportunities;

  // Preserve original emittedAt — don't reset on re-publish
  const fresh = validOpportunities.map(op => {
    const prev = existing.find(e => e.symbol === op.symbol && e.side === op.side);
    return {
      ...op,
      emittedAt: prev?.emittedAt ?? op.emittedAt ?? now
    };
  }).filter(op => op.emittedAt && (now - op.emittedAt) < 30000);

  signalsStore[key].validOpportunities = fresh;
  signalsStore[key].waitOpportunities = waitOpportunities;
  signalsStore[key].lastUpdate = now;

  res.json({ ok: true, valid: fresh.length, wait: waitOpportunities.length });
});

// GET /api/signals — returns current signal store for user (TTL 30s)
// ============================================================================
// NEWS — RSS proxy (Reuters)
// ============================================================================

const NEWS_FEEDS = [
  "https://www.financialjuice.com/feed.ashx?xy=rss",
  "https://feeds.reuters.com/reuters/businessNews",
  "https://feeds.reuters.com/reuters/topNews",
];

let newsCache = { items: [], fetchedAt: 0 };

const xmlParser = new XMLParser({ ignoreAttributes: false, cdataPropName: "__cdata" });

function parseRSS(xml) {
  try {
    const doc   = xmlParser.parse(xml);
    const rawItems = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
    const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
    return arr.map(it => ({
      title:   (it.title?.__cdata ?? it.title ?? "").toString().trim(),
      link:    (it.link?.__cdata  ?? it.link  ?? "").toString().trim(),
      pubDate: (it.pubDate ?? it.updated ?? it["dc:date"] ?? "").toString().trim(),
    })).filter(it => it.title);
  } catch (e) {
    console.error("[parseRSS]", e.message);
    return [];
  }
}

app.get("/api/news", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const now = Date.now();
    if (now - newsCache.fetchedAt < 55_000) {
      return res.json({ items: newsCache.items, fetchedAt: newsCache.fetchedAt });
    }

    let items = [];
    for (const feed of NEWS_FEEDS) {
      try {
        const r = await _fetch(feed, { headers: { "User-Agent": "Mozilla/5.0" } });
        console.log(`[/api/news] ${feed} → ${r.status}`);
        if (!r.ok) continue;
        const xml = await r.text();
        console.log(`[/api/news] XML length=${xml.length} preview=${xml.slice(0, 120)}`);
        const parsed = parseRSS(xml);
        console.log(`[/api/news] parsed=${parsed.length} items`);
        if (parsed.length) { items = parsed; break; }
      } catch (e) {
        console.error(`[/api/news] fetch error ${feed}:`, e.message);
        continue;
      }
    }

    items = items.slice(0, 20);
    newsCache = { items, fetchedAt: now };
    res.json({ items, fetchedAt: now });
  } catch (err) {
    console.error("[/api/news] fatal:", err.message);
    res.json({ items: [], fetchedAt: 0, error: err.message });
  }
});

app.get("/api/signals", (req, res) => {
  const key = getSignalKey(req);
  ensureSignalBuckets(key);
  const now = Date.now();
  const store = signalsStore[key];
  res.json({
    ...store,
    validOpportunities: (store.validOpportunities ?? []).filter(op => op.emittedAt && (now - op.emittedAt) < 30000),
  });
});

// GET /api/signals/frequency — returns frequency map for user
app.get("/api/signals/frequency", (req, res) => {
  const key = getSignalKey(req);
  ensureSignalBuckets(key);
  res.json(signalFrequency[key]);
});

// POST /api/signals/cooldown — record trade cooldown after real execution
app.post("/api/signals/cooldown", (req, res) => {
  const key = getSignalKey(req);
  ensureSignalBuckets(key);
  const { symbol } = req.body ?? {};
  if (!symbol) return res.status(400).json({ error: "MISSING_SYMBOL" });
  signalFrequency[key][symbol] = Date.now();
  res.json({ ok: true, symbol });
});

// ============================================================================
// TRADING MODE (MANUAL / AUTO — persisted per user)
// ============================================================================

const tradingMode = {};  // { key: "MANUAL" | "AUTO" }

app.get("/api/trading-mode", (req, res) => {
  const key = getSignalKey(req);
  res.json({ mode: tradingMode[key] ?? "MANUAL" });
});

app.post("/api/trading-mode", (req, res) => {
  const key = getSignalKey(req);
  const { mode } = req.body ?? {};
  if (mode !== "MANUAL" && mode !== "AUTO") {
    return res.status(400).json({ error: "INVALID_MODE" });
  }
  tradingMode[key] = mode;
  console.log(`[trading-mode] key=${key} → ${mode}`);
  res.json({ mode });
});

// ============================================================================
// STATIC FRONTEND (Vite build)
// ============================================================================
// CLAUDE API — /api/claude
// Body: { messages, context: { marketData, signals, account, openPositions } }
// ============================================================================

function formatIntradayConfig(symbol) {
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  return (
    `SPIKE_DOWN<${cfg.spikeDown}% | ` +
    `EXP_DOWN[${cfg.explosiveDown},${cfg.spikeDown}] | ` +
    `STR_DOWN[${cfg.strongDown},${cfg.explosiveDown}] | ` +
    `SOFT_DOWN[${cfg.softDown},${cfg.strongDown}] | ` +
    `NEUTRE[${cfg.softDown},${cfg.softUp}] | ` +
    `SOFT_UP[${cfg.softUp},${cfg.strongUp}] | ` +
    `STR_UP[${cfg.strongUp},${cfg.explosiveUp}] | ` +
    `EXP_UP[${cfg.explosiveUp},${cfg.spikeUp}] | ` +
    `SPIKE_UP>${cfg.spikeUp}%`
  );
}

function getIntradayRegime(intra, symbol) {
  if (intra === null || intra === undefined) return "NEUTRE";
  const cfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
  if (intra >  cfg.spikeUp)       return "SPIKE_UP";
  if (intra >= cfg.explosiveUp)   return "EXPLOSIVE_UP";
  if (intra >= cfg.strongUp)      return "STRONG_UP";
  if (intra >= cfg.softUp)        return "SOFT_UP";
  if (intra >  cfg.softDown)      return "NEUTRE";
  if (intra >  cfg.strongDown)    return "SOFT_DOWN";
  if (intra >  cfg.explosiveDown) return "STRONG_DOWN";
  if (intra >  cfg.spikeDown)     return "EXPLOSIVE_DOWN";
  return "SPIKE_DOWN";
}

const CLAUDE_SYSTEM = `You are NEO, an expert trading assistant embedded in a live MT5 trading terminal.
You have access to real-time market data, active trading signals, account state, and open positions.
Be concise, precise, and actionable. Use trading terminology. Answer in the same language as the user.
Never use markdown formatting: no bold, no italics, no headers, no bullet lists, no code blocks. Plain text only — your responses are read aloud by a text-to-speech engine.

## RÈGLES TP/SL
- TP = tpAtr × atr_h1  (tpAtr par asset, visible dans chaque signal)
- SL = slAtr × atr_h1  (slAtr par asset, visible dans chaque signal)
- Défauts si asset inconnu : tpAtr=0.50 slAtr=1.65
- Valeurs TP/SL pré-calculées et affichées dans chaque ligne de signal
- range_ratio_h1 > 0.8 → late entry (H1 bar >80% consumed) — wait next bar

## D1STATE GUIDE
- D1_BUY  : slope_d1_s0 > 0.5  AND rsi_d1 > 52
- D1_SELL : slope_d1_s0 < -0.5 AND rsi_d1 < 48
- D1_FLAT : otherwise (trend uncertain)

## INTRADAY RÉGIMES (9 niveaux, calibrés par asset)
Les seuils IC sont fournis dans chaque signal sous IC_seuils.
Le régime IC actuel est fourni sous IC_regime dans marketData.
Utilise ces valeurs pour évaluer la force du mouvement intraday
par rapport aux percentiles historiques de l'asset.

Exemples d'interprétation :
- IC=+0.15% sur EURUSD (softUp=0.11, strongUp=0.19) → SOFT_UP ✅
- IC=-2.36% sur CrudeOIL (strongDown=-0.85) → EXPLOSIVE_DOWN ⚠️
- IC=+0.05% sur EURUSD → NEUTRE (entre softDown et softUp)

## ROUTE GUIDE (H1 bar patterns)
- BUY-[28-50]       : reversal zone — rsi_h1_s0 28-50, zscore_h1_s0 ≤ -0.5
- BUY-[50-72]       : continuation zone — rsi_h1_s0 50-72, dslope_h1 > 0.5
- SELL-[50-72]      : continuation zone — rsi_h1_s0 50-72, dslope_h1 < -0.5
- SELL-[28-50]      : reversal zone — rsi_h1_s0 28-50, zscore_h1_s0 ≥ 0.5
- CONT-RESUME       : trend resuming after pause — dslope_h1 acceleration > 1.5
- EXHAUSTION=true   : counter-trend spike detected — higher reversal conviction

## SIGNAL QUALITY
- score 0-100: composite of slope + dslope + zscore + RSI depth + intraday + volatility bonus
- mode: UPTREND / DOWNTREND / REVERSAL / NEUTRAL
- volatilityLevel: LOW / MED / HIGH
- contResume=true → trend consolidation resolved, momentum restarting

## RESPONSE FORMAT
When commenting on a signal or asset, structure: [SYMBOL SIDE TYPE] route=X d1=Y score=Z — analysis in 1-2 sentences.`;


app.post("/api/claude", async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    const anthropic = new Anthropic({ apiKey });
    const { messages = [], context = {} } = req.body ?? {};

    const { marketData = [], signals = [], waitOpportunities = [], account = {}, openPositions = [] } = context;

    let recentNews = [];
    try {
      const nr = await _fetch("http://localhost:3001/api/news");
      if (nr.ok) {
        const nd = await nr.json();
        recentNews = (nd.items ?? []).slice(0, 10);
      }
    } catch (_) { /* news unavailable */ }
    const fmtPubDate = s => {
      if (!s) return "";
      const d = new Date(s);
      if (isNaN(d)) return s.slice(0, 16);
      return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    };
    const newsBlock = recentNews.length
      ? recentNews.map(n => `${fmtPubDate(n.pubDate)} - ${(n.title ?? "").replace(/^FinancialJuice:\s*/i, "")}`).join("\n")
      : "Aucune news disponible";

    const f2  = v => v != null ? Number(v).toFixed(2) : "—";
    const f1  = v => v != null ? Number(v).toFixed(1) : "—";
    const boo = v => v == null ? "—" : v ? "Y" : "n";

    const sigLines = signals.length
      ? signals.map(s => {
          const rc = getRiskConfig(s.symbol);
          const tp = s.atr_h1 != null ? (rc.tpAtr * s.atr_h1).toFixed(5) : "?";
          const sl = s.atr_h1 != null ? (rc.slAtr * s.atr_h1).toFixed(5) : "?";
          return (
            `  ${(s.symbol ?? "").padEnd(12)} ${(s.side ?? "").padEnd(5)} [${s.type ?? "?"}]` +
            ` score=${s.score ?? "—"} route=${s.route ?? "—"} d1=${s.d1State ?? "—"} mode=${s.mode ?? "—"}` +
            ` vol=${s.volatilityLevel ?? "—"} phase=${s.phase ?? "—"}` +
            ` | rsi_s0=${f1(s.rsi_h1_s0)} dsl=${f2(s.dslope_h1)} z_s0=${f2(s.zscore_h1_s0)}` +
            ` rr=${f2(s.range_ratio_h1)} atr=${f2(s.atr_h1)}` +
            ` tpAtr=${rc.tpAtr} slAtr=${rc.slAtr} TP=${tp} SL=${sl}` +
            ` | EXHST=${boo(s.exhaustion)} CONT-RES=${boo(s.contResume)} m5Conf=${s.m5Confidence ?? "—"}` +
            ` | IC_regime=${getIntradayRegime(s.intraday_change, s.symbol)} IC_val=${s.intraday_change ?? "—"}%` +
            ` IC_seuils: ${formatIntradayConfig(s.symbol)}`
          );
        }).join("\n")
      : "  None";

    const waitLines = waitOpportunities.length
      ? waitOpportunities.map(s =>
          `  ${(s.symbol ?? "").padEnd(12)} ${(s.side ?? "").padEnd(5)} [${s.type ?? "?"}]` +
          ` score=${s.score ?? "—"} wait=${s.waitState ?? "—"} route=${s.route ?? "—"} d1=${s.d1State ?? "—"}` +
          ` vol=${s.volatilityLevel ?? "—"}` +
          ` | rsi_s0=${f1(s.rsi_h1_s0)} dsl=${f2(s.dslope_h1)} z_s0=${f2(s.zscore_h1_s0)}` +
          ` rr=${f2(s.range_ratio_h1)}` +
          ` | EXHST=${boo(s.exhaustion)} CONT-RES=${boo(s.contResume)}`
        ).join("\n")
      : "  None";

    const mdFiltered = (marketData ?? []).filter(r => ALLOWED_SYMBOLS.includes(r.symbol));
    const mdLines = mdFiltered.map(r =>
      `  ${(r.symbol ?? "").padEnd(12)} intra=${f2(r.intraday_change)}% IC_regime=${getIntradayRegime(r.intraday_change, r.symbol)}` +
      ` atr=${f2(r.atr_h1)}` +
      ` | D1: rsi=${f1(r.rsi_d1)} sl_s0=${f2(r.slope_d1_s0)} dsl=${f2(r.dslope_d1)}` +
      ` | H4: rsi=${f1(r.rsi_h4)} sl=${f2(r.slope_h4)} sl_s0=${f2(r.slope_h4_s0)} dsl=${f2(r.dslope_h4)} z=${f2(r.zscore_h4)}` +
      ` | H1: rsi=${f1(r.rsi_h1)} rsi_s0=${f1(r.rsi_h1_s0)} sl_s0=${f2(r.slope_h1_s0)} dsl=${f2(r.dslope_h1)} z=${f2(r.zscore_h1)} z_s0=${f2(r.zscore_h1_s0)} rr=${f2(r.range_ratio_h1)}` +
      ` | M5s0: rsi=${f1(r.rsi_m5_s0)} sl=${f2(r.slope_m5_s0)} dsl=${f2(r.dslope_m5_s0)} z=${f2(r.zscore_m5_s0)}`
    ).join("\n");

    const contextBlock = [
      `## Dernières news macro (FinancialJuice) :`,
      newsBlock,
      ``,
      `## Account`,
      `Balance: ${account.balance ?? "—"} | Equity: ${account.equity ?? "—"} | Free Margin: ${account.free_margin ?? "—"}`,
      ``,
      `## Open Positions (${openPositions.length})`,
      openPositions.length
        ? openPositions.map(p => `  ${p.symbol} ${p.side} ${p.lots} lots | PnL: ${p.pnl_eur ?? "—"}€`).join("\n")
        : "  None",
      ``,
      `## Active Signals (${signals.length})`,
      sigLines,
      ``,
      `## Wait Signals (${waitOpportunities.length})`,
      waitLines,
      ``,
      `## Market Data (${mdFiltered.length} assets) — fields: D1(rsi,sl_s0,dsl) H4(rsi,sl,sl_s0,dsl,z) H1(rsi,rsi_s0,sl_s0,dsl,z,z_s0,rr) M5s0(rsi,sl,dsl,z)`,
      mdLines,
    ].join("\n");

    const systemPrompt = `${CLAUDE_SYSTEM}\n\n--- LIVE CONTEXT ---\n${contextBlock}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const content = response.content?.[0]?.text ?? "";
    res.json({ content });
  } catch (err) {
    console.error("[/api/claude]", err.message);
    res.status(500).json({ error: err.message });
  }
});

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
