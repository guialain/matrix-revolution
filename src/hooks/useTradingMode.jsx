// ============================================================================
// TRADING MODE — Global Context (MANUAL / AUTO)
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_BASE = window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin;

const TradingModeContext = createContext({ mode: "MANUAL", setMode: () => {} });

export function TradingModeProvider({ children }) {
  const [mode, setModeLocal] = useState("MANUAL");

  // Fetch persisted mode on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/trading-mode`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.mode) setModeLocal(d.mode); })
      .catch(() => {});
  }, []);

  const setMode = useCallback((newMode) => {
    setModeLocal(newMode);
    fetch(`${API_BASE}/api/trading-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mode: newMode })
    }).catch(() => {});
  }, []);

  return (
    <TradingModeContext.Provider value={{ mode, setMode }}>
      {children}
    </TradingModeContext.Provider>
  );
}

export default function useTradingMode() {
  return useContext(TradingModeContext);
}
