export type TargetBillboard = {
  position: [number, number, number];
  name: string;
  imageUrl?: string | null;
};

export type SceneAppProps = {
  version?: number;
  onDevicePose?: (pos: [number, number, number], yawDeg: number) => void;
  onTrackingState?: (state: string, reason: string) => void;
  modelPosition?: [number, number, number] | null;
  modelRotation?: [number, number, number] | null;
  routePointsWorld?: ([number, number, number] | null)[] | null;
  routePolylineWorld?: [number, number, number][] | null;
  animationName?: string | null;
  targetBillboard?: TargetBillboard | null;
  modelVisible?: boolean;
  modelRevision?: number;
  showPlaneGuide?: boolean;
};

type Listener = (props: SceneAppProps) => void;

let latestSceneProps: SceneAppProps = {};
const listeners = new Set<Listener>();

export function publishSceneProps(next: SceneAppProps) {
  latestSceneProps = next;
  for (const listener of listeners) {
    try {
      listener(latestSceneProps);
    } catch (err) {
      console.warn("[AR bridge] listener failed", err);
    }
  }
}

export function subscribeSceneProps(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLatestSceneProps() {
  return latestSceneProps;
}
