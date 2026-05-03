// ============================================================================
// ZoneClassification.jsx — Panel "Classification des actifs" (3 sous-blocs)
//
// Classifie tous les TRADABLE_SYMBOLS (minus BLOCKED_SYMBOLS) par zone
// zscore_h1_s0 dans 3 buckets : GRISE / EXH / CONT.
// ============================================================================

import React, { useMemo } from "react";
import { TRADABLE_SYMBOLS } from "../../config/allowedSymbols";
import { BLOCKED_SYMBOLS } from "../robot/engines/trading/AssetEligibility";
import { getZscoreH1Zone, bucketZone } from "../../utils/zoneClassifier";

function HeatChip({ symbol, zscore }) {
  // Echelle absolue : |z|=3 → 100%
  const force = Math.min(Math.abs(zscore) / 3, 1) * 100;
  const zStr  = zscore >= 0 ? `+${zscore.toFixed(2)}` : zscore.toFixed(2);

  return (
    <span className="zc-chip">
      <span className="zc-chip-row">
        <span className="zc-chip-symbol">{symbol}</span>
        <span className="zc-chip-zscore">{zStr}</span>
      </span>
      <span className="zc-chip-bar">
        <span className="zc-chip-bar-fill" style={{ width: `${force}%` }} />
      </span>
    </span>
  );
}

function ZoneClassification({ marketWatch = [] }) {
  const buckets = useMemo(() => {
    const grey     = [];
    const exhBuy   = [];
    const exhSell  = [];
    const contBuy  = [];
    const contSell = [];

    const allowed = TRADABLE_SYMBOLS.filter(s => !BLOCKED_SYMBOLS.includes(s));

    for (const symbol of allowed) {
      const row = marketWatch.find(r => r.symbol === symbol);
      if (!row) continue;
      const z = row.zscore_h1_s0;
      const zone = getZscoreH1Zone(z);
      const bucket = bucketZone(zone);
      const item = { symbol, zscore: Number(z) };
      if (bucket === "GREY")           grey.push(item);
      else if (bucket === "EXH_BUY")   exhBuy.push(item);
      else if (bucket === "EXH_SELL")  exhSell.push(item);
      else if (bucket === "CONT_BUY")  contBuy.push(item);
      else if (bucket === "CONT_SELL") contSell.push(item);
    }

    // Tri par |zscore| desc dans les sections EXH/CONT, alpha dans GRISE
    const byForceDesc = (a, b) => Math.abs(b.zscore) - Math.abs(a.zscore);
    grey.sort((a, b) => a.symbol.localeCompare(b.symbol));
    exhBuy.sort(byForceDesc);
    exhSell.sort(byForceDesc);
    contBuy.sort(byForceDesc);
    contSell.sort(byForceDesc);
    return { grey, exhBuy, exhSell, contBuy, contSell };
  }, [marketWatch]);

  return (
    <div className="zone-classification">
      <div className="zc-header">
        <span className="zc-title">CLASSIFICATION</span>
      </div>

      <div className="zc-section zc-grey">
        <div className="zc-section-header">
          <span className="zc-section-title">GRISE</span>
          <span className="zc-section-count">{buckets.grey.length}</span>
        </div>
        <div className="zc-symbols">
          {buckets.grey.length === 0
            ? <span className="zc-empty">—</span>
            : buckets.grey.map(item => <HeatChip key={item.symbol} {...item} />)}
        </div>
      </div>

      <div className="zc-section zc-exh-buy">
        <div className="zc-section-header">
          <span className="zc-section-title">EXH BUY</span>
          <span className="zc-section-count">{buckets.exhBuy.length}</span>
        </div>
        <div className="zc-symbols">
          {buckets.exhBuy.length === 0
            ? <span className="zc-empty">—</span>
            : buckets.exhBuy.map(item => <HeatChip key={item.symbol} {...item} />)}
        </div>
      </div>

      <div className="zc-section zc-exh-sell">
        <div className="zc-section-header">
          <span className="zc-section-title">EXH SELL</span>
          <span className="zc-section-count">{buckets.exhSell.length}</span>
        </div>
        <div className="zc-symbols">
          {buckets.exhSell.length === 0
            ? <span className="zc-empty">—</span>
            : buckets.exhSell.map(item => <HeatChip key={item.symbol} {...item} />)}
        </div>
      </div>

      <div className="zc-section zc-cont-buy">
        <div className="zc-section-header">
          <span className="zc-section-title">CONT BUY</span>
          <span className="zc-section-count">{buckets.contBuy.length}</span>
        </div>
        <div className="zc-symbols">
          {buckets.contBuy.length === 0
            ? <span className="zc-empty">—</span>
            : buckets.contBuy.map(item => <HeatChip key={item.symbol} {...item} />)}
        </div>
      </div>

      <div className="zc-section zc-cont-sell">
        <div className="zc-section-header">
          <span className="zc-section-title">CONT SELL</span>
          <span className="zc-section-count">{buckets.contSell.length}</span>
        </div>
        <div className="zc-symbols">
          {buckets.contSell.length === 0
            ? <span className="zc-empty">—</span>
            : buckets.contSell.map(item => <HeatChip key={item.symbol} {...item} />)}
        </div>
      </div>
    </div>
  );
}

export default ZoneClassification;
