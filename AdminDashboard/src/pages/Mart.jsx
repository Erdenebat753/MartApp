import React, { useEffect, useMemo, useState } from "react";
import { getMarts, createMart, updateMart, uploadMartImage } from "../api";
import { API_BASE } from "../config";

export default function MartPage() {
  const [mart, setMart] = useState(null);
  const [form, setForm] = useState({
    name: "",
    longitude: "",
    latitude: "",
    map_width_px: "",
    map_height_px: "",
    map_image_url: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await getMarts();
        if (Array.isArray(list) && list.length > 0) {
          setMart(list[0]);
          setForm({
            name: list[0].name || "",
            longitude: list[0].coord_x ?? "",
            latitude: list[0].coord_y ?? "",
            map_width_px: list[0].map_width_px ?? "",
            map_height_px: list[0].map_height_px ?? "",
            map_image_url: list[0].map_image_url || "",
          });
        }
      } catch {}
    })();
  }, []);

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
    try {
      if (mart) {
        const upd = await updateMart(mart.id, payload);
        setMart(upd);
      } else {
        const crt = await createMart(payload);
        setMart(crt);
      }
      alert("Saved");
    } catch (e) {
      alert("Save failed: " + (e?.message || e));
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
      setMart(upd);
      setForm((f) => ({
        ...f,
        map_image_url: upd.map_image_url || "",
        map_width_px: upd.map_width_px ?? f.map_width_px,
        map_height_px: upd.map_height_px ?? f.map_height_px,
      }));
    } catch (e) {
      alert("Upload failed: " + (e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Mart</h2>
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

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" style={{ padding: "8px 12px" }}>{mart ? "Update" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}
