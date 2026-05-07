// ============================================================================
// useRobotState.js
// Rôle : déterminer l'état système global pour l'animation du robot.
//   - 'block'    : margin level < 350% avec exposure, OU heures NEO fermées
//   - 'prudent'  : margin warning (350-400%), OU volatilité 'explo' détectée
//   - 'idle'     : pas de snapshot, ou conditions ambiguës
//   - 'scanning' : défaut, opérationnel
// ============================================================================

import { useMemo } from "react";
import GlobalMarketHours from "../components/robot/engines/trading/GlobalMarketHours";
import { getVolatilityRegime } from "../components/robot/engines/config/VolatilityConfig";
import { TRADABLE_SYMBOLS } from "../config/allowedSymbols";

const MIN_MARGIN_LEVEL  = 350; // mirroir de ValidateMargin.js
const WARN_MARGIN_LEVEL = 400; // zone d'avertissement avant block

export default function useRobotState(snapshot) {
  return useMemo(() => {
    if (!snapshot) return { state: "idle", reason: "No snapshot" };

    const now         = new Date();
    const account     = snapshot.account ?? {};
    const marketWatch = snapshot.marketWatch ?? [];

    const marginLevel = Number(account?.marginLevel);
    const marginUsed  = Number(account?.marginUsed ?? 0);

    // BLOCK : margin level < 350% avec exposure
    if (Number.isFinite(marginLevel) && marginUsed > 0 && marginLevel < MIN_MARGIN_LEVEL) {
      return { state: "block", reason: `Margin ${marginLevel.toFixed(0)}% < ${MIN_MARGIN_LEVEL}%` };
    }

    // BLOCK / IDLE : heures NEO fermées
    const hours = GlobalMarketHours.check("FX", now);
    if (!hours.neoOpen) {
      return { state: "idle", reason: "Outside NEO hours" };
    }

    // PRUDENT : zone d'avertissement marge (350-400%)
    if (Number.isFinite(marginLevel) && marginUsed > 0 && marginLevel < WARN_MARGIN_LEVEL) {
      return { state: "prudent", reason: `Margin ${marginLevel.toFixed(0)}% (warning)` };
    }

    // PRUDENT : volatilité 'explo' sur ≥1 actif tradable
    const exploSymbols = [];
    for (const row of marketWatch) {
      if (!TRADABLE_SYMBOLS.includes(row?.symbol)) continue;
      const atr   = Number(row?.atr_m15);
      const close = Number(row?.price);
      if (!Number.isFinite(atr) || !Number.isFinite(close) || close <= 0) continue;
      if (getVolatilityRegime(row.symbol, atr, close) === "explo") {
        exploSymbols.push(row.symbol);
      }
    }
    if (exploSymbols.length > 0) {
      const head = exploSymbols.slice(0, 2).join(", ");
      const more = exploSymbols.length > 2 ? `+${exploSymbols.length - 2}` : "";
      return { state: "prudent", reason: `Vol explo: ${head}${more}` };
    }

    return { state: "scanning", reason: "Normal" };
  }, [snapshot]);
}
