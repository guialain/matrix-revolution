// ============================================================================
// TIMING CONFIG — Seuils M5 et M1, identiques pour tous les assets
// ============================================================================

export const TIMING_CONFIG = {

  // Filtre weekend — pas d'entrée vendredi ≥ weekendFridayHour, samedi, dimanche
  weekendFridayHour: 17.5,

  // Filtre trading hours — entrées autorisées uniquement dans cette fenêtre (UTC)
  tradingHoursUTC: { open: 9, close: 19 },

  M5: {

    // =========================================================
    // Micro Direction Threshold
    // Frontière neutre / directionnelle
    // |slope| < threshold  → zone neutre
    // |slope| ≥ threshold  → micro directionnel clair
    // =========================================================
    slopeThreshold: 0.5,

    // =========================================================
    // Overextended — spike terminal (reversal + continuation)
    // =========================================================
    overextended: {
      slopeAbs:  5.0,
      dslopeAbs: 5.0,
      drsiAbs:   8.0,
      rsiMax:    65,
      rsiMin:    35,
    },
  },

};
