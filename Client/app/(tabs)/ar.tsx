import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Dimensions,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Vibration,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import ARTestScreen from "../../components/ARTestScreen";
import type { TargetBillboard } from "../../components/arSceneBridge";
import Map2D, { Point } from "../../components/Map2D";
import { useItems } from "../../hooks/useItems";
import { useCategories } from "../../hooks/useCategories";
import { useSlamStart } from "../../hooks/useSlamStart";
import { useRouteCompute } from "../../hooks/useRoute";
import { API_BASE } from "../../constants/api";
import type { Item } from "../../src/types";
import { useMartMeta } from "../../hooks/useMartMeta";
import { useLists } from "../../hooks/useLists";
import { useLocalSearchParams } from "expo-router";

const YAW_STABLE_EPS = 0.05;
const POS_STABLE_EPS = 1e-3; // ignore sub-millimeter noise when comparing poses
const FRAME_THROTTLE_MS = 16;
const DEV_MODE_ENABLED =
  String(process.env.EXPO_PUBLIC_DEV_MODE ?? "true").toLowerCase() !== "false";
const ALERT_START_METERS: number = 5;
const ALERT_STOP_METERS: number = 1.5;
const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixColor = (start: [number, number, number], end: [number, number, number], t: number) => {
  const clamped = clampValue(t, 0, 1);
  return [
    Math.round(lerp(start[0], end[0], clamped)),
    Math.round(lerp(start[1], end[1], clamped)),
    Math.round(lerp(start[2], end[2], clamped)),
  ] as [number, number, number];
};

export default function ARTab() {
  const { width, height } = Dimensions.get("window");
  const arHeight = Math.floor(height * 0.6);
  const mapHeight = height - arHeight;
  const { mart, mapWidthPx, mapHeightPx, imageSource } = useMartMeta();
  const { items } = useItems(mart?.id);
  const { categories } = useCategories(mart?.id);
  const [slamStart, setSlamStart] = useState<Point | null>(null);
  const [headingBase, setHeadingBase] = useState<number>(0);
  const [user, setUser] = useState<Point | null>(null);
  const [deviceYaw0, setDeviceYaw0] = useState<number | null>(null);
  const [deviceYaw, setDeviceYaw] = useState<number>(0);
  const [camStart, setCamStart] = useState<[number, number, number] | null>(
    null
  );
  const [camNow, setCamNow] = useState<[number, number, number] | null>(null);
  const [useYawOnly, setUseYawOnly] = useState<boolean>(false);
  const [alignment, setAlignment] = useState<
    "Gravity" | "GravityAndHeading" | "Camera"
  >("GravityAndHeading");
  // Force-calibrate PPM to 100 (1m = 100px)
  const [ppm, setPpm] = useState<number>(100);
  // Use current device yaw for transforming AR camera deltas (default OFF to reduce yaw jitter)
  const [transUseCurrentYaw, setTransUseCurrentYaw] = useState<boolean>(false);
  const rotateMap = false;
  const [autoCenterMap, setAutoCenterMap] = useState<boolean>(true);
  const [centerOnUserToken, setCenterOnUserToken] = useState<number>(0);
  const [showArModel, setShowArModel] = useState<boolean>(true);
  const [alertEffectsEnabled, setAlertEffectsEnabled] = useState<boolean>(true);
  const [planeGuideEnabled, setPlaneGuideEnabled] = useState<boolean>(true);
  const [modelRevision, setModelRevision] = useState<number>(0);
  const yawSmoothRef = React.useRef<number>(0);
  const defaultModelPosition = React.useMemo(
    () => [0, -0.4, -1.2] as [number, number, number],
    []
  );
  const modelYOffset = -0.05;
  const arModelAnimation = "mixamo.com";
  const hasResetOnFocusRef = React.useRef<boolean>(false);
  const slamInitializedRef = React.useRef<boolean>(false);
  const guard = React.useCallback(<T,>(label: string, fn: () => T) => {
    try {
      return fn();
    } catch (e) {
      console.error(`[AR error] ${label}`, e);
      return undefined;
    }
  }, []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const { route, compute, clear, setPolyline } = useRouteCompute();
  const [routeIdx, setRouteIdx] = useState<number>(0);
  const routeKeyRef = React.useRef<string | null>(null);
  const { lists, reload: reloadLists } = useLists();
  const [routeStops, setRouteStops] = useState<
    { id: number; idx: number; name?: string | null }[]
  >([]);
  const [routeStep, setRouteStep] = useState<number>(0);
  const safeLists = useMemo(
    () => (Array.isArray(lists) ? (lists as any[]) : []),
    [lists]
  );
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [listRouteLoading, setListRouteLoading] = useState(false);
  const [listRouteMessage, setListRouteMessage] = useState<string | null>(null);
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const [pendingListId, setPendingListId] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(false);
  const alignmentLabel = React.useMemo(() => {
    if (alignment === "GravityAndHeading") return "중력+방위";
    if (alignment === "Camera") return "카메라";
    return "중력";
  }, [alignment]);
  // Waypoint capture radius: 1 meter expressed in pixels using current ppm
  const waypointRadiusPx = 1.0 * ppm; // 1m zone
  const [debug, setDebug] = useState(false);
  const lastPoseTsRef = React.useRef<number>(0);
  // Keep dynamic values in refs so the AR callback can be stable
  const slamStartRef = React.useRef(slamStart);
  const camStartRef = React.useRef(camStart);
  const deviceYaw0Ref = React.useRef(deviceYaw0);
  const trackingOKRef = React.useRef(true);
  const poseBusyRef = React.useRef(false);
  const poseSampleRef = React.useRef<{
    pos: [number, number, number];
    yaw: number;
  } | null>(null);
  const poseFrameHandleRef = React.useRef<number | null>(null);
  const poseFlushDepthRef = React.useRef<number>(0);
  const vibrationTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stopVibration = React.useCallback(() => {
    if (vibrationTimerRef.current) {
      clearInterval(vibrationTimerRef.current);
      vibrationTimerRef.current = null;
    }
    Vibration.cancel();
  }, []);
  const itemsById = useMemo(
    () => new Map(items.map((it) => [it.id, it] as const)),
    [items]
  );
  const [arModelRotation, setArModelRotation] = useState<[number, number, number]>([0, 0, 0]);
  const camNowLatestRef = React.useRef<[number, number, number] | null>(null);
  const userWorldLatestRef = React.useRef<[number, number, number] | null>(null);
  const deviceYawLatestRef = React.useRef<number>(0);
  const modelTargetRef = React.useRef<Point | null>(null);
  const resolveImageUrl = React.useCallback((raw?: string | null) => {
    if (!raw || raw.length === 0) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
  }, []);
  const handleMapManualControl = React.useCallback(() => {
    setAutoCenterMap((prev) => {
      if (!prev) return prev;
      return false;
    });
  }, []);
  const handleRecenterMap = React.useCallback(() => {
    setAutoCenterMap(true);
    setCenterOnUserToken((t) => t + 1);
  }, []);

  React.useEffect(() => {
    slamStartRef.current = slamStart;
  });
  React.useEffect(() => {
    camStartRef.current = camStart;
  });
  React.useEffect(() => {
    deviceYaw0Ref.current = deviceYaw0;
  });
  React.useEffect(() => {
    camNowLatestRef.current = camNow;
  }, [camNow]);
  React.useEffect(() => {
    deviceYawLatestRef.current = deviceYaw;
  }, [deviceYaw]);
  React.useEffect(() => {
    return guard("cleanup pose frame handle", () => () => {
      if (poseFrameHandleRef.current != null) {
        cancelAnimationFrame(poseFrameHandleRef.current);
        poseFrameHandleRef.current = null;
      }
    });
  }, [guard]);
  React.useEffect(() => {
    return () => {
      stopVibration();
    };
  }, [stopVibration]);

  React.useEffect(() => {
    guard("select default list", () => {
      if (selectedListId == null && safeLists.length > 0) {
        const idVal = (safeLists[0] as any)?.id;
        if (typeof idVal === "number") {
          setSelectedListId(idVal);
        }
      }
    });
  }, [safeLists, selectedListId, guard]);

  React.useEffect(() => {
    guard("sync listId param", () => {
      if (!listId) return;
      const parsed = Number(listId);
      if (Number.isNaN(parsed)) return;
      setSelectedListId(parsed);
      setPendingListId(parsed);
    });
  }, [listId, guard]);

  const flushPoseSample = React.useCallback(() => {
    guard("flushPoseSample", () => {
      poseFlushDepthRef.current += 1;
      if (poseFlushDepthRef.current > 25) {
        console.error(
          "[AR error] flushPoseSample runaway detected — dropping samples to avoid render loop"
        );
        poseSampleRef.current = null;
        poseBusyRef.current = false;
        poseFlushDepthRef.current = 0;
        return;
      }
      const sample = poseSampleRef.current;
      poseFrameHandleRef.current = null;
      if (!sample) {
        poseBusyRef.current = false;
        poseFlushDepthRef.current = 0;
        return;
      }
      const now = Date.now();
      if (now - lastPoseTsRef.current < FRAME_THROTTLE_MS) {
        poseBusyRef.current = false;
        poseFlushDepthRef.current = 0;
        return;
      }
      lastPoseTsRef.current = now;
      const { pos: finalPos, yaw: finalYaw } = sample;
      poseSampleRef.current = null;
      setDeviceYaw((prev) =>
        Math.abs(prev - finalYaw) < YAW_STABLE_EPS ? prev : finalYaw
      );
      setCamNow((prev) => {
        if (
          prev &&
          Math.abs(prev[0] - finalPos[0]) < POS_STABLE_EPS &&
          Math.abs(prev[1] - finalPos[1]) < POS_STABLE_EPS &&
          Math.abs(prev[2] - finalPos[2]) < POS_STABLE_EPS
        ) {
          return prev;
        }
        return finalPos;
      });
      if (slamStartRef.current && !camStartRef.current) {
        camStartRef.current = finalPos;
        setCamStart(finalPos);
      }
      if (deviceYaw0Ref.current === null) {
        deviceYaw0Ref.current = finalYaw;
        setDeviceYaw0(finalYaw);
      }
      poseBusyRef.current = false;
      poseFlushDepthRef.current = 0;
    });
  }, [guard]);

  // Stable handlers (top-level hooks, not inside conditionals/JSX)
  const handleDevicePose = React.useCallback(
    (pos: [number, number, number], yawDeg: number) => {
      guard("handleDevicePose", () => {
        if (!trackingOKRef.current) return;
        poseSampleRef.current = {
          pos: [
            Number(pos?.[0]) || 0,
            Number(pos?.[1]) || 0,
            Number(pos?.[2]) || 0,
          ],
          yaw:
            Number.isFinite(yawDeg) && typeof yawDeg === "number" ? yawDeg : 0,
        };
        if (poseBusyRef.current) return;
        poseBusyRef.current = true;
        if (poseFrameHandleRef.current != null) {
          cancelAnimationFrame(poseFrameHandleRef.current);
          poseFrameHandleRef.current = null;
        }
        poseFrameHandleRef.current = requestAnimationFrame(flushPoseSample);
      });
    },
    [flushPoseSample, guard]
  );

  const handleTrackingState = React.useCallback(
    (st: string, rsn: string) => {
      try {
        const s = `${st} ${rsn}`.toLowerCase();
        // Default optimistic: tracking is OK unless explicit negative markers appear
        let ok = true;
        const negatives = [
          "limited",
          "relocal",
          "insufficient",
          "excessive",
          "unavailable",
          "not available",
          "paused",
          "stopped",
        ];
        for (const n of negatives) {
          if (s.includes(n)) {
            ok = false;
            break;
          }
        }
        trackingOKRef.current = ok;
      } catch {
        trackingOKRef.current = true;
      }
      if (debug)
        console.log("[AR tracking]", st, rsn, "ok=", trackingOKRef.current);
    },
    [debug]
  );

  const isFocused = useIsFocused();

  // When returning to the AR tab, reload lists once but keep existing route/SLAM state intact.
  React.useEffect(() => {
    guard("focus reload", () => {
      if (!isFocused) {
        hasResetOnFocusRef.current = false;
        return;
      }
      if (hasResetOnFocusRef.current) return;
      hasResetOnFocusRef.current = true;
      reloadLists();
    });
  }, [isFocused, reloadLists, guard]);

  // Kick off initial SLAM fetch once with real setters below

  const normalizeDeg = (d: number) => {
    let x = d % 360;
    if (x < 0) x += 360;
    return x;
  };

  // Use SLAM start once, then update by Viro camera deltas
  const onSlamUser = React.useCallback((p: Point) => {
    if (slamInitializedRef.current && slamStartRef.current) return;
    slamInitializedRef.current = true;
    setSlamStart(p);
    setUser(p);
    setCamStart(null);
    setDeviceYaw0(null);
  }, []);
  const onSlamHeading = React.useCallback((deg: number) => {
    setHeadingBase(Number(deg || 0));
  }, []);
  useSlamStart(items, onSlamUser, onSlamHeading);

  React.useEffect(() => {
    guard("yaw smoothing", () => {
      const prev = yawSmoothRef.current;
      let d = ((deviceYaw - prev + 540) % 360) - 180;
      const next = prev + d * 0.1;
      let norm = next % 360;
      if (norm < 0) norm += 360;
      yawSmoothRef.current = norm;
    });
  }, [deviceYaw, guard]);

  const yawRaw = yawSmoothRef.current;
  const yawUsed = yawRaw;
  const effectiveHeading = (() => {
    const base = Number(headingBase || 0);
    const d0 = deviceYaw0 ?? yawUsed;
    const delta = normalizeDeg(yawUsed - d0);
    return normalizeDeg(base + delta);
  })();

  const headingForMap = useYawOnly
    ? normalizeDeg(yawUsed - (deviceYaw0 ?? yawUsed))
    : normalizeDeg(effectiveHeading);
  // Flip here so the 2D arrow points with camera forward without using headingInvert
  const headingForMapUI = normalizeDeg(headingForMap);
  const mapPointToWorld = React.useCallback(
    (target: { x: number; y: number } | null) => {
      if (!target || !slamStart) return null;
      const camOrigin = camStart || camNow || [0, 0, 0];
      const yawRef = transUseCurrentYaw ? yawUsed : deviceYaw0 ?? yawUsed;
      const theta = ((headingBase - yawRef) * Math.PI) / 180;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const dxPx = target.x - slamStart.x;
      const dyPx = target.y - slamStart.y;
      const rx = dxPx / ppm;
      const ry = -dyPx / ppm;
      const vx = cosT * rx + sinT * ry;
      const vzForward = -sinT * rx + cosT * ry;
      const cx = camOrigin?.[0] ?? 0;
      const cy = camOrigin?.[1] ?? 0;
      const cz = camOrigin?.[2] ?? 0;
      return [cx + vx, cy + modelYOffset, cz - vzForward] as [
        number,
        number,
        number
      ];
    },
    [
      slamStart,
      camStart,
      camNow,
      ppm,
      headingBase,
      transUseCurrentYaw,
      yawUsed,
      deviceYaw0,
      modelYOffset,
    ]
  );

  // Recompute user map position from camera movement
  useEffect(() => {
    guard("recompute user map position", () => {
      if (!slamStart || !camStart || !camNow) return;
      const dx = camNow[0] - camStart[0];
      const dz = camNow[2] - camStart[2];
      // compensate AR forward (-Z): use -dz so forward increases +Y in up-coords
      const vx = dx;
      const vy = -dz;
      const yawRef = transUseCurrentYaw ? yawUsed : deviceYaw0 ?? yawUsed;
      // Follow SLAM heading relative to device yaw (original rotation)
      const theta = ((headingBase - yawRef) * Math.PI) / 180;
      const rx = Math.cos(theta) * vx - Math.sin(theta) * vy;
      const ry = Math.sin(theta) * vx + Math.cos(theta) * vy; // up-positive
      const px = rx * ppm;
      const pyDown = -ry * ppm; // convert up->down for image coords
      // Dual deadzone: require small both in meters and pixels to ignore
      const moveM = Math.hypot(dx, dz);
      const movePx = Math.hypot(px, pyDown);
      if (moveM < 0.025 && movePx < 3.0) return; // ignore sub-2.5cm OR sub-3px jitter
      const target = { x: slamStart.x + px, y: slamStart.y + pyDown };
      const beta = 0.7; // higher => smoother (but laggier)
      setUser((prev) =>
        prev
          ? {
              x: prev.x * beta + target.x * (1 - beta),
              y: prev.y * beta + target.y * (1 - beta),
            }
          : target
      );
    });
  }, [
    slamStart,
    camStart,
    camNow,
    headingBase,
    deviceYaw0,
    ppm,
    transUseCurrentYaw,
    yawUsed,
    guard,
  ]);

  const doSearch = () => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    setResults(
      (items || [])
        .filter((it) => (it.name || "").toLowerCase().includes(q))
        .slice(0, 10)
    );
  };

  const navigateTo = (it: Item) => {
    if (!user) {
      Alert.alert("위치 확인 불가", "현재 위치가 아직 설정되지 않았습니다.");
      return;
    }
    Alert.alert("길찾기 시작", `"${it.name}"로 이동할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "시작",
        style: "default",
        onPress: async () => {
          try {
            setRouteStops([]);
            setRouteStep(0);
            await compute(user, { x: it.x, y: it.y });
            setResults([]);
          } catch {}
        },
      },
    ]);
  };

  const handleRouteList = React.useCallback(
    async (forceListId?: number) => {
      if (!user) {
        Alert.alert("위치 확인 불가", "현재 위치가 아직 설정되지 않았습니다.");
        return;
      }
      const targetListId = forceListId ?? selectedListId;
      if (!targetListId) {
        setListRouteMessage("먼저 목록을 선택하세요.");
        return;
      }
      const list = safeLists.find((l) => (l as any)?.id === targetListId);
      const ids = Array.isArray(list?.item_ids) ? list?.item_ids : [];
      if (!ids.length) {
        setListRouteMessage("선택한 목록에 항목이 없습니다.");
        return;
      }
      setListRouteLoading(true);
      setListRouteMessage(null);
      try {
        const payload = { user: { x: user.x, y: user.y }, item_ids: ids };
        const res = await fetch(`${API_BASE}/api/route/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "경로 요청에 실패했습니다.");
        }
        const data = await res.json();
        if (Array.isArray(data?.polyline)) {
          setPolyline(data.polyline);
        }
        // Build stop indices so we can show one leg at a time
        if (Array.isArray(data?.ordered_ids) && Array.isArray(data?.polyline)) {
          const stops: { id: number; idx: number; name?: string | null }[] = [];
          let searchFrom = 0;
          const eps = 0.5; // allow small float drift when matching item coords to polyline points (px)
          const nearEq = (a: number, b: number) => Math.abs(a - b) <= eps;
          for (const id of data.ordered_ids as number[]) {
            const dest = itemsById.get(id);
            if (!dest) continue;
            let found = -1;
            let bestIdx = -1;
            let bestDist = Number.POSITIVE_INFINITY;
            for (let i = searchFrom; i < data.polyline.length; i++) {
              const p = data.polyline[i] || {};
              const px = Number(p.x ?? 0);
              const py = Number(p.y ?? 0);
              const d = Math.hypot(px - dest.x, py - dest.y);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
              }
              if (nearEq(px, dest.x) && nearEq(py, dest.y)) {
                found = i;
                break;
              }
            }
            const idxToUse = found >= 0 ? found : bestIdx;
            if (idxToUse >= 0) {
              stops.push({ id, idx: idxToUse, name: dest.name });
              searchFrom = idxToUse;
            }
          }
          setRouteStops(stops);
          setRouteStep(0);
          setRouteIdx(0);
        } else {
          setRouteStops([]);
          setRouteStep(0);
        }
        setRouteIdx(0);
        setListRouteMessage(
          `Routing ${data?.ordered_ids?.length ?? ids.length} item(s).`
        );
      } catch (e: any) {
        setListRouteMessage(e?.message || "경로 생성에 실패했습니다.");
      } finally {
        setListRouteLoading(false);
      }
    },
    [selectedListId, safeLists, user, setPolyline, itemsById, camStart, camNow, slamStart]
  );

  // Reset waypoint index when a new route comes in
  useEffect(() => {
    guard("route change effect", () => {
      const key = (route || [])
        ?.map((p) => `${p.x?.toFixed?.(3) ?? p.x},${p.y?.toFixed?.(3) ?? p.y}`)
        .join("|");
      if (key !== routeKeyRef.current) {
        routeKeyRef.current = key;
      }
      if (!route || route.length === 0) {
        setRouteStops([]);
        setRouteStep(0);
        return;
      }
      setRouteIdx(0);
    });
  }, [route, guard]);

  useEffect(() => {
    guard("route step bounds", () => {
      if (routeStep >= routeStops.length && routeStops.length > 0) {
        setRouteStep(0);
        setRouteIdx(0);
      }
    });
  }, [routeStops, routeStep, guard]);

  // Advance waypoint when user enters the zone around current waypoint
  useEffect(() => {
    guard("advance waypoint on proximity", () => {
      if (!user || !route || route.length === 0) return;
      setRouteIdx((prevIdx) => {
        let idx = prevIdx;
        // Guard index within bounds
        if (idx < 0) idx = 0;
        if (idx >= route.length) idx = route.length - 1;

        let advanced = false;
        while (idx < route.length) {
          const wp = route[idx];
          const dx = user.x - wp.x;
          const dy = user.y - wp.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= waypointRadiusPx) {
            idx += 1;
            advanced = true;
            continue;
          }
          break;
        }

        if (idx >= route.length) {
          idx = route.length - 1;
        } else if (!advanced) {
          idx = prevIdx;
        }
        return idx;
      });
    });
  }, [user, route, waypointRadiusPx, guard]);

  const displayRoute = useMemo(() => {
    if (!route || !route.length) return route;
    if (routeStops.length === 0) {
      const idx = Math.min(routeIdx, route.length - 1);
      const rem = route.slice(idx);
      return user ? [{ x: user.x, y: user.y }, ...rem] : rem;
    }
    const step = Math.min(routeStep, routeStops.length - 1);
    const startIdx = Math.max(0, step === 0 ? 0 : routeStops[step - 1]?.idx ?? 0);
    const endIdx = Math.min(route.length - 1, routeStops[step]?.idx ?? route.length - 1);
    const clampedStart = Math.max(startIdx, Math.min(routeIdx, endIdx));
    const seg = route.slice(clampedStart, endIdx + 1);
    if (!seg.length) return user ? [{ x: user.x, y: user.y }] : route;
    if (user) {
      const [, ...rest] = seg;
      return [{ x: user.x, y: user.y }, ...rest];
    }
    return seg;
  }, [route, routeIdx, routeStops, routeStep, user]);
  const currentDisplayTarget = useMemo(() => {
    if (!displayRoute || displayRoute.length < 2) return null;
    return displayRoute[1] || null;
  }, [displayRoute]);
  const currentRouteTarget = useMemo(() => {
    if (currentDisplayTarget) return currentDisplayTarget;
    if (!route || route.length === 0) return null;
    const idx = Math.min(routeIdx, route.length - 1);
    return route[idx] ?? null;
  }, [currentDisplayTarget, route, routeIdx]);
  const currentRouteItem = useMemo(() => {
    if (routeStops.length > 0) {
      const step = Math.min(routeStep, routeStops.length - 1);
      const stopId = routeStops[step]?.id;
      if (typeof stopId === "number") {
        const target = itemsById.get(stopId);
        if (target) return target;
      }
    }
    if (!currentRouteTarget || !items.length) return null;
    let best: Item | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const it of items) {
      const dx = it.x - currentRouteTarget.x;
      const dy = it.y - currentRouteTarget.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        best = it;
        bestDist = dist;
      }
    }
    if (best && bestDist <= Math.max(waypointRadiusPx, 75)) {
      return best;
    }
    return null;
  }, [routeStops, routeStep, itemsById, currentRouteTarget, items, waypointRadiusPx]);
  React.useEffect(() => {
    if (!debug) return;
    console.log("[AR debug] currentRouteTarget:", currentRouteTarget);
  }, [currentRouteTarget, debug]);
  const arRouteTargetWorld = useMemo(
    () => mapPointToWorld(currentRouteTarget),
    [mapPointToWorld, currentRouteTarget]
  );
  const arModelPosition = arRouteTargetWorld ?? defaultModelPosition;
  const userWorld = useMemo(() => {
    if (!user) return null;
    return mapPointToWorld(user);
  }, [user, mapPointToWorld]);
  React.useEffect(() => {
    userWorldLatestRef.current = userWorld;
  }, [userWorld]);
  React.useEffect(() => {
    const prev = modelTargetRef.current;
    if (!currentRouteTarget) {
      if (prev) {
        modelTargetRef.current = null;
        setModelRevision((rev) => rev + 1);
      }
      return;
    }
    if (!prev || prev.x !== currentRouteTarget.x || prev.y !== currentRouteTarget.y) {
      modelTargetRef.current = currentRouteTarget;
      setModelRevision((rev) => rev + 1);
    }
  }, [currentRouteTarget]);
  const updateModelRotation = React.useCallback(() => {
    if (!arRouteTargetWorld) {
      setArModelRotation([0, 0, 0]);
      return;
    }
    let targetYaw: number | null = null;
    if (routeDirectionWorld) {
      const dx = routeDirectionWorld[0];
      const dz = routeDirectionWorld[2];
      if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) {
        targetYaw = normalizeDeg((Math.atan2(dx, -dz) * 180) / Math.PI + 180);
      }
    }
    if (targetYaw == null) {
      const lookAt = userWorldLatestRef.current || camNowLatestRef.current;
      if (lookAt) {
        const dx = lookAt[0] - arRouteTargetWorld[0];
        const dz = lookAt[2] - arRouteTargetWorld[2];
        if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) {
          targetYaw = normalizeDeg((Math.atan2(dx, -dz) * 180) / Math.PI + 180);
        }
      }
    }
    if (targetYaw == null && Number.isFinite(deviceYawLatestRef.current)) {
      targetYaw = normalizeDeg(deviceYawLatestRef.current + 180);
    }
    if (targetYaw == null) return;
    setArModelRotation((prev) => {
      if (prev[1] === targetYaw) return prev;
      if (debug) {
        console.log("[AR debug] rotation set ->", targetYaw.toFixed(2));
      }
      return [0, targetYaw, 0];
    });
  }, [arRouteTargetWorld, debug]);
  React.useEffect(() => {
    updateModelRotation();
  }, [
    updateModelRotation,
    currentRouteTarget,
    routeIdx,
    routeStep,
    userWorld,
    camNow,
    deviceYaw,
    routeDirectionWorld,
  ]);
  const routeWorldPoints = useMemo(() => {
    if (!route || route.length === 0) return [];
    return route.map((pt) => mapPointToWorld(pt));
  }, [route, mapPointToWorld]);
  const routePolylineWorld = useMemo(() => {
    if (!displayRoute || displayRoute.length < 2) return [];
    return displayRoute
      .map((pt) => mapPointToWorld(pt))
      .filter(
        (p): p is [number, number, number] =>
          Array.isArray(p) && p.length === 3 && p.every((v) => typeof v === "number")
      );
  }, [displayRoute, mapPointToWorld]);
  const routeDirectionWorld = useMemo(() => {
    if (!routePolylineWorld || routePolylineWorld.length < 2) return null;
    const from = routePolylineWorld[0];
    const to = routePolylineWorld[1];
    if (!from || !to) return null;
    return [to[0] - from[0], to[1] - from[1], to[2] - from[2]] as [
      number,
      number,
      number
    ];
  }, [routePolylineWorld]);
  const targetDistanceMeters = useMemo(() => {
    if (!user || !currentRouteTarget) return Number.POSITIVE_INFINITY;
    const dx = user.x - currentRouteTarget.x;
    const dy = user.y - currentRouteTarget.y;
    return Math.hypot(dx, dy) / ppm;
  }, [user, currentRouteTarget, ppm]);
  const rawTargetBillboard = useMemo<TargetBillboard | null>(() => {
    if (!arRouteTargetWorld || !currentRouteItem) return null;
    const heightCm =
      "z" in currentRouteItem
        ? Number((currentRouteItem as Item & { z?: number | null }).z ?? 0)
        : 0;
    const heightMeters = Math.max(0, heightCm / 100);
    const imageUri = resolveImageUrl(currentRouteItem.image_url || null);
    return {
      position: [
        arRouteTargetWorld[0],
        arRouteTargetWorld[1] + heightMeters,
        arRouteTargetWorld[2],
      ] as [number, number, number],
      name: currentRouteItem.name,
      imageUrl: imageUri,
    };
  }, [arRouteTargetWorld, currentRouteItem, resolveImageUrl]);
  React.useEffect(() => {
    if (!debug) return;
    console.log("[AR debug] arModelPosition:", arModelPosition);
  }, [arModelPosition, debug]);

  const goPrevLeg = () => {
    setRouteStep((prev) => {
      if (!routeStops.length) return prev;
      const next = Math.max(0, prev - 1);
      const startIdx = next === 0 ? 0 : routeStops[next - 1]?.idx ?? 0;
      setRouteIdx(startIdx);
      return next;
    });
  };

  const goNextLeg = () => {
    setRouteStep((prev) => {
      if (!routeStops.length) return prev;
      const next = Math.min(routeStops.length - 1, prev + 1);
      const startIdx = next === 0 ? 0 : routeStops[next - 1]?.idx ?? 0;
      setRouteIdx(startIdx);
      return next;
    });
  };

  // Remaining distance (m) and ETA (s)
  const remaining = React.useMemo(() => {
    if (!route || route.length === 0) return { meters: 0, seconds: 0 } as const;
    const idx = Math.min(routeIdx, route.length - 1);
    let sumPx = 0;
    if (user) {
      const p = route[idx];
      sumPx += Math.hypot(p.x - user.x, p.y - user.y);
    }
    for (let i = idx; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      sumPx += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const meters = sumPx / ppm;
    const speed = 1.2; // m/s approx indoor walking
    const seconds = meters / speed;
    return { meters, seconds } as const;
  }, [route, routeIdx, user, ppm]);
  const hasActiveRoute = Boolean(route && route.length > 0);
  const distanceMeters = remaining.meters;
  const arAlertVisuals = useMemo(() => {
    if (
      !alertEffectsEnabled ||
      !hasActiveRoute ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters > ALERT_START_METERS
    ) {
      return null;
    }
    const clamped = clampValue(distanceMeters, ALERT_STOP_METERS, ALERT_START_METERS);
    const progress =
      ALERT_START_METERS === ALERT_STOP_METERS
        ? 1
        : clampValue(
            (ALERT_START_METERS - clamped) /
              (ALERT_START_METERS - ALERT_STOP_METERS),
            0,
            1
          );
    const [r, g, b] = mixColor([250, 204, 21], [220, 38, 38], progress);
    return {
      borderColor: `rgb(${r}, ${g}, ${b})`,
      overlayColor: `rgba(${r}, ${g}, ${b}, ${0.06 + progress * 0.18})`,
      borderWidth: 2 + progress * 4,
    };
  }, [alertEffectsEnabled, distanceMeters, hasActiveRoute]);
  const activeBillboard =
    Number.isFinite(targetDistanceMeters) && targetDistanceMeters <= ALERT_STOP_METERS
      ? rawTargetBillboard
      : null;
  React.useEffect(() => {
    if (!isFocused || !hasActiveRoute) {
      stopVibration();
      return;
    }
    if (
      !alertEffectsEnabled ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters > ALERT_STOP_METERS
    ) {
      stopVibration();
      return;
    }
    const progress = 1 - clampValue(distanceMeters / ALERT_STOP_METERS, 0, 1);
    const interval = Math.round(lerp(900, 220, progress));
    const vibrateNow = () => Vibration.vibrate(90);
    stopVibration();
    vibrateNow();
    vibrationTimerRef.current = setInterval(vibrateNow, interval);
    return () => {
      stopVibration();
    };
  }, [alertEffectsEnabled, distanceMeters, isFocused, hasActiveRoute, stopVibration]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {/* TOP: AR */}
        <View style={{ height: arHeight }}>
          <View style={{ flex: 1 }}>
            {isFocused ? (
              <ARTestScreen
                alignment={alignment}
                onDevicePose={handleDevicePose}
                onTrackingState={handleTrackingState}
                modelPosition={arModelPosition}
                modelRotation={arModelRotation}
                routePointsWorld={routeWorldPoints}
                routePolylineWorld={routePolylineWorld}
                targetBillboard={activeBillboard}
                modelVisible={showArModel}
                modelRevision={modelRevision}
                showPlaneGuide={planeGuideEnabled}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#000",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#888" }}>AR paused (switched tab)</Text>
              </View>
            )}
            {arAlertVisuals ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 18,
                  borderWidth: arAlertVisuals.borderWidth,
                  borderColor: arAlertVisuals.borderColor,
                  backgroundColor: arAlertVisuals.overlayColor,
                }}
              />
            ) : null}
          </View>

          {/* Controls dropdown */}
          {DEV_MODE_ENABLED && (
            <View
              style={{
                position: "absolute",
                right: 8,
                top: 8,
                zIndex: 1000,
                elevation: 1000,
                alignItems: "flex-end",
              }}
            >
            <Pressable
              onPress={() => setShowControls((v) => !v)}
              style={{
                backgroundColor: "#111827dd",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#1f2937",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {showControls ? "설정 숨기기" : "설정 보기"}
              </Text>
            </Pressable>
            {showControls && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: "#0b1222ee",
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#1f2937",
                  gap: 8,
                  minWidth: 200,
                }}
              >
                <Pressable
                  onPress={() => setDebug((v) => !v)}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      {debug ? "디버그: 켜짐" : "디버그: 꺼짐"}
                    </Text>
                </Pressable>
                <Pressable
                  onPress={() => setUseYawOnly((v) => !v)}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      {useYawOnly ? "헤딩 모드: YAW" : "헤딩 모드: SLAM+YAW"}
                    </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setAlignment((a) =>
                      a === "GravityAndHeading"
                        ? "Camera"
                        : a === "Camera"
                        ? "Gravity"
                        : "GravityAndHeading"
                    )
                  }
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    정렬 기준: {alignmentLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCamStart(camNow);
                    setDeviceYaw0(deviceYaw);
                  }}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    카메라 기준 재설정
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const eff = effectiveHeading;
                    setHeadingBase(eff);
                    setDeviceYaw0(deviceYaw);
                  }}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    현재 각도로 기준 설정
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    onPress={() => setPpm((p) => Math.max(10, p - 20))}
                    style={{
                      backgroundColor: "#00000088",
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>축척 -</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPpm((p) => p + 20)}
                    style={{
                      backgroundColor: "#00000088",
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>축척 +</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTransUseCurrentYaw((v) => !v)}
                    style={{
                      backgroundColor: "#00000088",
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      회전 기준: {transUseCurrentYaw ? "현재" : "기준"}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={async () => {
                    try {
                      const r = await fetch(`${API_BASE}/api/slam`);
                      const j = await r.json();
                      if (j && j.x != null && j.y != null) {
                        const p = { x: Number(j.x), y: Number(j.y) };
                        slamInitializedRef.current = true;
                        setSlamStart(p);
                        setUser(p);
                        setHeadingBase(Number(j.heading_deg || 0));
                        setCamStart(null);
                        setDeviceYaw0(null);
                      }
                    } catch {}
                  }}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    SLAM 위치 재설정
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => clear()}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    경로 지우기
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPlaneGuideEnabled((v) => !v)}
                  style={{
                    backgroundColor: "#00000088",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    평면 가이드: {planeGuideEnabled ? "켜짐" : "꺼짐"}
                  </Text>
                </Pressable>
                {debug && (
                  <View
                    style={{
                      backgroundColor: "#000000CC",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      zIndex: 1001,
                      elevation: 1001,
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      yaw0:{deviceYaw0 === null ? "-" : deviceYaw0.toFixed(1)}{" "}
                      yaw:
                      {yawUsed.toFixed(1)}
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      headBase:{headingBase.toFixed(1)} eff:
                      {effectiveHeading.toFixed(1)} map:
                      {headingForMap.toFixed(1)}
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      cam0:
                      {camStart
                        ? `${camStart[0].toFixed(2)},${camStart[1].toFixed(
                            2
                          )},${camStart[2].toFixed(2)}`
                        : "-"}
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      cam :
                      {camNow
                        ? `${camNow[0].toFixed(2)},${camNow[1].toFixed(
                            2
                          )},${camNow[2].toFixed(2)}`
                        : "-"}
                    </Text>
                    {camStart && camNow && (
                      <Text style={{ color: "#fff", fontSize: 11 }}>
                        d:(x:{(camNow[0] - camStart[0]).toFixed(2)} z:
                        {(camNow[2] - camStart[2]).toFixed(2)}) ppm:{ppm}
                      </Text>
                    )}
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      user:
                      {user ? `${user.x.toFixed(1)},${user.y.toFixed(1)}` : "-"}
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      route pts:{route?.length ?? 0}
                    </Text>
                  </View>
                )}
              </View>
            )}
            </View>
          )}
          {routeStops.length > 0 && (
            <View
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                bottom: 12,
                backgroundColor: "#000000cc",
                padding: 10,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  단계 {Math.min(routeStep + 1, routeStops.length)} /{" "}
                  {routeStops.length}
                </Text>
                <Text style={{ color: "#d1d5db", marginTop: 2 }}>
                  {itemsById.get(
                    routeStops[Math.min(routeStep, routeStops.length - 1)]?.id
                  )?.name ||
                    `상품 #${
                      routeStops[Math.min(routeStep, routeStops.length - 1)]
                        ?.id ?? "?"
                    }`}
                </Text>
              </View>
              <Pressable
                onPress={goPrevLeg}
                disabled={routeStep <= 0}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: routeStep <= 0 ? "#333" : "#1f2937",
                }}
              >
                <Text style={{ color: routeStep <= 0 ? "#777" : "#fff" }}>
                  이전
                </Text>
              </Pressable>
              <Pressable
                onPress={goNextLeg}
                disabled={routeStep >= routeStops.length - 1}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor:
                    routeStep >= routeStops.length - 1 ? "#333" : "#2563eb",
                }}
              >
                <Text
                  style={{
                    color:
                      routeStep >= routeStops.length - 1 ? "#777" : "#fff",
                    fontWeight: "700",
                  }}
                >
                  다음
                </Text>
              </Pressable>
            </View>
          )}

          {!routeStops.length && (
            <View
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                bottom: 12,
                backgroundColor: "#000000cc",
                padding: 10,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text style={{ color: "#fff" }}>
                이 목록으로 경로 안내를 시작할까요?
              </Text>
              <Pressable
                onPress={() => {
                  const target = pendingListId ?? selectedListId;
                  if (typeof target === "number") {
                    setSelectedListId(target);
                    handleRouteList(target);
                    setPendingListId(null);
                  }
                }}
                disabled={listRouteLoading || !user}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
            backgroundColor: listRouteLoading ? "#374151" : "#2563eb",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>시작</Text>
        </Pressable>
        {!user && (
          <Text style={{ color: "#fbbf24", fontSize: 12, marginTop: 6 }}>
            시작 전에 기기를 조금 움직여 위치를 먼저 고정하세요.
          </Text>
        )}
      </View>
    )}
          {/* Overlay search */}
          <View style={{ position: "absolute", left: 8, right: 8, top: 8, maxHeight: arHeight - 60 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="상품을 검색하세요"
                placeholderTextColor={"#aaa"}
                onSubmitEditing={doSearch}
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: "#111",
                  color: "#fff",
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#333",
                }}
              />
              <Pressable
                onPress={doSearch}
                style={{
                  backgroundColor: "#1e90ff",
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>검색</Text>
              </Pressable>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <Pressable
                onPress={() => setShowArModel((prev) => !prev)}
                style={{
                  backgroundColor: showArModel ? "#14532d" : "#374151",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: showArModel ? "#22c55e" : "#4b5563",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12 }}>
                  3D 모델: {showArModel ? "켜짐" : "꺼짐"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAlertEffectsEnabled((prev) => !prev)}
                style={{
                  backgroundColor: alertEffectsEnabled ? "#7f1d1d" : "#374151",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: alertEffectsEnabled ? "#f87171" : "#4b5563",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12 }}>
                  경고 효과: {alertEffectsEnabled ? "켜짐" : "꺼짐"}
                </Text>
              </Pressable>
            </View>
            {results.length > 0 && (
              <View
                style={{
                  backgroundColor: "#000000cc",
                  borderRadius: 8,
                  padding: 8,
                  marginTop: 6,
                  maxHeight: arHeight - 80,
                }}
              >
                <ScrollView>
                  {results.map((it) => (
                    <Pressable
                      key={it.id}
                      onPress={() => navigateTo(it)}
                      style={{ paddingVertical: 6 }}
                    >
                      <Text style={{ color: "#fff" }}>
                        {it.name} {it.price != null ? `• ₩${it.price}` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {results.length === 0 && query.trim().length > 0 && (
              <View
                style={{
                  backgroundColor: "#000000aa",
                  borderRadius: 8,
                  padding: 8,
                  marginTop: 6,
                }}
              >
                <Text style={{ color: "#fff" }}>검색 결과가 없습니다.</Text>
              </View>
            )}
          </View>
        </View>

        {/* BOTTOM: 2D Map with overlay */}
        <View style={{ height: mapHeight, position: "relative" }}>
          <Map2D
            width={width}
            height={mapHeight}
            mapWidthPx={mapWidthPx || 675}
            mapHeightPx={mapHeightPx || 878}
            backgroundSource={imageSource}
            polyline={displayRoute}
            user={user}
            headingDeg={headingForMapUI}
            headingInvert={false}
            roundMask
            rotateMap={rotateMap}
            centerOnUser={autoCenterMap}
            centerOnUserToken={centerOnUserToken}
            onViewportInteraction={handleMapManualControl}
            debug={debug}
            categories={categories?.map((c) => ({
              name: c.name,
              polygon: c.polygon,
              color: c.color,
            }))}
          />
        <View
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            flexDirection: "row",
            gap: 8,
            justifyContent: "space-between",
          }}
          pointerEvents="box-none"
        >
            <View
              style={{
                backgroundColor: "#000000aa",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>
                남은 거리 {remaining.meters.toFixed(1)}m · 예상{" "}
                {Math.floor(remaining.seconds / 60)}분{" "}
                {Math.round(remaining.seconds % 60)}초
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {!autoCenterMap && (
                <Pressable
                  onPress={handleRecenterMap}
                  style={{
                    backgroundColor: "#1e3a8a",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>
                    지도 다시 맞추기
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
          {DEV_MODE_ENABLED && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 12,
                bottom: safeLists.length > 0 ? 120 : 12,
                backgroundColor: "#000000cc",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                zIndex: 5,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11 }}>
                현재 좌표: {user ? `${user.x.toFixed(1)}, ${user.y.toFixed(1)}` : "-"}
              </Text>
            </View>
          )}
        </View>
        {safeLists.length > 0 && (
          <View
            style={{
              backgroundColor: "#0d0d14",
              borderTopWidth: 1,
              borderTopColor: "#1f2937",
              padding: 12,
              zIndex: 4,
              elevation: 4,
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>
              내 목록
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 10 }}
            >
              {safeLists.map((l, i) => {
                const lid = (l as any)?.id ?? i;
                const lname = (l as any)?.name;
                const isSel = selectedListId === lid;
                return (
                  <Pressable
                    key={String(lid)}
                    onPress={() => {
                      if (typeof lid === "number") setSelectedListId(lid);
                    }}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isSel ? "#1e90ff" : "#333",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: "#fff" }}>
                      {lname || `목록 #${lid}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => handleRouteList()}
              disabled={listRouteLoading || !safeLists.length}
              style={{
                backgroundColor: listRouteLoading ? "#425e4f" : "#2e8b57",
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {listRouteLoading ? "경로 계산 중..." : "선택 목록 안내"}
              </Text>
            </Pressable>
            {listRouteMessage && (
              <Text style={{ color: "#80ffb3", fontSize: 12, marginTop: 6 }}>
                {listRouteMessage}
              </Text>
            )}
          </View>
        )}

        {!imageSource && (
          <View
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              backgroundColor: "#550000aa",
              padding: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>
              매장 지도 이미지가 설정되지 않았습니다. 관리자 대시보드에서 지도를
              업로드하거나 EXPO_PUBLIC_API_BASE 값을 확인하세요.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
