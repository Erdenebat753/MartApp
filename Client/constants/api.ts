import { Platform } from "react-native";

export const API_BASE = (() => {
  const env = process.env.EXPO_PUBLIC_API_BASE;
  if (env && env.length > 0) return env;
  if (Platform.OS === "android") {
    // TODO: replace with your LAN IP for device testing
    return "http://10.46.73.109:8000";
  }
  return "http://127.0.0.1:8000";
})();

