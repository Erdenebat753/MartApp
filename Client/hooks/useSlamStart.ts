import { useEffect, useRef } from "react";
import { API_BASE } from "../constants/api";

export function useSlamStart(
  _items: any,
  setUser: (p: { x: number; y: number }) => void,
  setHeading: (deg: number) => void
) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/slam`);
        const j = await r.json();
        if (j) {
          console.log('[useSlamStart] slam_start from API:', j);
          setUser({ x: Number(j.x), y: Number(j.y) });
          setHeading(Number(j.heading_deg || 0));
          initialized.current = true;
        }
      } catch (e) {
        console.log('[useSlamStart] fetch error', e);
      }
    })();
  }, [setUser, setHeading]);
}
