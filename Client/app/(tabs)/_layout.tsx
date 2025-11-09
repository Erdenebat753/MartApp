// Client/app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { House, ChatCircle, Cube } from "phosphor-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0ea5e9",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: { backgroundColor: "#0b0b0f", borderTopColor: "#1f2937" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused, size }) => (
            <House color={color as string} size={size ?? 24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, focused, size }) => (
            <ChatCircle color={color as string} size={size ?? 24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="ar"
        options={{
          title: "AR",
          tabBarIcon: ({ color, focused, size }) => (
            <Cube color={color as string} size={size ?? 24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
    </Tabs>
  );
}
