import { useEffect, useState } from "react";
import { API_BASE } from "../constants/api";
import { log } from "../src/logger";

export type PolyPoint = { x: number; y: number };
export type Category = {
  id: number;
  mart_id: number;
  name: string;
  color?: string | null;
  polygon: PolyPoint[];
};

export function useCategories(martId?: number | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  async function load() {
    if (!martId) {
      setCategories([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/api/categories?mart_id=${encodeURIComponent(String(martId))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      setCategories(Array.isArray(list) ? list : []);
      log.debug('[useCategories] fetched', Array.isArray(list) ? list.length : list);
    } catch (e) {
      setError(e);
      log.warn('[useCategories] failed', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [martId]);

  return { categories, loading, error, refetch: load } as const;
}

