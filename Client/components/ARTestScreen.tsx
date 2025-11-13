// Client/components/ARTestScreen.tsx
import React from "react";
import { Platform } from "react-native";
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
  const onCamUpdate = React.useCallback(
    (t: any) => {
      // Prefer yaw from forward vector to avoid platform-specific Euler issues.
      let yawDeg = 0;
      if (Array.isArray(t?.forward)) {
        const fx = Number(t.forward[0]);
        const fz = Number(t.forward[2]);
        // Android often uses +fz for forward. iOS typically -fz.
        const denom = Platform.OS === 'android' ? fz : -fz;
        yawDeg = (Math.atan2(fx, denom) * 180) / Math.PI;
      } else if (Array.isArray(t?.rotation)) {
        yawDeg = Number(t.rotation[1]);
      }
      const pos = Array.isArray(t?.position)
        ? ([
            Number(t.position[0]),
            Number(t.position[1]),
            Number(t.position[2]),
          ] as [number, number, number])
        : ([0, 0, 0] as [number, number, number]);
      if (!Number.isNaN(yawDeg) && onDevicePose) onDevicePose(pos, yawDeg);
    },
    [onDevicePose]
  );

  const onTrack = React.useCallback(
    (state: any, reason: any) => {
      if (onTrackingState) onTrackingState(String(state), String(reason));
    },
    [onTrackingState]
  );

  return (
    <ViroARScene
      onCameraTransformUpdate={onCamUpdate}
      onTrackingUpdated={onTrack}
    >
      <ViroText
        text="Hello AR World!"
        position={[0, 0, -1]}
        style={{ fontSize: 40, color: "#00ff99" }}
      />
    </ViroARScene>
  );
}

const SceneWithHeadingMemo = React.memo(SceneWithHeading);

export default function ARTestScreen({
  onDevicePose,
  onTrackingState,
  alignment = "GravityAndHeading",
}: Props) {
  const sceneFn = React.useCallback(
    () => (
      <SceneWithHeadingMemo
        onDevicePose={onDevicePose}
        onTrackingState={onTrackingState}
      />
    ),
    [onDevicePose, onTrackingState]
  );
  // Keep initialScene stable for the lifetime of the component to avoid AR scene remounts
  const initialSceneRef = React.useRef<{
    scene: () => React.ReactElement;
  } | null>(null);
  if (!initialSceneRef.current) {
    initialSceneRef.current = { scene: sceneFn } as any;
  }
  return (
    <ViroARSceneNavigator
      autofocus={true}
      worldAlignment={alignment}
      initialScene={initialSceneRef.current as any}
      style={{ flex: 1 }}
    />
  );
}
