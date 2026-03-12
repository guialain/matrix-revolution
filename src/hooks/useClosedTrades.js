import { useState, useEffect } from "react";
const API_BASE = window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin;

export default function useClosedTrades(intervalMs = 5000) {
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetch_ = async () => {
      try {
        const res  = await fetch(`${API_BASE}/api/closedtrades`, { credentials: "include" });
        const data = await res.json();
        if (active) {
          setTrades(data.trades ?? []);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [intervalMs]);

  return { trades, loading };
}