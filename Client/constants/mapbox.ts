export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";
export const ORIGIN_LAT = Number(process.env.EXPO_PUBLIC_MAP_ORIGIN_LAT || 47.9205); // top-left lat
export const ORIGIN_LNG = Number(process.env.EXPO_PUBLIC_MAP_ORIGIN_LNG || 106.9170); // top-left lng

// If not provided, derive from existing PIXELS_PER_METER.
export const PIXELS_PER_METER_ENV = Number(process.env.EXPO_PUBLIC_MAP_PIXELS_PER_METER || "");

