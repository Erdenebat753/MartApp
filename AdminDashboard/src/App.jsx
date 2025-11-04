import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "./layouts/AdminLayout";
import Home from "./pages/Home";
import AdminMapPage from "./pages/AdminMapPage";
import ChatPage from "./pages/Chat";
import ItemsPage from "./pages/Items";
import ThreeDPage from "./pages/ThreeD";

function useHashRoute(defaultRoute = "home") {
  const [route, setRoute] = useState(() => (window.location.hash.replace(/^#/, "") || defaultRoute));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace(/^#/, "") || defaultRoute);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [defaultRoute]);
  return [route, setRoute];
}

function App() {
  const [route] = useHashRoute("home");
  const content = useMemo(() => {
    switch (route) {
      case "map":
        return <AdminMapPage />;
      case "chat":
        return <ChatPage />;
      case "items":
        return <ItemsPage />;
      case "3d":
        return <ThreeDPage />;
      case "settings":
        return (
          <div>
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <p style={{ marginTop: 0 }}>Configure API base and environment files:</p>
              <ul>
                <li>Vite API: <code>AdminDashboard/.env</code> with <code>VITE_API_BASE</code></li>
                <li>Backend: <code>FastApi_AI/.env</code> or fallback to <code>.env.sample</code></li>
              </ul>
            </div>
          </div>
        );
      case "home":
      default:
        return <Home />;
    }
  }, [route]);

  return (
    <AdminLayout route={route}>
      {content}
    </AdminLayout>
  );
}

export default App;
