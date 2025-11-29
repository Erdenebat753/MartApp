// Client/components/ARTestScreen.tsx
import React from "react";
import {
  ViroARScene,
  ViroText,
  ViroARSceneNavigator,
  ViroAmbientLight,
  Viro3DObject,
  ViroNode,
  ViroImage,
  ViroQuad,
  ViroPolyline,
  ViroARPlaneSelector,
} from "@reactvision/react-viro";
import gunplayModel from "../assets/Gunplay.vrx";
const gunplayResources = [
  require("../assets/Ch09_1001_Diffuse.png"),
  require("../assets/Ch09_1001_Glossiness.png"),
  require("../assets/Ch09_1001_Normal.png"),
  require("../assets/Ch09_1001_Specular.png"),
];
import {
  publishSceneProps,
  subscribeSceneProps,
  getLatestSceneProps,
  SceneAppProps,
  TargetBillboard,
} from "./arSceneBridge";
import { useBillboardMaterials } from "./billboardMaterials";

type SceneProps = {
  sceneNavigator?: any;
};

function SceneWithHeading({ sceneNavigator }: SceneProps) {
  useBillboardMaterials();
  const [appProps, setAppProps] = React.useState<SceneAppProps>(() => {
    const fromNavigator =
      (sceneNavigator?.viroAppProps as SceneAppProps | undefined) || null;
    return fromNavigator || getLatestSceneProps();
  });
  React.useEffect(() => {
    const next =
      (sceneNavigator?.viroAppProps as SceneAppProps | undefined) || null;
    if (next) {
      setAppProps(next);
    }
  }, [sceneNavigator]);
  React.useEffect(() => {
    return subscribeSceneProps((next) => {
      setAppProps(next);
    });
  }, []);
  const {
    onDevicePose,
    onTrackingState,
    modelPosition,
    modelRotation,
    routePointsWorld,
    routePolylineWorld,
    targetBillboard,
    animationName = "mixamo.com",
    modelVisible = true,
    modelRevision = 0,
    showPlaneGuide = true,
  } = appProps;
  const defaultPos: [number, number, number] = [0, -0.4, -1.2];
  const defaultRot: [number, number, number] = [0, 0, 0];
  const markers = Array.isArray(routePointsWorld)
    ? routePointsWorld.filter(Boolean)
    : [];
  const modelRef = React.useRef<any>(null);
  const lastRotationRef = React.useRef<[number, number, number] | null>(null);
  React.useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.setNativeProps({
      position: modelPosition ?? defaultPos,
      rotation: modelRotation ?? defaultRot,
    });
    if (__DEV__) {
      const prevRot = lastRotationRef.current;
      const nextRot = modelRotation ?? defaultRot;
      if (
        !prevRot ||
        prevRot[0] !== nextRot[0] ||
        prevRot[1] !== nextRot[1] ||
        prevRot[2] !== nextRot[2]
      ) {
        console.log("[AR debug] modelRotation update:", nextRot);
        lastRotationRef.current = nextRot;
      }
    }
  }, [modelPosition, modelRotation]);
  const onCamUpdate = React.useCallback(
    (t: any) => {
      // Prefer yaw from forward vector to avoid platform-specific Euler issues.
      let yawDeg = 0;
      if (Array.isArray(t?.forward)) {
        const fx = Number(t.forward[0]);
        const fz = Number(t.forward[2]);
        // Treat -Z as forward on both platforms so yaw grows clockwise.
        const denom = -fz;
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
      {showPlaneGuide !== false && (
        <ViroARPlaneSelector alignment="Horizontal">
          <ViroQuad
            position={[0, 0, 0]}
            rotation={[-90, 0, 0]}
            width={1.5}
            height={1.5}
            opacity={0.65}
            materials={["planeGrid"]}
            arShadowReceiver={false}
          />
        </ViroARPlaneSelector>
      )}
      {markers.map((pos, idx) => {
        const cast = pos as [number, number, number];
        return (
          <ViroText
            key={`marker-${idx}`}
            text="•"
            position={cast}
            style={{ fontSize: 20, color: "#1e90ff" }}
          />
        );
      })}
      {targetBillboard ? (
        <ViroNode position={targetBillboard.position} transformBehaviors={["billboard"]}>
          <ViroQuad
            width={0.38}
            height={0.48}
            materials={["billboardOuter"]}
            position={[0, 0, 0]}
            opacity={0.9}
            arShadowReceiver={false}
          />
          <ViroQuad
            width={0.35}
            height={0.45}
            materials={["billboardInner"]}
            position={[0, 0, 0.001]}
            opacity={0.92}
            arShadowReceiver={false}
          />
          {targetBillboard.imageUrl ? (
            <ViroImage
              source={{ uri: targetBillboard.imageUrl }}
              width={0.28}
              height={0.28}
              position={[0, 0.08, 0.002]}
              resizeMode="ScaleToFill"
              onError={(e) =>
                console.warn("[AR] failed to load product image", e?.nativeEvent)
              }
            />
          ) : null}
          <ViroText
            text={targetBillboard.name}
            width={0.3}
            height={0.12}
            position={[0, -0.13, 0.002]}
            style={{
              fontSize: 20,
              color: "#fefefe",
              textAlign: "center",
              fontWeight: "600",
            }}
            maxLines={2}
          />
        </ViroNode>
      ) : null}
      {Array.isArray(routePolylineWorld) && routePolylineWorld.length >= 2 && (
        <ViroPolyline
          points={routePolylineWorld as [number, number, number][]}
          thickness={0.01}
          materials={["routeLine"]}
        />
      )}
      {modelVisible !== false && (
        <Viro3DObject
          key={`model-${modelRevision}`}
          ref={modelRef}
          source={gunplayModel as any}
          resources={gunplayResources}
          type="VRX"
          position={modelPosition ?? defaultPos}
          scale={[0.0045, 0.0045, 0.0045]}
          rotation={modelRotation ?? defaultRot}
          dragType="FixedDistance"
          onLoadStart={() => console.log("Loading GunPlay.vrx...")}
          onLoadEnd={() => console.log("GunPlay.vrx ready")}
          onError={(e) => {
            const detail = e?.nativeEvent
              ? JSON.stringify(e.nativeEvent, null, 2)
              : String(e);
            console.warn("Failed to load GunPlay.vrx", detail);
          }}
          animation={{ name: animationName ?? undefined, run: Boolean(animationName), loop: true }}
        />
      )}
      <ViroText
        text="AR Ready"
        position={[0, 0.15, -1]}
        style={{
          fontSize: 30,
          color: "#38bdf8",
          fontWeight: "600",
          textAlign: "center",
        }}
      />
    </ViroARScene>
  );
}

const SceneWithHeadingMemo = React.memo(SceneWithHeading);

type NavigatorProps = {
  onDevicePose?: (pos: [number, number, number], yawDeg: number) => void;
  onTrackingState?: (state: string, reason: string) => void;
  alignment?: "Gravity" | "GravityAndHeading" | "Camera";
  modelPosition?: [number, number, number];
  modelRotation?: [number, number, number];
  routePointsWorld?: ([number, number, number] | null)[];
  routePolylineWorld?: [number, number, number][];
  targetBillboard?: TargetBillboard | null;
  animationName?: string;
  modelVisible?: boolean;
  modelRevision?: number;
  showPlaneGuide?: boolean;
};

export default function ARTestScreen({
  onDevicePose,
  onTrackingState,
  alignment = "GravityAndHeading",
  modelPosition,
  modelRotation,
  routePointsWorld,
  routePolylineWorld,
  targetBillboard,
  animationName = "mixamo.com",
  modelVisible = true,
  modelRevision = 0,
  showPlaneGuide = true,
}: NavigatorProps) {
  const viroAppProps = React.useMemo(
    () => ({
      version: Date.now(),
      onDevicePose,
      onTrackingState,
      modelPosition,
      modelRotation,
      routePointsWorld,
      routePolylineWorld,
      targetBillboard,
      animationName,
      modelVisible,
      modelRevision,
      showPlaneGuide,
    }),
    [
      onDevicePose,
      onTrackingState,
      modelPosition,
      modelRotation,
      routePointsWorld,
      routePolylineWorld,
      targetBillboard,
      animationName,
      modelVisible,
      modelRevision,
      showPlaneGuide,
    ]
  );

  React.useEffect(() => {
    publishSceneProps(viroAppProps);
  }, [viroAppProps]);

  return (
    <ViroARSceneNavigator
      autofocus={true}
      worldAlignment={alignment}
      initialScene={{ scene: SceneWithHeadingMemo } as any}
      viroAppProps={viroAppProps}
      style={{ flex: 1 }}
    />
  );
}
