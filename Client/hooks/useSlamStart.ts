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
        const r = await fetch(API_BASE + "/api/slam");
        const j = await r.json();
        if (j) {
          log.debug('[useSlamStart] slam_start from API:', j);
          setUser({ x: Number(j.x), y: Number(j.y) });
          // Admin now stores 0 deg as "forward/up" – normalize only
          const raw = Number(j.heading_deg || 0);
          let normalized = raw % 360;
          if (normalized < 0) normalized += 360;
          setHeading(normalized);
          initialized.current = true;
        }
      } catch (e) {
        log.debug('[useSlamStart] fetch error', e);
      }
    })();
  }, [setUser, setHeading]);
}
