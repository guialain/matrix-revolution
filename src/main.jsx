import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { TradingModeProvider } from "./hooks/useTradingMode";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <TradingModeProvider>
        <App />
      </TradingModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
