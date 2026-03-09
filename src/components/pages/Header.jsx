// ============================================================================
//  HEADER — Neo Matrix (OFFICIAL / STABLE)
// ============================================================================

import React, { useEffect, useState, useRef, useMemo } from "react";
import { NavLink } from "react-router-dom";
import "../../styles/stylespages/header.css";

// ============================================================================
//  ASSET META
// ============================================================================

const ASSET_META = {
  crypto: { label: "CRYPTO", icon: "₿" },
  index:  { label: "INDEX",  icon: "📊" },
  fx:     { label: "FX",     icon: "💱" },
  metal:  { label: "METAL",  icon: "🥇" },
  energy: { label: "ENERGY", icon: "⚡" },
  stock:  { label: "STOCK",  icon: "🏦" }
};

// ============================================================================
//  COMPONENT
// ============================================================================

export default function Header({ snapshot }) {

  const data = snapshot;
  const ready = Boolean(snapshot);

  // ========================================================================
  // ⏱ HORLOGE LOCALE
  // ========================================================================

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ========================================================================
  // 📦 EXTRACTION SNAPSHOT
  // ========================================================================

  const asset  = data?.asset ?? null;

const bidNum = Number.isFinite(asset?.bid) ? asset.bid : null;
const askNum = Number.isFinite(asset?.ask) ? asset.ask : null;

  
const digits = useMemo(() => {
  const d = Number(asset?.digits);
  return Number.isInteger(d) && d >= 0 && d <= 8 ? d : 2;
}, [asset?.digits]);




  // ========================================================================
  // 🧠 MÉMOIRE BID / ASK (direction persistante)
  // ========================================================================

  const lastBidRef = useRef(null);
  const lastAskRef = useRef(null);

  const bidDirRef = useRef(null); // "up" | "down"
  const askDirRef = useRef(null);

  let bidClass = "price-neutral";
  let askClass = "price-neutral";

  // --- BID ---
  if (bidNum !== null && lastBidRef.current !== null) {
    if (bidNum > lastBidRef.current) bidDirRef.current = "up";
    else if (bidNum < lastBidRef.current) bidDirRef.current = "down";
  }

  if (bidDirRef.current === "up")   bidClass = "price-green";
  if (bidDirRef.current === "down") bidClass = "price-red";

  // --- ASK ---
  if (askNum !== null && lastAskRef.current !== null) {
    if (askNum > lastAskRef.current) askDirRef.current = "up";
    else if (askNum < lastAskRef.current) askDirRef.current = "down";
  }

  if (askDirRef.current === "up")   askClass = "price-green";
  if (askDirRef.current === "down") askClass = "price-red";

  // Mise à jour mémoire
  useEffect(() => {
    if (bidNum !== null) lastBidRef.current = bidNum;
    if (askNum !== null) lastAskRef.current = askNum;
  }, [bidNum, askNum]);

  // ========================================================================
  // 🔢 FORMAT PRIX
  // ========================================================================

const formatPrice = (v) => {
  if (!Number.isFinite(v)) return "—";

  return v.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
};


  const bid = useMemo(() => formatPrice(bidNum), [bidNum, digits]);
  const ask = useMemo(() => formatPrice(askNum), [askNum, digits]);

  // ========================================================================
  // 📌 ASSET INFO
  // ========================================================================

  const symbol     = asset?.symbol ?? "—";
  const assetClass = asset?.asset_class ?? null;

  const meta = useMemo(
    () => ASSET_META[assetClass] ?? null,
    [assetClass]
  );

// ========================================================================
// 🟢 MARKET OPEN / CLOSED (UTC)
// ========================================================================

const marketStatus = useMemo(() => {
  if (!assetClass) return "unknown";

  // Crypto = toujours ouvert
  if (assetClass === "crypto") {
    return "open";
  }

  const nowUtc = new Date();
  const day = nowUtc.getUTCDay();   // 0=Sun ... 6=Sat
  const hour = nowUtc.getUTCHours();

  // FX / Indices / Commodities
  // Open: Mon 22:00 UTC → Fri 22:00 UTC
  const isWeek =
    (day > 1 && day < 5) ||                  // Tue–Thu
    (day === 1 && hour >= 22) ||              // Mon after 22h
    (day === 5 && hour < 22);                 // Fri before 22h

  return isWeek ? "open" : "closed";
}, [assetClass, now]);



  // ========================================================================
  // 🧱 RENDER
  // ========================================================================

  if (!ready) {
    return (

      <header className="neo-header px-6 py-4">
        Loading…
      </header>
    );
  }

  return (
<header className="neo-header neo-header-grid px-6 py-4">

  {/* ================= LEFT ================= */}
  <div className="neo-header-left">
    <span className="neo-header-logo">NEO MATRIX</span>

    <span className="neo-header-date">
      {now.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      })}
    </span>

    <span className="neo-header-time">
      {now.toLocaleTimeString("fr-FR")}
    </span>
  </div>

  {/* ================= CENTER ================= */}
  <div className="neo-header-center">
    <div className="neo-header-trading">

      <span className="symbol text-gold">
        {symbol}
      </span>

      {marketStatus !== "unknown" && (
        <span className={`market-badge ${marketStatus}`}>
          {marketStatus === "open" ? "Market Open" : "Market Closed"}
        </span>
      )}

      {meta && (
        <span className={`asset-badge asset-${assetClass}`}>
          {meta.icon} {meta.label}
        </span>
      )}

      <span className={`header-price ${bidClass}`}>
        Bid : {bid}
      </span>

      <span className={`header-price ${askClass}`}>
        Ask : {ask}
      </span>

    </div>
  </div>

  {/* ================= RIGHT ================= */}
  <nav className="neo-header-menu">
    <NavLink to="/" end>Matrix Analysis</NavLink>
    <NavLink to="/opportunities">Market Opportunities</NavLink>
    <NavLink to="/terminal">Terminal MT5</NavLink>
  </nav>

</header>

  );
}
