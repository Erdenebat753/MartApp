import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DISPLAY_WIDTH as CFG_DISPLAY_WIDTH,
  MAP_WIDTH_PX as CFG_MAP_W,
  MAP_HEIGHT_PX as CFG_MAP_H,
  SCALE as CFG_SCALE,
  DISPLAY_HEIGHT as CFG_DISPLAY_HEIGHT,
} from "../config";
import { PIXELS_PER_METER as PPM } from "../config";

export default function MapCanvas({
  containerRef,
  onMapClick,
  onMapMove,
  drawMode,
  routeMode,
  selectSegMode,
  segments,
  routePolyline,
  drawPoints,
  items,
  newItemPos,
  selectedItem,
  routeStart,
  routeEnd,
  selectedSegId,
  toDisplay,
  polylineStr,
  headingPickMode,
  headingArrow,
  slamStart,
  categories = [],
  categoryPoints = [],
  categoryMode = false,
  showGrid = false,
  showLabels = false,
  backgroundImageUrl = "/Frame1.png",
  displayWidth = CFG_DISPLAY_WIDTH,
  displayHeight = CFG_DISPLAY_HEIGHT,
  scale = CFG_SCALE,
  mapWidthPx = CFG_MAP_W,
  mapHeightPx = CFG_MAP_H,
}) {
  // Container size (responsive full-frame)
  const [contW, setContW] = useState(0);
  const [contH, setContH] = useState(0);
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const update = () => {
      setContW(el.clientWidth || 0);
      setContH(el.clientHeight || 0);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  // Fit map fully inside container while preserving aspect
  const baseScale = useMemo(() => {
    if (!mapWidthPx || !mapHeightPx || !contW || !contH) return scale;
    return Math.min(contW / mapWidthPx, contH / mapHeightPx);
  }, [mapWidthPx, mapHeightPx, contW, contH, scale]);
  const effScale = baseScale;
  const dispW = useMemo(() => Math.round((mapWidthPx || CFG_MAP_W) * effScale), [mapWidthPx, effScale]);
  const dispH = useMemo(() => Math.round((mapHeightPx || CFG_MAP_H) * effScale), [mapHeightPx, effScale]);

  // Pan and zoom state (Figma-like interactions)
  const [z, setZ] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const minZ = 0.2;
  const maxZ = 8;

  const screenToMap = useCallback(
    (clientX, clientY) => {
      if (!containerRef?.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const mx = (cx - tx) / (effScale * z);
      const my = (cy - ty) / (effScale * z);
      return { x: mx, y: my };
    },
    [containerRef, effScale, tx, ty, z]
  );

  const toDisplayLocal = useCallback((p) => ({ x: p.x * effScale, y: p.y * effScale }), [effScale]);
  const polylineStrLocal = useCallback((pts) => (pts || []).map((p) => `${p.x * effScale},${p.y * effScale}`).join(" "), [effScale]);

  const handleMouseMove = useCallback(
    (e) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        setTx((v) => v + dx);
        setTy((v) => v + dy);
        e.preventDefault();
        return;
      }
      if (!onMapMove) return;
      const p = screenToMap(e.clientX, e.clientY);
      onMapMove(p);
    },
    [onMapMove, screenToMap]
  );

  const handleClick = useCallback(
    (e) => {
      if (!onMapClick) return;
      if (isPanningRef.current) return; // ignore click when panning
      const p = screenToMap(e.clientX, e.clientY);
      onMapClick(p); // pass map coords directly
    },
    [onMapClick, screenToMap]
  );

  const handleMouseDown = useCallback((e) => {
    // Middle mouse button -> start panning
    if (e.button === 1) {
      isPanningRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  useEffect(() => {
    const up = () => {
      isPanningRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = e.clientX - (rect?.left || 0);
      const cy = e.clientY - (rect?.top || 0);

      if (e.ctrlKey || e.metaKey) {
        // Zoom at cursor
        const oldZ = z;
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newZ = Math.max(minZ, Math.min(maxZ, oldZ * factor));
        if (newZ === oldZ) return;
        const mx = (cx - tx) / (effScale * oldZ);
        const my = (cy - ty) / (effScale * oldZ);
        setZ(newZ);
        setTx(cx - effScale * newZ * mx);
        setTy(cy - effScale * newZ * my);
        return;
      }

      // Wheel pan: shift => horizontal, otherwise vertical
      const stepX = e.shiftKey ? (e.deltaY || e.deltaX) : (e.deltaX || 0);
      const stepY = e.shiftKey ? 0 : e.deltaY;
      setTx((v) => v - stepX);
      setTy((v) => v - stepY);
    },
    [containerRef, effScale, tx, ty, z]
  );

  // Block browser page zoom for Ctrl/Cmd + wheel within the canvas
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const blocker = (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
      }
    };
    el.addEventListener('wheel', blocker, { passive: false });
    return () => el.removeEventListener('wheel', blocker, { passive: false });
  }, [containerRef]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        border: "none",
        borderRadius: 0,
        overflow: "hidden",
        backgroundColor: "#000000",
        cursor: isPanningRef.current
          ? "grabbing"
          : drawMode || routeMode || selectSegMode || headingPickMode
          ? "crosshair"
          : "default",
      }}
    >
      {/* Pannable/zoomable viewport */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: dispW,
          height: dispH,
          transform: `translate(${tx}px, ${ty}px) scale(${z})`,
          transformOrigin: "0 0",
          userSelect: "none",
        }}
      >
        <img
          src={backgroundImageUrl}
          alt="store map"
          style={{
            width: dispW,
            height: dispH,
            objectFit: "fill",
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Grid overlay */}
        {showGrid && (
          <svg
            width={dispW}
            height={dispH}
            style={{ position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" }}
          >
            {(() => {
              const step = (PPM || 100) * effScale; // 1m grid
              const lines = [];
              for (let x = 0; x <= dispW; x += step) {
                lines.push(
                  <line key={`vx${x}`} x1={x} y1={0} x2={x} y2={dispH} stroke="#2a2a2e" strokeWidth={1} />
                );
              }
              for (let y = 0; y <= dispH; y += step) {
                lines.push(
                  <line key={`hz${y}`} x1={0} y1={y} x2={dispW} y2={y} stroke="#2a2a2e" strokeWidth={1} />
                );
              }
              return lines;
            })()}
          </svg>
        )}

        {/* Segments */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 3, pointerEvents: "none" }}
        >
          {segments.map((s) => (
            <polyline
              key={s.id}
              points={polylineStrLocal(s.polyline || [])}
              fill="none"
              stroke="#21d07a"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          ))}
        </svg>

        {/* Categories */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 4, pointerEvents: "none" }}
        >
          {categories.map((c) => (
            <polygon
              key={c.id}
              points={polylineStrLocal(c.polygon || [])}
              fill={c.color || "#f472b6"}
              stroke={c.color || "#f472b6"}
              strokeWidth={2.5}
              fillOpacity={0.35}
              opacity={0.95}
            />
          ))}
        </svg>

        {/* SLAM start */}
        {slamStart && (
          <svg
            width={dispW}
            height={dispH}
            style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}
          >
            {(() => {
              const L = 60;
              const deg = Number(slamStart.heading_deg || 0);
              // 0° is "up", but canvas angle 0 points right; subtract 90°
              const rad = ((deg - 90) * Math.PI) / 180;
              const sx = Number(slamStart.x) * effScale;
              const sy = Number(slamStart.y) * effScale;
              const ex = (Number(slamStart.x) + L * Math.cos(rad)) * effScale;
              const ey = (Number(slamStart.y) + L * Math.sin(rad)) * effScale;
              return (
                <g>
                  <circle cx={sx} cy={sy} r={6} fill="#a78bfa" stroke="#000" strokeWidth={1} />
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#a78bfa" strokeWidth={3} />
                </g>
              );
            })()}
          </svg>
        )}

        {/* Heading arrow preview */}
        {headingArrow && (
          <svg
            width={dispW}
            height={dispH}
            style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}
          >
            {(() => {
              const L = 60;
              // 0° is "up", but canvas angle 0 points right; subtract 90°
              const rad = (((headingArrow.deg || 0) - 90) * Math.PI) / 180;
              const sx = headingArrow.x * effScale;
              const sy = headingArrow.y * effScale;
              const ex = (headingArrow.x + L * Math.cos(rad)) * effScale;
              const ey = (headingArrow.y + L * Math.sin(rad)) * effScale;
              return (
                <g>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#ffcc00" strokeWidth={3} />
                  <circle cx={sx} cy={sy} r={5} fill="#ffcc00" stroke="#000" strokeWidth={1} />
                </g>
              );
            })()}
          </svg>
        )}

        {/* Route */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 5, pointerEvents: "none" }}
        >
          {routePolyline?.length >= 2 && (
            <polyline
              points={polylineStrLocal(routePolyline)}
              fill="none"
              stroke="red"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Drawing */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 7, pointerEvents: "none" }}
        >
          {drawMode && drawPoints?.length >= 2 && (
            <polyline
              points={polylineStrLocal(drawPoints)}
              fill="none"
              stroke="#ffd400"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {drawMode &&
            drawPoints?.map((p, idx) => {
              const dp = toDisplayLocal(p);
              return <circle key={idx} cx={dp.x} cy={dp.y} r={3} fill="#ffd400" stroke="#000" strokeWidth={1} />;
            })}
        </svg>

        {/* Category drawing */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 8, pointerEvents: "none" }}
        >
          {categoryMode && categoryPoints?.length >= 2 && (
            <polyline
              points={polylineStrLocal(categoryPoints)}
              fill="none"
              stroke="#f472b6"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {categoryMode && categoryPoints?.length >= 3 && (
            <polygon
              points={polylineStrLocal([...categoryPoints, categoryPoints[0]])}
              fill="#f472b6"
              fillOpacity={0.18}
              stroke="#f472b6"
              strokeWidth={2}
            />
          )}
          {categoryMode &&
            categoryPoints?.map((p, idx) => {
              const dp = toDisplayLocal(p);
              return <circle key={idx} cx={dp.x} cy={dp.y} r={4} fill="#f472b6" stroke="#000" strokeWidth={1} />;
            })}
        </svg>

        {/* Selected segment highlight */}
        {selectedSegId && (
          <svg
            width={dispW}
            height={dispH}
            style={{ position: "absolute", left: 0, top: 0, zIndex: 9, pointerEvents: "none" }}
          >
            {segments
              .filter((s) => s.id === selectedSegId)
              .map((s) => (
                <polyline
                  key={s.id}
                  points={polylineStrLocal(s.polyline || [])}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                />
              ))}
          </svg>
        )}

        {/* Items */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 10, pointerEvents: "none" }}
        >
          {items.map((it) => (
            <g key={it.id}>
              <circle cx={it.x * effScale} cy={it.y * effScale} r={4} fill="#4da3ff" stroke="#00224d" strokeWidth={1} />
              {showLabels && (
                <text x={it.x * effScale + 6} y={it.y * effScale - 6} fill="#e5e7eb" fontSize={11} style={{ userSelect: "none" }}>
                  {it.name}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* New/Selected item marker */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 11, pointerEvents: "none" }}
        >
          {newItemPos && (
            <g>
              <circle cx={newItemPos.x * effScale} cy={newItemPos.y * effScale} r={6} fill={selectedItem ? "#ff9f1a" : "#ffd400"} stroke="#000" strokeWidth={1} />
              <circle cx={newItemPos.x * effScale} cy={newItemPos.y * effScale} r={2} fill="#000" />
            </g>
          )}
        </svg>

        {/* Start/End markers */}
        <svg
          width={dispW}
          height={dispH}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 12, pointerEvents: "none" }}
        >
          {routeStart && <circle cx={routeStart.x * effScale} cy={routeStart.y * effScale} r={5} fill="#3fa9f5" stroke="#000" strokeWidth={1} />}
          {routeEnd && <circle cx={routeEnd.x * effScale} cy={routeEnd.y * effScale} r={5} fill="#ff2bd6" stroke="#000" strokeWidth={1} />}
        </svg>

      </div>

      {/* Fixed badge */}
      <div
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          zIndex: 20,
          background: "rgba(10,10,14,0.8)",
          border: "1px solid #2a2a2e",
          color: "#e5e7eb",
          padding: "6px 8px",
          borderRadius: 6,
          fontSize: 12,
          lineHeight: "14px",
          backdropFilter: "blur(2px)",
        }}
      >
        <div>Map: {mapWidthPx} x {mapHeightPx} px</div>
        <div>Display: {dispW} x {dispH} px</div>
        <div>Scale: {(effScale * z).toFixed(2)}x</div>
      </div>
    </div>
  );
}
