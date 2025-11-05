import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "./layouts/AdminLayout";
import Home from "./pages/Home";
import AdminMapPage from "./pages/AdminMapPage";
import ChatPage from "./pages/Chat";
import ItemsPage from "./pages/Items";
import ThreeDPage from "./pages/ThreeD";
import SettingsPage from "./pages/Settings";
import MartPage from "./pages/Mart";

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
      case "mart":
        return <MartPage />;
      case "3d":
        return <ThreeDPage />;
      case "settings":
        return <SettingsPage />;
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
