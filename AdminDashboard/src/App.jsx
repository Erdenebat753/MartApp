import React from "react";
import MapView from "./MapView";

function App() {
  return (
    <div style={{ padding: 20, background: "#111", color: "#fff" }}>
      <h2 style={{ fontFamily: "sans-serif", fontSize: 16, color: "#fff" }}>
        Store Navigation Demo
      </h2>
      <MapView />
    </div>
  );
}

export default App;
