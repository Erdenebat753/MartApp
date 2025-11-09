import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../constants/api";
import { log } from "../src/logger";

type Mart = {
  id: number;
  name: string;
  coord_x?: number | null;
  coord_y?: number | null;
  map_width_px?: number | null;
  map_height_px?: number | null;
  map_image_url?: string | null;
};

function resolveImageUrl(raw?: string | null): string | null {
  if (!raw || raw.length === 0) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // treat as backend-relative path
  return `${API_BASE}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export function useMartMeta() {
  const [mart, setMart] = useState<Mart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const envId = process.env.EXPO_PUBLIC_MART_ID;
        let m: Mart | null = null;
        if (envId && envId.length > 0) {
          const r = await fetch(`${API_BASE}/api/marts/${encodeURIComponent(envId)}`);
          if (!r.ok) throw new Error(`Failed to load mart ${envId} (HTTP ${r.status})`);
          m = await r.json();
        } else {
          const r = await fetch(`${API_BASE}/api/marts`);
          if (!r.ok) throw new Error(`Failed to list marts (HTTP ${r.status})`);
          const list: Mart[] = await r.json();
          m = Array.isArray(list) && list.length > 0 ? list[0] : null;
        }
        if (mounted) {
          setMart(m);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) {
          setMart(null);
          setError(e);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const imageSource = useMemo(() => {
    const u = resolveImageUrl(mart?.map_image_url || null);
    if (u) log.debug('[useMartMeta] map image url:', u);
    else log.debug('[useMartMeta] no map image url on mart');
    return u ? { uri: u } : undefined;
  }, [mart]);

  const mapWidthPx = useMemo(() => (mart?.map_width_px ? Number(mart.map_width_px) : undefined), [mart]);
  const mapHeightPx = useMemo(() => (mart?.map_height_px ? Number(mart.map_height_px) : undefined), [mart]);

  return { mart, mapWidthPx, mapHeightPx, imageSource, loading, error } as const;
}
