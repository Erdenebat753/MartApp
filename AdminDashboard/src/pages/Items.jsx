import React, { useCallback, useEffect, useState } from "react";
import ItemsList from "../components/ItemsList";
import { getItems, getSlamStart, deleteItem } from "../api";

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [slamStart, setSlamStart] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    (async () => {
      try { setItems(await getItems()); } catch {}
      try { setSlamStart(await getSlamStart()); } catch {}
    })();
  }, []);

  const handleDeleteItem = useCallback(async (item) => {
    if (!item) return;
    const ok = window.confirm(`Delete item "${item.name}"?`);
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await deleteItem(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e) {
      alert("Delete failed: " + (e?.message || e));
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Items</h2>
      <div style={{ marginBottom: 8 }}>
        <input
          placeholder="Search items..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ padding: 6, width: 260, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}
        />
      </div>
      <ItemsList
        items={items}
        filterText={filterText}
        slamStart={slamStart}
        onDeleteItem={handleDeleteItem}
        deletingId={deletingId}
      />
    </div>
  );
}
