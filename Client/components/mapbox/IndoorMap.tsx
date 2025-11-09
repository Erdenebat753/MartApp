import React, { useMemo } from "react";
import { View, Text } from "react-native";
// Lazy require to avoid bundle errors when the package is not installed yet
let MapboxGL: any = null;
try { MapboxGL = require("@rnmapbox/maps"); } catch {}
import type { Point } from "../Map2D";
import { MAPBOX_TOKEN, ORIGIN_LAT, ORIGIN_LNG, PIXELS_PER_METER_ENV } from "../../constants/mapbox";
import { PIXELS_PER_METER as PPM_DEFAULT } from "../../constants/map";

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
  try { MapboxGL.setAccessToken(MAPBOX_TOKEN); } catch {}
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
}: Props) {
  const imageUrl = typeof backgroundSource === "string" ? backgroundSource : undefined;

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

  const userShape = useMemo(() => {
    if (!user) return null;
    const [lng, lat] = pxToLngLat(user.x, user.y);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { rotation: headingDeg },
    } as const;
  }, [user, headingDeg]);

  const centerCoordinate = useMemo(() => {
    if (user) return pxToLngLat(user.x, user.y);
    // center of the image
    return pxToLngLat(mapWidthPx / 2, mapHeightPx / 2);
  }, [user, mapWidthPx, mapHeightPx]);

  if (!MapboxGL || !MapboxGL.MapView) {
    return (
      <View style={{ width, height, backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 12, opacity: 0.8 }}>
          Mapbox not installed. Falling back is handled in caller.
        </Text>
      </View>
    );
  }

  const styleUrl = MapboxGL?.StyleURL?.Dark ?? "mapbox://styles/mapbox/dark-v11";

  return (
    <View style={{ width, height, backgroundColor: "#111" }}>
      <MapboxGL.MapView
        style={{ width: "100%", height: "100%" }}
        styleURL={styleUrl}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={(e) => {
          if (!onLongPress) return;
          const { geometry } = e;
          const [lng, lat] = (geometry?.coordinates || []) as number[];
          if (lng != null && lat != null) {
            const p = lngLatToPx(lng, lat);
            onLongPress(p);
          }
        }}
      >
        <MapboxGL.Camera centerCoordinate={centerCoordinate as any} zoomLevel={20} pitch={0} />

        {/* Floorplan overlay if URL provided */}
        {imageUrl && (
          // @ts-ignore
          <MapboxGL.ImageSource id="floor" coordinates={imageCorners as any} url={imageUrl}>
            <MapboxGL.RasterLayer id="floorLayer" style={{ rasterOpacity: 0.9 }} />
          </MapboxGL.ImageSource>
        )}

        {/* Route */}
        {routeShape && (
          <MapboxGL.ShapeSource id="route" shape={routeShape as any}>
            <MapboxGL.LineLayer id="routeLine" style={{ lineColor: "#ef4444", lineWidth: 3 }} />
          </MapboxGL.ShapeSource>
        )}

        {/* User dot */}
        {userShape && (
          <MapboxGL.ShapeSource id="user" shape={userShape as any}>
            <MapboxGL.CircleLayer
              id="userDot"
              style={{ circleColor: "#3fa9f5", circleRadius: 4, circleStrokeWidth: 1, circleStrokeColor: "#083a66" }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>
    </View>
  );
}
