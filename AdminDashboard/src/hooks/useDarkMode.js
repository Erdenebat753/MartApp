import { useEffect, useState } from "react";

export function useDarkMode(defaultMode = "dark") {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : defaultMode;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(mode === "light" ? "theme-light" : "theme-dark");
    localStorage.setItem("theme", mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));
  return { mode, setMode, toggle };
}

