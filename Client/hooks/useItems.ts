import { useEffect, useState } from "react";
import { API_BASE } from "../constants/api";
import type { Item } from "../src/types";

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      console.log(`[useItems] fetching: ${API_BASE}/api/items`);
      const res = await fetch(`${API_BASE}/api/items`);
      const list = await res.json();
      console.log(`[useItems] fetched items:`, Array.isArray(list) ? list.length : list);
      setItems(list);
      setError(null);
    } catch (e: any) {
      console.log(`[useItems] fetch error:`, e);
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { items, loading, error, refetch: load };
}
