import React from "react";

export default function Toolbar({
  drawMode, setDrawMode,
  routeMode, setRouteMode,
  createMode, setCreateMode,
  editMode, setEditMode,
  selectSegMode, setSelectSegMode,
  drawPointsCount,
  onClearDraw,
  onSaveSegment,
  routeStart, routeEnd,
  onClearRoute,
  onComputeRoute,
  onReloadSegments,
  onReloadItems,
  onReloadSlam,
  search, setSearch,
  showSidebar, setShowSidebar,
  showChat, setShowChat,
  selectedSegId,
  onDeleteSelectedSegment,
  onUseSlamStart,
  showGrid, setShowGrid,
  showLabels, setShowLabels,
}) {
  return (
    <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#18181b", border: "1px solid #2a2a2e", borderRadius: 10, padding: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
      <button onClick={() => { const nv = !drawMode; setDrawMode(nv); if(nv){ setRouteMode(false); setCreateMode(false); setEditMode(false); setSelectSegMode(false);} }} style={{ padding: "6px 10px", background: drawMode ? "#2dd4bf" : "#27272a", color: drawMode ? "#0b1614" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {drawMode ? "Drawing: ON" : "Drawing: OFF"}
      </button>
      <button onClick={onClearDraw} disabled={!drawPointsCount} style={{ padding: "6px 10px", background: !drawPointsCount ? "#1f2937" : "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, opacity: !drawPointsCount ? 0.6 : 1 }}>Clear Draw</button>
      <button onClick={onSaveSegment} disabled={drawPointsCount < 2} style={{ padding: "6px 10px", background: drawPointsCount < 2 ? "#1f2937" : "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, opacity: drawPointsCount < 2 ? 0.6 : 1 }}>Save Segment</button>
      <span style={{ width: 1, height: 20, background: "#2a2a2e" }} />
      <button onClick={() => { const nv = !routeMode; setRouteMode(nv); if(nv){ setDrawMode(false); setCreateMode(false); setEditMode(false); setSelectSegMode(false);} }} style={{ padding: "6px 10px", background: routeMode ? "#60a5fa" : "#27272a", color: routeMode ? "#0b1220" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {routeMode ? "Route Mode: ON" : "Route Mode: OFF"}
      </button>
      <button onClick={onClearRoute} style={{ padding: "6px 10px", background: "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>Clear Route</button>
      <button onClick={onComputeRoute} disabled={!routeStart || !routeEnd} style={{ padding: "6px 10px", background: (!routeStart || !routeEnd) ? "#1f2937" : "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, opacity: (!routeStart || !routeEnd) ? 0.6 : 1 }}>Compute Route</button>
      <button onClick={onUseSlamStart} style={{ padding: "6px 10px", background: "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>Use SLAM Start</button>
      <span style={{ width: 1, height: 20, background: "#2a2a2e" }} />
      <button onClick={onReloadSegments} style={{ padding: "6px 10px", background: "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>Reload Segments</button>
      <button onClick={onReloadItems} style={{ padding: "6px 10px", background: "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>Reload Items</button>
      <button onClick={onReloadSlam} style={{ padding: "6px 10px", background: "#27272a", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>Reload SLAM</button>
      <span style={{ width: 1, height: 20, background: "#2a2a2e" }} />
      <button onClick={() => setShowGrid(v=>!v)} style={{ padding: "6px 10px", background: showGrid ? "#86efac" : "#27272a", color: showGrid ? "#052e16" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {showGrid ? "Grid: ON" : "Grid: OFF"}
      </button>
      <button onClick={() => setShowLabels(v=>!v)} style={{ padding: "6px 10px", background: showLabels ? "#fde68a" : "#27272a", color: showLabels ? "#3b2902" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {showLabels ? "Labels: ON" : "Labels: OFF"}
      </button>
      <button onClick={()=>{ const nv = !createMode; setCreateMode(nv); if(nv){ setDrawMode(false); setRouteMode(false); setEditMode(false); setSelectSegMode(false);} }} style={{ padding: "6px 10px", background: createMode ? "#a78bfa" : "#27272a", color: createMode ? "#1c1433" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {createMode ? "Create Item: ON" : "Create Item: OFF"}
      </button>
      <button onClick={()=>{ const nv = !editMode; setEditMode(nv); if(nv){ setDrawMode(false); setRouteMode(false); setCreateMode(false); setSelectSegMode(false);} }} style={{ padding: "6px 10px", background: editMode ? "#f59e0b" : "#27272a", color: editMode ? "#241a03" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {editMode ? "Edit Item: ON" : "Edit Item: OFF"}
      </button>
      <button onClick={()=>{ const nv = !selectSegMode; setSelectSegMode(nv); if(nv){ setDrawMode(false); setRouteMode(false); setCreateMode(false); setEditMode(false);} }} style={{ padding: "6px 10px", background: selectSegMode ? "#f59e0b" : "#27272a", color: selectSegMode ? "#241a03" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>
        {selectSegMode ? "Select Segment: ON" : "Select Segment: OFF"}
      </button>
      <button onClick={onDeleteSelectedSegment} disabled={!selectedSegId} style={{ padding: "6px 10px", background: selectedSegId ? "#dc2626" : "#1f2937", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, opacity: selectedSegId ? 1 : 0.6 }}>
        Delete Selected
      </button>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <input placeholder="Search items..." value={search} onChange={(e)=>setSearch(e.target.value)} style={{ padding: 6, width: 220, background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }} />
        <button onClick={()=> setShowSidebar((v)=>!v)} style={{ padding: "6px 10px", background: showSidebar ? "#22c55e" : "#27272a", color: showSidebar ? "#06260f" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>{showSidebar ? "Hide Items" : "Show Items"}</button>
        <button onClick={()=> setShowChat((v)=>!v)} style={{ padding: "6px 10px", background: showChat ? "#ef4444" : "#27272a", color: showChat ? "#2a0a0a" : "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6 }}>{showChat ? "Hide Chat" : "Show Chat"}</button>
      </div>
    </div>
  );
}
