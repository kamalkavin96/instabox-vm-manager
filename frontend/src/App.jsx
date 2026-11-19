import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, FolderTree, LayoutDashboard, LogOut, Menu, Monitor, Moon, Network, Server, Settings as Cog, SquareTerminal, Sun, TerminalSquare } from "lucide-react";
import { api, getToken, setToken } from "./api";
import { useTheme } from "./theme.jsx";
import { ProgressLine, Toasts } from "./components/ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";

const VMDetail = lazy(() => import("./pages/VMDetail.jsx"));
const Terminals = lazy(() => import("./pages/Terminals.jsx"));
const Files = lazy(() => import("./pages/Files.jsx"));
const Commands = lazy(() => import("./pages/Commands.jsx"));
const Ports = lazy(() => import("./pages/Ports.jsx"));
const Instabox = lazy(() => import("./pages/Instabox.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));

function Login({ onDone }) {
  const [token, setT] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setToken(token.trim());
    try { await api.check(); onDone(); } catch { setToken(""); setErr("Invalid token"); }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 14px" }}><span className="brand-mark"><Server size={16} /></span>VM Manager</div>
        <label>Admin token<input type="password" value={token} onChange={(e) => setT(e.target.value)} autoFocus /></label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={!token.trim()}>Sign in</button>
      </form>
    </div>
  );
}

const NAV = [
  ["/", "Dashboard", LayoutDashboard, true], ["/terminals", "Terminals", TerminalSquare], ["/files", "Files (SFTP)", FolderTree],
  ["/commands", "Run commands", SquareTerminal], ["/ports", "Ports & URLs", Network], ["/instabox", "InstaBox", Cloud], ["/settings", "Settings", Cog],
];

export default function App() {
  const qc = useQueryClient();
  const { pref, setPref } = useTheme();
  const [authed, setAuthed] = useState(!!getToken());
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const h = () => { setToken(""); qc.clear(); setAuthed(false); };
    window.addEventListener("vmm-unauthorized", h);
    return () => window.removeEventListener("vmm-unauthorized", h);
  }, [qc]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const next = { system: "light", light: "dark", dark: "system" }[pref];
  const ThemeIcon = { system: Monitor, light: Sun, dark: Moon }[pref];
  return (
    <div className="layout">
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Server size={16} /></span>VM Manager</div>
        <nav className="nav">
          {NAV.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end}><Icon size={17} />{label}</NavLink>)}
        </nav>
        <div className="sidebar-foot">
          <button className="btn" onClick={() => setPref(next)} title="Switch theme"><ThemeIcon size={16} />Theme: {pref}</button>
          <button className="btn" onClick={() => { setToken(""); qc.clear(); setAuthed(false); }}><LogOut size={16} />Sign out</button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <strong>VM Manager</strong>
        </header>
        <main>
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vm/:id" element={<VMDetail />} />
              <Route path="/terminals" element={<Terminals />} />
              <Route path="/files" element={<Files />} />
              <Route path="/commands" element={<Commands />} />
              <Route path="/ports" element={<Ports />} />
              <Route path="/instabox" element={<Instabox />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <ProgressLine />
      <Toasts />
    </div>
  );
}
