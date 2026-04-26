// ============================================================================
// AssetBrain.js
// Rôle : agrégation FACTUELLE de l'état de l'actif (macro uniquement)
// ============================================================================

import AssetMacro from "./AssetMacro";

const AssetBrain = (() => {

  function analyze({ asset, macro }) {

    const macroState = AssetMacro.evaluate({ macro });

    return {
      symbol: asset?.symbol ?? null,
      timestamp: Date.now(),

      macro: macroState
    };
  }

  return { analyze };

})();

export default AssetBrain;
