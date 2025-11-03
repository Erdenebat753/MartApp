// Client/components/ARTestScreen.tsx
import React from "react";
import {
  ViroARScene,
  ViroText,
  ViroARSceneNavigator,
} from "@reactvision/react-viro";

type Props = {
  onDevicePose?: (pos: [number, number, number], yawDeg: number) => void;
  onTrackingState?: (state: string, reason: string) => void;
  alignment?: "Gravity" | "GravityAndHeading" | "Camera";
};

function SceneWithHeading({ onDevicePose, onTrackingState }: Props) {
  return (
    <ViroARScene
      onCameraTransformUpdate={(t) => {
        // Prefer yaw from forward vector to avoid platform-specific Euler issues.
        let yawDeg = 0;
        if (Array.isArray((t as any)?.forward)) {
          const fx = Number((t as any).forward[0]);
          const fz = Number((t as any).forward[2]);
          // AR forward is -Z; yaw 0 should face up; atan2(fx, -fz)
          yawDeg = (Math.atan2(fx, -fz) * 180) / Math.PI;
        } else if (Array.isArray(t?.rotation)) {
          yawDeg = Number(t.rotation[1]);
        }
        const pos = Array.isArray(t?.position) ? [Number(t.position[0]), Number(t.position[1]), Number(t.position[2])] as [number,number,number] : [0,0,0];
        if (!Number.isNaN(yawDeg) && onDevicePose) onDevicePose(pos, yawDeg);
      }}
      onTrackingUpdated={(state, reason) => {
        if (onTrackingState) onTrackingState(String(state), String(reason));
      }}
    >
      <ViroText
        text="Hello AR World!"
        position={[0, 0, -1]}
        style={{ fontSize: 40, color: "#00ff99" }}
      />
    </ViroARScene>
  );
}

export default function ARTestScreen({ onDevicePose, onTrackingState, alignment = "GravityAndHeading" }: Props) {
  return (
    <ViroARSceneNavigator
      autofocus={true}
      worldAlignment={alignment}
      initialScene={{ scene: () => <SceneWithHeading onDevicePose={onDevicePose} onTrackingState={onTrackingState} /> }}
      style={{ flex: 1 }}
    />
  );
}
