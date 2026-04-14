// src/components/terminalmt5/DealPipeline.jsx

import React, { useState, useEffect } from "react";
import useTrinityVoice from "../../hooks/useTrinityVoice";
import useTradingMode from "../../hooks/useTradingMode";
import SignalFrequency from "../robot/engines/trading/SignalFrequency";
import AccountHealth from "./AccountHealth";
import "../../styles/stylesterminalMT5/dealpipeline.css";

export default function DealPipeline({ robot, draftDeal, onSelectDeal, account, totalExposure }) {

  // ================= TRADING MODE =================
  const { mode, setMode } = useTradingMode();
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);

  const handleToggleMode = () => {
    if (mode === "MANUAL") {
      setShowAutoConfirm(true);
    } else {
      setMode("MANUAL");
    }
  };

  // ================= EXTRACTION TRINITY =================
  const {
    validOpportunities = [],
    expiredOpportunities = [],
    waitOpportunities  = []
  } = robot ?? {};

  const displayValid = validOpportunities.filter(
    op => op.symbol !== draftDeal?.symbol
  );
  const displayExpired = expiredOpportunities.filter(
    op => op.symbol !== draftDeal?.symbol
  );

  const hasValid = displayValid.length > 0;
  const hasExpired = displayExpired.length > 0;
  const hasWait  = waitOpportunities.length > 0;

  const [muted, setMuted] = useState(false);

  // ================= COOLDOWN CONFIG + TICK =================
  const [cooldownMin, setCooldownMin] = useState(() => SignalFrequency.getCooldownMinutes());
  const handleCooldownChange = (e) => {
    const v = parseInt(e.target.value, 10);
    SignalFrequency.setCooldownMinutes(v);
    setCooldownMin(v);
  };

  const hasCooldown = waitOpportunities.some(op => op.state === "WAIT_COOLDOWN");
  const [cdTick, setCdTick] = useState(0);
  useEffect(() => {
    if (!hasCooldown) return;
    const id = setInterval(() => setCdTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasCooldown]);

  // ================= 🔊 VOICE HOOK =================
  const trinityState = useTrinityVoice({
    valid: validOpportunities.length,
    wait: waitOpportunities.length,
    topValid: validOpportunities[0] ?? null,
    muted
  }) || "";

  /* =====================================================
     SOUS-COMPONENT — TrinityOpportunityLine
  ===================================================== */
  function TrinityOpportunityLine({ op, muted = false, onClick }) {

    if (!op) return null;

    const fmtScore = v =>
      Number.isFinite(v)
        ? `${v > 0 ? "+" : ""}${Math.round(v)}`
        : "—";

    const type      = String(op.type ?? "").toUpperCase();          // CONTINUATION | REVERSAL
    const typeShort = type === "CONTINUATION" ? "CONT" : type === "REVERSAL" ? "REV" : type;
    const phase     = op.signalPhase ?? op.signalType ?? "";        // e.g. STRONG_UP / BUY_RSI_LOW
    const waitRaw   = String(op.state ?? "").replace(/^WAIT_/, ""); // e.g. M5_CONTRARY
    const isCooldown = op.state === "WAIT_COOLDOWN";
    let waitState = waitRaw;
    if (isCooldown) {
      void cdTick; // force re-eval on tick
      const cdMs = SignalFrequency.getCooldownRemaining(`${op.symbol}_${op.side}`);
      if (cdMs > 0) {
        const m = Math.floor(cdMs / 60000);
        const s = Math.floor((cdMs % 60000) / 1000);
        waitState = `${waitRaw} ${m}m ${String(s).padStart(2, "0")}s`;
      }
    }

    return (
      <div
        className={`pipeline-item ${muted ? "muted" : ""} pipeline-clickable`}
        onClick={() => onClick?.(op)}
      >
        {/* SYMBOL */}
        <span className="sym">{op.symbol}</span>

        {/* SIDE */}
        <span className={`side ${(op.side ?? "").toLowerCase()}`}>
          {muted ? `WAIT-${op.side}` : op.side}
        </span>

        {/* SCORE */}
        <span className="metric score">
          {fmtScore(op.score)}
        </span>

        {/* TYPE + PHASE */}
        <span className="mini">
          {typeShort && (
            <span className={`mini-bd type-${type.toLowerCase()}`}>
              {typeShort}
            </span>
          )}
          <span className="mini-bd phase">
            {muted ? waitState : phase}
          </span>
        </span>
      </div>
    );
  }

  // ================= RENDER =================
  return (
    <div className="deal-pipeline">

      <div className="box-title">
        Deal Pipeline
        <select
          className="cooldown-select"
          value={cooldownMin}
          onChange={handleCooldownChange}
          title="Cooldown between trades (same symbol+side)"
        >
          {SignalFrequency.COOLDOWN_OPTIONS.map(m => (
            <option key={m} value={m}>{m === 0 ? "No CD" : `${m}m CD`}</option>
          ))}
        </select>
        <button
          className={`voice-btn ${muted ? "off" : "on"}`}
          onClick={() => setMuted(m => !m)}
          title={muted ? "Activer la voix" : "Désactiver la voix"}
        >
          {muted ? "🔇" : "🔊"}
        </button>

        <div className="auto-toggle-wrapper">
          <button
            className={`auto-toggle-btn ${mode.toLowerCase()}`}
            onClick={handleToggleMode}
          >
            <span className={`auto-toggle-label ${mode === "MANUAL" ? "active" : ""}`}>MANUAL</span>
            <span className={`auto-toggle-label ${mode === "AUTO" ? "active" : ""}`}>AUTO</span>
          </button>
        </div>
      </div>

      {/* ================= AUTO CONFIRM MODAL ================= */}
      {showAutoConfirm && (
        <div className="auto-confirm-overlay" onClick={() => setShowAutoConfirm(false)}>
          <div className="auto-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="auto-confirm-title">ENABLE AUTO TRADING</div>
            <p className="auto-confirm-text">
              Orders will be sent directly to MT5 without manual confirmation.
            </p>
            <div className="auto-confirm-actions">
              <button
                className="auto-confirm-cancel"
                onClick={() => setShowAutoConfirm(false)}
              >
                CANCEL
              </button>
              <button
                className="auto-confirm-ok"
                onClick={() => { setMode("AUTO"); setShowAutoConfirm(false); }}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pipeline-grid-2col">

        {/* ================= LEFT — Trinity + placeholder ================= */}
        <div className="pipeline-col-left">
          <div className={`pipeline-panel-trinity ${trinityState}`}>
            <img
              src="/trinity.png"
              alt="Trinity AI"
              className="trinity-image"
            />
            <div className="trinity-label">TRINITY</div>
          </div>

          <div className="pipeline-account-health">
            <AccountHealth account={account} totalExposure={totalExposure} />
          </div>
        </div>

        {/* ================= RIGHT — VALID ================= */}
        <div className="pipeline-panel-valid">

          <div className="pipeline-title">
            VALID
            <span className="pipeline-count">
              {displayValid.length}
            </span>
          </div>

          {!hasValid && !hasExpired ? (
            <div className="pipeline-empty">
              No validated opportunity
            </div>
          ) : (
            <>
              {displayValid.slice(0, 7).map((op, i) => (
                <TrinityOpportunityLine
                  key={`valid-${op.symbol}-${i}`}
                  op={op}
                  onClick={onSelectDeal}
                />
              ))}
              {displayExpired.slice(0, 5).map((op, i) => (
                <TrinityOpportunityLine
                  key={`exp-${op.symbol}-${i}`}
                  op={op}
                  muted
                />
              ))}
            </>
          )}

        </div>

      </div>

    </div>
  );
}
