import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./layouts/AdminLayout";
import { MartProvider } from "./context/MartContext.jsx";
import Home from "./pages/Home";
import AdminMapPage from "./pages/AdminMapPage";
import ChatPage from "./pages/Chat";
import ItemsPage from "./pages/Items";
import ThreeDPage from "./pages/ThreeD";
import SettingsPage from "./pages/Settings";
import MartPage from "./pages/Mart";
import Login from "./pages/Login";
import { getToken, clearToken } from "./auth";

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
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "admin_token") setAuthed(!!e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleLoggedIn = useCallback(() => {
    setAuthed(true);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setAuthed(false);
    if (typeof window !== "undefined") {
      window.location.hash = "#login";
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {
          // ignore
        }
      }, 0);
    }
  }, []);

  if (!authed) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  const [route] = useHashRoute("map");
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
    <MartProvider>
      <AdminLayout route={route} onLogout={handleLogout}>
        {content}
      </AdminLayout>
    </MartProvider>
  );
}

export default App;
