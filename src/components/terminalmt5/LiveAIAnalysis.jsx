// ============================================================================
// LiveAIAnalysis.jsx — Claude API integration (scaffold)
// Props : snapshot, robot
// ============================================================================

import { useState, useRef, useEffect } from "react";
import "../../styles/stylesterminalMT5/liveaianalysis.css";

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : window.location.origin;

export default function LiveAIAnalysis({ snapshot, robot }) {
  const STORAGE_KEY = "neo_ai_messages";

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); }
    catch { /* quota exceeded */ }
  }, [messages]);

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
        symbol: p.symbol,
        side:   p.side,
        lots:   p.lots,
        pnl_eur: p.pnl_eur,
      })),
      signals: opps.map(o => ({
        symbol:          o.symbol,
        side:            o.side,
        type:            o.type,
        score:           o.score,
        phase:           o.signalPhase ?? o.signalType,
        volatilityLevel: o.volatilityLevel ?? null,
      })),
      waitOpportunities: (robot?.waitOpportunities ?? []).map(o => ({
        symbol:          o.symbol,
        side:            o.side,
        type:            o.type,
        score:           o.score,
        waitState:       o.waitState ?? null,
        volatilityLevel: o.volatilityLevel ?? null,
      })),
      marketData: mw.map(r => ({
        symbol:          r.symbol,
        intraday_change: r.intraday_change,
        // H4
        rsi_h4:          r.rsi_h4,
        slope_h4:        r.slope_h4,
        dslope_h4:       r.dslope_h4,
        zscore_h4:       r.zscore_h4,
        // H1
        rsi_h1:          r.rsi_h1,
        slope_h1:        r.slope_h1,
        dslope_h1:       r.dslope_h1,
        zscore_h1:       r.zscore_h1,
        // M5
        rsi_m5:          r.rsi_m5,
        slope_m5:        r.slope_m5,
        dslope_m5:       r.dslope_m5,
        zscore_m5:       r.zscore_m5,
      })),
    };
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
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
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
