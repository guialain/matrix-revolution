// ============================================================================
// SignalFilters.js — M5 MICRO CONTRARY FILTER (v2.6)
// Compatible VolatilityConfig.js
// Détection : M1
// Validation : M5
// Cooldown trade : 5 minutes
//
// Politique volatilité :
// BLOCK : low, explo
// ALLOW : med, high
// ============================================================================

import { getVolatilityRegime } from "../config/VolatilityConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";
import { TradeCooldown } from "./SignalCooldown";

const SCORE_MIN_TRADE = 25;

const SignalFilters = (() => {

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// =========================================================
// TRADING HOURS
// =========================================================
function isOutsideTradingHours(opp) {

const now = new Date();
const timePart = now.toTimeString().slice(0,5);

const symbol = String(opp?.symbol ?? "").toUpperCase();

const hours =
TIMING_CONFIG.tradingHours?.[symbol] ??
TIMING_CONFIG.tradingHours?.default;

if (!hours) return false;

return timePart < hours.start || timePart >= hours.end;

}

// =========================================================
// WEEKEND
// =========================================================
function isWeekendRisk() {

const now = new Date();
const day = now.getDay();
const hour = now.getHours();

if (day === 6 || day === 0) return true;

if (day === 5 && hour >= TIMING_CONFIG.weekendFridayHour)
return true;

return false;

}

// =========================================================
// VOLATILITY REGIME
// =========================================================
function getRegime(opp) {

  return getVolatilityRegime(
    opp?.symbol,
    opp?.atr_m15,
    opp?.close
  );

}

function isBlockedVolatility(regime) {

  if (!regime) return false;

  // Bloquer uniquement la volatilité trop faible
  if (regime === "low") return true;

  return false;

}

// =========================================================
// M5 CONTRARY
// =========================================================
function isM5Contrary(opp, side) {

const rsi = num(opp?.rsi_m5);
const drsi = num(opp?.drsi_m5);
const slope = num(opp?.slope_m5);
const dslope = num(opp?.dslope_m5);

const zh1 = num(opp?.zscore_h1);
const zm5 = num(opp?.zscore_m5);

const TH = TIMING_CONFIG.M5.slopeThreshold;

if (rsi === null || drsi === null || slope === null || dslope === null)
return false;

// ================= BUY =================

if (side === "BUY") {

if (zh1 !== null && zm5 !== null && zh1 > 1.9 && zm5 > 0.8)
return true;

if (rsi > 65 && drsi > 5)
return true;

if (slope < 0 && dslope < 0 && drsi < 0)
return true;

if (dslope < 0 && drsi < 0)
return true;

const slopeWeak = slope < TH;
const microWeak = dslope < 0 || drsi < 0;

if (slopeWeak && microWeak)
return true;

}

// ================= SELL =================

if (side === "SELL") {

if (zh1 !== null && zm5 !== null && zh1 < -1.9 && zm5 < -0.8)
return true;

if (rsi < 35 && drsi < -5)
return true;

if (slope > 0 && dslope > 0 && drsi > 0)
return true;

if (dslope > 0 && drsi > 0)
return true;

const slopeWeak = slope > -TH;
const microWeak = dslope > 0 || drsi > 0;

if (slopeWeak && microWeak)
return true;

}

return false;

}

// =========================================================
// M5 OVEREXTENDED
// =========================================================
function isM5Overextended(opp, side) {

const slope = num(opp?.slope_m5);
const dslope = num(opp?.dslope_m5);
const drsi = num(opp?.drsi_m5);
const rsi = num(opp?.rsi_m5);

if (slope === null || dslope === null || drsi === null || rsi === null)
return false;

const oe = TIMING_CONFIG.M5.overextended;

// BUY
if (side === "BUY") {

let score = 0;

if (rsi > oe.rsiMax) score++;
if (slope > oe.slopeAbs) score++;
if (dslope > oe.dslopeAbs) score++;
if (drsi > oe.drsiAbs) score++;

if (score >= 2) return true;

}

// SELL
if (side === "SELL") {

let score = 0;

if (rsi < oe.rsiMin) score++;
if (slope < -oe.slopeAbs) score++;
if (dslope < -oe.dslopeAbs) score++;
if (drsi < -oe.drsiAbs) score++;

if (score >= 2) return true;

}

return false;

}

// =========================================================
// M1 MICRO CONTRARY
// =========================================================
function isM1Contrary(opp, side) {

const rsi = num(opp?.rsi_m1);
const drsi = num(opp?.drsi_m1);

if (rsi === null || drsi === null) return false;

if (side === "BUY" && rsi > 65 && drsi > 0.5)
return true;

if (side === "SELL" && rsi < 35 && drsi < -0.5)
return true;

return false;

}

// =========================================================
// MAIN
// =========================================================
function evaluate({ opportunities } = {}) {

const opps = Array.isArray(opportunities) ? opportunities : [];

const validOpportunities = [];
const waitOpportunities = [];

for (const opp of opps) {

const side = opp?.side;
if (!side) continue;

const type = String(opp?.type ?? "").toUpperCase();
const isContinuation = type === "CONTINUATION";

const now = Date.now();

// =========================================================
// SCORE
// =========================================================

if ((opp?.score ?? 0) < SCORE_MIN_TRADE) {

waitOpportunities.push({
...opp,
state: "LOW_SCORE",
debugInfo: `score=${opp.score}`
});

continue;

}

// =========================================================
// COOLDOWN 5 MINUTES
// =========================================================

if (!TradeCooldown.canEmit(opp.symbol, now)) {

waitOpportunities.push({
...opp,
state: "WAIT_COOLDOWN",
debugInfo: "cooldown_5m"
});

continue;

}

// =========================================================
// HOURS
// =========================================================

if (isOutsideTradingHours(opp)) {

waitOpportunities.push({
...opp,
state: "WAIT_OUTSIDE_HOURS",
debugInfo: "hours"
});

continue;

}

// =========================================================
// WEEKEND
// =========================================================

if (isWeekendRisk()) {

waitOpportunities.push({
...opp,
state: "WAIT_WEEKEND",
debugInfo: "weekend"
});

continue;

}

// =========================================================
// VOLATILITY
// =========================================================

const regime = getRegime(opp);

if (isBlockedVolatility(regime)) {

waitOpportunities.push({
...opp,
state: `WAIT_VOL_${regime}`,
debugInfo: `volatility_${regime}`
});

continue;

}

// =========================================================
// CONTINUATION
// =========================================================

if (isContinuation) {

if (isM5Contrary(opp, side)) {

waitOpportunities.push({
...opp,
state: "WAIT_M5_CONTRARY",
debugInfo: "m5contrary_cont"
});

continue;

}

if (isM5Overextended(opp, side)) {

waitOpportunities.push({
...opp,
state: "WAIT_M5_OVEREXTENDED",
debugInfo: "m5overextended_cont"
});

continue;

}

}

// =========================================================
// REVERSAL
// =========================================================

else {

const TH = TIMING_CONFIG.M5.slopeThreshold;
const sm5 = num(opp?.slope_m5);
const dsm5 = num(opp?.dslope_m5);
const zm5 = num(opp?.zscore_m5);

// ZSCORE EXTENSION

if (side === "BUY" && zm5 !== null && zm5 > 0.7) {

waitOpportunities.push({
...opp,
state: "WAIT_ZM5_EXTENDED",
debugInfo: `zm5_extended_buy(${zm5})`
});

continue;

}

if (side === "SELL" && zm5 !== null && zm5 < -0.7) {

waitOpportunities.push({
...opp,
state: "WAIT_ZM5_EXTENDED",
debugInfo: `zm5_extended_sell(${zm5})`
});

continue;

}

// M5 CONFIRMATION

if (sm5 !== null && dsm5 !== null) {

const slopeTooBearish = sm5 < -TH;
const noMicroTurn = dsm5 <= 0;

if (side === "BUY" && slopeTooBearish && noMicroTurn) {

waitOpportunities.push({
...opp,
state: "WAIT_M5_CONFIRMATION",
debugInfo: `m5confirm_buy`
});

continue;

}

const slopeTooBullish = sm5 > TH;
const noMicroTurnSell = dsm5 >= 0;

if (side === "SELL" && slopeTooBullish && noMicroTurnSell) {

waitOpportunities.push({
...opp,
state: "WAIT_M5_CONFIRMATION",
debugInfo: `m5confirm_sell`
});

continue;

}

}

// MICRO

if (isM5Contrary(opp, side)) {

waitOpportunities.push({
...opp,
state: "WAIT_MICRO",
debugInfo: "m5contrary_rev"
});

continue;

}

// OVEREXTENDED

if (isM5Overextended(opp, side)) {

waitOpportunities.push({
...opp,
state: "WAIT_M5_OVEREXTENDED",
debugInfo: "m5overextended_rev"
});

continue;

}

// M1 SPIKE

if (isM1Contrary(opp, side)) {

waitOpportunities.push({
...opp,
state: "WAIT_M1_CONTRARY",
debugInfo: "m1contrary"
});

continue;

}

}

// =========================================================
// VALID
// =========================================================

validOpportunities.push({
...opp,
state: "VALID",
volatilityRegime: regime ?? null
});

}

return { validOpportunities, waitOpportunities };

}

return { evaluate };

})();

export default SignalFilters;