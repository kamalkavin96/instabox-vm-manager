import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken } from "./api";
import Dashboard from "./pages/Dashboard.jsx";
import VMDetail from "./pages/VMDetail.jsx";
import Commands from "./pages/Commands.jsx";
import Ports from "./pages/Ports.jsx";
import Instabox from "./pages/Instabox.jsx";

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
        <h2>VM Manager</h2>
        <label>Admin token<input type="password" value={token} onChange={(e) => setT(e.target.value)} autoFocus /></label>
        {err && <div className="error">{err}</div>}
        <button disabled={!token.trim()}>Sign in</button>
      </form>
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(!!getToken());
  useEffect(() => {
    const h = () => { setToken(""); qc.clear(); setAuthed(false); };
    window.addEventListener("vmm-unauthorized", h);
    return () => window.removeEventListener("vmm-unauthorized", h);
  }, [qc]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <div className="layout">
      <nav>
        <div className="brand">▣ VM Manager</div>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/commands">Run commands</NavLink>
        <NavLink to="/ports">Ports &amp; apps</NavLink>
        <NavLink to="/instabox">InstaBox</NavLink>
        <button className="ghost logout" onClick={() => { setToken(""); qc.clear(); setAuthed(false); }}>Sign out</button>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vm/:id" element={<VMDetail />} />
          <Route path="/commands" element={<Commands />} />
          <Route path="/ports" element={<Ports />} />
          <Route path="/instabox" element={<Instabox />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
