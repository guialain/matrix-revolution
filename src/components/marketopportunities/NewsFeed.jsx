// ============================================================================
// NewsFeed.jsx — Reuters RSS via /api/news proxy
// Refresh : 60s
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import "../../styles/marketopportunities/newsfeed.css";

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : window.location.origin;

function fmtTime(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (isNaN(d)) return pubDate.slice(0, 16);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mo}/${dd} ${hh}:${mm}`;
}

export default function NewsFeed({ filters = null, defaultFilter = "All" }) {
  const [items, setItems]       = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeFilter, setActiveFilter] = useState(defaultFilter);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/news`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setFetchedAt(data.fetchedAt ?? null);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, 60_000);
    return () => clearInterval(id);
  }, [fetchNews]);

  const lastUpdate = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Filtrage client-side par regex (si filters fournis)
  const activeRegex = (filters && activeFilter !== "All")
    ? filters.find(f => f.key === activeFilter)?.regex ?? null
    : null;

  const filteredItems = activeRegex
    ? items.filter(it => activeRegex.test(`${it.title ?? ""} ${it.description ?? ""}`))
    : items;

  return (
    <div className="nf-container">
      <div className="nf-header">
        <span className="nf-title">LIVE NEWS</span>
        <span className="nf-source">FinancialJuice</span>
        {lastUpdate && <span className="nf-updated">↻ {lastUpdate}</span>}
      </div>

      {filters && filters.length > 0 && (
        <div className="nf-filters">
          {filters.map(f => (
            <button
              key={f.key}
              type="button"
              className={`nf-chip ${activeFilter === f.key ? "nf-chip-active" : ""}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label ?? f.key}
            </button>
          ))}
        </div>
      )}

      <div className="nf-body">
        {loading && <div className="nf-status">Chargement…</div>}
        {error   && <div className="nf-status nf-error">Erreur : {error}</div>}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="nf-status">
            {items.length === 0 ? "Aucun article" : `Aucun article pour "${activeFilter}"`}
          </div>
        )}

        {filteredItems.map((item, i) => (
          <a
            key={i}
            className="nf-item"
            href={item.link || "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="nf-item-time">{fmtTime(item.pubDate)}</span>
            <span className="nf-item-title">{(item.title ?? "").replace(/^FinancialJuice:\s*/i, "")}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
