import fs from "fs";
import path from "path";

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
  indicators:    "neo_indicators.csv",
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
    indicators:    readLastRowCSV(path.join(mt5_dir, FILES.indicators)),
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

async function pushData() {
  try {
    const data = readAllData();
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

setInterval(pushData, 1000);
setInterval(pollOrders, 200);

// Initial push
pushData();
