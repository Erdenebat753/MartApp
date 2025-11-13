import { useEffect, useRef } from "react";
import { API_BASE } from "../constants/api";
import { log } from "../src/logger";

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
          log.debug('[useSlamStart] slam_start from API:', j);
          setUser({ x: Number(j.x), y: Number(j.y) });
          // Admin stores 0° = +X (east). Client uses 0° = up/north.
          const raw = Number(j.heading_deg || 0);
          let conv = (raw + 90) % 360;
          if (conv < 0) conv += 360;
          setHeading(conv);
          initialized.current = true;
        }
      } catch (e) {
        log.debug('[useSlamStart] fetch error', e);
      }
    })();
  }, [setUser, setHeading]);
}
