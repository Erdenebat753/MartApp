import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../constants/api";

export type ItemList = { id: number; name?: string | null; item_ids: number[] };

async function jsonFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

export function useLists() {
  const [lists, setLists] = useState<ItemList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await jsonFetch<ItemList[]>(`${API_BASE}/api/lists`);
      setLists(data);
      setError(null);
    } catch (e: any) {
      setError(e);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (name: string) => {
    const payload = { name, item_ids: [] as number[] };
    const created = await jsonFetch<ItemList>(`${API_BASE}/api/lists`, { method: 'POST', body: JSON.stringify(payload) });
    setLists(prev => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: number, data: Partial<ItemList>, base?: ItemList) => {
    const original = lists.find(l => l.id === id) ?? base;
    if (!original) throw new Error(`List ${id} not found`);
    const payload = {
      name: data.name ?? original?.name ?? null,
      item_ids: data.item_ids ?? original?.item_ids ?? [],
    };
    const saved = await jsonFetch<ItemList>(`${API_BASE}/api/lists/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    setLists(prev => {
      const exists = prev.some(l => l.id === id);
      if (!exists) return [...prev, saved];
      return prev.map(l => l.id === id ? saved : l);
    });
    return saved;
  }, [lists]);

  const remove = useCallback(async (id: number) => {
    await fetch(`${API_BASE}/api/lists/${id}`, { method: 'DELETE' });
    setLists(prev => prev.filter(l => l.id !== id));
  }, []);

  const appendItems = useCallback(async (id: number, ids: number[], fallback?: ItemList) => {
    const l = lists.find(x => x.id === id) ?? fallback;
    if (!l) return null;
    const merged = Array.from(new Set([...(l.item_ids || []), ...ids.map(n => Number(n))])).filter(n => Number.isFinite(n));
    return update(id, { item_ids: merged }, l);
  }, [lists, update]);

  const removeItem = useCallback(async (id: number, itemId: number) => {
    const l = lists.find(x => x.id === id);
    if (!l) return null;
    const filtered = (l.item_ids || []).filter(x => x !== itemId);
    return update(id, { item_ids: filtered });
  }, [lists, update]);

  return { lists, loading, error, reload, create, update, remove, appendItems, removeItem } as const;
}
