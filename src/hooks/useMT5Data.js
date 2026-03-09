import { useEffect, useRef, useState } from "react";

// ============================================================================
// useMT5Data — NEO MATRIX
// Source of truth frontend
// ============================================================================

const API_URL = "http://localhost:3001/api/mt5data";
const REFRESH_MS = 800;

export default function useMT5Data() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;

    const fetchMT5Data = async () => {
      try {
        const res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("API_NOT_AVAILABLE");

        const json = await res.json();
        if (!alive) return;

        setData(json);
        setError(null);

      } catch (err) {
        if (alive) setError(err.message);
      }
    };

    fetchMT5Data();
    timerRef.current = setInterval(fetchMT5Data, REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(timerRef.current);
    };
  }, []);

  return {
    data,
    error,
    ready: !!data && !error
  };
}
