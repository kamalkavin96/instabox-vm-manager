import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Keyboard, Plus, Radio, TerminalSquare, ZoomIn, ZoomOut } from "lucide-react";
import { api } from "../api";
import TermPane from "../components/TermPane.jsx";
import { Empty, ErrorBox, PageHeader } from "../components/ui.jsx";

const QUICK = [["htop", "htop"], ["btop", "btop"], ["mc", "mc"], ["top", "top"], ["df -h", "df -h"], ["free -h", "free -h"], ["journalctl -f", "journalctl -f"], ["clear", "clear"]];

export default function Terminals() {
  const [params, setParams] = useSearchParams();
  const { data: vms = [], error } = useQuery({ queryKey: ["vms"], queryFn: api.vms });
  const ids = (params.get("vms") || "").split(",").map(Number).filter(Boolean);
  const open = vms.filter((v) => ids.includes(v.id));
  const [broadcast, setBroadcast] = useState(false);
  const [cols, setCols] = useState(0);              // 0 = auto
  const [font, setFont] = useState(13);
  const [focus, setFocus] = useState(null);
  const [max, setMax] = useState(null);
  const [picker, setPicker] = useState(false);
  const refs = useRef({});

  const setIds = (next) => setParams(next.length ? { vms: next.join(",") } : {}, { replace: true });
  const add = (id) => { setIds([...new Set([...ids, id])]); };
  const close = (id) => { setIds(ids.filter((x) => x !== id)); if (max === id) setMax(null); };
  // Broadcast mode: whatever you type in one terminal is mirrored to all the others.
  const onInput = (fromId, data) => {
    if (!broadcast) return;
    open.forEach((v) => v.id !== fromId && refs.current[v.id]?.send(data));
  };
  const sendAll = (cmd) => open.forEach((v) => refs.current[v.id]?.send(cmd + "\r"));
  const auto = Math.min(Math.max(open.length, 1), 3);
  const grid = cols || auto;

  return (
    <>
      <PageHeader title="Terminals" subtitle="Full interactive shells in the browser (htop, btop, mc, vim all work). Open several to watch the whole fleet live."
        actions={<>
          <button className={`btn ${broadcast ? "active" : ""}`} onClick={() => setBroadcast(!broadcast)} title="Mirror keystrokes to every open terminal"><Radio size={15} />Broadcast typing {broadcast ? "ON" : "off"}</button>
          <div className="seg">{[0, 1, 2, 3].map((c) => <button key={c} className={cols === c ? "on" : ""} onClick={() => setCols(c)}>{c === 0 ? "Auto" : `${c} col`}</button>)}</div>
          <button className="icon-btn" onClick={() => setFont((f) => Math.max(9, f - 1))} title="Smaller font"><ZoomOut size={17} /></button>
          <button className="icon-btn" onClick={() => setFont((f) => Math.min(24, f + 1))} title="Larger font"><ZoomIn size={17} /></button>
          <button className="btn primary" onClick={() => setPicker(!picker)}><Plus size={15} />Add VMs</button>
        </>} />
      <ErrorBox error={error} />
      {picker && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between"><strong>Open terminal on…</strong>
            <span className="actions"><button className="btn sm" onClick={() => setIds(vms.filter((v) => v.enabled).map((v) => v.id))}>All VMs</button><button className="btn sm" onClick={() => setIds([])}>Close all</button></span></div>
          <div className="checks">{vms.map((v) => <label key={v.id} className="check"><input type="checkbox" checked={ids.includes(v.id)} onChange={(e) => (e.target.checked ? add(v.id) : close(v.id))} />{v.name}</label>)}</div>
        </div>
      )}
      {open.length > 0 && (
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="muted small row" style={{ gap: 4 }}><Keyboard size={14} />Send to all open terminals:</span>
          {QUICK.map(([l, c]) => <button key={l} className="btn sm mono" onClick={() => sendAll(c)}>{l}</button>)}
        </div>
      )}
      {open.length === 0 ? <Empty icon={TerminalSquare} title="No terminals open">Choose “Add VMs”, or open a VM and click Terminal.</Empty> : (
        <div className="term-grid" style={{ "--cols": grid, "--h": open.length > 4 ? "340px" : "460px" }}>
          {open.map((v) => (
            <TermPane key={v.id} vm={v} ref={(r) => { if (r) refs.current[v.id] = r; else delete refs.current[v.id]; }}
              fontSize={font} focused={focus === v.id} maximized={max === v.id} onInput={onInput}
              onFocus={() => setFocus(v.id)} onClose={() => close(v.id)} onToggleMax={() => setMax(max === v.id ? null : v.id)} />
          ))}
        </div>
      )}
    </>
  );
}
