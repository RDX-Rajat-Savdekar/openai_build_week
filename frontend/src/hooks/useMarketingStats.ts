import { useCallback, useEffect, useState } from "react";
import { api, type PublicMarketingData } from "@/lib/api";

export function useMarketingStats(pollMs = 45_000) {
  const [data, setData] = useState<PublicMarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await api.publicMarketing());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(true), pollMs);
    return () => window.clearInterval(t);
  }, [load, pollMs]);

  return { data, loading, error, refresh: () => load(true) };
}
