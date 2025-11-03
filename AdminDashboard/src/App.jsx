import React from "react";
import AdminMapPage from "./pages/AdminMapPage";

function App() {
  return (
    <div style={{ padding: 20, background: "#111", color: "#fff" }}>
      <h2 style={{ fontFamily: "sans-serif", fontSize: 16, color: "#fff" }}>
        Store Navigation Demo
      </h2>
      <AdminMapPage />
    </div>
  );
}

export default App;
