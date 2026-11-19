import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY = "vmm_theme";
const Ctx = createContext({ pref: "system", resolved: "dark", setPref: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(() => localStorage.getItem(KEY) || "system");
  const [sys, setSys] = useState(() => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e) => setSys(e.matches ? "dark" : "light");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const resolved = pref === "system" ? sys : pref;
  useEffect(() => { document.documentElement.dataset.theme = resolved; }, [resolved]);
  const value = useMemo(() => ({
    pref, resolved,
    setPref: (p) => { localStorage.setItem(KEY, p); setPrefState(p); },
  }), [pref, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
