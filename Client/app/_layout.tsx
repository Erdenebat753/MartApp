// Client/app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { NativeBaseProvider } from "native-base";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";

export default function RootLayout() {
  useEffect(() => {
    try {
      const g: any = global as any;
      const prev = g?.ErrorUtils?.getGlobalHandler?.();
      g?.ErrorUtils?.setGlobalHandler?.((e: any, isFatal?: boolean) => {
        try {
          const msg = e?.stack || (e?.message ? `${e.message}` : String(e));
          console.error("[GLOBAL ERROR]", isFatal ? "FATAL" : "NONFATAL", msg);
        } catch {}
        try { prev && prev(e, isFatal); } catch {}
      });
    } catch {}
    // Do not mute logs; ensure warnings show up
    try { LogBox.ignoreAllLogs(false); } catch {}
  }, []);
  return (
    <NativeBaseProvider>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0b0b0f" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </NativeBaseProvider>
  );
}
