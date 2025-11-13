import React, { useMemo } from "react";
import { View, Text } from "react-native";
import type { Point } from "../Map2D";
import {
  MAPBOX_TOKEN,
  ORIGIN_LAT,
  ORIGIN_LNG,
  PIXELS_PER_METER_ENV,
} from "../../constants/mapbox";
import { PIXELS_PER_METER as PPM_DEFAULT } from "../../constants/map";

// Lazy require to avoid bundle errors when the package is not installed yet
const MapboxGL: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@rnmapbox/maps");
  } catch {
    return null;
  }
})();

// Minimal press event shape used in onPress handler
type MapboxOnPressEvent = { geometry?: { coordinates?: number[] } };

type Props = {
  width: number;
  height: number;
  mapWidthPx: number;
  mapHeightPx: number;
  backgroundSource?: any; // URL preferred for Mapbox ImageSource
  polyline?: Point[];
  user?: Point | null;
  onLongPress?: (p: Point) => void;
  headingDeg?: number;
  debug?: boolean;
  interactive?: boolean; // enable gestures
  autoZoom?: boolean; // fit to route/user
  initialZoom?: number; // default zoom when not autoZoom
  categories?: { name: string; polygon: Point[]; color?: string | null }[];
  rotateMap?: boolean;
  headingInvert?: boolean;
};

const PPM = PIXELS_PER_METER_ENV || PPM_DEFAULT; // pixels per meter

function metersPerDegLat() {
  return 111_320; // meters per degree latitude (approx)
}

function metersPerDegLng(lat: number) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function pxToLngLat(x: number, y: number) {
  const mLat = metersPerDegLat();
  const mLng = metersPerDegLng(ORIGIN_LAT);
  const dx_m = x / PPM;
  const dy_m = y / PPM;
  const lat = ORIGIN_LAT - dy_m / mLat; // +y (down) => south (lat-)
  const lng = ORIGIN_LNG + dx_m / mLng; // +x (right) => east (lng+)
  return [lng, lat] as [number, number];
}

function lngLatToPx(lng: number, lat: number) {
  const mLat = metersPerDegLat();
  const mLng = metersPerDegLng(ORIGIN_LAT);
  const dx_m = (lng - ORIGIN_LNG) * mLng;
  const dy_m = (ORIGIN_LAT - lat) * mLat;
  return { x: dx_m * PPM, y: dy_m * PPM };
}

// Set token if available (safe to call multiple times)
if (MAPBOX_TOKEN && MapboxGL?.setAccessToken) {
  try {
    MapboxGL.setAccessToken(MAPBOX_TOKEN);
  } catch {}
}

export default function IndoorMap({
  width,
  height,
  mapWidthPx,
  mapHeightPx,
  backgroundSource,
  polyline = [],
  user,
  onLongPress,
  headingDeg = 0,
  debug = false,
  interactive = true,
  autoZoom = false,
  initialZoom = 20,
  categories = [],
  rotateMap = true,
  headingInvert = false,
}: Props) {
  const imageUrl =
    typeof backgroundSource === "string" ? backgroundSource : undefined;

  // floor corners using top-left origin
  const imageCorners = useMemo(() => {
    const tl = pxToLngLat(0, 0);
    const tr = pxToLngLat(mapWidthPx, 0);
    const br = pxToLngLat(mapWidthPx, mapHeightPx);
    const bl = pxToLngLat(0, mapHeightPx);
    return [tl, tr, br, bl] as [number, number][];
  }, [mapWidthPx, mapHeightPx]);

  const routeShape = useMemo(() => {
    if (!polyline || polyline.length < 2) return null;
    const coordinates = polyline.map((p) => pxToLngLat(p.x, p.y));
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: {},
    } as const;
  }, [polyline]);

  const catLabelShape = useMemo(() => {
    try {
      const features: any[] = [];
      for (const c of categories || []) {
        const pts = Array.isArray(c.polygon) ? c.polygon : [];
        if (pts.length === 0) continue;
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
          const sx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const sy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          const [lng, lat] = pxToLngLat(sx, sy);
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: { name: c.name },
          });
          continue;
        }
        A *= 0.5;
        cx = cx / (6 * A);
        cy = cy / (6 * A);
        const [lng, lat] = pxToLngLat(cx, cy);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: { name: c.name },
        });
      }
      return { type: "FeatureCollection", features } as const;
    } catch {
      return null;
    }
  }, [categories]);

  const userShape = useMemo(() => {
    if (!user) return null;
    // Build a small triangle (arrow) in pixel space and convert to lng/lat
    // Triple the previous size for higher visibility
    const s = 30; // size in px (3x larger)
    const b = s * 0.6; // base distance
    const w = s * 0.8; // base width
    const hd = Number.isFinite(headingDeg) ? headingDeg : 0;
    const ang = (hd * Math.PI) / 180;
    const dx = Math.sin(ang);
    const dy = -Math.cos(ang); // screen up is -y
    const cx = user.x;
    const cy = user.y;
    const tip = [cx + dx * s, cy + dy * s] as [number, number];
    const bx = cx - dx * b;
    const by = cy - dy * b;
    const px = dy; // perpendicular
    const py = -dx;
    const left = [bx + px * (w / 2), by + py * (w / 2)] as [number, number];
    const right = [bx - px * (w / 2), by - py * (w / 2)] as [number, number];
    const tri = [tip, left, right, tip].map(([x, y]) => pxToLngLat(x, y));
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [tri] },
      properties: {},
    } as const;
  }, [user, headingDeg]);

  // Keep a small dot as fallback/anchor at the same position
  const userPointShape = useMemo(() => {
    if (!user) return null;
    const [lng, lat] = pxToLngLat(user.x, user.y);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {},
    } as const;
  }, [user]);

  // Heading line for visibility (user center to tip)
  const userHeadingLine = useMemo(() => {
    if (!user) return null;
    const hd = Number.isFinite(headingDeg) ? headingDeg : 0;
    const ang = (hd * Math.PI) / 180;
    const dx = Math.sin(ang);
    const dy = -Math.cos(ang);
    const len = 36; // px length of heading line (3x)
    const tip = [user.x + dx * len, user.y + dy * len] as [number, number];
    const coords = [pxToLngLat(user.x, user.y), pxToLngLat(tip[0], tip[1])];
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    } as const;
  }, [user, headingDeg]);

  // We rotate the map itself using camera bearing, so no arrow line.

  const centerCoordinate = useMemo(() => {
    if (user) return pxToLngLat(user.x, user.y);
    // center of the image
    return pxToLngLat(mapWidthPx / 2, mapHeightPx / 2);
  }, [user, mapWidthPx, mapHeightPx]);

  // Use a blank style so no global basemap is rendered behind the floorplan
  const blankStyle = useMemo(
    () => ({ version: 8, sources: {}, layers: [] as any[] }),
    []
  );
  const mapBearing = rotateMap ? (headingInvert ? headingDeg : -headingDeg) : 0;

  // Compute auto zoom to fit remaining polyline + user with padding
  const zoomLevel = useMemo(() => {
    if (!autoZoom || !polyline || polyline.length === 0) return initialZoom;
    const pts = user ? [user, ...polyline] : polyline;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const spanPxX = Math.max(10, maxX - minX);
    const spanPxY = Math.max(10, maxY - minY);
    const PPM = PIXELS_PER_METER_ENV || PPM_DEFAULT;
    const spanMX = spanPxX / PPM;
    const spanMY = spanPxY / PPM;
    const pad = 1.3; // 30% padding
    const R = Math.cos((ORIGIN_LAT * Math.PI) / 180);
    const C = 156543.03392 * R; // meters per pixel at zoom 0
    const zx = Math.log2((C * width) / (Math.max(1e-3, spanMX) * pad));
    const zy = Math.log2((C * height) / (Math.max(1e-3, spanMY) * pad));
    const z = Math.min(zx, zy);
    return Math.max(18, Math.min(22, z));
  }, [autoZoom, polyline, user, width, height, initialZoom]);

  if (!MapboxGL || !MapboxGL.MapView) {
    return (
      <View
        style={{
          width,
          height,
          backgroundColor: "#111",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 12, opacity: 0.8 }}>
          Mapbox not installed. Falling back is handled in caller.
        </Text>
      </View>
    );
  }

  const radius = Math.min(width, height) / 2;

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: "#111",
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <MapboxGL.MapView
        style={{ width: "100%", height: "100%" }}
        styleJSON={JSON.stringify(blankStyle) as any}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={(e: MapboxOnPressEvent) => {
          if (!onLongPress) return;
          const { geometry } = e;
          const [lng, lat] = (geometry?.coordinates || []) as number[];
          if (lng != null && lat != null) {
            const p = lngLatToPx(lng, lat);
            onLongPress(p);
          }
        }}
      >
        <MapboxGL.Camera
          centerCoordinate={centerCoordinate as any}
          zoomLevel={zoomLevel}
          pitch={0}
          bearing={mapBearing}
        />

        {/* Floorplan overlay if URL provided */}
        {imageUrl && (
          // @ts-ignore
          <MapboxGL.ImageSource
            id="floor"
            coordinates={imageCorners as any}
            url={imageUrl}
          >
            <MapboxGL.RasterLayer
              id="floorLayer"
              style={{ rasterOpacity: 0.9 }}
            />
          </MapboxGL.ImageSource>
        )}

        {/* Route */}
        {routeShape && (
          <MapboxGL.ShapeSource id="route" shape={routeShape as any}>
            <MapboxGL.LineLayer
              id="routeLine"
              style={{ lineColor: "#ef4444", lineWidth: 3 }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Category labels */}
        {catLabelShape && (
          <MapboxGL.ShapeSource id="catLabels" shape={catLabelShape as any}>
            <MapboxGL.SymbolLayer
              id="catLabelLayer"
              style={{
                textField: ["get", "name"] as any,
                textColor: "#e5e7eb",
                textSize: 12,
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Fallback dot first, then arrow on top for visibility */}
        {userPointShape && (
          <MapboxGL.ShapeSource id="userDotSrc" shape={userPointShape as any}>
            <MapboxGL.CircleLayer
              id="userDot"
              existing={true}
              style={{
                circleColor: "#3fa9f5",
                circleRadius: 6,
                circleStrokeWidth: 2,
                circleStrokeColor: "#083a66",
              }}
            />
          </MapboxGL.ShapeSource>
        )}
        {userHeadingLine && (
          <MapboxGL.ShapeSource
            id="userHeadingSrc"
            shape={userHeadingLine as any}
          >
            <MapboxGL.LineLayer
              id="userHeading"
              existing={true}
              style={{
                lineColor: "#ffffff",
                lineWidth: 2.5,
                lineOpacity: 0.85,
              }}
            />
          </MapboxGL.ShapeSource>
        )}
        {userShape && (
          <MapboxGL.ShapeSource id="userArrowSrc" shape={userShape as any}>
            <MapboxGL.FillLayer
              id="userArrow"
              existing={true}
              style={{
                fillColor: "#3fa9f5",
                fillOpacity: 1,
                fillOutlineColor: "#083a66",
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>
    </View>
  );
}
