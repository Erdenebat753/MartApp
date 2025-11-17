// Client/components/ARTestScreen.tsx
import React from "react";
import { Platform } from "react-native";
import {
  ViroARScene,
  ViroText,
  ViroARSceneNavigator,
  ViroAmbientLight,
  Viro3DObject,
  ViroPolyline,
  ViroMaterials,
} from "@reactvision/react-viro";
import modelSource from "../assets/Walking.fbx";

type Props = {
  onDevicePose?: (pos: [number, number, number], yawDeg: number) => void;
  onTrackingState?: (state: string, reason: string) => void;
  alignment?: "Gravity" | "GravityAndHeading" | "Camera";
  // Allow any clip name so parent can pass whatever the GLB exposes
  activeAnimation?: string;
  routeWorld?: [number, number, number][];
};

ViroMaterials.createMaterials({
  routeLine: {
    diffuseColor: "#1e90ff",
    lightingModel: "Constant",
  },
});

const MODEL_SOURCE = modelSource;

function SceneWithHeading({
  onDevicePose,
  onTrackingState,
  activeAnimation,
  routeWorld,
}: Props) {
  React.useEffect(() => {
    // Log what Metro resolves so we can diagnose asset bundling issues
    console.log("AR model source", MODEL_SOURCE);
  }, []);

  const onCamUpdate = React.useCallback(
    (t: any) => {
      // Prefer yaw from forward vector to avoid platform-specific Euler issues.
      let yawDeg = 0;
      if (Array.isArray(t?.forward)) {
        const fx = Number(t.forward[0]);
        const fz = Number(t.forward[2]);
        // Android often uses +fz for forward. iOS typically -fz.
        const denom = Platform.OS === "android" ? fz : -fz;
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
      <ViroAmbientLight color="#ffffff" intensity={850} />
      <Viro3DObject
        source={MODEL_SOURCE}
        type="GLB"
        position={[0, -0.2, -1]}
        scale={[1.2, 1.2, 1.2]}
        rotation={[0, 180, 0]}
        visible
        dragType="FixedDistance"
        onLoadStart={() => console.log("Loading .glb...")}
        onLoadEnd={() => console.log("Loaded .glb")}
        animation={
          activeAnimation
            ? { name: activeAnimation, run: true, loop: true }
            : undefined
        }
        onError={(e) => {
          const detail = e?.nativeEvent
            ? JSON.stringify(e.nativeEvent, null, 2)
            : String(e);
          console.warn("Failed to .glb", detail);
        }}
        resources={[]}
      />
      {routeWorld && routeWorld.length >= 2 && (
        <ViroPolyline
          points={routeWorld}
          thickness={0.1}
          materials={["routeLine"]}
        />
      )}
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
  activeAnimation,
  routeWorld,
}: Props) {
  const sceneFn = React.useCallback(
    () => (
      <SceneWithHeadingMemo
        onDevicePose={onDevicePose}
        onTrackingState={onTrackingState}
        activeAnimation={activeAnimation}
        routeWorld={routeWorld}
      />
    ),
    [onDevicePose, onTrackingState, activeAnimation, routeWorld]
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
