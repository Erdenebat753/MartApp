import { ViroMaterials } from "@reactvision/react-viro";

const ensureBillboardMaterials = (() => {
  let registered = false;
  return () => {
    if (registered) return;
    ViroMaterials.createMaterials({
      billboardOuter: {
        diffuseColor: "#f59e0b",
      },
      billboardInner: {
        diffuseColor: "#0f172a",
      },
      routeLine: {
        diffuseColor: "#3fa9f5",
      },
      planeGrid: {
        diffuseTexture: {
          source: require("../assets/plane_grid.png"),
        },
        lightingModel: "Constant",
        writesToDepthBuffer: true,
      },
    });
    registered = true;
  };
})();

export function useBillboardMaterials() {
  ensureBillboardMaterials();
}
