const ENABLED = (() => {
  // Always enable logs in dev, or when EXPO_PUBLIC_DEBUG is set.
  const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  const v = (process.env.EXPO_PUBLIC_DEBUG || "").toLowerCase();
  return dev || v === "1" || v === "true";
})();

export const log = {
  debug: (...args: any[]) => {
    if (ENABLED) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (ENABLED) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (ENABLED) console.error(...args);
  },
};
