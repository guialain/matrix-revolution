import React, { useState, useEffect } from "react";
import { getAssetClass } from "../../components/classification/AssetClassification";
import useMT5Data from "../../hooks/useMT5Data";
import OrderController from "../robot/engines/controller/OrderController";
import { getRiskConfig } from "../robot/engines/config/RiskConfig";
import "../../styles/stylesterminalMT5/dealingroom.css";
import { sendOrderToMT5 } from "../../utilitaires/sendMT5Instructions";
import useTradingMode from "../../hooks/useTradingMode";
import SignalFrequency from "../robot/engines/trading/SignalFrequency";



export default function DealingRoom({ draftDeal, dealLocked, onOrderSent }) {

  const { mode } = useTradingMode();

  // ================= STATE =================
  const [side, setSide] = useState(null);
  const [lots, setLots] = useState(null);
  const [sl, setSl] = useState(0);
  const [tp, setTp] = useState(0);
  const [riskTouched, setRiskTouched] = useState(false);
  const [signalTF, setSignalTF] = useState("H1");

  const [preview, setPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
const [activePreset, setActivePreset] = useState(null);

  const [sending, setSending] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);

  const locked = dealLocked;

  // ================= MT5 DATA =================
  const { data } = useMT5Data();
  const asset = data?.asset ?? null;
  const account = data?.account ?? null;
  const openPositions = data?.openPositions ?? [];

  const atr_h1 = Number.isFinite(data?.indicators?.atr?.H1)
    ? data.indicators.atr.H1
    : null;

  const bid = Number.isFinite(asset?.bid) ? asset.bid : null;
  const ask = Number.isFinite(asset?.ask) ? asset.ask : null;
  const hasQuote = bid !== null && ask !== null;

  const digits = Number.isInteger(asset?.digits) ? asset.digits : 2;

  // ================= BROKER RULES =================
  const volumeMin  = Number(asset?.volume_min ?? 0.01);
  const volumeMax  = Number(asset?.volume_max ?? 100);
  const volumeStep = Number(asset?.volume_step ?? 0.01);

const point = Math.pow(10, -digits);
const minStopDistance = (asset?.stops_level ?? 0) * point;

  // ================= ASSET =================
  const mt5Symbol = asset?.symbol ?? null;
  const assetClass = mt5Symbol ? getAssetClass(mt5Symbol) : null;
  const canTrade = hasQuote && mt5Symbol && assetClass;
  const isLoadingSymbol = locked && draftDeal?.symbol && mt5Symbol !== draftDeal?.symbol;

  // ================= DEFAULT LOT =================
  useEffect(() => {
    if (!asset || lots !== null) return;
    setLots(volumeMin);
  }, [asset, lots, volumeMin]);

  // ================= AUTO SL / TP =================
const normalizePrice = (price) => {

  const tick = Number(asset?.tick_size);

  if (!Number.isFinite(tick) || tick <= 0)
    return price;

  const normalized = Math.round(price / tick) * tick;

  return Number(normalized.toFixed(digits));
};

 const computeSLTP = (selectedSide) => {

  if (!hasQuote || !selectedSide || !atr_h1) return null;

  const cfg = getRiskConfig(mt5Symbol);

  const atrCap = Number(cfg.atrH1Cap);
  const atrCapped = (Number.isFinite(atrCap) && atrCap > 0) ? Math.min(atr_h1, atrCap) : atr_h1;

  const slDistance = atrCapped * cfg.slAtr;
  const tpDistance = atrCapped * cfg.tpAtr;

  const entry = selectedSide === "BUY" ? ask : bid;

  let slValue, tpValue;

  if (selectedSide === "BUY") {
    slValue = entry - slDistance;
    tpValue = entry + tpDistance;
  } else {
    slValue = entry + slDistance;
    tpValue = entry - tpDistance;
  }




  // stopsLevel: broker value (via digits) or fallback from RiskConfig
  const cfgStopsLevel = Number(cfg.stopsLevel);
  const effectiveMinStop = minStopDistance > 0
    ? minStopDistance
    : (Number.isFinite(cfgStopsLevel) && cfgStopsLevel > 0) ? cfgStopsLevel : 0;

  if (effectiveMinStop > 0) {

    if (selectedSide === "BUY") {

      if (Math.abs(entry - slValue) < effectiveMinStop)
        slValue = entry - effectiveMinStop * 1.05;

      if (Math.abs(tpValue - entry) < effectiveMinStop)
        tpValue = entry + effectiveMinStop * 1.05;

    } else {

      if (Math.abs(slValue - entry) < effectiveMinStop)
        slValue = entry + effectiveMinStop * 1.05;

      if (Math.abs(entry - tpValue) < effectiveMinStop)
        tpValue = entry - effectiveMinStop * 1.05;
    }
  }

  const cfgTick = getRiskConfig(mt5Symbol)?.tickSize;
  if (cfgTick > 0) {
    const d = Math.max(0, Math.ceil(-Math.log10(cfgTick)));
    return {
      sl: Number((Math.round(slValue / cfgTick) * cfgTick).toFixed(d)),
      tp: Number((Math.round(tpValue / cfgTick) * cfgTick).toFixed(d)),
    };
  }
  return {
    sl: normalizePrice(slValue),
    tp: normalizePrice(tpValue)
  };
};

const autoFillSLTP = () => {
  const result = computeSLTP(side);
  if (!result) return;
  setSl(result.sl);
  setTp(result.tp);
  setActivePreset(null);
};

// ================= HANDLE SIDE SELECT =================
const handleSideSelect = (selectedSide) => {
  setSide(selectedSide);

  // Auto-lots — tick-based (broker) with canonical fallback (RiskConfig)
  const cfg = getRiskConfig(mt5Symbol);
  const ref = selectedSide === "BUY" ? ask : bid;
  const tickSize = Number(asset?.tick_size);
  const tickValue = Number(asset?.tick_value);
  const equity = Number(account?.equity);
  const targetLev = cfg?.targetLeveragePerTrade ?? 1;

  if (ref > 0 && equity > 0) {
    const isFX = assetClass === "FX";
    const eurPerLot = (tickSize > 0 && tickValue > 0)
      ? (ref / tickSize) * tickValue
      : isFX
        ? (cfg?.contractSize ?? 100000) * (cfg?.baseToEUR ?? 1)
        : ref * (cfg?.contractSize ?? 100000) * (cfg?.baseToEUR ?? 1);
    const rawSize = Math.round((equity * targetLev) / eurPerLot * 1000) / 1000;
    setLots(normalizeLots(rawSize));
  }

  if (atr_h1 && !riskTouched) {
    const result = computeSLTP(selectedSide);
    if (result) {
      setSl(result.sl);
      setTp(result.tp);
      setActivePreset("ATR");
    }
  }
};

// ================= REFRESH SL/TP FROM LIVE PRICE =================
const refreshSLTP = () => {
  if (!side || !atr_h1) return;
  const computed = computeSLTP(side);
  if (computed) {
    setSl(computed.sl);
    setTp(computed.tp);
  }
};

  // ================= LOTS NORMALIZATION =================
  const normalizeLots = (v) => {
    if (!Number.isFinite(v)) return volumeMin;

    const steps = Math.floor(v / volumeStep);
    const raw = steps * volumeStep;
    const decimals = Math.max(0, Math.ceil(-Math.log10(volumeStep)));

    return Math.min(
      volumeMax,
      Math.max(volumeMin, Number(raw.toFixed(decimals)))
    );
  };

  // ================= NOTIONAL =================
  const price =
    side === "BUY" ? ask :
    side === "SELL" ? bid :
    null;

  const baseToEUR = getRiskConfig(mt5Symbol)?.baseToEUR ?? 1;
  const isFXNotional = assetClass === "FX";
  const notional_eur =
    Number.isFinite(lots) &&
    Number.isFinite(price) &&
    Number.isFinite(asset?.contract_size)
      ? isFXNotional
        ? lots * asset.contract_size * baseToEUR
        : lots * price * asset.contract_size * baseToEUR
      : null;

  // ================= ORDER CONTROLLER =================
  const orderEval = OrderController.evaluate({
    draft: {
      symbol: mt5Symbol,
      side,
      lots,
      sl,
      tp,
      tf: signalTF,
      notional_eur
    },
    asset,
    account,
    openPositions
  });

  // ================= STOP VALIDATION =================
  const isStopDistanceOK = (priceValue) => {
    if (!hasQuote || priceValue === 0) return true;
    if (side === "BUY") {
      const isSL = priceValue < bid;
      return isSL
        ? Math.abs(bid - priceValue) >= minStopDistance
        : Math.abs(ask - priceValue) >= minStopDistance;
    }
    if (side === "SELL") {
      const isSL = priceValue > ask;
      return isSL
        ? Math.abs(priceValue - ask) >= minStopDistance
        : Math.abs(priceValue - bid) >= minStopDistance;
    }
    return false;
  };

  const isValidRisk =
    hasQuote &&
    side &&
    (
      (sl === 0 && tp === 0) ||
      (sl > 0 && tp === 0 && isStopDistanceOK(sl)) ||
      (sl === 0 && tp > 0 && isStopDistanceOK(tp)) ||
      (sl > 0 && tp > 0 && isStopDistanceOK(sl) && isStopDistanceOK(tp))
    );

  // ================= SYMBOL CHANGE RESET =================
  useEffect(() => {
    if (!locked) {
      setSl(0);
      setTp(0);
      setRiskTouched(false);
      setActivePreset(null);
    }
  }, [mt5Symbol]);

  // ================= DRAFT DEAL — RESET on new op =========================
  useEffect(() => {
    if (!draftDeal?.side) return;
    setSide(null);
    setLots(null);
    setSl(0);
    setTp(0);
    setRiskTouched(false);
    setActivePreset(null);
    setPreview(false);
    setPreviewData(null);
  }, [draftDeal]);

  // ================= DRAFT DEAL — APPLY when data ready =================
  useEffect(() => {
    if (!draftDeal?.side) return;
    if (mt5Symbol !== draftDeal.symbol) return;
    if (!atr_h1 || !ask || !bid) return;
    handleSideSelect(draftDeal.side);
  }, [draftDeal, mt5Symbol, atr_h1, ask, bid]);

  // ================= CLEAR STATUS =================
  useEffect(() => {
    if (!orderStatus) return;
    const t = setTimeout(() => setOrderStatus(null), 5000);
    return () => clearTimeout(t);
  }, [orderStatus]);

  // ================= RENDER =================
  return (
    <div className={`dealing-room ${mode === "AUTO" ? "dealing-room-auto" : ""}`}>
      <div className="box-title">Dealing Room</div>

      {/* AUTO MODE OVERLAY */}
      {mode === "AUTO" && (
        <div className="dealing-auto-overlay">
          <div className="dealing-auto-icon">⚡</div>
          <div className="dealing-auto-label">AUTO TRADING ACTIVE</div>
          <div className="dealing-auto-sub">Orders sent directly to MT5</div>
        </div>
      )}

      {/* EMPTY STATE */}
      {mode !== "AUTO" && !draftDeal && (
        <div className="deal-empty">En attente d'une opportunité</div>
      )}

      {/* LOADING STATE */}
      {mode !== "AUTO" && isLoadingSymbol && (
        <div className="deal-empty">Chargement {draftDeal.symbol}…</div>
      )}

      {/* READONLY DEAL DISPLAY */}
      {mode !== "AUTO" && draftDeal && !isLoadingSymbol && (
        <>
          {/* ASSET */}
          <div className="asset-readonly">
            <span>{mt5Symbol ?? "—"}</span>
            <span>{assetClass ?? "UNKNOWN"}</span>
          </div>

          {/* SIDE | LOTS — READONLY */}
          <div className="deal-side-lots-row">
            <span className={`btn-${side?.toLowerCase()} active`}>{side ?? "—"}</span>
            <div className="lots-inline">
              <label>Lots</label>
              <span className="deal-readonly-value">
                {Number.isFinite(lots)
                  ? lots.toFixed(Math.max(0, Math.ceil(-Math.log10(volumeStep))))
                  : "—"}
              </span>
            </div>
          </div>

          {/* MAX LOTS */}
          {orderEval?.metrics?.maxLots && (
            <div className="deal-hint warning">
              Max lots autorisés :
              <strong> {orderEval.metrics.maxLots.toFixed(2)}</strong>
            </div>
          )}

          {/* SEPARATOR */}
          <div className="deal-separator" />

          {/* SL / TP — READONLY */}
          <div className="deal-sl-tp-inline">
            <div className="sl-tp-item">
              <label>SL</label>
              <span className="deal-readonly-value">{sl || "—"}</span>
            </div>
            <div className="sl-tp-item">
              <label>TP</label>
              <span className="deal-readonly-value">{tp || "—"}</span>
            </div>
          </div>
        </>
      )}


      {mode !== "AUTO" && draftDeal && (
        <>
          {/* SEPARATOR */}
          <div className="deal-separator" />

          {/* WARNINGS */}
          {orderEval?.issues?.length > 0 && (
            <div className={`send-warning ${orderEval.status?.toLowerCase()}`}>
              {orderEval.issues.find(i => i.level === "BLOCK")?.message
                ?? orderEval.issues[0]?.message}
            </div>
          )}

          {/* PREVIEW BOX */}
          {preview && previewData && (
            <div className={`deal-preview ${previewData.side.toLowerCase()}`}>
              <div className="preview-row preview-main">
                <span className={`preview-side ${previewData.side.toLowerCase()}`}>
                  {previewData.side}
                </span>
                <span className="preview-symbol">{previewData.symbol}</span>
                <span className="preview-class">{previewData.assetClass}</span>
                <span className="preview-lots">Lots: {previewData.lots}</span>
              </div>
              <div className="preview-row preview-risk">
                <span>SL: {previewData.sl || "—"}</span>
                <span>TP: {previewData.tp || "—"}</span>
                <span>Notional: {previewData.notional?.toFixed(0)} €</span>
                <span>TF: {previewData.tf}</span>
              </div>
            </div>
          )}

          {/* ACTION */}
          <div className="deal-action-row">
            <button
              className={`deal-send ${preview ? "send" : "preview"}`}
              disabled={
                !canTrade ||
                !side ||
                sending ||
                orderEval.status === "BLOCK" ||
                (preview && !isValidRisk)
              }
              onClick={() => {
                if (!preview) {
                  if (orderEval.status === "BLOCK") return;
                  if (locked) refreshSLTP();
                  setPreviewData({
                    symbol: mt5Symbol,
                    assetClass,
                    side,
                    lots,
                    sl,
                    tp,
                    tf: signalTF,
                    notional: notional_eur
                  });
                  setPreview(true);
                  return;
                }
                if (!SignalFrequency.canEmit(`${mt5Symbol}_${side}`)) {
                  setOrderStatus("COOLDOWN");
                  return;
                }

                const sendSl = sl;
                const sendTp = tp;
                setSl(sendSl);
                setTp(sendTp);

                setSending(true);
                setOrderStatus(null);
                setPreview(false);
                sendOrderToMT5({
                  symbol: mt5Symbol,
                  side,
                  lots: normalizeLots(lots),
                  sl: sendSl,
                  tp: sendTp,
                  signalTF
                })
                  .then(() => {
                    setOrderStatus("OK");
                    console.log(`[COOLDOWN] recording ${mt5Symbol}_${side}`);
                    SignalFrequency.recordCooldown(`${mt5Symbol}_${side}`);
                    if (onOrderSent) onOrderSent(mt5Symbol);
                  })
                  .catch(() => setOrderStatus("ERROR"))
                  .finally(() => {
                    setSending(false);
                    setSide(null);
                    setSl(0);
                    setTp(0);
                    setRiskTouched(false);
                    setActivePreset(null);
                    setPreview(false);
                    setPreviewData(null);
                  });
              }}
            >
              {sending ? "SENDING…" : preview ? "SEND ORDER" : "PREVIEW ORDER"}
            </button>

            {preview && !sending && (
              <button
                className="deal-cancel"
                onClick={() => {
                  setPreview(false);
                  setPreviewData(null);
                }}
              >
                CANCEL
              </button>
            )}
          </div>

          {orderStatus && (
            <div className={`order-status ${orderStatus.toLowerCase()}`}>
              {orderStatus === "OK" ? "ORDER SENT ✔" : orderStatus === "COOLDOWN" ? "COOLDOWN — wait 5 min" : "ORDER FAILED ✖"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
