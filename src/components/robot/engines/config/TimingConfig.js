// ============================================================================
// TIMING CONFIG — Seuils M5 et M1, identiques pour tous les assets
// ============================================================================

export const TIMING_CONFIG = {

  // Filtre weekend — pas d'entrée vendredi ≥ weekendFridayHour, samedi, dimanche
  weekendFridayHour: 17,

  // Fenêtres horaires de trading — format "HH:MM" (heure locale du CSV)
  // Bloque les nouvelles entrées hors fenêtre (les trades ouverts continuent d'être gérés)
  // Override optionnel par symbol ; sinon default s'applique
  tradingHours: {
    default: { start: "05:00", end: "19:30" },
    // EURUSD: { start: "08:00", end: "20:00" },
  },

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
      slopeAbs:  6.0,
      dslopeAbs: 4.0,
      drsiAbs:   8.0,
      rsiMax:    65,
      rsiMin:    35,
    },
  },

};
