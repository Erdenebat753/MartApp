import React from "react";
import { DISPLAY_WIDTH as CFG_DISPLAY_WIDTH, MAP_WIDTH_PX as CFG_MAP_W, MAP_HEIGHT_PX as CFG_MAP_H, SCALE as CFG_SCALE, DISPLAY_HEIGHT as CFG_DISPLAY_HEIGHT } from "../config";

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
  const effScale = scale;
  const effHeight = displayHeight ?? Math.round((mapHeightPx || CFG_MAP_H) * effScale);
  return (
    <div
      ref={containerRef}
      onClick={onMapClick}
      onMouseMove={(e) => {
        if (!containerRef?.current || !onMapMove) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;
        onMapMove({ x: dx / effScale, y: dy / effScale });
      }}
      style={{
        position: "relative",
        width: displayWidth,
        height: effHeight,
        border: "1px solid #999",
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#000000",
        cursor: (drawMode || routeMode || selectSegMode || headingPickMode) ? "crosshair" : "default",
      }}
    >
      <img src={backgroundImageUrl} alt="store map" style={{ width: displayWidth, height: effHeight, objectFit: "fill", position: "absolute", left: 0, top: 0, zIndex: 1 }} />

      {/* Grid overlay */}
      {showGrid && (
        <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 1.5, pointerEvents: "none" }}>
          {(() => {
            const step = 50 * effScale; // grid every 50 map px
            const lines = [];
            for (let x = 0; x <= displayWidth; x += step) {
              lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={effHeight} stroke="#2a2a2e" strokeWidth={1} />);
            }
            for (let y = 0; y <= effHeight; y += step) {
              lines.push(<line key={`hz${y}`} x1={0} y1={y} x2={displayWidth} y2={y} stroke="#2a2a2e" strokeWidth={1} />);
            }
            return lines;
          })()}
        </svg>
      )}

      {/* Existing segments (green) */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" }}>
        {segments.map((s) => (
          <polyline key={s.id} points={polylineStr(s.polyline || [])} fill="none" stroke="#21d07a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        ))}
      </svg>

      {/* Categories (filled polygons) */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 5, pointerEvents: "none" }}>
        {categories.map((c) => (
          <polygon
            key={c.id}
            points={polylineStr(c.polygon || [])}
            fill={c.color || "#f472b6"}
            stroke={c.color || "#f472b6"}
            strokeWidth={2.5}
            fillOpacity={0.35}
            opacity={0.95}
          />
        ))}
      </svg>

      {/* SLAM start marker (purple) */}
      {slamStart && (
        <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}>
          {(() => {
            const L = 60;
            const deg = Number(slamStart.heading_deg || 0);
            const rad = deg * Math.PI / 180;
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
        <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}>
          {(() => {
            const L = 60; // map pixels
            const rad = (headingArrow.deg || 0) * Math.PI / 180;
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

      {/* Route overlay (red) */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 3, pointerEvents: "none" }}>
        {routePolyline?.length >= 2 && (
          <polyline points={polylineStr(routePolyline)} fill="none" stroke="red" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>

      {/* Drawing overlay (yellow) */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 4, pointerEvents: "none" }}>
        {drawMode && drawPoints?.length >= 2 && (
          <polyline points={polylineStr(drawPoints)} fill="none" stroke="#ffd400" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {drawMode && drawPoints?.map((p, idx) => { const dp = toDisplay(p); return (<circle key={idx} cx={dp.x} cy={dp.y} r={3} fill="#ffd400" stroke="#000" strokeWidth={1} />); })}
      </svg>

      {/* Category drawing overlay (pink) */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 9, pointerEvents: "none" }}>
        {categoryMode && categoryPoints?.length >= 2 && (
          <polyline points={polylineStr(categoryPoints)} fill="none" stroke="#f472b6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {categoryMode && categoryPoints?.length >= 3 && (
          <polygon
            points={polylineStr([...categoryPoints, categoryPoints[0]])}
            fill="#f472b6"
            fillOpacity={0.18}
            stroke="#f472b6"
            strokeWidth={2}
          />
        )}
        {categoryMode && categoryPoints?.map((p, idx) => { const dp = toDisplay(p); return (<circle key={idx} cx={dp.x} cy={dp.y} r={4} fill="#f472b6" stroke="#000" strokeWidth={1} />); })}
      </svg>

      {/* Selected segment highlight */}
      {selectedSegId && (
        <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 9, pointerEvents: "none" }}>
          {segments.filter(s=>s.id===selectedSegId).map(s => (
            <polyline key={s.id} points={polylineStr(s.polyline||[])} fill="none" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
          ))}
        </svg>
      )}

      {/* Items overlay (blue markers) */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 8, pointerEvents: "none" }}>
        {items.map((it)=> (
          <g key={it.id}>
            <circle cx={it.x * effScale} cy={it.y * effScale} r={4} fill="#4da3ff" stroke="#00224d" strokeWidth={1} />
            {showLabels && (
              <text x={it.x * effScale + 6} y={it.y * effScale - 6} fill="#e5e7eb" fontSize={11} style={{ userSelect: 'none' }}>{it.name}</text>
            )}
          </g>
        ))}
      </svg>

      {/* New/Selected Item marker */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" }}>
        {newItemPos && (
          <g>
            <circle cx={newItemPos.x * effScale} cy={newItemPos.y * effScale} r={6} fill={selectedItem ? "#ff9f1a" : "#ffd400"} stroke="#000" strokeWidth={1} />
            <circle cx={newItemPos.x * effScale} cy={newItemPos.y * effScale} r={2} fill="#000" />
          </g>
        )}
      </svg>

      {/* Start/End markers */}
      <svg width={displayWidth} height={effHeight} style={{ position: "absolute", left: 0, top: 0, zIndex: 7, pointerEvents: "none" }}>
        {routeStart && (<circle cx={routeStart.x * effScale} cy={routeStart.y * effScale} r={5} fill="#3fa9f5" stroke="#000" strokeWidth={1} />)}
        {routeEnd && (<circle cx={routeEnd.x * effScale} cy={routeEnd.y * effScale} r={5} fill="#ff2bd6" stroke="#000" strokeWidth={1} />)}
      </svg>

      {/* Map size badge */}
      <div style={{ position: "absolute", left: 8, bottom: 8, zIndex: 10, background: "rgba(10,10,14,0.8)", border: "1px solid #2a2a2e", color: "#e5e7eb", padding: "6px 8px", borderRadius: 6, fontSize: 12, lineHeight: "14px", backdropFilter: "blur(2px)" }}>
        <div>Map: {mapWidthPx} × {mapHeightPx} px</div>
        <div>Display: {displayWidth} × {effHeight} px</div>
        <div>Scale: {effScale.toFixed(2)}×</div>
      </div>
    </div>
  );
}
