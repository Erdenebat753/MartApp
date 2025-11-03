// Client/app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="ar" options={{ title: "AR" }} />
    </Tabs>
  );
}

