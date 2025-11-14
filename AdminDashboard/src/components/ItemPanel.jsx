import React, { useEffect, useMemo, useRef, useState } from "react";

import { API_BASE } from "../config";
import { uploadItemImage } from "../api";

export default function ItemPanel({
  editMode,
  newItem,
  setNewItem,
  onSaveNew,
  onSaveEdit,
  onDelete,
  onCancel,
  onPickHeading,
  categories = [],
  onCategorySelect,
}) {
  const [pos, setPos] = useState({ left: 16, top: 16 });
  const [size, setSize] = useState({ width: 360, height: 520 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (dragging) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = e.clientX - dragOffset.current.x;
        let top = e.clientY - dragOffset.current.y;
        left = Math.max(0, Math.min(vw - size.width, left));
        top = Math.max(0, Math.min(vh - size.height, top));
        setPos({ left, top });
      } else if (resizing) {
        const minW = 260, minH = 280, maxW = Math.min(window.innerWidth - pos.left - 8, 800), maxH = Math.min(window.innerHeight - pos.top - 8, 900);
        let newW = resizeStart.current.w + (e.clientX - resizeStart.current.x);
        let newH = resizeStart.current.h + (e.clientY - resizeStart.current.y);
        newW = Math.max(minW, Math.min(maxW, newW));
        newH = Math.max(minH, Math.min(maxH, newH));
        setSize({ width: newW, height: newH });
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, resizing, size.width, size.height, pos.left, pos.top]);

  return (
    <div
      onMouseDown={(e)=>e.stopPropagation()}
      onClick={(e)=>e.stopPropagation()}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 1000,
        background: "rgba(10,10,14,0.92)",
        border: "1px solid #2a2a2e",
        borderRadius: 10,
        width: size.width,
        height: size.height,
        maxWidth: "100vw",
        maxHeight: "100vh",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        onMouseDown={(e)=>{ setDragging(true); dragOffset.current = { x: e.clientX - pos.left, y: e.clientY - pos.top }; }}
        style={{ cursor: 'move', padding: '8px 10px', borderBottom: '1px solid #2a2a2e', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ fontWeight: 700 }}>{editMode ? 'Edit Item' : 'Create Item'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={onSaveNew} disabled={editMode} style={{ padding: '4px 8px', opacity: editMode ? 0.5 : 1 }}>Save</button>
          {editMode && (
            <>
              <button onClick={onSaveEdit} style={{ padding: '4px 8px' }}>Update</button>
              {typeof onDelete === "function" && (
                <button
                  type="button"
                  onClick={onDelete}
                  style={{
                    padding: "4px 8px",
                    background: "#7f1d1d",
                    color: "#fee2e2",
                    border: "1px solid #f87171",
                    borderRadius: 6,
                  }}
                >
                  Delete
                </button>
              )}
            </>
          )}
          <button onClick={onCancel} style={{ padding: '4px 8px' }}>Close</button>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: 12, boxSizing: 'border-box', width: '100%' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{editMode ? "Edit Item" : "Create Item"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(80px, 110px) 1fr", gap: 6, alignItems: "center" }}>
        <label>Name</label>
        <input value={newItem.name} onChange={(e)=>setNewItem((p)=>({...p, name: e.target.value}))} style={{ width: "100%", background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Type</label>
        <select value={newItem.type} onChange={(e)=>setNewItem((p)=>({...p, type: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }}>
          <option value="product">product</option>
          <option value="product_zone">product_zone</option>
          <option value="slam_start">slam_start</option>
        </select>
        <label>Category</label>
        <select
          value={newItem.category_id ?? ""}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            if (typeof onCategorySelect === "function") {
              onCategorySelect(val);
            }
            setNewItem((p) => ({ ...p, category_id: val }));
          }}
          style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }}
        >
          <option value="">(none)</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {newItem.type === 'slam_start' && (
          <>
            <label>Heading°</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" step="0.1" value={newItem.heading_deg ?? ''} onChange={(e)=>setNewItem((p)=>({...p, heading_deg: e.target.value}))} style={{ flex: '0 0 90px', background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
              <input type="range" min="0" max="360" step="1" value={Number(newItem.heading_deg || 0)} onChange={(e)=>setNewItem((p)=>({...p, heading_deg: Number(e.target.value)}))} style={{ flex: 1, minWidth: 0 }} />
              <button onClick={onPickHeading} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Set From Map</button>
            </div>
          </>
        )}
        <label>X</label>
        <input type="number" value={newItem.x ?? ""} onChange={(e)=>setNewItem((p)=>({...p, x: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Y</label>
        <input type="number" value={newItem.y ?? ""} onChange={(e)=>setNewItem((p)=>({...p, y: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Z</label>
        <input type="number" step="0.01" value={newItem.z} onChange={(e)=>setNewItem((p)=>({...p, z: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Image</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={newItem.image_url} onChange={(e)=>setNewItem((p)=>({...p, image_url: e.target.value}))} placeholder="/uploads/item_xxx.png" style={{ flex: 1, background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
          <label style={{ padding: '6px 10px', border: '1px solid #3f3f46', borderRadius: 6, cursor: 'pointer' }}>
            Upload
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e)=>{
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { image_url } = await uploadItemImage(file);
                setNewItem((p)=>({ ...p, image_url }));
              } catch (err) {
                alert('Upload failed: ' + (err?.message || err));
              }
            }} />
          </label>
        </div>
        <label>Price</label>
        <input type="number" step="0.01" value={newItem.price} onChange={(e)=>setNewItem((p)=>({...p, price: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Sale %</label>
        <input type="number" value={newItem.sale_percent} onChange={(e)=>setNewItem((p)=>({...p, sale_percent: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Sale Ends</label>
        <input
          type="datetime-local"
          value={newItem.sale_end_at || ""}
          onChange={(e) => setNewItem((p) => ({ ...p, sale_end_at: e.target.value }))}
          style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={saleEndMonth}
            onChange={(e) => setSaleEndMonth(Number(e.target.value))}
            style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={31}
            value={saleEndDay}
            onChange={(e) => setSaleEndDay(e.target.value)}
            style={{ width: 70, background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }}
            placeholder="Day"
          />
          <button
            type="button"
            onClick={handleQuickSaleApply}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #3f3f46", background: "#1e293b", color: "#e5e7eb", whiteSpace: "nowrap" }}
          >
            Set 23:59
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          Default day set to 15 at 23:59 for quick entry.
        </div>
        <label>Note</label>
        <input value={newItem.note} onChange={(e)=>setNewItem((p)=>({...p, note: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
        <label>Desc</label>
        <textarea rows={2} value={newItem.description} onChange={(e)=>setNewItem((p)=>({...p, description: e.target.value}))} style={{ background: "#0b0b0f", color: "#e5e7eb", border: "1px solid #3f3f46", borderRadius: 6, padding: "6px 8px" }} />
          </div>
          {/* Preview */}
          {newItem.image_url && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Preview</div>
              <img alt="preview" src={(newItem.image_url.startsWith('http') ? newItem.image_url : `${API_BASE}${newItem.image_url}`)} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid #2a2a2e' }} />
            </div>
          )}
          {/* Actions moved to header: Save / Update / Close */}
          <div style={{ marginTop: 6, fontSize: 12, color: "#bbb" }}>
            {editMode ? "Tip: Click an item to edit." : "Tip: Click map to set position (snaps to nearby points)."}
          </div>
        </div>
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); setResizing(true); resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }; }}
        style={{ position: 'absolute', right: 6, bottom: 6, width: 16, height: 16, cursor: 'nwse-resize', opacity: 0.8 }}
        title="Resize"
      >
        <svg width="16" height="16"><path d="M0 16 L16 0" stroke="#888" /></svg>
      </div>
    </div>
  );
}
  const now = useMemo(() => new Date(), []);
  const [saleEndMonth, setSaleEndMonth] = useState(() => now.getMonth() + 1);
  const [saleEndDay, setSaleEndDay] = useState("15");

  useEffect(() => {
    if (!newItem.sale_end_at) {
      setSaleEndMonth(now.getMonth() + 1);
      setSaleEndDay("15");
      return;
    }
    const dt = new Date(newItem.sale_end_at);
    if (Number.isFinite(dt.getTime())) {
      setSaleEndMonth(dt.getMonth() + 1);
      setSaleEndDay(String(dt.getDate()));
    }
  }, [newItem.sale_end_at, now]);

  const toLocalInputValue = (date) => {
    const tz = date.getTimezoneOffset();
    const local = new Date(date.getTime() - tz * 60000);
    return local.toISOString().slice(0, 16);
  };

  const handleQuickSaleApply = () => {
    const monthNum = Math.min(12, Math.max(1, Number(saleEndMonth) || 1));
    const dayNum = Math.min(31, Math.max(1, Number(saleEndDay) || 15));
    const currentYear = now.getFullYear();
    let targetYear = currentYear;
    if (monthNum < now.getMonth() + 1) {
      targetYear += 1;
    }
    const dt = new Date(targetYear, monthNum - 1, dayNum, 23, 59, 0);
    const value = toLocalInputValue(dt);
    setNewItem((prev) => ({ ...prev, sale_end_at: value }));
  };

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, idx) => idx + 1),
    []
  );
