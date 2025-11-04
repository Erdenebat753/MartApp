import React from "react";
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, SCALE, MAP_WIDTH_PX, MAP_HEIGHT_PX } from "../config";

export default function MapCanvas({
  containerRef,
  onMapClick,
  onMapMove,
  drawMode, routeMode, selectSegMode,
  segments, routePolyline, drawPoints,
  items, newItemPos, selectedItem,
  routeStart, routeEnd, selectedSegId,
  toDisplay, polylineStr,
  headingPickMode,
  headingArrow,
  slamStart,
  showGrid = false,
  showLabels = false,
}) {
  return (
    <div
      ref={containerRef}
      onClick={onMapClick}
      onMouseMove={(e) => {
        if (!containerRef?.current || !onMapMove) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;
        onMapMove({ x: dx / SCALE, y: dy / SCALE });
      }}
      style={{
        position: "relative",
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        border: "1px solid #999",
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#000000",
        cursor: (drawMode || routeMode || selectSegMode || headingPickMode) ? "crosshair" : "default",
      }}
    >
      <img src="/Frame1.png" alt="store map" style={{ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, objectFit: "fill", position: "absolute", left: 0, top: 0, zIndex: 1 }} />

      {/* Grid overlay */}
      {showGrid && (
        <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 1.5, pointerEvents: "none" }}>
          {(() => {
            const step = 50 * SCALE; // grid every 50 map px
            const lines = [];
            for (let x = 0; x <= DISPLAY_WIDTH; x += step) {
              lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={DISPLAY_HEIGHT} stroke="#2a2a2e" strokeWidth={1} />);
            }
            for (let y = 0; y <= DISPLAY_HEIGHT; y += step) {
              lines.push(<line key={`hz${y}`} x1={0} y1={y} x2={DISPLAY_WIDTH} y2={y} stroke="#2a2a2e" strokeWidth={1} />);
            }
            return lines;
          })()}
        </svg>
      )}

      {/* Existing segments (green) */}
      <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" }}>
        {segments.map((s) => (
          <polyline key={s.id} points={polylineStr(s.polyline || [])} fill="none" stroke="#21d07a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        ))}
      </svg>

      {/* SLAM start marker (purple) */}
      {slamStart && (
        <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}>
          {(() => {
            const L = 60;
            const deg = Number(slamStart.heading_deg || 0);
            const rad = deg * Math.PI / 180;
            const sx = Number(slamStart.x) * SCALE;
            const sy = Number(slamStart.y) * SCALE;
            const ex = (Number(slamStart.x) + L * Math.cos(rad)) * SCALE;
            const ey = (Number(slamStart.y) + L * Math.sin(rad)) * SCALE;
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
        <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}>
          {(() => {
            const L = 60; // map pixels
            const rad = (headingArrow.deg || 0) * Math.PI / 180;
            const sx = headingArrow.x * SCALE;
            const sy = headingArrow.y * SCALE;
            const ex = (headingArrow.x + L * Math.cos(rad)) * SCALE;
            const ey = (headingArrow.y + L * Math.sin(rad)) * SCALE;
            return (
              <g>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#ffcc00" strokeWidth={3} />
                <circle cx={sx} cy={sy} r={5} fill="#ffcc00" stroke="#000" strokeWidth={1} />
              </g>
            );
          })()}
        </svg>
      )}

      {/* Route overlay (red) */}
      <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 3, pointerEvents: "none" }}>
        {routePolyline?.length >= 2 && (
          <polyline points={polylineStr(routePolyline)} fill="none" stroke="red" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>

      {/* Drawing overlay (yellow) */}
      <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 4, pointerEvents: "none" }}>
        {drawPoints?.length >= 2 && (
          <polyline points={polylineStr(drawPoints)} fill="none" stroke="#ffd400" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {drawPoints?.map((p, idx) => { const dp = toDisplay(p); return (<circle key={idx} cx={dp.x} cy={dp.y} r={3} fill="#ffd400" stroke="#000" strokeWidth={1} />); })}
      </svg>

      {/* Selected segment highlight */}
      {selectedSegId && (
        <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 9, pointerEvents: "none" }}>
          {segments.filter(s=>s.id===selectedSegId).map(s => (
            <polyline key={s.id} points={polylineStr(s.polyline||[])} fill="none" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
          ))}
        </svg>
      )}

      {/* Items overlay (blue markers) */}
      <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 8, pointerEvents: "none" }}>
        {items.map((it)=> (
          <g key={it.id}>
            <circle cx={it.x * SCALE} cy={it.y * SCALE} r={4} fill="#4da3ff" stroke="#00224d" strokeWidth={1} />
            {showLabels && (
              <text x={it.x * SCALE + 6} y={it.y * SCALE - 6} fill="#e5e7eb" fontSize={11} style={{ userSelect: 'none' }}>{it.name}</text>
            )}
          </g>
        ))}
      </svg>

      {/* New/Selected Item marker */}
      <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}>
        {newItemPos && (
          <g>
            <circle cx={newItemPos.x * SCALE} cy={newItemPos.y * SCALE} r={6} fill={selectedItem ? "#ff9f1a" : "#ffd400"} stroke="#000" strokeWidth={1} />
            <circle cx={newItemPos.x * SCALE} cy={newItemPos.y * SCALE} r={2} fill="#000" />
          </g>
        )}
      </svg>

      {/* Start/End markers */}
      <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 7, pointerEvents: "none" }}>
        {routeStart && (<circle cx={routeStart.x * SCALE} cy={routeStart.y * SCALE} r={5} fill="#3fa9f5" stroke="#000" strokeWidth={1} />)}
        {routeEnd && (<circle cx={routeEnd.x * SCALE} cy={routeEnd.y * SCALE} r={5} fill="#ff2bd6" stroke="#000" strokeWidth={1} />)}
      </svg>

      {/* Map size badge */}
      <div style={{ position: "absolute", left: 8, bottom: 8, zIndex: 10, background: "rgba(10,10,14,0.8)", border: "1px solid #2a2a2e", color: "#e5e7eb", padding: "6px 8px", borderRadius: 6, fontSize: 12, lineHeight: "14px", backdropFilter: "blur(2px)" }}>
        <div>Map: {MAP_WIDTH_PX} × {MAP_HEIGHT_PX} px</div>
        <div>Display: {DISPLAY_WIDTH} × {DISPLAY_HEIGHT} px</div>
        <div>Scale: {SCALE.toFixed(2)}×</div>
      </div>
    </div>
  );
}
