import React, { useEffect, useState } from "react";
import ItemsList from "../components/ItemsList";
import { getItems, getSlamStart } from "../api";

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [slamStart, setSlamStart] = useState(null);

  useEffect(() => {
    (async () => {
      try { setItems(await getItems()); } catch {}
      try { setSlamStart(await getSlamStart()); } catch {}
    })();
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
      <ItemsList items={items} filterText={filterText} slamStart={slamStart} />
    </div>
  );
}
