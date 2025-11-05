import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMarts, getMart } from "../api";
import { getSelectedMartId, setSelectedMartId, onMartSelectionChange } from "../hooks/martSelection";

const MartContext = createContext({ mart: null, martId: null, selectMart: () => {} });

export function MartProvider({ children }) {
  const [mart, setMart] = useState(null);
  const [martId, setMartId] = useState(getSelectedMartId());

  const loadForId = useCallback(async (id) => {
    if (!id) {
      const list = await getMarts();
      setMart(Array.isArray(list) && list.length > 0 ? list[0] : null);
      return;
    }
    try {
      const m = await getMart(id);
      setMart(m);
    } catch {
      const list = await getMarts();
      setMart(Array.isArray(list) && list.length > 0 ? list[0] : null);
    }
  }, []);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      await loadForId(martId);
    })();
    unsub = onMartSelectionChange(async (id) => {
      setMartId(id || null);
      await loadForId(id || null);
    });
    return () => unsub();
  }, [loadForId]);

  const selectMart = useCallback((id) => {
    setSelectedMartId(id ?? null);
  }, []);

  const value = useMemo(() => ({ mart, martId, selectMart }), [mart, martId, selectMart]);
  return <MartContext.Provider value={value}>{children}</MartContext.Provider>;
}

export function useMart() {
  return useContext(MartContext);
}
