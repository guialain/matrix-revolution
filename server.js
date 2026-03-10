import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ============================================================================
// NUM HELPER (safe number)
// ============================================================================

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ============================================================================
// AUTH TOKENS
// ============================================================================

const TOKENS = {
  LeloupTrader: "neo-leloup-x7k9m2",
  EricTrader:   "neo-eric-p4q8n1",
  NeoTrader:    "neo-neotrader-z3w6j5"
};

const TOKEN_TO_USER = Object.fromEntries(
  Object.entries(TOKENS).map(([uid, tok]) => [tok, uid])
);

function authMiddleware(req, res, next) {
  const key = req.headers["x-api-key"];
  const uid = TOKEN_TO_USER[key];
  if (!uid) return res.status(401).json({ error: "UNAUTHORIZED" });
  req.userId = uid;
  next();
}

// ============================================================================
// REMOTE STORE (per-user, populated via POST /api/push/:userId)
// ============================================================================

const STORE = {};

// ============================================================================
// MT5 LOCAL FILES (only if MT5_DIR exists on disk)
// ============================================================================

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/" +
  "9B101088254A9C260A9790D5079A7B11/MQL5/Files";

const MT5_LOCAL = fs.existsSync(MT5_DIR);

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
// GLOBAL CACHE (local MT5 only)
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
// CACHE UPDATE (background polling — local MT5 only)
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

if (MT5_LOCAL) {
  setInterval(updateCache, 1000);
  console.log("⏳ Loading MT5 data...");
  updateCache();
  console.log("✅ MT5 cache ready (local polling active)");
} else {
  console.log("ℹ️  MT5_DIR not found — local polling disabled, remote push only");
}

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
// DATA SOURCE RESOLVER (STORE[userId] or local CACHE)
// ============================================================================

function resolveSource(userId) {
  if (userId && STORE[userId]) return STORE[userId];
  return CACHE;
}

// ============================================================================
// POST /api/push/:userId — REMOTE DATA PUSH
// ============================================================================

app.post("/api/push/:userId", authMiddleware, (req, res) => {
  try {
    const { userId } = req.params;

    if (req.userId !== userId) {
      return res.status(403).json({ error: "FORBIDDEN", reason: "Token/userId mismatch" });
    }

    const { account, asset, indicators, macro, scan, openpositions, closedtrades } = req.body;

    STORE[userId] = {
      account:       account ?? null,
      asset:         asset ?? null,
      indicators:    indicators ?? null,
      macro:         macro ?? null,
      scan:          scan ?? [],
      openpositions: openpositions ?? [],
      closedtrades:  closedtrades ?? [],
      lastUpdate:    Date.now(),
    };

    res.json({ status: "OK", userId, ts: STORE[userId].lastUpdate });

  } catch (err) {
    console.error("PUSH API ERROR:", err);
    res.status(500).json({ error: "PUSH_ERROR" });
  }
});

// ============================================================================
// MAIN MATRIX API
// ============================================================================

app.get("/api/mt5data", (req, res) => {

  try {

    const src        = resolveSource(req.query.userId);
    const accountRaw = src.account;
    const assetRaw   = src.asset;
    const indiRaw    = src.indicators;
    const macroRaw   = src.macro;
    const openPosRaw = src.openpositions ?? [];

    const matrix = {

      time: {
        timestamp: num(accountRaw?.ms),
        cacheAge: Date.now() - (src.lastUpdate || 0)
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

      marketWatch: (src.scan ?? [])
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
    const src = resolveSource(req.query.userId);
    const raw = src.closedtrades ?? [];

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
// DEBUG CACHE
// ============================================================================

app.get("/api/debug/cache", (req, res) => {
  const src = resolveSource(req.query.userId);
  res.json({
    lastUpdate:    src.lastUpdate,
    cacheAge:      Date.now() - (src.lastUpdate || 0),
    scanRows:      src.scan?.length ?? 0,
    openPositions: src.openpositions?.length ?? 0,
    closedTrades:  src.closedtrades?.length ?? 0,
    storeUsers:    Object.keys(STORE),
  });
});

// ============================================================================
// MT5 ORDER EXECUTION (local only)
// ============================================================================

app.post("/api/mt5order", (req, res) => {
  try {
    if (!MT5_LOCAL) return res.status(503).json({ error: "MT5_NOT_AVAILABLE" });

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

    const filePath = path.join(MT5_DIR, "neo_order.json");
    fs.writeFileSync(filePath, JSON.stringify(order, null, 2), "utf8");

    res.json({ status: "OK", message: "Order forwarded to MT5", order });

  } catch (err) {
    console.error("MT5 ORDER API ERROR:", err);
    res.status(500).json({ error: "MT5_ORDER_BRIDGE_ERROR" });
  }
});

// ============================================================================
// MT5 CLOSE POSITION (local only)
// ============================================================================

app.post("/api/mt5close", (req, res) => {
  try {
    if (!MT5_LOCAL) return res.status(503).json({ error: "MT5_NOT_AVAILABLE" });

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

    const filePath = path.join(MT5_DIR, "neo_close.json");
    fs.writeFileSync(filePath, JSON.stringify(closeCmd, null, 2), "utf8");

    res.json({ status: "OK", message: "Close command forwarded to MT5", closeCmd });

  } catch (err) {
    console.error("MT5 CLOSE API ERROR:", err);
    res.status(500).json({ error: "MT5_CLOSE_BRIDGE_ERROR" });
  }
});

// ============================================================================
// MT5 SYMBOL SWITCH (local only)
// ============================================================================

app.post("/api/mt5switch", (req, res) => {
  try {
    if (!MT5_LOCAL) return res.status(503).json({ error: "MT5_NOT_AVAILABLE" });

    const { symbol } = req.body ?? {};

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "INVALID_SYMBOL", payload: req.body });
    }

    const filePath = path.join(MT5_DIR, "neo_symbol.txt");
    fs.writeFileSync(filePath, symbol.trim(), "utf8");

    res.json({ status: "OK", message: "Symbol switch forwarded to MT5", symbol });

  } catch (err) {
    console.error("MT5 SWITCH API ERROR:", err);
    res.status(500).json({ error: "MT5_SWITCH_ERROR" });
  }
});

// ============================================================================
// STATIC FRONTEND (Vite build)
// ============================================================================

const __root = path.resolve();
app.use(express.static(path.join(__root, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__root, "dist", "index.html"));
});

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ NEO MATRIX API running on http://localhost:${PORT}`);
  if (MT5_LOCAL) console.log("🔥 Background polling active (1s)");
});
