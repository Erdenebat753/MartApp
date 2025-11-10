import React, { useMemo } from "react";
import {
  View,
  Image,
  GestureResponderEvent,
  Text,
  Pressable,
} from "react-native";
import Svg, {
  Polyline as SvgPolyline,
  Circle as SvgCircle,
  Text as SvgText,
} from "react-native-svg";

export type Point = { x: number; y: number };

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
  // Fit map entirely inside given width/height while preserving aspect
  const scale = Math.min(width / mapWidthPx, height / mapHeightPx);
  const dispWidth = Math.round(mapWidthPx * scale);
  const dispHeight = Math.round(mapHeightPx * scale);
  const offX = Math.floor((width - dispWidth) / 2);
  const offY = Math.floor((height - dispHeight) / 2);

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
      scale,
      offX,
      offY,
      user,
      headingDeg,
      polyLen: polyline?.length || 0,
    });
  }

  const onLongPressWrap = (e: GestureResponderEvent) => {
    if (!onLongPress) return;
    const { locationX, locationY } = e.nativeEvent;
    // Inverse transform if map is rotated/centered
    let x = locationX;
    let y = locationY;
    if (rotateMap || centerOnUser) {
      // move to viewport-origin at center
      x -= width / 2;
      y -= height / 2;
      // undo rotation
      if (rotateMap) {
        const ang = ((headingInvert ? -headingDeg : headingDeg) * Math.PI) / 180;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const rx = cos * x + -sin * y;
        const ry = sin * x + cos * y;
        x = rx;
        y = ry;
      }
      // move back from user point
      const userSX = offX + (user?.x ?? 0) * scale;
      const userSY = offY + (user?.y ?? 0) * scale;
      x += userSX;
      y += userSY;
    }
    // convert screen to map px
    const px = (x - offX) / scale;
    const py = (y - offY) / scale;
    onLongPress({ x: px, y: py });
  };

  // Compute category label positions (simple polygon centroid)
  const catLabels = useMemo(() => {
    return (categories || []).map((c) => {
      const pts = Array.isArray(c.polygon) ? c.polygon : [];
      let cx = 0, cy = 0, A = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const p0 = pts[j], p1 = pts[i];
        const a = (p0.x * p1.y - p1.x * p0.y);
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
    }).filter(Boolean) as { name: string; x: number; y: number }[];
  }, [categories, offX, offY, scale]);

  // Build transform so that only the map moves: translate(user to origin), rotate, translate to center
  const userSX = offX + (user?.x ?? 0) * scale;
  const userSY = offY + (user?.y ?? 0) * scale;
  const angleDeg = headingInvert ? -headingDeg : headingDeg;
  const transforms = (rotateMap || centerOnUser) && user
    ? [
        { translateX: -userSX },
        { translateY: -userSY },
        ...(rotateMap ? [{ rotate: `${-angleDeg}deg` as const }] : []),
        { translateX: width / 2 },
        { translateY: height / 2 },
      ]
    : [];

  return (
    <Pressable
      onLongPress={onLongPressWrap}
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
      <View style={{ position: "absolute", left: 0, top: 0, width, height, transform: transforms }}>
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
              if (debug) console.log("[Map2D] image load error", e?.nativeEvent);
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

      {/* User dot rendered on top, always centered when centerOnUser */}
      {user && (
        <Svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
          pointerEvents="none"
        >
          <SvgCircle
            cx={centerOnUser ? width / 2 : offX + user.x * scale}
            cy={centerOnUser ? height / 2 : offY + user.y * scale}
            r={4}
            stroke="#083a66"
            strokeWidth={1}
            fill="#3fa9f5"
          />
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
            s:{scale.toFixed(3)} off:{offX},{offY} poly:{polyline?.length || 0}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
