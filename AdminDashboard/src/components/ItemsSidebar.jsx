import React, { useMemo } from "react";

export default function ItemsSidebar({ items, filterText, slamStart }) {
  const list = useMemo(() => {
    const t = (filterText||"").toLowerCase();
    return items.filter(it => !t || it.name.toLowerCase().includes(t) || it.type.toLowerCase().includes(t));
  }, [items, filterText]);

  return (
    <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()} style={{ position: "absolute", left: 8, top: 70, bottom: 8, width: 300, background: "rgba(10,10,14,0.92)", border: "1px solid #2a2a2e", borderRadius: 10, padding: 10, zIndex: 12, overflow: "auto" }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Items</div>
      {slamStart && (
        <div style={{ marginBottom: 8, padding: 8, border: '1px solid #2a2a2e', borderRadius: 8, background: '#0b0b0f' }}>
          <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>SLAM Start</div>
          <div style={{ fontSize: 12, color: '#ddd' }}>
            ({Math.round(Number(slamStart.x))}, {Math.round(Number(slamStart.y))}) • {Number(slamStart.heading_deg || 0)}°
          </div>
        </div>
      )}
      {list.map((it)=> (
        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", marginBottom: 6, background: "#0b0b0f", border: "1px solid #2a2a2e", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              {it.type}
              {it.type === 'slam_start' && (it.heading_deg != null ? ` • ${it.heading_deg}°` : '')}
              {it.type !== 'slam_start' && (it.price!=null? ` • $${it.price}` : "")}
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>({Math.round(it.x)}, {Math.round(it.y)})</div>
        </div>
      ))}
    </div>
  );
}
