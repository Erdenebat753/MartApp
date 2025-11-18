import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Image, Text, PanResponder } from "react-native";
import Svg, {
  Polyline as SvgPolyline,
  Circle as SvgCircle,
  Text as SvgText,
  Polygon as SvgPolygon,
} from "react-native-svg";

export type Point = { x: number; y: number };

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;
const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 12;
const PAN_MARGIN = 60;

const distanceBetweenTouches = (touches: readonly any[]) => {
  if (!touches || touches.length < 2) return 0;
  const [a, b] = touches;
  const dx = (a?.pageX ?? 0) - (b?.pageX ?? 0);
  const dy = (a?.pageY ?? 0) - (b?.pageY ?? 0);
  return Math.hypot(dx, dy);
};

type Props = {
  width: number;
  height: number;
  mapWidthPx: number;
  mapHeightPx: number;
  backgroundSource?: any; // 예: require('../assets/map.png') 등
  polyline?: Point[];
  user?: Point | null;
  onLongPress?: (p: Point) => void;
  headingDeg?: number; // heading for rotate-map mode
  headingInvert?: boolean; // true이면 회전 방향을 반대로 함
  roundMask?: boolean; // 둥гөр хүрээ
  rotateMap?: boolean; // сум биш map эргэнэ
  centerOnUser?: boolean; // хэрэглэгч төвд, зөвхөн map хөдөлнө
  debug?: boolean;
  categories?: { name: string; polygon: Point[]; color?: string | null }[];
};

export default function Map2D({
  width,
  height,
  mapWidthPx,
  mapHeightPx,
  backgroundSource,
  polyline = [],
  user,
  onLongPress,
  headingDeg = 0,
  headingInvert = false,
  roundMask = false,
  rotateMap = false,
  centerOnUser = false,
  debug = false,
  categories = [],
}: Props) {
  const baseScale = Math.min(width / mapWidthPx, height / mapHeightPx);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panOffsetRef = useRef(panOffset);
  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);
  const panStartRef = useRef({ x: 0, y: 0 });

  const pinchBaseRef = useRef<{ dist: number; zoom: number } | null>(null);
  const pinchActiveRef = useRef(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  const clampZoom = useCallback(
    (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    []
  );
  const clampPanValue = useCallback(
    (axis: "x" | "y", value: number, zoomValue = zoomRef.current) => {
      const mapPx =
        (axis === "x" ? mapWidthPx : mapHeightPx) * baseScale * zoomValue;
      const viewport = axis === "x" ? width : height;
      const halfRange = Math.max(viewport, mapPx) / 2 + PAN_MARGIN;
      return Math.max(-halfRange, Math.min(halfRange, value));
    },
    [baseScale, height, mapHeightPx, mapWidthPx, width]
  );

  useEffect(() => {
    setPanOffset((prev) => {
      const nx = clampPanValue("x", prev.x);
      const ny = clampPanValue("y", prev.y);
      if (nx === prev.x && ny === prev.y) return prev;
      return { x: nx, y: ny };
    });
  }, [clampPanValue, zoom]);

  const scale = baseScale * zoom;
  const dispWidth = Math.round(mapWidthPx * scale);
  const dispHeight = Math.round(mapHeightPx * scale);
  const offX = Math.floor((width - dispWidth) / 2);
  const offY = Math.floor((height - dispHeight) / 2);
  const baseUserScreen = useMemo(() => {
    if (!user) return null;
    return {
      x: offX + user.x * scale,
      y: offY + user.y * scale,
    };
  }, [user, offX, offY, scale]);

  const centerShift = useMemo(() => {
    if (!centerOnUser || !baseUserScreen) {
      return { x: 0, y: 0 };
    }
    return {
      x: width / 2 - baseUserScreen.x,
      y: height / 2 - baseUserScreen.y,
    };
  }, [centerOnUser, baseUserScreen, width, height]);

  const effectiveShift = useMemo(
    () => ({
      x: panOffset.x + centerShift.x,
      y: panOffset.y + centerShift.y,
    }),
    [panOffset.x, panOffset.y, centerShift.x, centerShift.y]
  );

  const routePoints = useMemo(() => {
    if (!polyline || polyline.length < 2) return "";
    return polyline
      .map((p) => `${offX + p.x * scale},${offY + p.y * scale}`)
      .join(" ");
  }, [polyline, scale, offX, offY]);

  if (debug) {
    console.log("[Map2D] dims", {
      cont: { width, height },
      map: { mapWidthPx, mapHeightPx },
      disp: { dispWidth, dispHeight },
      zoom,
      scale,
      offX,
      offY,
      pan: panOffset,
      shift: effectiveShift,
      shift: effectiveShift,
      user,
      headingDeg,
      polyLen: polyline?.length || 0,
    });
  }

  const rotationPivot = useMemo(() => {
    if (rotateMap) {
      // When rotating the map, spin around the viewport center (user is centered via centerOnUser)
      return { x: width / 2, y: height / 2 };
    }
    const baseX = baseUserScreen?.x ?? width / 2;
    const baseY = baseUserScreen?.y ?? height / 2;
    return {
      x: baseX + effectiveShift.x,
      y: baseY + effectiveShift.y,
    };
  }, [rotateMap, baseUserScreen, effectiveShift.x, effectiveShift.y, width, height]);

  const screenToMap = useCallback(
    (screenX: number, screenY: number) => {
      let x = screenX;
      let y = screenY;

      if (rotateMap) {
        const pivotX = rotationPivot.x;
        const pivotY = rotationPivot.y;
        const ang =
          ((headingInvert ? -headingDeg : headingDeg) * Math.PI) / 180;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const relX = x - pivotX;
        const relY = y - pivotY;
        const rx = cos * relX - sin * relY;
        const ry = sin * relX + cos * relY;
        x = pivotX + rx;
        y = pivotY + ry;
      }

      x -= effectiveShift.x;
      y -= effectiveShift.y;

      const px = (x - offX) / scale;
      const py = (y - offY) / scale;
      return { x: px, y: py };
    },
    [
      rotateMap,
      rotationPivot.x,
      rotationPivot.y,
      headingInvert,
      headingDeg,
      effectiveShift.x,
      effectiveShift.y,
      offX,
      offY,
      scale,
    ]
  );

  const handlePressFromCoords = useCallback(
    (screenX: number, screenY: number) => {
      if (!onLongPress) return;
      onLongPress(screenToMap(screenX, screenY));
    },
    [onLongPress, screenToMap]
  );

  const scheduleLongPress = useCallback(
    (screenX: number, screenY: number) => {
      if (!onLongPress) return;
      cancelLongPress();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        handlePressFromCoords(screenX, screenY);
      }, LONG_PRESS_MS);
    },
    [cancelLongPress, handlePressFromCoords, onLongPress]
  );

  const finishGesture = useCallback(() => {
    cancelLongPress();
    pinchBaseRef.current = null;
    pinchActiveRef.current = false;
    panStartRef.current = panOffsetRef.current;
  }, [cancelLongPress]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          pinchActiveRef.current = false;
          pinchBaseRef.current = null;
          panStartRef.current = panOffsetRef.current;
          scheduleLongPress(
            evt.nativeEvent.locationX,
            evt.nativeEvent.locationY
          );
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches || [];
          if (touches.length >= 2) {
            pinchActiveRef.current = true;
            cancelLongPress();
            const dist = distanceBetweenTouches(touches);
            if (dist <= 0) return;
            if (!pinchBaseRef.current) {
              pinchBaseRef.current = { dist, zoom: zoomRef.current };
            } else if (pinchBaseRef.current.dist > 0) {
              const factor = dist / pinchBaseRef.current.dist;
              const nextZoom = clampZoom(pinchBaseRef.current.zoom * factor);
              setZoom(nextZoom);
            }
            return;
          }

          if (pinchActiveRef.current) return;

          if (
            Math.abs(gestureState.dx) > MOVE_CANCEL_PX ||
            Math.abs(gestureState.dy) > MOVE_CANCEL_PX
          ) {
            cancelLongPress();
          }

          const next = {
            x: clampPanValue("x", panStartRef.current.x + gestureState.dx),
            y: clampPanValue("y", panStartRef.current.y + gestureState.dy),
          };
          setPanOffset(next);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            !pinchActiveRef.current &&
            Math.abs(gestureState.dx) < MOVE_CANCEL_PX &&
            Math.abs(gestureState.dy) < MOVE_CANCEL_PX
          ) {
            cancelLongPress();
          }
          finishGesture();
        },
        onPanResponderTerminate: finishGesture,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      cancelLongPress,
      clampPanValue,
      clampZoom,
      finishGesture,
      scheduleLongPress,
    ]
  );

  // Compute category label positions (simple polygon centroid)
  const catLabels = useMemo(() => {
    return (categories || [])
      .map((c) => {
        const pts = Array.isArray(c.polygon) ? c.polygon : [];
        let cx = 0,
          cy = 0,
          A = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const p0 = pts[j],
            p1 = pts[i];
          const a = p0.x * p1.y - p1.x * p0.y;
          A += a;
          cx += (p0.x + p1.x) * a;
          cy += (p0.y + p1.y) * a;
        }
        if (Math.abs(A) < 1e-5) {
          // fallback: average of points
          if (pts.length > 0) {
            const sx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const sy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            return { name: c.name, x: offX + sx * scale, y: offY + sy * scale };
          }
          return null;
        }
        A *= 0.5;
        cx = cx / (6 * A);
        cy = cy / (6 * A);
        return { name: c.name, x: offX + cx * scale, y: offY + cy * scale };
      })
      .filter(Boolean) as { name: string; x: number; y: number }[];
  }, [categories, offX, offY, scale]);

  // Build transform so that only the map rotates/translates; user overlay stays outside.
  const userSX = baseUserScreen?.x ?? (width / 2);
  const userSY = baseUserScreen?.y ?? (height / 2);
  const angleDeg = headingInvert ? -headingDeg : headingDeg;
  const transforms = useMemo(() => {
    const t: { [key: string]: string | number }[] = [];
    if (effectiveShift.x !== 0 || effectiveShift.y !== 0) {
      t.push({ translateX: effectiveShift.x }, { translateY: effectiveShift.y });
    }
    if (rotateMap) {
      const pivotX = rotationPivot.x;
      const pivotY = rotationPivot.y;
      t.push(
        { translateX: -pivotX },
        { translateY: -pivotY },
        { rotate: `${-angleDeg}deg` as const },
        { translateX: pivotX },
        { translateY: pivotY }
      );
    }
    return t;
  }, [
    angleDeg,
    rotateMap,
    rotationPivot.x,
    rotationPivot.y,
    effectiveShift.x,
    effectiveShift.y,
  ]);

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        width,
        height,
        backgroundColor: "#111",
        overflow: "hidden",
        borderRadius: roundMask ? Math.min(width, height) / 2 : 0,
        position: "relative",
      }}
    >
      {/* Transform group: map + route rotate/translate; user stays outside */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          transform: transforms,
        }}
      >
        {backgroundSource ? (
          <Image
            source={backgroundSource}
            style={{
              width: dispWidth,
              height: dispHeight,
              position: "absolute",
              left: offX,
              top: offY,
            }}
            resizeMode="stretch"
            onLoad={() => {
              if (debug) console.log("[Map2D] image loaded");
            }}
            onError={(e) => {
              if (debug)
                console.log("[Map2D] image load error", e?.nativeEvent);
            }}
          />
        ) : (
          <View
            style={{
              position: "absolute",
              left: offX,
              top: offY,
              width: dispWidth,
              height: dispHeight,
              backgroundColor: "#222",
            }}
          />
        )}

        {/* Polyline segments (빨간색) */}
        <Svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
          pointerEvents="none"
        >
          {polyline && polyline.length >= 2 && (
            <SvgPolyline
              points={routePoints}
              fill="none"
              stroke="red"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {/* Category labels */}
          {catLabels.map((c, i) => (
            <SvgText
              key={i}
              x={c.x}
              y={c.y}
              fill="#e5e7eb"
              fontSize={12}
              textAnchor="middle"
            >
              {c.name}
            </SvgText>
          ))}
        </Svg>
      </View>

      {/* User marker (arrow + small dot fallback) rendered on top */}
      {user && (
        <Svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
          pointerEvents="none"
        >
          {(() => {
            const cx = rotationPivot.x;
            const cy = rotationPivot.y;
            // When rotating the map, keep arrow pointing up; otherwise rotate by heading
            const hd = Number.isFinite(headingDeg) ? headingDeg : 0;
            const ang =
              ((rotateMap ? 0 : headingInvert ? -hd : hd) * Math.PI) / 180;
            // Triple the previous size for higher visibility
            const s = 24; // size in px (smaller arrow)
            const b = s * 0.6;
            const w = s * 0.8;
            const dx = Math.sin(ang);
            const dy = -Math.cos(ang); // screen up is -y
            const tipX = cx + dx * s;
            const tipY = cy + dy * s;
            const bx = cx - dx * b;
            const by = cy - dy * b;
            const px = dy; // perpendicular
            const py = -dx;
            const leftX = bx + px * (w / 2);
            const leftY = by + py * (w / 2);
            const rightX = bx - px * (w / 2);
            const rightY = by - py * (w / 2);
            const pts = `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
            return (
              <>
                {/* draw center dot first */}
                <SvgCircle
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill="#3fa9f5"
                  stroke="#083a66"
                  strokeWidth={1.5}
                />
                {/* heading ray for extra visibility */}
                <SvgPolyline
                  points={`${cx},${cy} ${tipX},${tipY}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.8 as any}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                {/* arrow on top */}
                <SvgPolygon
                  points={pts}
                  fill="#3fa9f5"
                  stroke="#083a66"
                  strokeWidth={3}
                />
              </>
            );
          })()}
        </Svg>
      )}

      {/* Heading overlay (레이블) */}
      <View
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          backgroundColor: "#00000088",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 12 }}>
          방향: {headingDeg.toFixed(0)}°
        </Text>
        {debug && (
          <Text style={{ color: "#ccc", fontSize: 10, marginTop: 2 }}>
            s:{scale.toFixed(3)} z:{zoom.toFixed(2)} pan:{panOffset.x.toFixed(0)},{panOffset.y.toFixed(0)} poly:{polyline?.length || 0}
          </Text>
        )}
      </View>
    </View>
  );
}
