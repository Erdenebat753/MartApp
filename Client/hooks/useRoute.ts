import { useState } from "react";
import { API_BASE } from "../constants/api";

export function useRouteCompute() {
  const [route, setRoute] = useState<{x:number;y:number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const compute = async (start: {x:number;y:number}, end: {x:number;y:number}) => {
    try {
      setLoading(true);
      console.log('[useRoute] compute start', { start, end });
      const r = await fetch(`${API_BASE}/api/route/coords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end })
      });
      const j = await r.json();
      const poly = j?.polyline || [];
      console.log('[useRoute] response polyline length:', poly.length);
      setRoute(poly);
      setError(null);
    } catch (e: any) {
      console.log('[useRoute] compute error', e);
      setRoute([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => setRoute([]);

  return { route, loading, error, compute, clear };
}
