const KEY = "selectedMartId";

export function getSelectedMartId() {
  try {
    const v = localStorage.getItem(KEY);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setSelectedMartId(id) {
  try {
    if (id == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(id));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("mart-selection-changed", { detail: id }));
  } catch {}
}

export function onMartSelectionChange(cb) {
  const handler = (e) => {
    if (e?.type === "storage" && e.key !== KEY) return;
    cb(getSelectedMartId());
  };
  window.addEventListener("mart-selection-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("mart-selection-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

