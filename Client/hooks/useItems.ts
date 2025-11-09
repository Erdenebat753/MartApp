import { useCallback, useEffect, useState } from "react";
import { log } from "../src/logger";
import { API_BASE } from "../constants/api";
import type { Item } from "../src/types";

export function useItems(martId?: number | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const url = martId != null ? `${API_BASE}/api/items?mart_id=${encodeURIComponent(String(martId))}` : `${API_BASE}/api/items`;
      log.debug(`[useItems] fetching: ${url}`);
      const res = await fetch(url);
      const list = await res.json();
      log.debug(`[useItems] fetched items:`, Array.isArray(list) ? list.length : list);
      setItems(list);
      setError(null);
    } catch (e: any) {
      log.debug(`[useItems] fetch error:`, e);
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [martId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, refetch: load };
}
