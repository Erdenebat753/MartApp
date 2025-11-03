import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useItems } from "../../hooks/useItems";

export default function HomePage() {
  const router = useRouter();
  const { items } = useItems();
  return (
    <View style={{ flex: 1, backgroundColor: "#0b0b0f", alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Welcome</Text>
      <Text style={{ color: '#bbb', textAlign: 'center', marginBottom: 20 }}>
        Start indoor AR navigation when you're ready.
      </Text>
      <Pressable onPress={() => router.push('/(tabs)/ar')} style={{ backgroundColor: '#1e90ff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Start AR</Text>
      </Pressable>
    </View>
  );
}
