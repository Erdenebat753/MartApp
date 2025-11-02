import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import zones from "./zones.json";
import {
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  MAP_HEIGHT_PX,
  MAP_WIDTH_PX,
  SCALE,
  SNAP_THRESHOLD_PX,
} from "./config";
import { createFreeSegment, getSegments, routeByCoords, getItems, createItem, updateItem, deleteItem, planRoute } from "./api";
import { chatBot } from "./chatApi";

function toDisplay({ x, y }) {
  return { x: x * SCALE, y: y * SCALE };
}

function toMapCoords(clientX, clientY, rect) {
  const dx = clientX - rect.left;
  const dy = clientY - rect.top;
  return { x: dx / SCALE, y: dy / SCALE };
}

export default function MapView() {
  const containerRef = useRef(null);

  const [segments, setSegments] = useState([]); // [{id, polyline:[{x,y},...]}, ...]
  const [items, setItems] = useState([]); // backend items
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);

  const [routeMode, setRouteMode] = useState(false);
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);

  // Create Item mode
  const [createMode, setCreateMode] = useState(false);
  const [newItemPos, setNewItemPos] = useState(null);
  const [newItem, setNewItem] = useState({
    name: "",
    type: "product",
    x: null,
    y: null,
    z: "",
    image_url: "",
    note: "",
    price: "",
    sale_percent: "",
    description: "",
  });

  // Edit Item mode
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null); // {message, actionText, onAction}
  const [lastDeleted, setLastDeleted] = useState(null); // store deleted item for undo
  const [showSidebar, setShowSidebar] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState(null); // {intent, item_ids, reply}

  // Preload segments on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getSegments();
        setSegments(data);
      } catch (e) {
        console.warn("Failed to load segments:", e?.message || e);
      }
      try {
        const it = await getItems();
        setItems(it);
      } catch (e) {
        console.warn("Failed to load items:", e?.message || e);
      }
    })();
  }, []);

  const allSnapPoints = useMemo(() => {
    const pts = [];
    for (const s of segments) {
      if (s.polyline?.length) {
        // snap only endpoints to reduce noise
        const first = s.polyline[0];
        const last = s.polyline[s.polyline.length - 1];
        pts.push(first, last);
      }
    }
    // include item points too
    for (const it of items) pts.push({ x: it.x, y: it.y });
    // include current draw points as well
    for (const p of drawPoints) pts.push(p);
    return pts;
  }, [segments, items, drawPoints]);

  const findNearestSnap = useCallback(
    (p) => {
      if (!allSnapPoints.length) return null;
      let best = null;
      let bestD2 = SNAP_THRESHOLD_PX * SNAP_THRESHOLD_PX; // compare in map-px^2
      for (const q of allSnapPoints) {
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = q;
        }
      }
      return best; // null if no candidate within threshold
    },
    [allSnapPoints]
  );

  const findNearestItem = useCallback((p) => {
    if (!items.length) return null;
    let best = null;
    let bestD2 = SNAP_THRESHOLD_PX * SNAP_THRESHOLD_PX;
    for (const it of items) {
      const dx = it.x - p.x; const dy = it.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 <= bestD2) { bestD2 = d2; best = it; }
    }
    return best;
  }, [items]);

  const handleMapClick = useCallback(
    async (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      let p = toMapCoords(e.clientX, e.clientY, rect);

      // clamp to map bounds
      p.x = Math.max(0, Math.min(MAP_WIDTH_PX, p.x));
      p.y = Math.max(0, Math.min(MAP_HEIGHT_PX, p.y));

      // apply snapping in draw/route modes
      if (drawMode || routeMode) {
        const snap = findNearestSnap(p);
        if (snap) p = snap;
      }

      if (drawMode) {
        setDrawPoints((prev) => [...prev, p]);
        return;
      }

      if (routeMode) {
        if (!routeStart) {
          setRouteStart(p);
        } else if (!routeEnd) {
          setRouteEnd(p);
        } else {
          // third click resets start/end
          setRouteStart(p);
          setRouteEnd(null);
          setRoutePolyline([]);
        }
        return;
      }

      if (createMode) {
        setNewItemPos(p);
        setNewItem((prev) => ({ ...prev, x: p.x, y: p.y }));
        return;
      }

      if (editMode) {
        const it = findNearestItem(p);
        if (it) {
          setSelectedItem(it);
          setNewItem({
            name: it.name,
            type: it.type,
            x: it.x,
            y: it.y,
            z: it.z ?? "",
            image_url: it.image_url || "",
            note: it.note || "",
            price: it.price ?? "",
            sale_percent: it.sale_percent ?? "",
            description: it.description || "",
          });
          setNewItemPos({ x: it.x, y: it.y });
        }
        return;
      }
    },
    [drawMode, routeMode, routeStart, routeEnd, findNearestSnap, createMode, editMode, findNearestItem]
  );

  const handleSaveSegment = useCallback(async () => {
    if (drawPoints.length < 2) return;
    try {
      const created = await createFreeSegment(drawPoints);
      setDrawPoints([]);
      // refresh list
      const data = await getSegments();
      setSegments(data);
    } catch (e) {
      alert("Save failed: " + (e?.message || e));
    }
  }, [drawPoints]);

  const handleComputeRoute = useCallback(async () => {
    if (!routeStart || !routeEnd) return;
    try {
      const res = await routeByCoords(routeStart, routeEnd);
      setRoutePolyline(res.polyline || []);
    } catch (e) {
      alert("Route failed: " + (e?.message || e));
    }
  }, [routeStart, routeEnd]);

  const polylineStr = useCallback((pts) => pts.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(" "), []);

  const saveNewItem = useCallback(async () => {
    if (!newItemPos) {
      alert("Click on map to set item position.");
      return;
    }
    const payload = {
      ...newItem,
      x: Number(newItem.x ?? newItemPos.x),
      y: Number(newItem.y ?? newItemPos.y),
      z: newItem.z === "" ? null : Number(newItem.z),
      price: newItem.price === "" ? null : Number(newItem.price),
      sale_percent: newItem.sale_percent === "" ? null : parseInt(newItem.sale_percent, 10),
    };
    if (!payload.name || !payload.type) {
      alert("Name and type are required");
      return;
    }
    try {
      const created = await createItem(payload);
      setItems((prev)=> Array.isArray(prev) ? [...prev, created] : [created]);
      setNewItemPos(null);
      setNewItem({
        name: "",
        type: "product",
        x: null,
        y: null,
        z: "",
        image_url: "",
        note: "",
        price: "",
        sale_percent: "",
        description: "",
      });
    } catch (e) {
      alert("Create failed: " + (e?.message || e));
    }
  }, [newItem, newItemPos]);

  const saveEditedItem = useCallback(async () => {
    if (!selectedItem) return;
    const payload = {
      ...newItem,
      x: Number(newItem.x ?? newItemPos?.x ?? selectedItem.x),
      y: Number(newItem.y ?? newItemPos?.y ?? selectedItem.y),
      z: newItem.z === "" ? null : Number(newItem.z),
      price: newItem.price === "" ? null : Number(newItem.price),
      sale_percent: newItem.sale_percent === "" ? null : parseInt(newItem.sale_percent, 10),
    };
    if (!payload.name || !payload.type) {
      alert("Name and type are required");
      return;
    }
    try {
      await updateItem(selectedItem.id, payload);
      const it = await getItems();
      setItems(it);
      // keep panel open, but refresh data
    } catch (e) {
      alert("Update failed: " + (e?.message || e));
    }
  }, [selectedItem, newItem, newItemPos]);

  const handleDeleteItem = useCallback(async () => {
    if (!selectedItem) return;
    const ok = window.confirm(`Delete item "${selectedItem.name}"?`);
    if (!ok) return;
    try {
      setLastDeleted({ ...selectedItem });
      await deleteItem(selectedItem.id);
      setItems((prev)=> prev.filter((it)=> it.id !== selectedItem.id));
      setSelectedItem(null);
      setNewItemPos(null);
      setNewItem({ name: "", type: "product", x: null, y: null, z: "", image_url: "", note: "", price: "", sale_percent: "", description: "" });
      setToast({
        message: "Item deleted",
        actionText: "Undo",
        onAction: async () => {
          try {
            if (lastDeleted) {
              const restored = await createItem({
                name: lastDeleted.name,
                type: lastDeleted.type,
                x: lastDeleted.x,
                y: lastDeleted.y,
                z: lastDeleted.z ?? null,
                image_url: lastDeleted.image_url || null,
                note: lastDeleted.note || null,
                price: lastDeleted.price ?? null,
                sale_percent: lastDeleted.sale_percent ?? null,
                description: lastDeleted.description || null,
              });
              setItems((prev)=> Array.isArray(prev) ? [...prev, restored] : [restored]);
              setLastDeleted(null);
              setToast(null);
            }
          } catch (e) {
            alert("Undo failed: " + (e?.message || e));
          }
        }
      });
      // auto-hide toast in 5s
      setTimeout(()=> setToast(null), 5000);
    } catch (e) {
      alert("Delete failed: " + (e?.message || e));
    }
  }, [selectedItem]);

  return (
    <div style={{ color: "#fff", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => { const nv = !drawMode; setDrawMode(nv); if(nv){ setRouteMode(false); setCreateMode(false); setEditMode(false);} }} style={{ padding: "6px 10px" }}>
          {drawMode ? "Drawing: ON" : "Drawing: OFF"}
        </button>
        <button onClick={() => setDrawPoints([])} disabled={!drawPoints.length} style={{ padding: "6px 10px" }}>Clear Draw</button>
        <button onClick={handleSaveSegment} disabled={drawPoints.length < 2} style={{ padding: "6px 10px" }}>Save Segment</button>
        <span style={{ width: 1, background: "#444" }} />
        <button onClick={() => { const nv = !routeMode; setRouteMode(nv); if(nv){ setDrawMode(false); setCreateMode(false); setEditMode(false);} }} style={{ padding: "6px 10px" }}>
          {routeMode ? "Route Mode: ON" : "Route Mode: OFF"}
        </button>
        <button onClick={() => { setRouteStart(null); setRouteEnd(null); setRoutePolyline([]); }} style={{ padding: "6px 10px" }}>Clear Route</button>
        <button onClick={handleComputeRoute} disabled={!routeStart || !routeEnd} style={{ padding: "6px 10px" }}>Compute Route</button>
        <span style={{ width: 1, background: "#444" }} />
        <button onClick={async ()=>{ try { const data = await getSegments(); setSegments(data);} catch(e){} }} style={{ padding: "6px 10px" }}>Reload Segments</button>
        <button onClick={async ()=>{ try { const it = await getItems(); setItems(it);} catch(e){} }} style={{ padding: "6px 10px" }}>Reload Items</button>
        <span style={{ width: 1, background: "#444" }} />
        <button onClick={()=>{ const nv = !createMode; setCreateMode(nv); if(nv){ setDrawMode(false); setRouteMode(false); setEditMode(false); setNewItemPos(null);} }} style={{ padding: "6px 10px" }}>
          {createMode ? "Create Item: ON" : "Create Item: OFF"}
        </button>
        <button onClick={()=>{ const nv = !editMode; setEditMode(nv); if(nv){ setDrawMode(false); setRouteMode(false); setCreateMode(false); } if(!nv){ setSelectedItem(null); setNewItemPos(null);} }} style={{ padding: "6px 10px" }}>
          {editMode ? "Edit Item: ON" : "Edit Item: OFF"}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <input placeholder="Search items..." value={search} onChange={(e)=>setSearch(e.target.value)} style={{ padding: 6, width: 220 }} />
          <button onClick={()=> setShowSidebar((v)=>!v)} style={{ padding: "6px 10px" }}>{showSidebar ? "Hide Items" : "Show Items"}</button>
          <button onClick={()=> setShowChat((v)=>!v)} style={{ padding: "6px 10px" }}>{showChat ? "Hide Chat" : "Show Chat"}</button>
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={handleMapClick}
        style={{
          position: "relative",
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          border: "1px solid #999",
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#000000",
          cursor: drawMode || routeMode ? "crosshair" : "default",
        }}
      >
        {/* Store map background */}
        <img
          src="/Frame1.png"
          alt="store map"
          style={{
            width: DISPLAY_WIDTH,
            height: DISPLAY_HEIGHT,
            objectFit: "fill",
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 1,
          }}
        />

        {/* Existing segments (green) */}
        <svg
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" }}
        >
          {segments.map((s) => (
            <polyline
              key={s.id}
              points={polylineStr(s.polyline || [])}
              fill="none"
              stroke="#21d07a"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          ))}
        </svg>

        {/* Route overlay (red) */}
        <svg
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 3, pointerEvents: "none" }}
        >
          {routePolyline.length >= 2 && (
            <polyline
              points={polylineStr(routePolyline)}
              fill="none"
              stroke="red"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Drawing overlay (yellow) */}
        <svg
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 4, pointerEvents: "none" }}
        >
          {drawPoints.length >= 2 && (
            <polyline
              points={polylineStr(drawPoints)}
              fill="none"
              stroke="#ffd400"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {drawPoints.map((p, idx) => {
            const dp = toDisplay(p);
            return (
              <circle key={idx} cx={dp.x} cy={dp.y} r={3} fill="#ffd400" stroke="#000" strokeWidth={1} />
            );
          })}
        </svg>

        {/* Items overlay (blue markers) */}
        <svg width={DISPLAY_WIDTH} height={DISPLAY_HEIGHT} style={{ position: "absolute", left: 0, top: 0, zIndex: 8, pointerEvents: "none" }}>
          {items.map((it)=> (
            <circle key={it.id} cx={it.x * SCALE} cy={it.y * SCALE} r={4} fill="#4da3ff" stroke="#00224d" strokeWidth={1} />
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
        <svg
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ position: "absolute", left: 0, top: 0, zIndex: 7, pointerEvents: "none" }}
        >
          {routeStart && (
            <circle cx={routeStart.x * SCALE} cy={routeStart.y * SCALE} r={5} fill="#3fa9f5" stroke="#000" strokeWidth={1} />
          )}
          {routeEnd && (
            <circle cx={routeEnd.x * SCALE} cy={routeEnd.y * SCALE} r={5} fill="#ff2bd6" stroke="#000" strokeWidth={1} />
          )}
        </svg>

        {/* Zones overlay */}
        {zones.map((zone) => (
          <div
            key={zone.id}
            style={{
              position: "absolute",
              left: zone.x * SCALE - 6,
              top: zone.y * SCALE - 6,
              zIndex: 6,
              width: 12,
              height: 12,
              backgroundColor: "yellow",
              border: "2px solid black",
              borderRadius: "50%",
              boxShadow: "0 0 4px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -22,
                left: "50%",
                transform: "translateX(-50%)",
                padding: "2px 4px",
                fontSize: 10,
                lineHeight: "10px",
                backgroundColor: "rgba(0,0,0,0.7)",
                color: "white",
                borderRadius: 4,
                whiteSpace: "nowrap",
              }}
            >
              {zone.label}
            </div>
          </div>
        ))}
        {/* Create/Edit Item form panel */}
        {(createMode || (editMode && selectedItem)) && (newItemPos || selectedItem) && (
          <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()} style={{ position: "absolute", right: 8, top: 8, zIndex: 8, background: "rgba(0,0,0,0.8)", padding: 12, borderRadius: 8, width: 300 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{editMode ? "Edit Item" : "Create Item"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 6, alignItems: "center" }}>
              <label>Name</label>
              <input value={newItem.name} onChange={(e)=>setNewItem((p)=>({...p, name: e.target.value}))} style={{ width: "100%" }} />
              <label>Type</label>
              <select value={newItem.type} onChange={(e)=>setNewItem((p)=>({...p, type: e.target.value}))}>
                <option value="product">product</option>
                <option value="product_zone">product_zone</option>
                <option value="entrance">entrance</option>
                <option value="checkout">checkout</option>
              </select>
              <label>X</label>
              <input type="number" value={newItem.x ?? (newItemPos?.x ?? "")} onChange={(e)=>setNewItem((p)=>({...p, x: e.target.value}))} />
              <label>Y</label>
              <input type="number" value={newItem.y ?? (newItemPos?.y ?? "")} onChange={(e)=>setNewItem((p)=>({...p, y: e.target.value}))} />
              <label>Z</label>
              <input type="number" step="0.01" value={newItem.z} onChange={(e)=>setNewItem((p)=>({...p, z: e.target.value}))} />
              <label>Image URL</label>
              <input value={newItem.image_url} onChange={(e)=>setNewItem((p)=>({...p, image_url: e.target.value}))} />
              <label>Price</label>
              <input type="number" step="0.01" value={newItem.price} onChange={(e)=>setNewItem((p)=>({...p, price: e.target.value}))} />
              <label>Sale %</label>
              <input type="number" value={newItem.sale_percent} onChange={(e)=>setNewItem((p)=>({...p, sale_percent: e.target.value}))} />
              <label>Note</label>
              <input value={newItem.note} onChange={(e)=>setNewItem((p)=>({...p, note: e.target.value}))} />
              <label>Desc</label>
              <textarea rows={2} value={newItem.description} onChange={(e)=>setNewItem((p)=>({...p, description: e.target.value}))} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {!editMode && (<button onClick={saveNewItem} style={{ padding: "6px 10px" }}>Save</button>)}
              {editMode && (
                <>
                  <button onClick={saveEditedItem} style={{ padding: "6px 10px" }}>Update</button>
                  <button onClick={handleDeleteItem} style={{ padding: "6px 10px", color: "#fff", background: "#b00020" }}>Delete</button>
                </>
              )}
              <button onClick={()=>{ setNewItemPos(null); setSelectedItem(null); setNewItem({ name: "", type: "product", x: null, y: null, z: "", image_url: "", note: "", price: "", sale_percent: "", description: "" }); }} style={{ padding: "6px 10px" }}>Cancel</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#bbb" }}>
              {editMode ? "Tip: Click an item to edit." : "Tip: Click map to set position (snaps to nearby points)."}
            </div>
          </div>
        )}

        {/* Chat panel */}
        {showChat && (
          <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()} style={{ position: "absolute", right: 8, bottom: 8, width: 360, background: "rgba(0,0,0,0.8)", zIndex: 10, padding: 10, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>Chatbot</div>
              <button onClick={()=> setShowChat(false)} style={{ padding: "4px 8px" }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={chatInput} onChange={(e)=>setChatInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: 6 }} />
              <button onClick={async ()=>{
                try {
                  const device = null; // optionally pass {x,y,z}
                  const res = await chatBot(chatInput, device);
                  setChatReply(res);
                } catch (e) {
                  alert("Chat failed");
                }
              }} style={{ padding: "6px 10px" }}>Send</button>
            </div>
            {chatReply && (
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: "18px" }}>
                <div style={{ whiteSpace: "pre-wrap" }}>{chatReply.reply}</div>
                {Array.isArray(chatReply.item_ids) && chatReply.item_ids.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={()=>{
                      // navigate to the first item for now
                      const id = chatReply.item_ids[0];
                      const target = items.find((it)=> it.id === id);
                      if (!target) { alert('Item not found'); return; }
                      setRouteMode(true); setDrawMode(false); setCreateMode(false); setEditMode(false);
                      setRouteEnd({ x: target.x, y: target.y });
                      // if routeStart already set, compute immediately
                      if (routeStart) { handleComputeRoute(); }
                    }} style={{ padding: "6px 10px" }}>Navigate</button>
                    {chatReply.item_ids.length > 1 && (
                      <button onClick={async ()=>{
                        try {
                          if (!routeStart) { alert('Эхлэх цэгээ зураг дээр дарж сонгоно уу (Route Mode ON)'); setRouteMode(true); return; }
                          const res = await planRoute({ x: routeStart.x, y: routeStart.y }, chatReply.item_ids);
                          if (res?.polyline?.length) {
                            setRoutePolyline(res.polyline);
                            setRouteEnd(res.polyline[res.polyline.length-1]);
                          }
                          setToast({ message: `Нийт ${res?.ordered_ids?.length||0} зүйл рүү дарааллаар чиглүүллээ.`, actionText: null });
                          setTimeout(()=> setToast(null), 4000);
                        } catch (e) {
                          alert('Multi-stop төлөвлөлт амжилтгүй');
                        }
                      }} style={{ padding: "6px 10px" }}>Navigate All</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Items sidebar list */}
        {showSidebar && (
          <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()} style={{ position: "absolute", left: 8, top: 8, bottom: 8, width: 260, background: "rgba(0,0,0,0.6)", zIndex: 9, padding: 8, borderRadius: 8, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>Items</div>
              <button onClick={()=> setShowSidebar(false)} style={{ padding: "4px 8px" }}>×</button>
            </div>
            {(items || [])
              .filter((it)=> !search || it.name?.toLowerCase().includes(search.toLowerCase()) || it.type?.toLowerCase().includes(search.toLowerCase()))
              .map((it)=> (
                <div key={it.id} style={{ padding: 6, borderRadius: 6, background: selectedItem?.id===it.id? "rgba(255,255,255,0.1)":"transparent", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                     onClick={()=>{
                       setEditMode(true);
                       setCreateMode(false);
                       setSelectedItem(it);
                       setNewItem({
                         name: it.name,
                         type: it.type,
                         x: it.x,
                         y: it.y,
                         z: it.z ?? "",
                         image_url: it.image_url || "",
                         note: it.note || "",
                         price: it.price ?? "",
                         sale_percent: it.sale_percent ?? "",
                         description: it.description || "",
                       });
                       setNewItemPos({ x: it.x, y: it.y });
                     }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{it.type} • {it.price!=null? `$${it.price}` : "-"}</div>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>({Math.round(it.x)}, {Math.round(it.y)})</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div style={{ position: "fixed", right: 16, bottom: 16, background: "#222", color: "#fff", padding: "10px 12px", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", gap: 12, alignItems: "center" }}>
          <span>{toast.message}</span>
          {toast.actionText && (
            <button onClick={toast.onAction} style={{ padding: "6px 10px" }}>{toast.actionText}</button>
          )}
        </div>
      )}
    </div>
  );
}
