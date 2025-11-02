// Client/app/modal.tsx
import React from "react";
import { View, Text } from "react-native";

export default function ModalScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>Modal placeholder</Text>
    </View>
  );
}
