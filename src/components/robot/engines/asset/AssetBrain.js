// ============================================================================
// AssetBrain.js
// Rôle : agrégation FACTUELLE de l'état de l'actif
// Source UNIQUE des signaux multi-TF : AssetSignals
// ============================================================================

import AssetSignals from "./AssetSignals";
import AssetMacro   from "./AssetMacro";

const AssetBrain = (() => {

  function analyze({ asset, indicators, macro }) {

    const signals    = AssetSignals.evaluate(indicators);
    const macroState = AssetMacro.evaluate({ macro });

    return {
      symbol: asset?.symbol ?? null,
      timestamp: Date.now(),

      // ⬇️ DIRECTEMENT issu de AssetSignals
      structure: signals.structure,
      dominant:  signals.dominant,
      timing:    signals.timing,
      noise:     signals.noise,

      macro: macroState
    };
  }

  return { analyze };

})();

export default AssetBrain;
