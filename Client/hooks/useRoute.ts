import { useCallback, useState } from "react";
import { log } from "../src/logger";
import { API_BASE } from "../constants/api";

export function useRouteCompute() {
  const [route, setRoute] = useState<{x:number;y:number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const compute = useCallback(async (start: {x:number;y:number}, end: {x:number;y:number}, algorithm: 'astar'|'dijkstra' = 'astar') => {
    try {
      setLoading(true);
      log.debug('[useRoute] compute start', { start, end });
      const r = await fetch(`${API_BASE}/api/route/coords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, algorithm })
      });
      const j = await r.json();
      const poly = j?.polyline || [];
      log.debug('[useRoute] response polyline length:', poly.length);
      setRoute(poly);
      setError(null);
    } catch (e: any) {
      log.debug('[useRoute] compute error', e);
      setRoute([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setRoute([]), []);
  const setPolyline = useCallback((polyline: {x:number;y:number}[]) => setRoute(polyline), []);

  return { route, loading, error, compute, clear, setPolyline };
}
