import { Platform } from "react-native";
import { log } from "../src/logger";

export const API_BASE = (() => {
  const env = process.env.EXPO_PUBLIC_API_BASE;
  if (env && env.length > 0) {
    log.debug("[API_BASE] using env", env);
    return env;
  }
  if (Platform.OS === "android") {
    // Replace with your LAN IP when testing on device/emulator
    const def = "http://10.0.2.2:5001"; // Android emulator → host loopback
    log.warn("[API_BASE] env not set; defaulting to", def);
    return def;
  }
  const def = "http://127.0.0.1:5001";
  log.warn("[API_BASE] env not set; defaulting to", def);
  return def;
})();
