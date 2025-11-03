import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../constants/api";

type Point = { x: number; y: number };

export function useSlamPoll(
  opts: { intervalMs?: number } = {}
) {
  const { intervalMs = 1000 } = opts;
  const [user, setUser] = useState<Point | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/slam`);
        const j = await r.json();
        if (j && (j.x != null) && (j.y != null)) {
          setUser({ x: Number(j.x), y: Number(j.y) });
          setHeading(Number(j.heading_deg || 0));
        }
      } catch {}
    };

    if (enabled) {
      // immediate fetch then start interval
      tick();
      timer.current = setInterval(tick, Math.max(250, intervalMs));
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [enabled, intervalMs]);

  return { user, heading, enabled, setEnabled } as const;
}
