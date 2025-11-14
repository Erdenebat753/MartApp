import { useEffect, useState } from "react";
import { getMarts, createMart, uploadMartImage, deleteMart } from "../api";
import { getSelectedMartId, setSelectedMartId } from "../hooks/martSelection";
import { useMart } from "../context/MartContext";

export default function SettingsPage() {
  const [marts, setMarts] = useState([]);
  const [selected, setSelected] = useState(getSelectedMartId());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    longitude: "",
    latitude: "",
    file: null,
  });
  const { selectMart } = useMart();

  useEffect(() => {
    (async () => {
      try {
        const list = await getMarts();
        setMarts(list);
        setSelected((prev) => {
          if (prev != null && list.some((m) => m.id === prev)) {
            return prev;
          }
          return list[0]?.id ?? null;
        });
      } catch {}
    })();
  }, []);

  function saveSelection() {
    setSaving(true);
    setSelectedMartId(selected ?? null);
    selectMart(selected ?? null);
    setTimeout(() => setSaving(false), 200);
  }

  async function handleCreateMart() {
    if (!createForm.name) {
      alert("Please enter name");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: createForm.name,
        longitude: createForm.longitude === "" ? null : Number(createForm.longitude),
        latitude: createForm.latitude === "" ? null : Number(createForm.latitude),
      };
      const crt = await createMart(payload);
      if (createForm.file) {
        try { await uploadMartImage(crt.id, createForm.file); } catch {}
      }
      const list = await getMarts();
      setMarts(list);
      setSelected(crt.id);
      setSelectedMartId(crt.id);
      selectMart(crt.id);
      window.location.hash = "#map";
      setCreateForm({ name: "", longitude: "", latitude: "", file: null });
    } catch (e) {
      alert("Create failed: " + (e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteMart() {
    if (selected == null) {
      alert("Select a mart to delete");
      return;
    }
    const target = marts.find((m) => m.id === selected);
    const ok = window.confirm(`Delete mart "${target?.name || selected}"?`);
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMart(selected);
      const list = await getMarts();
      setMarts(list);
      const next = list[0]?.id ?? null;
      setSelected(next);
      setSelectedMartId(next ?? null);
      selectMart(next ?? null);
    } catch (e) {
      alert("Delete failed: " + (e?.message || e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Active Mart</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">None</option>
              {marts.map(m => (
                <option key={m.id} value={m.id}>{m.name} (#{m.id})</option>
              ))}
            </select>
            <button onClick={saveSelection} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleDeleteMart} disabled={selected == null || deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button onClick={() => { if (selected != null) { setSelectedMartId(selected); window.location.hash = '#map'; } }} disabled={selected == null}>
              Open Map Editor
            </button>
          </div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>
            Stored in browser cache. Pages will use this mart when available.
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Create New Mart</div>
          <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>Name</span>
              <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Mart name" required />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Longitude</span>
                <input type="number" step="0.000001" value={createForm.longitude} onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Latitude</span>
                <input type="number" step="0.000001" value={createForm.latitude} onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })} />
              </label>
            </div>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>Map Image (optional)</span>
              <input type="file" accept="image/*" onChange={(e) => setCreateForm({ ...createForm, file: e.target.files?.[0] || null })} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreateMart} disabled={creating}>{creating ? 'Creating...' : 'Create Mart'}</button>
              <button type="button" onClick={() => setCreateForm({ name: "", longitude: "", latitude: "", file: null })}>Reset</button>
            </div>
            <div style={{ color: '#9ca3af', fontSize: 12 }}>
              After creating, it becomes active and opens Map Editor.
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Config Files</div>
          <ul>
            <li>Vite API: <code>AdminDashboard/.env</code> with <code>VITE_API_BASE</code></li>
            <li>Backend: <code>FastApi_AI/.env</code> (CORS, API key)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
