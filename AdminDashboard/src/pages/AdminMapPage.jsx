import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  MAP_HEIGHT_PX,
  MAP_WIDTH_PX,
  SCALE,
  SNAP_THRESHOLD_PX,
} from "../config";
import {
  createFreeSegment,
  getSegments,
  routeByCoords,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  planRoute,
  deleteSegment,
} from "../api";
import { createSlamStart } from "../api";
import { getSlamStart } from "../api";
import { chatBot } from "../chatApi";
import Toolbar from "../components/Toolbar";
import MapCanvas from "../components/MapCanvas";
import ItemPanel from "../components/ItemPanel";
import ChatPanel from "../components/ChatPanel";
import ItemsSidebar from "../components/ItemsSidebar";

function toDisplay({ x, y }) {
  return { x: x * SCALE, y: y * SCALE };
}
function toMapCoords(clientX, clientY, rect) {
  const dx = clientX - rect.left;
  const dy = clientY - rect.top;
  return { x: dx / SCALE, y: dy / SCALE };
}

export default function AdminMapPage() {
  const containerRef = useRef(null);

  const [segments, setSegments] = useState([]);
  const [items, setItems] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);

  const [routeMode, setRouteMode] = useState(false);
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);

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
    heading_deg: "",
  });

  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState(null);

  const [selectSegMode, setSelectSegMode] = useState(false);
  const [selectedSegId, setSelectedSegId] = useState(null);
  const [headingPickMode, setHeadingPickMode] = useState(false);
  const [slamStart, setSlamStart] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSegments();
        setSegments(data);
      } catch {}
      try {
        const it = await getItems();
        setItems(it);
      } catch {}
      try {
        const s = await getSlamStart();
        setSlamStart(s);
      } catch {}
    })();
  }, []);

  const allSnapPoints = useMemo(() => {
    const pts = [];
    for (const s of segments) {
      if (s.polyline?.length) {
        const first = s.polyline[0];
        const last = s.polyline[s.polyline.length - 1];
        pts.push(first, last);
      }
    }
    for (const it of items) pts.push({ x: it.x, y: it.y });
    for (const p of drawPoints) pts.push(p);
    return pts;
  }, [segments, items, drawPoints]);

  const findNearestSnap = useCallback(
    (p) => {
      if (!allSnapPoints.length) return null;
      let best = null;
      let bestD2 = SNAP_THRESHOLD_PX * SNAP_THRESHOLD_PX;
      for (const q of allSnapPoints) {
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = q;
        }
      }
      return best;
    },
    [allSnapPoints]
  );

  const findNearestItem = useCallback(
    (p) => {
      if (!items.length) return null;
      let best = null;
      let bestD2 = SNAP_THRESHOLD_PX * SNAP_THRESHOLD_PX;
      for (const it of items) {
        const dx = it.x - p.x;
        const dy = it.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = it;
        }
      }
      return best;
    },
    [items]
  );

  function pointToSegmentDistance(p, a, b) {
    const px = p.x,
      py = p.y;
    const ax = a.x,
      ay = a.y;
    const bx = b.x,
      by = b.y;
    const abx = bx - ax,
      aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) return Math.hypot(px - ax, py - ay);
    const apx = px - ax,
      apy = py - ay;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * abx,
      qy = ay + t * aby;
    return Math.hypot(px - qx, py - qy);
  }

  const handleMapClick = useCallback(
    async (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      let p = toMapCoords(e.clientX, e.clientY, rect);
      p.x = Math.max(0, Math.min(MAP_WIDTH_PX, p.x));
      p.y = Math.max(0, Math.min(MAP_HEIGHT_PX, p.y));

      if (drawMode || routeMode) {
        const snap = findNearestSnap(p);
        if (snap) p = snap;
      }

      if (drawMode) {
        setDrawPoints((prev) => [...prev, p]);
        return;
      }

      if (routeMode) {
        if (!routeStart) setRouteStart(p);
        else if (!routeEnd) setRouteEnd(p);
        else {
          setRouteStart(p);
          setRouteEnd(null);
          setRoutePolyline([]);
        }
        return;
      }

      if (headingPickMode) {
        // Set heading based on click relative to current slam_start item position
        const isSlam = newItem.type === 'slam_start' || (selectedItem && selectedItem.type === 'slam_start');
        if (isSlam) {
          const baseX = Number(newItem.x ?? newItemPos?.x ?? selectedItem?.x);
          const baseY = Number(newItem.y ?? newItemPos?.y ?? selectedItem?.y);
          if (!isNaN(baseX) && !isNaN(baseY)) {
            const dx = p.x - baseX; const dy = p.y - baseY;
            let deg = (Math.atan2(dy, dx) * 180 / Math.PI);
            if (deg < 0) deg += 360;
            setNewItem(prev => ({ ...prev, heading_deg: Math.round(deg * 10) / 10 }));
          }
        }
        setHeadingPickMode(false);
        return;
      }

      if (createMode) {
        setNewItemPos(p);
        setNewItem((prev) => ({ ...prev, x: p.x, y: p.y }));
        return;
      }

      if (selectSegMode) {
        let best = null;
        let bestD = SNAP_THRESHOLD_PX;
        for (const s of segments) {
          const pts = s.polyline || [];
          for (let i = 0; i < pts.length - 1; i++) {
            const d = pointToSegmentDistance(p, pts[i], pts[i + 1]);
            if (d <= bestD) {
              bestD = d;
              best = s;
            }
          }
        }
        setSelectedSegId(best ? best.id : null);
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
            heading_deg: it.heading_deg ?? "",
          });
          setNewItemPos({ x: it.x, y: it.y });
        }
        return;
      }
    },
    [
      drawMode,
      routeMode,
      routeStart,
      routeEnd,
      createMode,
      editMode,
      selectSegMode,
      segments,
      findNearestSnap,
      findNearestItem,
    ]
  );

  const handleSaveSegment = useCallback(async () => {
    if (drawPoints.length < 2) return;
    try {
      await createFreeSegment(drawPoints);
      setDrawPoints([]);
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

  const polylineStr = useCallback(
    (pts) => pts.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(" "),
    []
  );

  const saveNewItem = useCallback(async () => {
    if (!newItemPos) {
      alert("Click on map to set item position.");
      return;
    }
    try {
      if (newItem.type === 'slam_start') {
        const slam = await createSlamStart({
          x: Number(newItem.x ?? newItemPos.x),
          y: Number(newItem.y ?? newItemPos.y),
          z: newItem.z === "" ? null : Number(newItem.z),
          heading_deg: newItem.heading_deg === "" ? null : Number(newItem.heading_deg),
        });
        // reload items so mobile can see slam_start
        const it = await getItems();
        setItems(it);
        try { const s = await getSlamStart(); setSlamStart(s); } catch {}
      } else {
        const { heading_deg, ...rest } = newItem;
        const payload = {
          ...rest,
          x: Number(newItem.x ?? newItemPos.x),
          y: Number(newItem.y ?? newItemPos.y),
          z: newItem.z === "" ? null : Number(newItem.z),
          price: newItem.price === "" ? null : Number(newItem.price),
          sale_percent:
            newItem.sale_percent === "" ? null : parseInt(newItem.sale_percent, 10),
          heading_deg: (heading_deg === "" || heading_deg == null) ? null : Number(heading_deg),
        };
        if (!payload.name || !payload.type) {
          alert("Name and type are required");
          return;
        }
        const created = await createItem(payload);
        setItems((prev) => Array.isArray(prev) ? [...prev, created] : [created]);
      }
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
        heading_deg: "",
      });
    } catch (e) {
      alert("Create failed: " + (e?.message || e));
    }
  }, [newItem, newItemPos]);

  const saveEditedItem = useCallback(async () => {
    if (!selectedItem) return;
    const { heading_deg, ...rest } = newItem;
    const payload = {
      ...rest,
      x: Number(newItem.x ?? newItemPos?.x ?? selectedItem.x),
      y: Number(newItem.y ?? newItemPos?.y ?? selectedItem.y),
      z: newItem.z === "" ? null : Number(newItem.z),
      price: newItem.price === "" ? null : Number(newItem.price),
      sale_percent:
        newItem.sale_percent === "" ? null : parseInt(newItem.sale_percent, 10),
      heading_deg: (heading_deg === "" || heading_deg == null) ? null : Number(heading_deg),
    };
    if (!payload.name || !payload.type) {
      alert("Name and type are required");
      return;
    }
    try {
      await updateItem(selectedItem.id, payload);
      const it = await getItems();
      setItems(it);
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
      setItems((prev) => prev.filter((it) => it.id !== selectedItem.id));
      setSelectedItem(null);
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
        heading_deg: "",
      });
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
              setItems((prev) =>
                Array.isArray(prev) ? [...prev, restored] : [restored]
              );
              setLastDeleted(null);
              setToast(null);
            }
          } catch (e) {
            alert("Undo failed: " + (e?.message || e));
          }
        },
      });
      setTimeout(() => setToast(null), 5000);
    } catch (e) {
      alert("Delete failed: " + (e?.message || e));
    }
  }, [selectedItem, lastDeleted]);

  const handleDeleteSelectedSegment = useCallback(async () => {
    if (!selectedSegId) return;
    try {
      await deleteSegment(selectedSegId);
      setSelectedSegId(null);
      const data = await getSegments();
      setSegments(data);
    } catch (e) {
      alert("Delete segment failed: " + (e?.message || e));
    }
  }, [selectedSegId]);

  return (
    <div
      style={{
        color: "#fff",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <Toolbar
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        routeMode={routeMode}
        setRouteMode={setRouteMode}
        createMode={createMode}
        setCreateMode={setCreateMode}
        editMode={editMode}
        setEditMode={setEditMode}
        selectSegMode={selectSegMode}
        setSelectSegMode={setSelectSegMode}
        drawPointsCount={drawPoints.length}
        onClearDraw={() => setDrawPoints([])}
        onSaveSegment={handleSaveSegment}
        routeStart={routeStart}
        routeEnd={routeEnd}
        onClearRoute={() => {
          setRouteStart(null);
          setRouteEnd(null);
          setRoutePolyline([]);
        }}
        onComputeRoute={handleComputeRoute}
        onUseSlamStart={() => {
          const s = items.find(it => it.type === 'slam_start');
          if (s) setRouteStart({ x: Number(s.x), y: Number(s.y) });
          else alert('No SLAM start item found');
        }}
        onReloadSegments={async () => {
          try {
            const data = await getSegments();
            setSegments(data);
          } catch {}
        }}
        onReloadItems={async () => {
          try {
            const it = await getItems();
            setItems(it);
          } catch {}
        }}
        search={search}
        setSearch={setSearch}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        showChat={showChat}
        setShowChat={setShowChat}
        selectedSegId={selectedSegId}
        onDeleteSelectedSegment={handleDeleteSelectedSegment}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
      />

      <MapCanvas
        containerRef={containerRef}
        onMapClick={handleMapClick}
        onMapMove={(p) => setMousePos(p)}
        drawMode={drawMode}
        routeMode={routeMode}
        selectSegMode={selectSegMode}
        segments={segments}
        routePolyline={routePolyline}
        drawPoints={drawPoints}
        items={items}
        newItemPos={newItemPos}
        selectedItem={selectedItem}
        routeStart={routeStart}
        routeEnd={routeEnd}
        selectedSegId={selectedSegId}
        headingPickMode={headingPickMode}
        headingArrow={(() => {
          // Show arrow when slam_start and we have heading
          const isCreate = createMode && newItem.type === 'slam_start' && (newItemPos || (newItem.x!=null && newItem.y!=null));
          const isEdit = editMode && selectedItem && selectedItem.type === 'slam_start';
          const hasHeading = newItem.heading_deg !== undefined && newItem.heading_deg !== '' && newItem.heading_deg !== null;
          if (isCreate && hasHeading) {
            const px = Number(newItem.x ?? newItemPos?.x);
            const py = Number(newItem.y ?? newItemPos?.y);
            return { x: px, y: py, deg: Number(newItem.heading_deg) };
          }
          if (isEdit && hasHeading) {
            const px = Number(newItem.x ?? selectedItem.x);
            const py = Number(newItem.y ?? selectedItem.y);
            return { x: px, y: py, deg: Number(newItem.heading_deg) };
          }
          return null;
        })()}
        slamStart={slamStart}
        showGrid={showGrid}
        showLabels={showLabels}
        toDisplay={toDisplay}
        polylineStr={polylineStr}
      />

      {(createMode || (editMode && selectedItem)) &&
        (newItemPos || selectedItem) && (
          <ItemPanel
            editMode={editMode}
            newItem={newItem}
            setNewItem={setNewItem}
            onSaveNew={saveNewItem}
            onSaveEdit={saveEditedItem}
            onDelete={handleDeleteItem}
            onPickHeading={() => setHeadingPickMode(true)}
            onCancel={() => {
              setNewItemPos(null);
              setSelectedItem(null);
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
                heading_deg: "",
              });
            }}
          />
        )}

      {showChat && (
        <ChatPanel
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatReply={chatReply}
          setChatReply={setChatReply}
          device={slamStart ? { x: slamStart.x, y: slamStart.y, z: slamStart.z ?? null } : null}
        />
      )}

      {showSidebar && <ItemsSidebar items={items} filterText={search} slamStart={slamStart} />}

      {mousePos && (
        <div style={{ position: "fixed", left: 16, bottom: 16, background: "#0b0b0f", border: "1px solid #2a2a2e", color: "#e5e7eb", padding: "6px 8px", borderRadius: 6, fontSize: 12, zIndex: 50 }}>
          ({Math.round(mousePos.x)}, {Math.round(mousePos.y)})
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            background: "#0b0b0f",
            border: "1px solid #2a2a2e",
            color: "#e5e7eb",
            padding: "10px 12px",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>{toast.message}</span>
          {toast.actionText && (
            <button
              onClick={toast.onAction}
              style={{
                padding: "6px 10px",
                background: "#27272a",
                color: "#e5e7eb",
                border: "1px solid #3f3f46",
                borderRadius: 6,
              }}
            >
              {toast.actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
