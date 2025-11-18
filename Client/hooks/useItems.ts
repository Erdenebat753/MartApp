import { useCallback, useEffect, useState } from "react";
import { log } from "../src/logger";
import { API_BASE } from "../constants/api";
import type { Item } from "../src/types";

export function useItems(martId?: number | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    const normalizeList = (raw: any): Item[] => {
      if (Array.isArray(raw)) return raw as Item[];
      if (raw && Array.isArray((raw as any).items)) return (raw as any).items as Item[];
      if (raw && Array.isArray((raw as any).data)) return (raw as any).data as Item[];
      return [];
    };
    try {
      setLoading(true);
      const url = martId != null ? `${API_BASE}/api/items?mart_id=${encodeURIComponent(String(martId))}` : `${API_BASE}/api/items`;
      log.debug(`[useItems] fetching: ${url}`);
      const res = await fetch(url);
      const list = normalizeList(await res.json());
      if (martId != null && list.length === 0) {
        // New API might require a mart id; fall back to all items if none returned
        const resAll = await fetch(`${API_BASE}/api/items`);
        const listAll = normalizeList(await resAll.json());
        log.debug(`[useItems] mart ${martId} empty, fallback items:`, listAll.length);
        setItems(listAll);
      } else {
        log.debug(`[useItems] fetched items:`, list.length);
        setItems(list);
      }
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
