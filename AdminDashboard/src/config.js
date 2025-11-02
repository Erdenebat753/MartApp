// Centralized config for API endpoints and map sizing
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// Map image intrinsic pixel size (original design pixels)
export const MAP_WIDTH_PX = 675;
export const MAP_HEIGHT_PX = 878;

// Display size on the dashboard (scaled for screen)
export const DISPLAY_WIDTH = 600; // adjust to fit your screen
export const SCALE = DISPLAY_WIDTH / MAP_WIDTH_PX;
export const DISPLAY_HEIGHT = Math.round(MAP_HEIGHT_PX * SCALE);

// Snapping threshold in map pixels (not display pixels)
export const SNAP_THRESHOLD_PX = 10;

