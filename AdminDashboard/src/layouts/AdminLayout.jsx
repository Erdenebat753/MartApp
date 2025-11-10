import React, { useEffect, useRef, useState } from "react";
import { useDarkMode } from "../hooks/useDarkMode";
import { useI18n } from "../i18n";
import { useMart } from "../context/MartContext";

function NavLink({ to, label, active, compact = false }) {
  return (
    <a
      href={`#${to}`}
      style={{
        display: "block",
        padding: compact ? "8px 8px" : "10px 12px",
        borderRadius: 8,
        color: active ? "#0b1220" : "var(--text)",
        background: active ? "#60a5fa" : "transparent",
        border: active ? "1px solid #3f3f46" : "1px solid transparent",
        textDecoration: "none",
        fontWeight: 500,
        textAlign: compact ? "center" : "left",
      }}
    >
      {label}
    </a>
  );
}

export default function AdminLayout({ route, children, onLogout }) {
  const { t, lang, setLang } = useI18n();
  const { mode, toggle } = useDarkMode("dark");
  const { mart } = useMart();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(240);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWRef = useRef(240);

  const effWidth = collapsed ? 56 : width;

  useEffect(() => {
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startXRef.current;
      const next = Math.min(420, Math.max(180, startWRef.current + dx));
      setWidth(next);
      e.preventDefault();
    }
    function onUp() {
      if (dragging) setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <aside
        style={{
          width: effWidth,
          padding: 12,
          borderRight: "1px solid var(--border)",
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          background: "var(--panel)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand" : "Collapse"}
            style={{ padding: "6px 10px", background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            {collapsed ? ">>" : "<<"}
          </button>
          {!collapsed && (
            <div style={{ display: "grid" }}>
              <div style={{ fontWeight: 700 }}>{t('app_title')}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Active Mart: {mart?.name ?? "None"}</div>
            </div>
          )}
          <button onClick={toggle} title="Toggle theme" style={{ padding: "6px 10px", background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}>
            {mode === "dark" ? "🌙" : "☀️"}
          </button>
          <select value={lang} onChange={(e)=>setLang(e.target.value)} style={{ padding: '6px 8px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
          <button onClick={onLogout} title="Logout" style={{ padding: "6px 10px", background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}>
            {t('logout')}
          </button>
        </div>
        <nav style={{ display: "grid", gap: 6, flex: 1, overflow: "auto", alignContent: "start" }}>
          <NavLink to="home" label={collapsed ? "H" : t('home')} active={route === "home"} compact={collapsed} />
          <NavLink to="map" label={collapsed ? "M" : t('map_editor')} active={route === "map"} compact={collapsed} />
          <NavLink to="items" label={collapsed ? "I" : t('items')} active={route === "items"} compact={collapsed} />
          <NavLink to="3d" label={collapsed ? "3D" : t('viewer3d')} active={route === "3d"} compact={collapsed} />
          <NavLink to="chat" label={collapsed ? "C" : t('chat')} active={route === "chat"} compact={collapsed} />
          <NavLink to="settings" label={collapsed ? "S" : t('settings')} active={route === "settings"} compact={collapsed} />
          <NavLink to="mart" label={collapsed ? "Mart" : t('mart')} active={route === "mart"} compact={collapsed} />
        </nav>
        {!collapsed && (
          <div
            onMouseDown={(e) => {
              setDragging(true);
              startXRef.current = e.clientX;
              startWRef.current = width;
            }}
            style={{
              position: "absolute",
              right: -3,
              top: 0,
              width: 6,
              height: "100%",
              cursor: "col-resize",
              background: dragging ? "#3b82f6" : "transparent",
            }}
            title="Drag to resize"
          />
        )}
      </aside>
      <main style={{ padding: 16, marginLeft: effWidth }}>
        {children}
      </main>
    </div>
  );
}
