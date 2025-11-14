import React, { useCallback, useEffect, useState } from "react";
import { getMarts, createMart, updateMart, uploadMartImage, deleteMart } from "../api";
import { API_BASE } from "../config";

const blankForm = () => ({
  name: "",
  longitude: "",
  latitude: "",
  map_width_px: "",
  map_height_px: "",
  map_image_url: "",
});

const formFromMart = (data) => ({
  name: data.name || "",
  longitude: data.coord_x ?? "",
  latitude: data.coord_y ?? "",
  map_width_px: data.map_width_px ?? "",
  map_height_px: data.map_height_px ?? "",
  map_image_url: data.map_image_url || "",
});

export default function MartPage() {
  const [marts, setMarts] = useState([]);
  const [mart, setMart] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const applySelection = useCallback((next) => {
    if (next) {
      setMart(next);
      setForm(formFromMart(next));
    } else {
      setMart(null);
      setForm(blankForm());
    }
  }, []);

  const loadMarts = useCallback(async (preferredId = null) => {
    try {
      const list = await getMarts();
      setMarts(list);
      let next = null;
      if (preferredId != null) {
        next = list.find((m) => m.id === preferredId) || null;
      }
      if (!next) {
        next = list[0] ?? null;
      }
      applySelection(next);
    } catch (e) {
      console.error(e);
    }
  }, [applySelection]);

  useEffect(() => {
    loadMarts();
  }, [loadMarts]);

  function handleSelectMart(e) {
    const val = e.target.value;
    if (val === "") {
      applySelection(null);
      return;
    }
    const selected = marts.find((m) => m.id === Number(val)) || null;
    applySelection(selected);
  }

  async function handleSave(e) {
    e.preventDefault();
    const payload = {
      name: form.name,
      longitude: form.longitude === "" ? null : Number(form.longitude),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      map_width_px: form.map_width_px === "" ? null : parseInt(form.map_width_px, 10),
      map_height_px: form.map_height_px === "" ? null : parseInt(form.map_height_px, 10),
      map_image_url: form.map_image_url || null,
    };
    setSaving(true);
    try {
      if (mart) {
        const upd = await updateMart(mart.id, payload);
        await loadMarts(upd.id);
      } else {
        const crt = await createMart(payload);
        await loadMarts(crt.id);
      }
      alert("Saved");
    } catch (e) {
      alert("Save failed: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file) {
    if (!mart) {
      alert("Please save Mart first.");
      return;
    }
    try {
      setUploading(true);
      const upd = await uploadMartImage(mart.id, file);
      setMarts((prev) => prev.map((m) => (m.id === upd.id ? upd : m)));
      applySelection(upd);
    } catch (e) {
      alert("Upload failed: " + (e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMart() {
    if (!mart) return;
    const ok = window.confirm(`Delete mart "${mart.name}"?`);
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMart(mart.id);
      await loadMarts();
    } catch (e) {
      alert("Delete failed: " + (e?.message || e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Mart</h2>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Select Mart</span>
          <select value={mart?.id ?? ""} onChange={handleSelectMart} style={{ minWidth: 220 }}>
            <option value="">(New mart)</option>
            {marts.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (#{m.id})
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => applySelection(null)}>Create New</button>
      </div>
      <form onSubmit={handleSave} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Store name" required />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Longitude</span>
            <input type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Latitude</span>
            <input type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Map Width (px)</span>
            <input type="number" value={form.map_width_px} onChange={(e) => setForm({ ...form, map_width_px: e.target.value })} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Map Height (px)</span>
            <input type="number" value={form.map_height_px} onChange={(e) => setForm({ ...form, map_height_px: e.target.value })} />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Map Image</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="text" placeholder="/uploads/xyz.png" value={form.map_image_url} onChange={(e) => setForm({ ...form, map_image_url: e.target.value })} style={{ flex: 1 }} />
            <label style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}>
              {uploading ? "Uploading..." : "Upload"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
          </div>
          {form.map_image_url && (() => {
            const src = (typeof form.map_image_url === 'string' && form.map_image_url.startsWith('http'))
              ? form.map_image_url
              : `${API_BASE}${form.map_image_url}`;
            return <img src={src} alt="map" style={{ maxWidth: 520, border: "1px solid var(--border)", borderRadius: 8 }} />;
          })()}
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" style={{ padding: "8px 12px" }} disabled={saving}>
            {saving ? "Saving..." : mart ? "Update" : "Create"}
          </button>
          {mart && (
            <button
              type="button"
              onClick={handleDeleteMart}
              disabled={deleting}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ef4444",
                background: deleting ? "#7f1d1d" : "transparent",
                color: deleting ? "#fee2e2" : "#f87171",
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
