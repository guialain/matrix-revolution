// ============================================================================
// CapitalAllocation.js — NEO MATRIX (FINAL / PRODUCTION)
// ---------------------------------------------------------------------------
// Rôle :
//  - Appliquer la diversification par classe d’actifs
//  - Capital = equity réelle
//  - Levier fixe = 20 (max broker)
//  - Source des classes : AssetClassification.js (SOURCE DE VÉRITÉ)
//  - Retour riche pour guider trader & UI
// ============================================================================

import { getAssetClass } from "../../../classification/AssetClassification";

// ============================================================================
// CONFIG
// ============================================================================

const LEVERAGE_MAX = 20;

// Poids par classe — alignés STRICTEMENT avec AssetClassification.js
export const CLASS_WEIGHTS = {

  INDEX:   0.30, // Indices
  AGRI:    0.05, // Agriculture
  OIL_GAS: 0.05, // Oil & Gas
  METAL:   0.15, // Métaux
  FX:      0.35, // Forex
  CRYPTO:  0.15  // Crypto
};

// ============================================================================
// ENGINE
// ============================================================================

const CapitalAllocation = {

  // --------------------------------------------------------------------------
  // Capacité maximale par classe
  // --------------------------------------------------------------------------
  classCapacity({ equity, assetClass }) {
    const weight = CLASS_WEIGHTS[assetClass];
    if (!weight || !Number.isFinite(equity) || equity <= 0) return 0;

    return equity * weight * LEVERAGE_MAX;
  },

  // --------------------------------------------------------------------------
  // Exposition actuelle par classe (notional cumulé)
  // --------------------------------------------------------------------------
  classExposure(openPositions = []) {
    const exposure = {};

    openPositions.forEach(p => {
      const cls = getAssetClass(p.symbol);
      if (!cls) return;

      const notional = Math.abs(Number(p.notional_eur));
      if (!Number.isFinite(notional) || notional <= 0) return;

      exposure[cls] = (exposure[cls] ?? 0) + notional;
    });

    return exposure;
  },

  // --------------------------------------------------------------------------
  // Vérification d’un nouveau trade (cœur TRINITY)
  // --------------------------------------------------------------------------
  checkTrade({ symbol, newNotional, equity, openPositions }) {

    const assetClass = getAssetClass(symbol);

    // ------------------------------------------------------------------------
    // Classe inconnue → blocage dur
    // ------------------------------------------------------------------------
    if (!assetClass) {
      return {
        allowed: false,
        reason: "UNKNOWN_ASSET_CLASS",
        symbol
      };
    }

    const exposure = this.classExposure(openPositions);

    const current  = exposure[assetClass] ?? 0;
    const capacity = this.classCapacity({
      equity,
      assetClass
    });

    // Protection flottants
    const remaining = Math.max(0, capacity - current);
    const usageRatio = capacity > 0 ? current / capacity : 1;

    // ------------------------------------------------------------------------
    // 🔴 Bloqué — plus aucune capacité
    // ------------------------------------------------------------------------
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: "CLASS_CAP_EXCEEDED",
        assetClass,

        capacity,
        current,
        remaining: 0,
        usageRatio
      };
    }

    // ------------------------------------------------------------------------
    // 🟠 Réduction nécessaire — allocation presque pleine
    // ------------------------------------------------------------------------
    if (newNotional > remaining) {
      return {
        allowed: true,
        reduced: true,
        assetClass,

        capacity,
        current,
        remaining,
        usageRatio,

        allowedNotional: remaining,
        reductionRatio: remaining / newNotional
      };
    }

    // ------------------------------------------------------------------------
    // 🟢 OK — allocation respectée
    // ------------------------------------------------------------------------
    return {
      allowed: true,
      reduced: false,
      assetClass,

      capacity,
      current,
      remaining,
      usageRatio,

      allowedNotional: newNotional
    };
  }
};

export default CapitalAllocation;
