import React, { useMemo } from "react";

export default function ItemsSidebar({
  items,
  filterText,
  slamStart,
  onEditItem,
  onEditSlamStart,
  createMode = false,
  editMode = false,
  onToggleCreateMode = () => {},
  onToggleEditMode = () => {},
  onDeleteSelectedItem = () => {},
  selectedItem = null,
  onHideSidebar = null,
}) {
  const list = useMemo(() => {
    const t = (filterText||"").toLowerCase();
    return items.filter(it => !t || it.name.toLowerCase().includes(t) || it.type.toLowerCase().includes(t));
  }, [items, filterText]);
  const canEdit = typeof onEditItem === "function";
  const canEditSlam = typeof onEditSlamStart === "function";
  const canDelete = typeof onDeleteSelectedItem === "function";

  return (
    <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 300, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 0, padding: 12, zIndex: 12, overflow: "auto", boxSizing: 'border-box' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: "var(--panel)", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Items</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
          <button
            onClick={onToggleCreateMode}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: createMode ? "#a78bfa" : "transparent", color: createMode ? "#1c1433" : "var(--text)", fontSize: 12 }}
          >
            Create
          </button>
          <button
            onClick={onToggleEditMode}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: editMode ? "#f59e0b" : "transparent", color: editMode ? "#241a03" : "var(--text)", fontSize: 12 }}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => canDelete && onDeleteSelectedItem()}
            disabled={!selectedItem}
            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #ef4444", background: selectedItem ? "#7f1d1d" : "transparent", color: selectedItem ? "#fee2e2" : "#f87171", fontSize: 12, opacity: selectedItem ? 1 : 0.6 }}
          >
            Delete
          </button>
          {typeof onHideSidebar === "function" && (
            <button
              onClick={onHideSidebar}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12 }}
            >
              Hide
            </button>
          )}
        </div>
      </div>
      {slamStart && (
        <div style={{ marginBottom: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--panel)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>SLAM Start</div>
          <div style={{ fontSize: 12, color: '#ddd' }}>
            ({Math.round(Number(slamStart.x))}, {Math.round(Number(slamStart.y))}) • {Number(slamStart.heading_deg || 0)}°
          </div>
          {canEditSlam && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditSlamStart(); }}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #3b82f6", background: "transparent", color: "#bfdbfe", fontSize: 11 }}
            >
              Edit
            </button>
          )}
        </div>
      )}
      {list.map((it)=> (
        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", marginBottom: 6, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              {it.type}
              {it.type === 'slam_start' && (it.heading_deg != null ? ` • ${it.heading_deg}°` : '')}
              {it.type !== 'slam_start' && (it.price!=null? ` • $${it.price}` : "")}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>({Math.round(it.x)}, {Math.round(it.y)})</div>
            {canEdit && (
              <button
                onClick={(e)=> { e.stopPropagation(); onEditItem(it); }}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #3b82f6", background: "transparent", color: "#bfdbfe", fontSize: 11 }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
