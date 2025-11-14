import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DISPLAY_WIDTH, SNAP_THRESHOLD_PX } from "../config";
import {
  createFreeSegment,
  getSegments,
  routeByCoords,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  deleteSegment,
} from "../api";
import { createSlamStart } from "../api";
import { getSlamStart } from "../api";
import { getCategories, createCategory } from "../api";
import EditorSidebar from "../components/EditorSidebar";
import MapCanvas from "../components/MapCanvas";
import ItemPanel from "../components/ItemPanel";
import ChatPanel from "../components/ChatPanel";
import { API_BASE } from "../config";
import { useMart } from "../context/MartContext";
import ItemsSidebar from "../components/ItemsSidebar";

function pointInPolygon(point, polygon = []) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i] || {};
    const prev = polygon[j] || {};
    const xi = Number(current.x);
    const yi = Number(current.y);
    const xj = Number(prev.x);
    const yj = Number(prev.y);
    if (
      !Number.isFinite(xi) ||
      !Number.isFinite(yi) ||
      !Number.isFinite(xj) ||
      !Number.isFinite(yj)
    ) {
      continue;
    }
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// toDisplay and toMapCoords will use dynamic scale (computed per mart)

export default function AdminMapPage() {
  const containerRef = useRef(null);

  const [segments, setSegments] = useState([]);
  const [items, setItems] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [categoryMode, setCategoryMode] = useState(false);
  const [categoryPoints, setCategoryPoints] = useState([]);
  const [categoryName, setCategoryName] = useState("");

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
    sale_end_at: "",
    description: "",
    heading_deg: "",
    category_id: null,
  });
  const [categoryLocked, setCategoryLocked] = useState(false);

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
  const { mart } = useMart();
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('all');

  const mapWidthPx = useMemo(() => Number(mart?.map_width_px) || null, [mart]);
  const mapHeightPx = useMemo(
    () => Number(mart?.map_height_px) || null,
    [mart]
  );
  const displayWidth = DISPLAY_WIDTH;
  const scale = useMemo(() => {
    if (mapWidthPx && mapWidthPx > 0) return displayWidth / mapWidthPx;
    // fallback to 1:1 if unknown; MapCanvas will use defaults
    return undefined;
  }, [mapWidthPx, displayWidth]);
  const displayHeight = useMemo(() => {
    if (scale && mapHeightPx) return Math.round(mapHeightPx * scale);
    return undefined;
  }, [scale, mapHeightPx]);
  const backgroundImageUrl = useMemo(() => {
    const u = mart?.map_image_url;
    let src = null;
    if (!u) {
      src = "/Frame1.png";
    } else {
      src =
        typeof u === "string" && u.startsWith("http") ? u : `${API_BASE}${u}`;
    }
    if (mart && src) {
      const sep = src.includes("?") ? "&" : "?";
      src = `${src}${sep}v=${encodeURIComponent(mart.id)}`;
    }
    return src || "/Frame1.png";
  }, [mart]);

  const toDisplay = useCallback(
    ({ x, y }) => {
      const s = scale || 1;
      return { x: x * s, y: y * s };
    },
    [scale]
  );
  const toMapCoords = useCallback(
    (clientX, clientY, rect) => {
      const s = scale || 1;
      const dx = clientX - rect.left;
      const dy = clientY - rect.top;
      return { x: dx / s, y: dy / s };
    },
    [scale]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await getSegments();
        setSegments(data);
      } catch (error) {
        console.error("Failed to load segments:", error);
      }
      try {
        const it = await getItems(mart?.id);
        setItems(it);
      } catch (error) {
        if (process?.env?.NODE_ENV !== 'production') console.warn('getItems failed', error);
      }
      try {
        const s = await getSlamStart();
        setSlamStart(s);
      } catch (error) {
        if (process?.env?.NODE_ENV !== 'production') console.warn('getSlamStart failed', error);
      }
      try {
        const cats = await getCategories(mart?.id);
        setCategories(cats);
      } catch (error) {
        if (process?.env?.NODE_ENV !== 'production') console.warn('getCategories failed', error);
      }
    })();
  }, [mart]);

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

  const findCategoryForPoint = useCallback(
    (x, y) => {
      if (!categories || categories.length === 0) return null;
      for (const cat of categories) {
        if (Array.isArray(cat.polygon) && cat.polygon.length >= 3) {
          if (pointInPolygon({ x, y }, cat.polygon)) {
            return cat.id;
          }
        }
      }
      return null;
    },
    [categories]
  );

  const handleMapClick = useCallback(
    async (eOrPoint) => {
      let p;
      if (typeof eOrPoint?.clientX === 'number' && typeof eOrPoint?.clientY === 'number') {
        const rect = containerRef.current.getBoundingClientRect();
        p = toMapCoords(eOrPoint.clientX, eOrPoint.clientY, rect);
      } else if (typeof eOrPoint?.x === 'number' && typeof eOrPoint?.y === 'number') {
        // MapCanvas now passes map coords directly when available
        p = { x: eOrPoint.x, y: eOrPoint.y };
      } else {
        return;
      }
      const maxW = mapWidthPx ?? Number.POSITIVE_INFINITY;
      const maxH = mapHeightPx ?? Number.POSITIVE_INFINITY;
      p.x = Math.max(0, Math.min(maxW, p.x));
      p.y = Math.max(0, Math.min(maxH, p.y));

      if (drawMode || routeMode || categoryMode) {
        const snap = findNearestSnap(p);
        if (snap) p = snap;
      }

      if (drawMode) {
        setDrawPoints((prev) => [...prev, p]);
        return;
      }

      if (categoryMode) {
        setCategoryPoints((prev) => [...prev, p]);
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
        const isSlam =
          newItem.type === "slam_start" ||
          (selectedItem && selectedItem.type === "slam_start");
        if (isSlam) {
          const baseX = Number(newItem.x ?? newItemPos?.x ?? selectedItem?.x);
          const baseY = Number(newItem.y ?? newItemPos?.y ?? selectedItem?.y);
          if (!isNaN(baseX) && !isNaN(baseY)) {
            const dx = p.x - baseX;
            const dy = p.y - baseY;
            let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (deg < 0) deg += 360;
            setNewItem((prev) => ({
              ...prev,
              heading_deg: Math.round(deg * 10) / 10,
            }));
          }
        }
        setHeadingPickMode(false);
        return;
      }

      if (createMode) {
        setNewItemPos(p);
        setNewItem((prev) => {
          let nextCategory = prev.category_id ?? null;
          if (!categoryLocked) {
            const detected = findCategoryForPoint(p.x, p.y);
            if (detected != null) {
              nextCategory = detected;
            }
          }
          return { ...prev, x: p.x, y: p.y, category_id: nextCategory };
        });
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
            sale_end_at: it.sale_end_at
              ? String(it.sale_end_at).slice(0, 16)
              : "",
            description: it.description || "",
            heading_deg: it.heading_deg ?? "",
            category_id: it.category_id ?? null,
          });
          setNewItemPos({ x: it.x, y: it.y });
          setCategoryLocked(it.category_id != null);
        }
        return;
      }
  },
    [
      drawMode,
      categoryMode,
      routeMode,
      routeStart,
      routeEnd,
      createMode,
      editMode,
      selectSegMode,
      segments,
      findNearestSnap,
      findNearestItem,
      headingPickMode,
      mapWidthPx,
      mapHeightPx,
      findCategoryForPoint,
      categoryLocked,
    ]
  );

  useEffect(() => {
    if (categoryLocked) return;
    if (newItem.category_id != null) return;
    const nx = Number(newItem.x);
    const ny = Number(newItem.y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    const detected = findCategoryForPoint(nx, ny);
    if (detected == null) return;
    setNewItem((prev) => {
      if (prev.category_id === detected) {
        return prev;
      }
      return { ...prev, category_id: detected };
    });
  }, [categoryLocked, newItem.category_id, newItem.x, newItem.y, findCategoryForPoint]);

  useEffect(() => {
    if (createMode && !editMode) {
      setCategoryLocked(false);
    }
  }, [createMode, editMode]);

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
      const res = await routeByCoords(routeStart, routeEnd, "astar");
      setRoutePolyline(res.polyline || []);
    } catch (e) {
      alert("Route failed: " + (e?.message || e));
    }
  }, [routeStart, routeEnd]);

  const handleSaveCategory = useCallback(async () => {
    if (!mart?.id) {
      alert("Select a mart first");
      return;
    }
    if (categoryPoints.length < 3) {
      alert("At least 3 points");
      return;
    }
    if (!categoryName.trim()) {
      alert("Enter category name");
      return;
    }
    try {
      // ensure closed by frontend as well
      const pts = [...categoryPoints];
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (!last || last.x !== first.x || last.y !== first.y) {
        pts.push({ x: first.x, y: first.y });
      }
      await createCategory({
        mart_id: mart.id,
        name: categoryName.trim(),
        polygon: pts,
      });
      setCategoryPoints([]);
      setCategoryName("");
      const cats = await getCategories(mart.id);
      setCategories(cats);
      alert("Category saved");
    } catch (e) {
      alert("Save category failed: " + (e?.message || e));
    }
  }, [categoryPoints, categoryName, mart?.id]);

  const polylineStr = useCallback(
    (pts) => {
      const s = scale || 1;
      return pts.map((p) => `${p.x * s},${p.y * s}`).join(" ");
    },
    [scale]
  );

  const saveNewItem = useCallback(async () => {
    if (!newItemPos) {
      alert("Click on map to set item position.");
      return;
    }
    try {
      if (newItem.type === "slam_start") {
        await createSlamStart({
          x: Number(newItem.x ?? newItemPos.x),
          y: Number(newItem.y ?? newItemPos.y),
          z: newItem.z === "" ? null : Number(newItem.z),
          heading_deg:
            newItem.heading_deg === "" ? null : Number(newItem.heading_deg),
        });
        // reload items so mobile can see slam_start
        const it = await getItems(mart?.id);
        setItems(it);
        try {
          const s = await getSlamStart();
          setSlamStart(s);
        } catch (error) {
          if (process?.env?.NODE_ENV !== 'production') console.warn('getSlamStart failed', error);
        }
      } else {
        const { heading_deg, ...rest } = newItem;
        const payload = {
          ...rest,
          mart_id: mart?.id,
          x: Number(newItem.x ?? newItemPos.x),
          y: Number(newItem.y ?? newItemPos.y),
          z: newItem.z === "" ? null : Number(newItem.z),
          price: newItem.price === "" ? null : Number(newItem.price),
          sale_percent:
            newItem.sale_percent === ""
              ? null
              : parseInt(newItem.sale_percent, 10),
          sale_end_at: newItem.sale_end_at === "" ? null : newItem.sale_end_at,
          heading_deg:
            heading_deg === "" || heading_deg == null
              ? null
              : Number(heading_deg),
        };
        if (
          payload.price == null ||
          payload.price === "" ||
          isNaN(Number(payload.price))
        ) {
          alert("Price is required");
          return;
        }
        if (!payload.image_url || String(payload.image_url).trim() === "") {
          alert("Image is required");
          return;
        }
        /*
        \n        if (payload.price == null || payload.price === '' || isNaN(Number(payload.price))) { alert('Price is required'); return; }\n        if (!payload.image_url || String(payload.image_url).trim() === '') { alert('Image is required'); return; }
        */
        const created = await createItem(payload);
      setItems((prev) =>
        Array.isArray(prev) ? [...prev, created] : [created]
      );
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
      category_id: null,
    });
    setCategoryLocked(false);
  } catch (e) {
    alert("Create failed: " + (e?.message || e));
  }
}, [newItem, newItemPos]);

  const saveEditedItem = useCallback(async () => {
    if (!selectedItem) return;
    const { heading_deg, ...rest } = newItem;
    const payload = {
      ...rest,
      mart_id: mart?.id ?? selectedItem?.mart_id,
      x: Number(newItem.x ?? newItemPos?.x ?? selectedItem.x),
      y: Number(newItem.y ?? newItemPos?.y ?? selectedItem.y),
      z: newItem.z === "" ? null : Number(newItem.z),
      price: newItem.price === "" ? null : Number(newItem.price),
      sale_percent:
        newItem.sale_percent === "" ? null : parseInt(newItem.sale_percent, 10),
      sale_end_at: newItem.sale_end_at === "" ? null : newItem.sale_end_at,
      heading_deg:
        heading_deg === "" || heading_deg == null ? null : Number(heading_deg),
    };
    if (
      payload.price == null ||
      payload.price === "" ||
      isNaN(Number(payload.price))
    ) {
      alert("Price is required");
      return;
    }
    if (!payload.image_url || String(payload.image_url).trim() === "") {
      alert("Image is required");
      return;
    }
    /*
    \n        if (payload.price == null || payload.price === '' || isNaN(Number(payload.price))) { alert('Price is required'); return; }\n        if (!payload.image_url || String(payload.image_url).trim() === '') { alert('Image is required'); return; }
    */
    try {
      await updateItem(selectedItem.id, payload);
      const it = await getItems(mart?.id);
      setItems(it);
    } catch (e) {
      alert("Update failed: " + (e?.message || e));
    }
  }, [selectedItem, newItem, newItemPos, mart]);

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
        sale_end_at: "",
        description: "",
        heading_deg: "",
        category_id: null,
      });
      setCategoryLocked(false);
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
      <EditorSidebar
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        categoryMode={categoryMode}
        setCategoryMode={setCategoryMode}
        routeMode={routeMode}
        setRouteMode={setRouteMode}
        createMode={createMode}
        setCreateMode={setCreateMode}
        editMode={editMode}
        setEditMode={setEditMode}
        selectSegMode={selectSegMode}
        setSelectSegMode={setSelectSegMode}
        drawPointsCount={drawPoints.length}
        categoryPointsCount={categoryPoints.length}
        onClearDraw={() => setDrawPoints([])}
        onClearCategory={() => setCategoryPoints([])}
        onSaveSegment={handleSaveSegment}
        onSaveCategory={handleSaveCategory}
        categoryName={categoryName}
        setCategoryName={setCategoryName}
        routeStart={routeStart}
        routeEnd={routeEnd}
        onClearRoute={() => {
          setRouteStart(null);
          setRouteEnd(null);
          setRoutePolyline([]);
        }}
        onComputeRoute={handleComputeRoute}
        onUseSlamStart={() => {
          const s = items.find((it) => it.type === "slam_start");
          if (s) setRouteStart({ x: Number(s.x), y: Number(s.y) });
          else alert("No SLAM start item found");
        }}
        onReloadSegments={async () => {
          try {
            const data = await getSegments();
            setSegments(data);
          } catch (error) {
            if (process?.env?.NODE_ENV !== 'production') console.warn('reload segments failed', error);
          }
        }}
        onReloadItems={async () => {
          try {
            const it = await getItems(mart?.id);
            setItems(it);
          } catch (error) {
            if (process?.env?.NODE_ENV !== 'production') console.warn('reload items failed', error);
          }
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
        categories={categories}
        martId={mart?.id ?? null}
        reloadCategories={async () => {
          try {
            setCategories(await getCategories(mart?.id));
          } catch (error) {
            if (process?.env?.NODE_ENV !== 'production') console.warn('reload categories failed', error);
          }
        }}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <MapCanvas
        key={mart ? mart.id : "no-mart"}
        containerRef={containerRef}
        onMapClick={handleMapClick}
        onMapMove={(p) => setMousePos(p)}
        drawMode={drawMode}
        routeMode={routeMode}
        selectSegMode={selectSegMode}
        segments={segments}
        routePolyline={routePolyline}
        drawPoints={drawPoints}
        categories={categories}
        categoryPoints={categoryPoints}
        categoryMode={categoryMode}
        items={items}
        newItemPos={newItemPos}
        selectedItem={selectedItem}
        routeStart={routeStart}
        routeEnd={routeEnd}
        selectedSegId={selectedSegId}
        headingPickMode={headingPickMode}
        headingArrow={(() => {
          // Show arrow when slam_start and we have heading
          const isCreate =
            createMode &&
            newItem.type === "slam_start" &&
            (newItemPos || (newItem.x != null && newItem.y != null));
          const isEdit =
            editMode && selectedItem && selectedItem.type === "slam_start";
          const hasHeading =
            newItem.heading_deg !== undefined &&
            newItem.heading_deg !== "" &&
            newItem.heading_deg !== null;
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
        // dynamic map config from Mart
        backgroundImageUrl={backgroundImageUrl}
        displayWidth={displayWidth}
        displayHeight={displayHeight}
        scale={scale}
        mapWidthPx={mapWidthPx ?? undefined}
        mapHeightPx={mapHeightPx ?? undefined}
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
            categories={categories}
            onCategorySelect={() => setCategoryLocked(true)}
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
                category_id: null,
              });
              setCategoryLocked(false);
            }}
          />
        )}

      {showChat && (
        <ChatPanel
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatReply={chatReply}
          setChatReply={setChatReply}
          device={
            slamStart
              ? { x: slamStart.x, y: slamStart.y, z: slamStart.z ?? null }
              : null
          }
        />
      )}

      {showSidebar && (
        <ItemsSidebar items={items} filterText={search} slamStart={slamStart} />
      )}

      {mousePos && (
        <div
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            background: "#0b0b0f",
            border: "1px solid #2a2a2e",
            color: "#e5e7eb",
            padding: "6px 8px",
            borderRadius: 6,
            fontSize: 12,
            zIndex: 50,
          }}
        >
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
