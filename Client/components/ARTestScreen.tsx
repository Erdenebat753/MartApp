// Client/components/ARTestScreen.tsx
import React from "react";
import {
  ViroARScene,
  ViroText,
  ViroARSceneNavigator,
} from "@reactvision/react-viro";

function HelloWorldScene() {
  return (
    <ViroARScene>
      <ViroText
        text="Hello AR World!"
        position={[0, 0, -1]}
        style={{ fontSize: 40, color: "#00ff99" }}
      />
    </ViroARScene>
  );
}

export default function ARTestScreen() {
  return (
    <ViroARSceneNavigator
      autofocus={true}
      initialScene={{ scene: HelloWorldScene }}
      style={{ flex: 1 }}
    />
  );
}
