import React from "react";

import { updateCategory, deleteCategory } from "../api";
import { useI18n } from "../i18n";

export default function EditorSidebar({
  // modes
  drawMode, setDrawMode,
  categoryMode, setCategoryMode,
  routeMode, setRouteMode,
  createMode, setCreateMode,
  editMode, setEditMode,
  selectSegMode, setSelectSegMode,

  // draw
  drawPointsCount,
  onClearDraw,
  onSaveSegment,

  // category
  categoryPointsCount,
  onClearCategory,
  onSaveCategory,
  categoryName, setCategoryName,

  // route
  routeStart, routeEnd,
  onClearRoute,
  onComputeRoute,
  onUseSlamStart,

  // reloads
  onReloadSegments,
  onReloadItems,
  onReloadSlam,

  // search + panels
  search, setSearch,
  showSidebar, setShowSidebar,
  showChat, setShowChat,

  // selection
  selectedSegId,
  onDeleteSelectedSegment,

  // view toggles
  showGrid, setShowGrid,
  showLabels, setShowLabels,

  // categories data
  categories = [],
  martId = null,
  reloadCategories = async () => {},
  viewMode = 'all',
  setViewMode = () => {},
}) {
  const { t } = useI18n();
  const [editCatId, setEditCatId] = React.useState(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState("");
  const panelStyle = {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
  };
  const rowStyle = { display: 'flex', gap: 6, flexWrap: 'wrap' };
  const btn = (extra={}) => ({
    padding: "6px 10px",
    background: "var(--panel)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    ...extra,
  });
  async function onSaveEditCategory() {
    if (!martId || !editCatId) return;
    try {
      const cat = categories.find(c=>c.id===editCatId);
      if (!cat) return;
      await updateCategory(editCatId, { mart_id: martId, name: editName || cat.name, color: editColor || null, polygon: cat.polygon || [] });
      setEditCatId(null);
      setEditName("");
      setEditColor("");
      await reloadCategories();
    } catch (e) {
      alert("Update category failed: " + (e?.message || e));
    }
  }
  async function onDeleteCat(id) {
    if (!id) return;
    const ok = window.confirm("Delete this category?");
    if (!ok) return;
    try {
      await deleteCategory(id);
      await reloadCategories();
    } catch (e) {
      alert("Delete category failed: " + (e?.message || e));
    }
  }
  const tabBtn = (active) => ({
    padding: "6px 10px",
    background: active ? "#22c55e" : "var(--panel)",
    color: active ? "#06260f" : "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    flex: 1,
    minWidth: '30%',
    textAlign: 'center',
  });
  const switchTo = (mode) => {
    setViewMode(mode);
    if (mode === 'segments') {
      setDrawMode(true); setRouteMode(false); setCategoryMode(false); setCreateMode(false); setEditMode(false); setSelectSegMode(false);
    } else if (mode === 'route') {
      setDrawMode(false); setRouteMode(true); setCategoryMode(false); setCreateMode(false); setEditMode(false); setSelectSegMode(false);
    } else if (mode === 'category') {
      setDrawMode(false); setRouteMode(false); setCategoryMode(true); setCreateMode(false); setEditMode(false); setSelectSegMode(false);
    } else if (mode === 'items') {
      setDrawMode(false); setRouteMode(false); setCategoryMode(false); setCreateMode(true); setEditMode(false); setSelectSegMode(false);
    }
  };
  return (
    <div
      onMouseDown={(e)=>e.stopPropagation()}
      onClick={(e)=>e.stopPropagation()}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 300,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: 12,
        zIndex: 12,
        overflow: "auto",
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxSizing: 'border-box',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text)", fontSize: 13 }}>{t('map_editor')}</div>

      {/* Mode Tabs */}
      <div style={panelStyle}>
        <div style={rowStyle}>
          <button onClick={()=>switchTo('all')} style={tabBtn(viewMode==='all')}>{t('all')}</button>
          <button onClick={()=>switchTo('segments')} style={tabBtn(viewMode==='segments')}>{t('segments')}</button>
          <button onClick={()=>switchTo('route')} style={tabBtn(viewMode==='route')}>{t('route')}</button>
          <button onClick={()=>switchTo('category')} style={tabBtn(viewMode==='category')}>{t('category')}</button>
          <button onClick={()=>switchTo('items')} style={tabBtn(viewMode==='items')}>{t('items')}</button>
        </div>
      </div>

      {/* Drawing controls */}
      {(viewMode==='segments' || viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('segments')}</div>
        <div style={rowStyle}>
          <button onClick={onClearDraw} disabled={!drawPointsCount} style={btn({ flex: 1, opacity: !drawPointsCount ? 0.6 : 1, background: "var(--panel)" })}>{t('clear')}</button>
          <button onClick={onSaveSegment} disabled={drawPointsCount < 2} style={btn({ flex: 1, opacity: drawPointsCount < 2 ? 0.6 : 1, background: "var(--panel)" })}>{t('save')}</button>
        </div>
      </div>
      )}

      {/* Category controls */}
      {(viewMode==='category' || viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('category')}</div>
        <input placeholder={t('category_name')} value={categoryName} onChange={(e)=>setCategoryName(e.target.value)} style={{ padding: 6, width: '100%', background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }} />
        <div style={rowStyle}>
          <button onClick={onClearCategory} disabled={!categoryPointsCount} style={btn({ flex: 1, opacity: !categoryPointsCount ? 0.6 : 1, background: "var(--panel)" })}>{t('clear')}</button>
          <button onClick={onSaveCategory} disabled={categoryPointsCount < 3 || !categoryName} style={btn({ flex: 1, opacity: (categoryPointsCount < 3 || !categoryName) ? 0.6 : 1, background: "var(--panel)" })}>{t('save')}</button>
        </div>
        {/* Existing categories list (like ItemsSidebar cards) */}
        <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
          {categories.map((c) => (
            <div key={c.id} style={{ display: "grid", gap: 6, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
              {editCatId === c.id ? (
                <>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{t('edit')} {t('category')}</div>
                  <input value={editName} onChange={(e)=>setEditName(e.target.value)} placeholder={c.name} style={{ padding: 6, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }} />
                  <input value={editColor} onChange={(e)=>setEditColor(e.target.value)} placeholder={c.color || '#f472b6'} style={{ padding: 6, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }} />
                  <div style={rowStyle}>
                    <button onClick={onSaveEditCategory} style={btn({ flex: 1 })}>{t('save')}</button>
                    <button onClick={()=>{ setEditCatId(null); setEditName(""); setEditColor(""); }} style={btn({ flex: 1 })}>{t('cancel')}</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{c.color || '#f472b6'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={()=>{ setEditCatId(c.id); setEditName(c.name); setEditColor(c.color || ""); }} style={btn()}>{t('edit')}</button>
                    <button onClick={()=> onDeleteCat(c.id)} style={{ ...btn(), background: "#dc2626", border: "1px solid #7f1d1d", color: "#fff" }}>{t('delete')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <div style={{ padding: 10, border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--muted)' }}>{t('no_categories')}</div>
          )}
        </div>
      </div>
      )}

      {/* Routing */}
      {(viewMode==='route' || viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('route')}</div>
        <div style={rowStyle}>
          <button onClick={onClearRoute} style={btn({ flex: 1 })}>{t('clear')}</button>
          <button onClick={onComputeRoute} disabled={!routeStart || !routeEnd} style={btn({ flex: 1, background: "var(--panel)", opacity: (!routeStart || !routeEnd) ? 0.6 : 1 })}>{t('compute')}</button>
        </div>
        <button onClick={onUseSlamStart} style={btn()}>{t('use_slam_start')}</button>
      </div>
      )}

      {/* Reload */}
      {(viewMode==='segments' || viewMode==='route' || viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('reload')}</div>
        <div style={{ ...rowStyle, flexWrap: 'wrap' }}>
          <button onClick={onReloadSegments} style={btn({ flex: 1 })}>{t('segments')}</button>
          <button onClick={onReloadItems} style={btn({ flex: 1 })}>{t('items')}</button>
          <button onClick={onReloadSlam} style={btn({ flex: 1 })}>SLAM</button>
        </div>
      </div>
      )}

      {/* Segment selection */}
      {(viewMode==='segments' || viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('selection')}</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <button
            onClick={() => {
              const next = !selectSegMode;
              setSelectSegMode(next);
              if (next) {
                setDrawMode(false);
                setRouteMode(false);
                setCategoryMode(false);
                setCreateMode(false);
                setEditMode(false);
              }
            }}
            style={{
              ...btn(),
              background: selectSegMode ? "#fbbf24" : "var(--panel)",
              color: selectSegMode ? "#2b1b02" : "var(--text)",
            }}
          >
            {selectSegMode ? t('select_segment_on') : t('select_segment_off')}
          </button>
          <button
            onClick={onDeleteSelectedSegment}
            disabled={!selectedSegId}
            style={{
              ...btn(),
              background: selectedSegId ? "#dc2626" : "#1f2937",
              border: selectedSegId ? "1px solid #7f1d1d" : "1px solid #3f3f46",
              color: selectedSegId ? "#fff" : "#e5e7eb",
              opacity: selectedSegId ? 1 : 0.6,
            }}
          >
            {t('delete_selected')}
          </button>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {t('select_segment_hint')}
          </div>
        </div>
      </div>
      )}

      {/* View & Panels */}
      {(viewMode==='items' || viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('panels')}</div>
        <input placeholder={t('items_title')} value={search} onChange={(e)=>setSearch(e.target.value)} style={{ padding: 6, width: '100%', background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }} />
        <div style={rowStyle}>
          <button onClick={()=> setShowSidebar((v)=>!v)} style={btn({ flex: 1, background: showSidebar ? "#22c55e" : "var(--panel)", color: showSidebar ? "#06260f" : "var(--text)" })}>{showSidebar ? t('hide_items') : t('show_items')}</button>
          <button onClick={()=> setShowChat((v)=>!v)} style={btn({ flex: 1, background: showChat ? "#ef4444" : "var(--panel)", color: showChat ? "#2a0a0a" : "var(--text)" })}>{showChat ? t('hide_chat') : t('show_chat')}</button>
        </div>
      </div>
      )}

      {(viewMode==='all') && (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600 }}>{t('view')}</div>
        <div style={rowStyle}>
          <button onClick={() => setShowGrid(v=>!v)} style={btn({ flex: 1, background: showGrid ? "#86efac" : "var(--panel)", color: showGrid ? "#052e16" : "var(--text)" })}>{showGrid ? t('grid_on') : t('grid_off')}</button>
          <button onClick={() => setShowLabels(v=>!v)} style={btn({ flex: 1, background: showLabels ? "#fde68a" : "var(--panel)", color: showLabels ? "#3b2902" : "var(--text)" })}>{showLabels ? t('labels_on') : t('labels_off')}</button>
        </div>
      </div>
      )}
    </div>
  );
}
