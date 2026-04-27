// ============================================================================
// LiveAIAnalysis.jsx — Claude API integration (scaffold)
// Props : snapshot, robot
// ============================================================================

import { useState, useRef, useEffect } from "react";
import "../../styles/stylesterminalMT5/liveaianalysis.css";

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : window.location.origin;

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")       // blocs de code
    .replace(/`[^`]*`/g, "")             // code inline
    .replace(/#{1,6}\s*/g, "")           // titres
    .replace(/\*\*([^*]+)\*\*/g, "$1")   // gras
    .replace(/\*([^*]+)\*/g, "$1")       // italique
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1") // underscore
    .replace(/~~([^~]+)~~/g, "$1")       // barré
    .replace(/^\s*[-*+]\s+/gm, "")       // listes à puces
    .replace(/^\s*\d+\.\s+/gm, "")       // listes numérotées
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // liens
    .replace(/[|#>]/g, "")              // tableaux / blockquotes
    .replace(/\n{2,}/g, ". ")           // doubles sauts → pause
    .replace(/\n/g, " ")               // sauts simples
    .trim();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(stripMarkdown(text));
  msg.lang   = "fr-FR";
  msg.rate   = 1.0;
  msg.pitch  = 0.78;
  msg.volume = 1.0;
  window.speechSynthesis.speak(msg);
}

export default function LiveAIAnalysis({ snapshot, robot, muted = false }) {
  const STORAGE_KEY = "neo_ai_messages";

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const DRAFT_KEY = "claude_input_draft";

  const [input, setInput] = useState(() => localStorage.getItem(DRAFT_KEY) ?? "");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); }
    catch { /* quota exceeded */ }
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, input); }
    catch { /* quota exceeded */ }
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function buildContext() {
    const account = snapshot?.account ?? {};
    const pos     = snapshot?.openPositions ?? [];
    const mw      = snapshot?.marketWatch ?? [];
    const opps    = robot?.validOpportunities ?? [];

    return {
      account: {
        balance:    account.balance,
        equity:     account.equity,
        margin:     account.margin,
        free_margin: account.free_margin,
      },
      openPositions: pos.map(p => ({
        symbol:  p.symbol,
        side:    p.side,
        lots:    p.lots,
        pnl_eur: p.pnl_eur,
      })),
      signals: opps.map(o => ({
        symbol:          o.symbol,
        side:            o.side,
        type:            o.type,
        score:           o.score,
        phase:           o.signalPhase ?? o.signalType,
        mode:            o.mode ?? null,
        route:           o.route ?? null,
        d1State:         o.d1State ?? null,
        exhaustion:      o.exhaustion ?? null,
        contResume:      o.contResume ?? null,
        volatilityLevel: o.volatilityLevel ?? null,
        rsi_h1_s0:       o.rsi_h1_s0 ?? null,
        dslope_h1_s0:    o.dslope_h1_s0 ?? null,
        zscore_h1_s0:    o.zscore_h1_s0 ?? null,
        range_ratio_h1:  o.range_ratio_h1 ?? null,
        atr_h1:          o.atr_h1 ?? null,
      })),
      waitOpportunities: (robot?.waitOpportunities ?? []).map(o => ({
        symbol:          o.symbol,
        side:            o.side,
        type:            o.type,
        score:           o.score,
        waitState:       o.state ?? null,
        mode:            o.mode ?? null,
        route:           o.route ?? null,
        d1State:         o.d1State ?? null,
        exhaustion:      o.exhaustion ?? null,
        contResume:      o.contResume ?? null,
        volatilityLevel: o.volatilityLevel ?? null,
        rsi_h1_s0:       o.rsi_h1_s0 ?? null,
        dslope_h1_s0:    o.dslope_h1_s0 ?? null,
        zscore_h1_s0:    o.zscore_h1_s0 ?? null,
        range_ratio_h1:  o.range_ratio_h1 ?? null,
      })),
      marketData: mw.map(r => ({
        symbol:          r.symbol,
        intraday_change: r.intraday_change,
        spread_points:   r.spread_points ?? null,
        atr_h1:          r.atr_h1 ?? null,
        // D1
        rsi_d1:          r.rsi_d1 ?? null,
        slope_d1_s0:     r.slope_d1_s0 ?? null,
        dslope_d1_s0:    r.dslope_d1_s0 ?? null,
        // H4
        rsi_h4:          r.rsi_h4,
        slope_h4:        r.slope_h4,
        slope_h4_s0:     r.slope_h4_s0 ?? null,
        dslope_h4_s0:    r.dslope_h4_s0 ?? null,
        zscore_h4:       r.zscore_h4,
        // H1
        rsi_h1:          r.rsi_h1,
        rsi_h1_s0:       r.rsi_h1_s0 ?? null,
        slope_h1:        r.slope_h1,
        slope_h1_s0:     r.slope_h1_s0 ?? null,
        dslope_h1_s0:    r.dslope_h1_s0 ?? null,
        zscore_h1:       r.zscore_h1,
        zscore_h1_s0:    r.zscore_h1_s0 ?? null,
        range_ratio_h1:  r.range_ratio_h1 ?? null,
        // M5 (closed bar s0)
        rsi_m5_s0:       r.rsi_m5_s0 ?? null,
        slope_m5_s0:     r.slope_m5_s0 ?? null,
        dslope_m5_s0:    r.dslope_m5_s0 ?? null,
        zscore_m5_s0:    r.zscore_m5_s0 ?? null,
      })),
    };
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    localStorage.removeItem(DRAFT_KEY);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: next,
          context: buildContext(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const reply = data?.content ?? data?.message ?? "No response";

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      if (!muted) speak(reply);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([]);
  }

  const opps = robot?.validOpportunities ?? [];

  return (
    <div className="ai-container">

      <div className="ai-header">
        <span className="ai-header-title">LIVE AI ANALYSIS</span>
        <span className="ai-header-sub">Claude · {opps.length} opp{opps.length !== 1 ? "s" : ""} active</span>
        {messages.length > 0 && (
          <button className="ai-clear-btn" onClick={clearChat}>Clear</button>
        )}
      </div>

      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="ai-placeholder">
            Ask Claude about current market conditions, signals, or risk…
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}`}>
            <span className="ai-msg-role">{m.role === "user" ? "You" : "Claude"}</span>
            <span className="ai-msg-text">{m.content}</span>
          </div>
        ))}

        {loading && (
          <div className="ai-msg ai-msg-assistant ai-msg-loading">
            <span className="ai-msg-role">Claude</span>
            <span className="ai-msg-text ai-thinking">thinking…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="ai-input-row">
        <textarea
          className="ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Claude… (Enter to send)"
          rows={2}
          disabled={loading}
        />
        <button
          className="ai-send-btn"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
        >
          {loading ? "…" : "Send"}
        </button>
      </div>

    </div>
  );
}
