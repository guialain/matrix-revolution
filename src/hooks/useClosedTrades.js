import { useState, useEffect } from "react";

export default function useClosedTrades(intervalMs = 5000) {
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetch_ = async () => {
      try {
        const res  = await fetch("https://matrix-revolution.onrender.com/api/closedtrades?userId=NeoTrader");
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