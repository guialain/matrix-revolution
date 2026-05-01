// ============================================================================
// ValidateMargin.js — NEO MATRIX (CORRIGÉ / PRODUCTION)
// ---------------------------------------------------------------------------
// Rôle :
//  - Vérifier la santé du compte AVANT envoi
//  - Critère principal : Margin Level (MT5 %)
//  - RÈGLE CLÉ :
//      👉 Pas d’exposition = pas de blocage (marginLevel peut être 0)
// ============================================================================

const ValidateMargin = {

  run({ account }) {
    const issues = [];
    const metrics = {};

    const marginLevel = Number(account?.marginLevel);
    const marginUsed  = Number(account?.marginUsed ?? 0);

    // Seuil TRINITY — CONSERVATEUR
    const MIN_MARGIN_LEVEL = 300; // %

    // ------------------------------------------------------------------------
    // Données manquantes
    // ------------------------------------------------------------------------
    if (!Number.isFinite(marginLevel)) {
      issues.push({
        level: "WARN",
        code: "MARGIN_DATA_MISSING",
        message: "Margin level indisponible"
      });

      return { issues, patch: null, metrics };
    }

    const hasExposure = marginUsed > 0;

    metrics.marginLevel = marginLevel;
    metrics.marginUsed  = marginUsed;
    metrics.hasExposure = hasExposure;

    // ------------------------------------------------------------------------
    // 🔴 Blocage DUR
    // 👉 UNIQUEMENT s’il y a déjà de l’exposition
    // ------------------------------------------------------------------------
    if (hasExposure && marginLevel < MIN_MARGIN_LEVEL) {
      issues.push({
        level: "BLOCK",
        code: "MARGIN_LEVEL_LOW",
        message: `Margin level < ${MIN_MARGIN_LEVEL}%`
      });
    }

    // ------------------------------------------------------------------------
    // 🟠 Avertissement (optionnel mais utile)
    // Premier trade → margin non engagée
    // ------------------------------------------------------------------------
    if (!hasExposure) {
      issues.push({
        level: "INFO",
        code: "NO_MARGIN_EXPOSURE",
        message: "Aucune marge engagée — premier trade"
      });
    }

    return { issues, patch: null, metrics };
  }
};

export default ValidateMargin;
