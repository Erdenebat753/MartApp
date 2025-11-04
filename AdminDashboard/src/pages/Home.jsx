import React from "react";

export default function Home() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Overview</h2>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
        <div style={{ color: "var(--muted)" }}>
          Welcome to the Store Navigation Admin. Use the sidebar to:
        </div>
        <ul>
          <li>Draw segments and edit points in Map Editor</li>
          <li>Browse and manage items</li>
          <li>Chat with the assistant to test intents</li>
          <li>Adjust API/config settings</li>
        </ul>
      </div>
    </div>
  );
}

