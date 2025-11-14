import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Dimensions,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import ARTestScreen from "../../components/ARTestScreen";
import Map2D, { Point } from "../../components/Map2D";
import { useItems } from "../../hooks/useItems";
import { useCategories } from "../../hooks/useCategories";
import { useSlamStart } from "../../hooks/useSlamStart";
import { useRouteCompute } from "../../hooks/useRoute";
import { API_BASE } from "../../constants/api";
import type { Item } from "../../src/types";
import { useMartMeta } from "../../hooks/useMartMeta";
import { useLists } from "../../hooks/useLists";
import { useRouter } from "expo-router";
import { useLists } from "../../hooks/useLists";

const YAW_STABLE_EPS = 0.05;
const POS_STABLE_EPS = 1e-4;
const FRAME_THROTTLE_MS = 16;

const requestFrame =
  typeof globalThis.requestAnimationFrame === "function"
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : (cb: (time: number) => void) =>
        setTimeout(() => cb(Date.now()), FRAME_THROTTLE_MS);

const cancelFrame =
  typeof globalThis.cancelAnimationFrame === "function"
    ? globalThis.cancelAnimationFrame.bind(globalThis)
    : (handle: number) => clearTimeout(handle as any);

export default function ARTab() {
  const { width, height } = Dimensions.get("window");
  const half = Math.floor(height * 0.5);
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
  // Use current device yaw for transforming AR camera deltas (better intuition)
  const [transUseCurrentYaw, setTransUseCurrentYaw] = useState<boolean>(true);
  const [rotateMap, setRotateMap] = useState<boolean>(true);
  const yawSmoothRef = React.useRef<number>(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const { route, compute, clear, setPolyline } = useRouteCompute();
  const [routeIdx, setRouteIdx] = useState<number>(0);
  const [arrived, setArrived] = useState<boolean>(false);
  const { lists } = useLists();
  const safeLists = useMemo(() => (Array.isArray(lists) ? (lists as any[]) : []), [lists]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [listRouteLoading, setListRouteLoading] = useState(false);
  const [listRouteMessage, setListRouteMessage] = useState<string | null>(null);
  const router = useRouter();
  const [pendingListId, setPendingListId] = useState<number | null>(null);
  const [pendingListId, setPendingListId] = useState<number | null>(null);
  // Waypoint capture radius: 1 meter expressed in pixels using current ppm
  const waypointRadiusPx = 1.0 * ppm; // 1m zone
  const [debug, setDebug] = useState(false);
  const lastPoseTsRef = React.useRef<number>(0);
  // Keep dynamic values in refs so the AR callback can be stable
  const slamStartRef = React.useRef(slamStart);
  const camStartRef = React.useRef(camStart);
  const deviceYaw0Ref = React.useRef(deviceYaw0);
  const trackingOKRef = React.useRef(true);
  const poseSampleRef = React.useRef<{
    pos: [number, number, number];
    yaw: number;
  } | null>(null);
  const poseFrameHandleRef = React.useRef<number | null>(null);
  const flushPoseSampleRef = React.useRef<() => void>(() => {});

  React.useEffect(() => { slamStartRef.current = slamStart; });
  React.useEffect(() => { camStartRef.current = camStart; });
  React.useEffect(() => { deviceYaw0Ref.current = deviceYaw0; });
  React.useEffect(() => {
    if (selectedListId == null && safeLists.length > 0) {
      const idVal = (safeLists[0] as any)?.id;
      if (typeof idVal === "number") {
        setSelectedListId(idVal);
      }
    }
  }, [safeLists, selectedListId]);

  React.useEffect(() => {
    const state = router.getState();
    const params = state?.routes?.[state.routes.length - 1]?.params as { listId?: string };
    const idParam = params?.listId;
    const parsed = idParam != null ? Number(idParam) : NaN;
    if (!Number.isNaN(parsed)) {
      setSelectedListId(parsed);
      setPendingListId(parsed);
    }
  }, [router, safeLists.length]);

  const schedulePoseFlush = React.useCallback(() => {
    if (poseFrameHandleRef.current != null) return;
    poseFrameHandleRef.current = requestFrame(() => {
      poseFrameHandleRef.current = null;
      flushPoseSampleRef.current();
    });
  }, []);

  const flushPoseSample = React.useCallback(() => {
    const sample = poseSampleRef.current;
    if (!sample) return;
    const now = Date.now();
    if (now - lastPoseTsRef.current < FRAME_THROTTLE_MS) {
      schedulePoseFlush();
      return;
    }
    poseSampleRef.current = null;
    lastPoseTsRef.current = now;
    const { pos: nextPos, yaw } = sample;
    setDeviceYaw((prev) =>
      Math.abs(prev - yaw) < YAW_STABLE_EPS ? prev : yaw
    );
    setCamNow((prev) => {
      if (
        prev &&
        Math.abs(prev[0] - nextPos[0]) < POS_STABLE_EPS &&
        Math.abs(prev[1] - nextPos[1]) < POS_STABLE_EPS &&
        Math.abs(prev[2] - nextPos[2]) < POS_STABLE_EPS
      ) {
        return prev;
      }
      return nextPos;
    });
    if (slamStartRef.current && !camStartRef.current) {
      camStartRef.current = nextPos;
      setCamStart(nextPos);
    }
    if (deviceYaw0Ref.current === null) {
      deviceYaw0Ref.current = yaw;
      setDeviceYaw0(yaw);
    }
  }, [schedulePoseFlush]);

  React.useEffect(() => {
    flushPoseSampleRef.current = flushPoseSample;
  }, [flushPoseSample]);

  React.useEffect(() => {
    return () => {
      if (poseFrameHandleRef.current != null) {
        cancelFrame(poseFrameHandleRef.current);
        poseFrameHandleRef.current = null;
      }
    };
  }, []);

  // Stable handlers (top-level hooks, not inside conditionals/JSX)
  const handleDevicePose = React.useCallback(
    (pos: [number, number, number], yawDeg: number) => {
      if (!trackingOKRef.current) return;
      const nextPos: [number, number, number] = [
        Number(pos?.[0]) || 0,
        Number(pos?.[1]) || 0,
        Number(pos?.[2]) || 0,
      ];
      const yaw =
        Number.isFinite(yawDeg) && typeof yawDeg === "number" ? yawDeg : 0;
      poseSampleRef.current = { pos: nextPos, yaw };
      schedulePoseFlush();
    },
    [schedulePoseFlush]
  );

  const handleTrackingState = React.useCallback((st: string, rsn: string) => {
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
        if (s.includes(n)) { ok = false; break; }
      }
      trackingOKRef.current = ok;
    } catch {
      trackingOKRef.current = true;
    }
    if (debug) console.log("[AR tracking]", st, rsn, "ok=", trackingOKRef.current);
  }, [debug]);

  const isFocused = useIsFocused();

  // Kick off initial SLAM fetch once with real setters below

  const normalizeDeg = (d: number) => {
    let x = d % 360;
    if (x < 0) x += 360;
    return x;
  };


  // Use SLAM start once, then update by Viro camera deltas
  const onSlamUser = React.useCallback((p: Point) => {
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
    const prev = yawSmoothRef.current;
    let d = ((deviceYaw - prev + 540) % 360) - 180;
    const next = prev + d * 0.1;
    let norm = next % 360;
    if (norm < 0) norm += 360;
    yawSmoothRef.current = norm;
  }, [deviceYaw]);

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
    : effectiveHeading;

  // Recompute user map position from camera movement
  useEffect(() => {
    if (!slamStart || !camStart || !camNow) return;
    const dx = camNow[0] - camStart[0];
    const dz = camNow[2] - camStart[2];
    // compensate AR forward (-Z): use -dz so forward increases +Y in up-coords
    const vx = dx;
    const vy = -dz;
    const yawRef = transUseCurrentYaw ? yawUsed : deviceYaw0 ?? yawUsed;
    const theta = ((headingBase - yawRef) * Math.PI) / 180;
    const rx = Math.cos(theta) * vx - Math.sin(theta) * vy;
    const ry = Math.sin(theta) * vx + Math.cos(theta) * vy; // up-positive
    const px = rx * ppm;
    const pyDown = -ry * ppm; // convert up->down for image coords
    // Dual deadzone: require small both in meters and pixels to ignore
    const moveM = Math.hypot(dx, dz);
    const movePx = Math.hypot(px, pyDown);
    if (moveM < 0.008 && movePx < 1.0) return; // <0.8cm AND <1px => ignore
    const target = { x: slamStart.x + px, y: slamStart.y + pyDown };
    const beta = 0.7; // higher => smoother (but laggier)
    setUser((prev) =>
      prev
        ? { x: prev.x * beta + target.x * (1 - beta), y: prev.y * beta + target.y * (1 - beta) }
        : target
    );
  }, [
    slamStart,
    camStart,
    camNow,
    headingBase,
    deviceYaw0,
    ppm,
    transUseCurrentYaw,
    yawUsed,
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
      Alert.alert("No location", "Current location is not set yet.");
      return;
    }
    Alert.alert("Start navigation", `Navigate to \"${it.name}\"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start",
        style: "default",
        onPress: async () => {
          try {
            await compute(user, { x: it.x, y: it.y });
            setResults([]);
          } catch {}
        },
      },
    ]);
  };

  const handleRouteList = React.useCallback(async (forceListId?: number) => {
    if (!user) {
      Alert.alert("No location", "Current location is not set yet.");
      return;
    }
    const targetListId = forceListId ?? selectedListId;
    if (!targetListId) {
      setListRouteMessage("Select a list first.");
      return;
    }
    const list = safeLists.find((l) => (l as any)?.id === targetListId);
    const ids = Array.isArray(list?.item_ids) ? list?.item_ids : [];
    if (!ids.length) {
      setListRouteMessage("Selected list contains no items.");
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
        throw new Error(text || "Route request failed");
      }
      const data = await res.json();
      if (Array.isArray(data?.polyline)) {
        setPolyline(data.polyline);
      }
      setRouteIdx(0);
      setArrived(false);
      setListRouteMessage(`Routing ${data?.ordered_ids?.length ?? ids.length} item(s).`);
    } catch (e: any) {
      setListRouteMessage(e?.message || "Route generation failed.");
    } finally {
      setListRouteLoading(false);
    }
  }, [selectedListId, safeLists, user, setPolyline]);

  React.useEffect(() => {
    if (pendingListId && user) {
      handleRouteList(pendingListId);
      setPendingListId(null);
    }
  }, [pendingListId, user, handleRouteList]);

  // Reset waypoint index when a new route comes in
  useEffect(() => {
    if (!route) return;
    setRouteIdx(0);
    setArrived(false);
  }, [route]);

  // Advance waypoint when user enters the zone around current waypoint
  useEffect(() => {
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
        setArrived(true);
        return route.length - 1;
      } else if (advanced) {
        setArrived(false);
        return idx;
      }
      return prevIdx;
    });
  }, [user, route, waypointRadiusPx]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {/* TOP: AR */}
        <View style={{ height: half }}>
          {isFocused ? (
            <ARTestScreen
              alignment={alignment}
              onDevicePose={handleDevicePose}
              onTrackingState={handleTrackingState}
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

          {/* Debug toggle */}
          <View
            style={{
              position: "absolute",
              right: 8,
              top: 8,
              gap: 6,
              zIndex: 1000,
              elevation: 1000,
            }}
          >
            <Pressable
              onPress={() => setDebug((v) => !v)}
              style={{
                backgroundColor: "#00000088",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>
                {debug ? "Debug: ON" : "Debug: OFF"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setUseYawOnly((v) => !v)}
              style={{
                backgroundColor: "#00000088",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>
                {useYawOnly ? "Heading Mode: YAW" : "Heading Mode: SLAM+YAW"}
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
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>
                Align: {alignment}
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
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>
                Reset Cam Anchor
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // set base heading to current effective heading, zero future delta
                // after this, effectiveHeading remains visually same but base value updates
                const eff = effectiveHeading;
                setHeadingBase(eff);
                setDeviceYaw0(deviceYaw);
              }}
              style={{
                backgroundColor: "#00000088",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12 }}>
                Set Base = Now
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
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11 }}>
                  yaw0:{deviceYaw0 === null ? "-" : deviceYaw0.toFixed(1)} yaw:
                  {yawUsed.toFixed(1)}
                </Text>
                <Text style={{ color: "#fff", fontSize: 11 }}>
                  headBase:{headingBase.toFixed(1)} eff:
                  {effectiveHeading.toFixed(1)} map:{headingForMap.toFixed(1)}
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
              </View>
            )}
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
                <Text style={{ color: "#fff", fontSize: 12 }}>PPM -</Text>
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
                <Text style={{ color: "#fff", fontSize: 12 }}>PPM +</Text>
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
                  Trans Rot: {transUseCurrentYaw ? "CURRENT" : "BASE"}
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
              <Text style={{ color: "#fff", fontSize: 12 }}>Recenter SLAM</Text>
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
              <Text style={{ color: "#fff", fontSize: 12 }}>Clear Route</Text>
            </Pressable>
          </View>
          {/* Overlay search */}
          <View style={{ position: "absolute", left: 8, right: 8, top: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search product"
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
                <Text style={{ color: "#fff", fontWeight: "600" }}>Search</Text>
              </Pressable>
            </View>
            {results.length > 0 && (
              <View
                style={{
                  backgroundColor: "#000000cc",
                  borderRadius: 8,
                  padding: 8,
                  marginTop: 6,
                  maxHeight: half - 80,
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
                <Text style={{ color: "#fff" }}>No results.</Text>
              </View>
            )}
          </View>
        </View>

        {/* BOTTOM: 2D Map with overlay */}
        <View style={{ height: half, position: "relative" }}>
          <Map2D
            width={width}
            height={half}
            mapWidthPx={mapWidthPx || 675}
            mapHeightPx={mapHeightPx || 878}
            backgroundSource={imageSource}
            polyline={
              route && route.length
                ? (() => {
                    const idx = Math.min(routeIdx, route.length - 1);
                    const rem = route.slice(idx);
                    return user ? [{ x: user.x, y: user.y }, ...rem] : rem;
                  })()
                : route
            }
            user={user}
            headingDeg={headingForMap}
            headingInvert={true}
            roundMask
            rotateMap={rotateMap}
            centerOnUser={false}
            debug={debug}
            categories={categories?.map((c) => ({
              name: c.name,
              polygon: c.polygon,
              color: c.color,
            }))}
            onLongPress={(p) => {
              if (!user) {
                Alert.alert("No location", "Current location is not set yet.");
                return;
              }
              compute(user, { x: p.x, y: p.y });
            }}
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
                Rem: {remaining.meters.toFixed(1)} m ETA: {
                Math.floor(remaining.seconds / 60)}m {Math.round(remaining.seconds % 60)}s
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                onPress={() => setRotateMap((v: boolean) => !v)}
                style={{
                  backgroundColor: "#00000088",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12 }}>
                  Rotate Map: {rotateMap ? "ON" : "OFF"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        {safeLists.length > 0 && (
          <View
            style={{
              backgroundColor: "#0d0d14",
              borderTopWidth: 1,
              borderTopColor: "#1f2937",
              padding: 12,
            }}
          >
            <Text
              style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}
            >
              Lists
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
                      {lname || `List #${lid}`}
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
                {listRouteLoading ? "Routing..." : "Route selected list"}
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
              No map image configured. Upload a map for this mart in the Admin
              dashboard or set EXPO_PUBLIC_API_BASE correctly.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
