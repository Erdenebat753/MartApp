import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
// We'll lazy-load SkeletonUtils to avoid startup import issues

export default function ThreeDPage() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const [fileName, setFileName] = useState("Silly Dancing.fbx");
  const [error, setError] = useState("");
  const [animFile, setAnimFile] = useState("animation/dance1.fbx");
  const mixerRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const [clipNames, setClipNames] = useState([]);
  const [currentClip, setCurrentClip] = useState("");
  const actionsRef = useRef([]);

  // Helpers available across handlers/effects
  const centerPlaceGroundScale = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // center in XZ
    object.position.x -= center.x;
    object.position.z -= center.z;
    // put base on ground (y=0)
    object.position.y -= box.min.y;
    // scale to target
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = 2.0;
    object.scale.setScalar(target / maxDim);
  };

  const fitCamera = (cam, obj, ctrl) => {
    if (!cam || !obj || !ctrl) return;
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = cam.fov * (Math.PI / 180);
    const dist = (sphere.radius / Math.sin(fov / 2)) * 1.2;
    const dirVec = new THREE.Vector3(1, 0.6, 1).normalize();
    cam.position.copy(sphere.center).addScaledVector(dirVec, dist);
    cam.near = Math.max(0.01, sphere.radius / 100);
    cam.far = Math.max(1000, sphere.radius * 100);
    cam.updateProjectionMatrix();
    ctrl.target.copy(sphere.center);
    ctrl.update();
  };

  const loadPublicFbx = (name, onSuccess) => {
    const url = "/3d/" + encodeURIComponent(name || "");
    setError("");
    const loader = new FBXLoader();
    loader.load(
      url,
      (object) => {
        const scene = sceneRef.current;
        // remove old
        if (modelRef.current && scene) scene.remove(modelRef.current);
        modelRef.current = object;
        // place/scale
        centerPlaceGroundScale(object);
        scene && scene.add(object);
        // fit camera
        fitCamera(cameraRef.current, object, controlsRef.current);
        // eslint-disable-next-line no-console
        console.info("FBX loaded:", url);
        if (typeof onSuccess === 'function') onSuccess();
      },
      undefined,
      (err) => {
        setError("FBX ачаалж чадсангүй: " + (err?.message || ""));
        // eslint-disable-next-line no-console
        console.error("FBX load error", err);
      }
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 520;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    canvasRef.current = renderer.domElement;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0b0b0f);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(3.5, 2.8, 4.2);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.enablePan = true;
    controls.minPolarAngle = 0; // look from above/below allowed
    controls.maxPolarAngle = Math.PI; 
    controlsRef.current = controls;

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 1.0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    scene.add(dir);
    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);

    // Ground grid (subtle)
    const grid = new THREE.GridHelper(20, 20, 0x2a2a2e, 0x2a2a2e);
    grid.material.opacity = 0.4;
    grid.material.transparent = true;
    scene.add(grid);

    const loader = new FBXLoader();
    const fitCameraToObject = (cam, obj, ctrl) => {
      const box = new THREE.Box3().setFromObject(obj);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fitDist = (maxDim / (2 * Math.atan((Math.PI * cam.fov) / 360))); // approximate
        const dirVec = new THREE.Vector3(1, 0.8, 1).normalize();
        cam.position.copy(center).addScaledVector(dirVec, fitDist * 1.2);
        cam.near = maxDim / 100;
        cam.far = maxDim * 100;
        cam.updateProjectionMatrix();
        ctrl.target.copy(center);
        ctrl.update();
      }
    };
    // initial load; then attempt to load default animation
    loadPublicFbx(fileName, () => {
      if (animFile) {
        loadAnimationFbx(animFile);
      }
    });

    let raf = 0;
    const tick = () => {
      controls.update();
      if (mixerRef.current) {
        const delta = clockRef.current.getDelta();
        mixerRef.current.update(delta);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    // Resize handling
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        const w = Math.max(320, cr.width);
        const h = Math.max(320, cr.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      // dispose geometries/materials
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, []);

  // Load animation (from public/3d/animation or any given path under /3d)
  const loadAnimationFbx = async (name) => {
    if (!modelRef.current) {
      setError("Эхлээд загвараа ачаална уу");
      return;
    }
    setError("");
    const url = name.startsWith("/3d/") ? name : "/3d/" + (name || "");
    const loader = new FBXLoader();
    loader.load(
      url,
      async (src) => {
        const clips = src.animations || [];
        if (!clips.length) {
          setError("Энэ FBX-д animation байхгүй байна");
          return;
        }
        // Prepare mixer
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }
        mixerRef.current = new THREE.AnimationMixer(modelRef.current);

        // Try retargeting per clip; if retarget fails, fall back to original clip (if bones match)
        const target = modelRef.current;
        const source = src; // animation source rig
        const playable = [];
        actionsRef.current = [];
        let SkeletonUtils = null;
        try {
          const mod = await import("three/examples/jsm/utils/SkeletonUtils.js");
          SkeletonUtils = mod.SkeletonUtils;
        } catch (_) {
          SkeletonUtils = null;
        }
        for (const clip of clips) {
          let converted = null;
          if (SkeletonUtils && SkeletonUtils.retargetClip) {
            try {
              converted = SkeletonUtils.retargetClip(target, source, clip);
            } catch (_) {
              converted = clip; // attempt to play as-is
            }
          } else {
            converted = clip; // fallback when utils unavailable
          }
          const action = mixerRef.current.clipAction(converted);
          const nm = clip.name || "clip";
          const entry = { name: nm, action, clip: converted };
          playable.push(entry);
          actionsRef.current.push(entry);
        }
        setClipNames(playable.map((p) => p.name));
        const first = playable[0];
        if (first) {
          setCurrentClip(first.name);
          first.action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        }
        // eslint-disable-next-line no-console
        console.info("Animation loaded:", url);
      },
      undefined,
      (err) => {
        setError("Animation ачаалж чадсангүй: " + (err?.message || ""));
        // eslint-disable-next-line no-console
        console.error("Animation load error", err);
      }
    );
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>3D Viewer</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, opacity: 0.85 }}>public/3d/</label>
        <input value={fileName} onChange={(e)=>setFileName(e.target.value)} placeholder="YourModel.fbx" style={{ padding: 6, width: 320, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
        <button onClick={() => loadPublicFbx(fileName)} style={{ padding: '6px 10px', background: '#27272a', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>Load</button>
        <button onClick={() => {
          // attempt to refit camera to current model
          if (cameraRef.current && controlsRef.current && modelRef.current) {
            fitCamera(cameraRef.current, modelRef.current, controlsRef.current);
          }
        }} style={{ padding: '6px 10px', background: '#27272a', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>Frame</button>
        <span style={{ width: 1, height: 28, background: 'var(--border)' }} />
        <label style={{ fontSize: 13, opacity: 0.85 }}>animation (public/3d/animation/…)</label>
        <input value={animFile} onChange={(e)=>setAnimFile(e.target.value)} placeholder="animation/Walk.fbx" style={{ padding: 6, width: 260, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
        <button onClick={() => loadAnimationFbx(animFile)} style={{ padding: '6px 10px', background: '#27272a', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>Load Anim</button>
        {clipNames.length > 0 && (
          <select value={currentClip} onChange={(e)=>{
            const name = e.target.value; setCurrentClip(name);
            if (!mixerRef.current) return;
            const found = actionsRef.current.find(a => a.name === name);
            if (!found) return;
            mixerRef.current.stopAllAction();
            found.action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
          }} style={{ padding: 6, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
            {clipNames.map((n)=> (<option key={n} value={n}>{n}</option>))}
          </select>
        )}
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div ref={containerRef} style={{ height: "70vh", border: "1px solid var(--border)", borderRadius: 10, background: "#0b0b0f" }} />
    </div>
  );
}
