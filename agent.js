import fs from "fs";
import path from "path";
import crypto from "crypto";

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG_PATH = path.join(path.resolve(), "agent-config.json");

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("❌ agent-config.json not found. Create it with your token and mt5_dir.");
  process.exit(1);
}

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const { token, mt5_dir, server } = CONFIG;

if (!token || !mt5_dir || !server) {
  console.error("❌ agent-config.json must contain: token, mt5_dir, server");
  process.exit(1);
}

const API_PUSH   = `${server}/api/agent/push`;
const API_ORDERS = `${server}/api/agent/orders?token=${token}`;

// ============================================================================
// CSV UTILITIES (same as server.js)
// ============================================================================

const FILES = {
  account:       "neo_account.csv",
  asset:         "neo_asset.csv",
  macro:         "neo_macro.csv",
  scan:          "neo_market_scan.csv",
  openpositions: "neo_openpositions.csv",
  closedtrades:  "neo_closedtrades.csv",
};

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
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return obj;
  } catch { return null; }
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
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      return obj;
    });
  } catch { return []; }
}

// ============================================================================
// READ ALL MT5 DATA
// ============================================================================

let lastScanTimestamp = null;   // gate: only push scan on new timestamp (~5s)
let lastScan = [];

function readAllData() {
  const scanRaw = readAllRowsCSV(path.join(mt5_dir, FILES.scan));
  const newTs = scanRaw?.[0]?.timestamp ?? null;
  if (newTs && newTs !== lastScanTimestamp) {
    lastScan = scanRaw;
    lastScanTimestamp = newTs;
  }

  return {
    account:       readLastRowCSV(path.join(mt5_dir, FILES.account)),
    asset:         readLastRowCSV(path.join(mt5_dir, FILES.asset)),
    macro:         readLastRowCSV(path.join(mt5_dir, FILES.macro)),
    scan:          lastScan,
    openpositions: readAllRowsCSV(path.join(mt5_dir, FILES.openpositions)),
    closedtrades:  readAllRowsCSV(path.join(mt5_dir, FILES.closedtrades)),
    timestamp:     Date.now(),
  };
}

// ============================================================================
// PUSH DATA TO SERVER (every 1s)
// ============================================================================

// ============================================================================
// DIAG INSTRUMENTATION (pour debug divergence multi-agents)
//   - Trace chaque push: hash MD5, scan TS, scan rows count, account/asset OK,
//     header hash (détecte EA versions différentes).
//   - Ecrit dans diag-agent.log à côté du process. Désactivable via DIAG=0.
// ============================================================================
const DIAG_ENABLED = process.env.DIAG !== "0";
const DIAG_LOG_PATH = path.join(path.resolve(), "diag-agent.log");
let diagHeaderHash = null; // calcul one-shot au démarrage

function md5(s) { return crypto.createHash("md5").update(s).digest("hex").slice(0, 12); }

function computeHeaderHash() {
  try {
    const scanPath = path.join(mt5_dir, FILES.scan);
    if (!fs.existsSync(scanPath)) return "no-file";
    const content = fs.readFileSync(scanPath, "utf8").replace(/\0/g, "");
    const firstLine = content.split(/\r?\n/)[0] ?? "";
    return md5(firstLine);
  } catch { return "err"; }
}

function diagLog(data) {
  if (!DIAG_ENABLED) return;
  try {
    const payloadStr = JSON.stringify(data);
    const scanFirst = data.scan?.[0] ?? null;
    const line = JSON.stringify({
      t: new Date().toISOString(),
      tokenShort: token.slice(0, 8),
      payloadHash: md5(payloadStr),
      payloadBytes: payloadStr.length,
      scanRows: data.scan?.length ?? 0,
      scanFirstTs: scanFirst?.timestamp ?? null,
      scanFirstSym: scanFirst?.symbol ?? null,
      accountOK: !!data.account,
      assetOK: !!data.asset,
      assetSym: data.asset?.symbol ?? null,
      macroOK: !!data.macro,
      headerHash: diagHeaderHash,
      openPosCount: data.openpositions?.length ?? 0,
    }) + "\n";
    fs.appendFileSync(DIAG_LOG_PATH, line);
  } catch (err) {
    console.error("⚠️ diagLog error:", err.message);
  }
}

async function pushData() {
  try {
    const data = readAllData();
    diagLog(data);
    const res = await fetch(API_PUSH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-token": token,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error(`⚠️ Push failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("⚠️ Push error:", err.message);
  }
}

// ============================================================================
// POLL ORDERS FROM SERVER (every 1s)
// ============================================================================

async function pollOrders() {
  try {
    const res = await fetch(API_ORDERS, {
      headers: { "x-agent-token": token },
    });
    if (!res.ok) return;

    const { orders } = await res.json();
    if (!orders || !orders.length) return;

    for (const cmd of orders) {
      if (cmd.action === "ORDER") {
        const filePath = path.join(mt5_dir, `neo_order_${Date.now()}.json`);
        fs.writeFileSync(filePath, JSON.stringify(cmd.payload));
        console.log(`📥 Order written: ${cmd.payload.symbol} ${cmd.payload.side}`);
      } else if (cmd.action === "CLOSE") {
        const filePath = path.join(mt5_dir, `neo_close_${Date.now()}.json`);
        fs.writeFileSync(filePath, JSON.stringify(cmd.payload));
        console.log(`📥 Close written: ticket ${cmd.payload.ticket}`);
      } else if (cmd.action === "SWITCH") {
        const filePath = path.join(mt5_dir, "neo_symbol.txt");
        fs.writeFileSync(filePath, cmd.payload.symbol.trim());
        console.log(`📥 Symbol switch: ${cmd.payload.symbol}`);
      } else if (cmd.action === "MODIFY") {
        const filePath = path.join(mt5_dir, `neo_modify_${cmd.payload.ticket}.json`);
        fs.writeFileSync(filePath, JSON.stringify(cmd.payload));
        console.log(`📥 Modify written: ticket=${cmd.payload.ticket} sl=${cmd.payload.sl}`);
      }
    }
  } catch (err) {
    console.error("⚠️ Poll error:", err.message);
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

console.log(`✅ NEO Agent started`);
console.log(`   Token:  ${token.slice(0, 8)}...`);
console.log(`   MT5:    ${mt5_dir}`);
console.log(`   Server: ${server}`);

// DIAG: snapshot du header CSV au démarrage (détecte EA versions différentes)
diagHeaderHash = computeHeaderHash();
console.log(`   Diag:   ${DIAG_ENABLED ? "ON" : "OFF"} | header=${diagHeaderHash} | log=${DIAG_LOG_PATH}`);

setInterval(pushData, 1000);
setInterval(pollOrders, 200);

// Initial push
pushData();
