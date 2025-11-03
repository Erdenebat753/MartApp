import React, { useMemo } from "react";
import { View, Image, GestureResponderEvent, Text, Pressable } from "react-native";
import Svg, { Polyline as SvgPolyline, Circle as SvgCircle, Polygon as SvgPolygon } from 'react-native-svg';

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
  headingInvert?: boolean; // true бол эргэлтийн чиглэлийг урвуулна
  debug?: boolean;
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
  debug = false,
}: Props) {
  // Fit map entirely inside given width/height while preserving aspect
  const scale = Math.min(width / mapWidthPx, height / mapHeightPx);
  const dispWidth = Math.round(mapWidthPx * scale);
  const dispHeight = Math.round(mapHeightPx * scale);
  const offX = Math.floor((width - dispWidth) / 2);
  const offY = Math.floor((height - dispHeight) / 2);

  const routePoints = useMemo(() => {
    if (!polyline || polyline.length < 2) return '';
    return polyline.map(p => `${offX + p.x * scale},${offY + p.y * scale}`).join(' ');
  }, [polyline, scale, offX, offY]);

  if (debug) {
    console.log('[Map2D] dims', { cont:{width,height}, map:{mapWidthPx,mapHeightPx}, disp:{dispWidth,dispHeight}, scale, offX, offY, user, headingDeg, polyLen: polyline?.length || 0 });
  }

  const onLongPressWrap = (e: GestureResponderEvent) => {
    if (!onLongPress) return;
    const { locationX, locationY } = e.nativeEvent;
    // convert screen point back to map coords considering offset/scale
    const px = (locationX - offX) / scale;
    const py = (locationY - offY) / scale;
    onLongPress({ x: px, y: py });
  };

  return (
    <Pressable
      onLongPress={onLongPressWrap}
      style={{ width, height, backgroundColor: "#111", overflow: "hidden", position: 'relative' }}
    >
      {backgroundSource ? (
        <Image
          source={backgroundSource}
          style={{ width: dispWidth, height: dispHeight, position: 'absolute', left: offX, top: offY }}
          resizeMode="stretch"
        />
      ) : (
        <View style={{ position: 'absolute', left: offX, top: offY, width: dispWidth, height: dispHeight, backgroundColor: "#222" }} />
      )}

      {/* Polyline segments (улаан) */}
      <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
        {polyline && polyline.length >= 2 && (
          <SvgPolyline points={routePoints} fill="none" stroke="red" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {user && (
          <>
            {/* User dot */}
            <SvgCircle cx={offX + user.x * scale} cy={offY + user.y * scale} r={4} stroke="#083a66" strokeWidth={1} fill="#3fa9f5" />
            {/* Heading arrow */}
            {(() => {
              // simple triangle pointing in headingDeg direction
              const cx = offX + user.x * scale;
              const cy = offY + user.y * scale;
              const length = 24; // px on screen (bigger for visibility)
              const halfBase = 6; // triangle base half-width
              const angleDeg = headingInvert ? -headingDeg : headingDeg;
              const rad = (angleDeg - 90) * Math.PI / 180; // rotate so 0deg points up
              const dirX = Math.cos(rad);
              const dirY = Math.sin(rad);
              // tip point
              const x1 = cx + dirX * length;
              const y1 = cy + dirY * length;
              // base center slightly behind center dot
              const bx = cx - dirX * 4;
              const by = cy - dirY * 4;
              // perpendicular for base corners
              const px = -dirY;
              const py = dirX;
              const x2 = bx + px * halfBase;
              const y2 = by + py * halfBase;
              const x3 = bx - px * halfBase;
              const y3 = by - py * halfBase;
              const points = `${x1},${y1} ${x2},${y2} ${x3},${y3}`;
              return <SvgPolygon points={points} fill="#3fa9f5" opacity={0.9} />;
            })()}
          </>
        )}
      </Svg>

      {/* Heading overlay (харах лэйбл) */}
      <View style={{ position: "absolute", right: 8, top: 8, backgroundColor: "#00000088", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
        <Text style={{ color: "#fff", fontSize: 12 }}>Heading: {headingDeg.toFixed(0)}°</Text>
        {debug && (
          <Text style={{ color: "#ccc", fontSize: 10, marginTop: 2 }}>
            s:{scale.toFixed(3)} off:{offX},{offY} poly:{polyline?.length||0}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
