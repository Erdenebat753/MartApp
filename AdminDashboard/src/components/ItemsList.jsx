import React, { useMemo } from "react";

export default function ItemsList({ items = [], filterText, slamStart, onDeleteItem, deletingId }) {
  const list = useMemo(() => {
    const t = (filterText || "").toLowerCase();
    return items.filter(
      (it) => !t || it.name.toLowerCase().includes(t) || it.type.toLowerCase().includes(t)
    );
  }, [items, filterText]);
  const canDelete = typeof onDeleteItem === "function";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {slamStart && (
        <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel)" }}>
          <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>SLAM Start</div>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>
            ({Math.round(Number(slamStart.x))}, {Math.round(Number(slamStart.y))})
            {typeof slamStart.heading_deg === 'number' ? ` · ${slamStart.heading_deg}°` : ''}
          </div>
        </div>
      )}
      {list.map((it) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--panel)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              {it.type}
              {it.type === 'slam_start' && (it.heading_deg != null ? ` · ${it.heading_deg}°` : '')}
              {it.type !== 'slam_start' && (it.price != null ? ` · $${it.price}` : '')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>({Math.round(it.x)}, {Math.round(it.y)})</div>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteItem(it); }}
                disabled={deletingId === it.id}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid #ef4444",
                  background: deletingId === it.id ? "#7f1d1d" : "transparent",
                  color: deletingId === it.id ? "#fee2e2" : "#f87171",
                  fontSize: 11,
                }}
              >
                {deletingId === it.id ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <div style={{ padding: 12, border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--muted)' }}>
          No items.
        </div>
      )}
    </div>
  );
}
