// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Header from "./components/pages/Header";
import MatrixAnalysis from "./components/pages/MatrixAnalysis";
import MarketOpportunities from "./components/pages/MarketOpportunities";
import TerminalMT5 from "./components/pages/TerminalMT5";

import useMT5Data from "./hooks/useMT5Data";

export default function App() {
  const { data: snapshot, ready } = useMT5Data();

  if (!ready) {
    return (
      <div className="h-screen bg-black text-white">
        Loading MT5…
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white">
      <Header snapshot={snapshot} />

      <Routes>
        <Route
          path="/"
          element={<MatrixAnalysis snapshot={snapshot} />}
        />
        <Route
          path="/opportunities"
          element={<MarketOpportunities />}
        />
        <Route
          path="/terminal"
          element={<TerminalMT5 snapshot={snapshot} />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
