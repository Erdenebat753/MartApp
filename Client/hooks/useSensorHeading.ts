import { useEffect, useState } from 'react';

// Lightweight optional import to avoid hard dependency if not installed
type MagnetometerType = {
  addListener: (cb: (data: { x: number; y: number; z: number }) => void) => { remove: () => void };
  setUpdateInterval: (ms: number) => void;
};

export function useSensorHeading(intervalMs: number = 200) {
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const [available, setAvailable] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    let sub: { remove: () => void } | null = null;
    let Magnetometer: MagnetometerType | null = null;

    (async () => {
      try {
        // Prefer deep import to avoid pulling in Pedometer on platforms/dev clients that lack it
        try {
          const m: any = await import('expo-sensors/build/Magnetometer');
          Magnetometer = (m?.Magnetometer || m?.default) as MagnetometerType | null;
        } catch {}
        // Fallback to package index if deep import not available
        if (!Magnetometer) {
          const mod: any = await import('expo-sensors');
          Magnetometer = (mod?.Magnetometer || null) as MagnetometerType | null;
        }
        if (!Magnetometer) {
          setAvailable(false);
          return;
        }
        setAvailable(true);
        try { Magnetometer.setUpdateInterval(intervalMs); } catch {}
        sub = Magnetometer.addListener((data) => {
          if (!mounted) return;
          const { x = 0, y = 0 } = data || {};
          // Heading (degrees), device flat, portrait: atan2(y, x)
          let deg = (Math.atan2(y, x) * 180) / Math.PI; // -180..180
          if (deg < 0) deg += 360;
          setHeadingDeg(deg);
        });
      } catch {
        // If anything fails (e.g., module missing), mark as unavailable but do not crash
        setAvailable(false);
      }
    })();

    return () => {
      mounted = false;
      try { sub?.remove(); } catch {}
    };
  }, [intervalMs]);

  return { headingDeg, available } as const;
}
