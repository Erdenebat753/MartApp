import React, { useMemo } from "react";
import { View, Image, GestureResponderEvent, Text, Pressable } from "react-native";

export type Point = { x: number; y: number };

type Props = {
  width: number;
  height: number;
  mapWidthPx: number;
  mapHeightPx: number;
  backgroundSource?: any; // require('../assets/map.png') гэх мэт
  polyline?: Point[];
  user?: Point | null;
  onLongPress?: (p: Point) => void;
  headingDeg?: number; // харагдах байдлын хувьд (одоогоор эргэлт OFF)
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
}: Props) {
  const scale = width / mapWidthPx;
  const dispHeight = Math.round(mapHeightPx * scale);

  const segments = useMemo(() => {
    const out: { left: number; top: number; w: number; angle: number }[] = [];
    for (let i = 0; i + 1 < polyline.length; i++) {
      const a = polyline[i];
      const b = polyline[i + 1];
      const ax = a.x * scale;
      const ay = a.y * scale;
      const bx = b.x * scale;
      const by = b.y * scale;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      out.push({ left: ax, top: ay, w: len, angle });
    }
    return out;
  }, [polyline, scale]);

  const onLongPressWrap = (e: GestureResponderEvent) => {
    if (!onLongPress) return;
    const { locationX, locationY } = e.nativeEvent;
    // NOTE: Одоогоор эргэлтгүй тул шууд хөрвүүлж байна
    const px = locationX / scale;
    const py = locationY / scale;
    onLongPress({ x: px, y: py });
  };

  return (
    <Pressable
      onLongPress={onLongPressWrap}
      style={{ width, height, backgroundColor: "#111", overflow: "hidden" }}
    >
      {backgroundSource ? (
        <Image
          source={backgroundSource}
          style={{ width, height: dispHeight }}
          resizeMode="stretch"
        />
      ) : (
        <View style={{ width, height: dispHeight, backgroundColor: "#222" }} />
      )}

      {/* Polyline segments (улаан) */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height: dispHeight,
        }}
        pointerEvents="none"
      >
        {segments.map((s, idx) => (
          <View
            key={idx}
            style={{
              position: "absolute",
              left: s.left,
              top: s.top,
              width: s.w,
              height: 3,
              backgroundColor: "red",
              transform: [{ rotate: `${s.angle}deg` }],
              borderRadius: 2,
            }}
          />
        ))}

        {/* User marker (цэнхэр) */}
        {user && (
          <View
            style={{
              position: "absolute",
              left: user.x * scale - 4,
              top: user.y * scale - 4,
              width: 8,
              height: 8,
              borderRadius: 8,
              backgroundColor: "#3fa9f5",
              borderWidth: 1,
              borderColor: "#083a66",
            }}
          />
        )}
      </View>

      {/* Heading overlay (харах лэйбл) */}
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
          Heading: {headingDeg.toFixed(0)}°
        </Text>
      </View>
    </Pressable>
  );
}
