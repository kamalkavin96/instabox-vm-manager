import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, LayoutGrid, Plus, RefreshCw, Rows3, TerminalSquare, TriangleAlert } from "lucide-react";
import { api } from "../api";
import { useEvents, useNow } from "../events";
import { getSeries } from "../series";
import { bytes, fullTime, pct, rate, uptime } from "../format";
import AddVM from "../components/AddVM.jsx";
import { Btn, Empty, ErrorBox, PageHeader, Sparkline, StatusBadge, toast } from "../components/ui.jsx";

function Meter({ label, value, sub, spark }) {
  const tone = value >= 90 ? "crit" : value >= 75 ? "warn" : "ok";
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><b className={`mono ${tone}c`}>{pct(value)}</b></div>
      <div className="bar"><div className={`bar-fill ${tone}`} style={{ width: `${Math.min(100, value || 0)}%` }} /></div>
      {spark ? <Sparkline data={spark} color={tone === "ok" ? "var(--accent)" : `var(--${tone})`} /> : <div className="spark" />}
      <div className="meter-sub mono">{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem("vmm_view") || "cards");
  const { state, lastEvent } = useEvents();
  const now = useNow(1000);
  // The WebSocket keeps this cache fresh; the slow poll is only a fallback while it is reconnecting.
  const { data: vms = [], error, isLoading } = useQuery({ queryKey: ["vms"], queryFn: api.vms, refetchInterval: state === "live" ? false : 15000 });
  const setV = (v) => { localStorage.setItem("vmm_view", v); setView(v); };
  const refreshAll = async () => {
    setRefreshing(true);
    try { await api.refreshFleet(); } catch (e) { toast(e.message, "error"); }
    setTimeout(() => setRefreshing(false), 1500);
  };

  const online = vms.filter((v) => v.enabled && v.status === "online").length;
  const offline = vms.filter((v) => v.enabled && v.status === "offline").length;
  const alerts = vms.reduce((n, v) => n + (v.summary?.alerts?.filter((a) => a.level !== "info").length || 0), 0);
  const withCpu = vms.filter((v) => v.summary?.cpu != null);
  const avgCpu = withCpu.length ? withCpu.reduce((s, v) => s + v.summary.cpu, 0) / withCpu.length : null;
  const memUsed = vms.reduce((s, v) => s + (v.summary?.mem_used || 0), 0);
  const memTotal = vms.reduce((s, v) => s + (v.summary?.mem_total || 0), 0);
  const duplicates = useMemo(() => {
    const g = {};
    vms.forEach((v) => { const id = v.summary?.boot_id; if (id) (g[id] ||= []).push(v.name); });
    return Object.values(g).filter((x) => x.length > 1);
  }, [vms]);
  const age = lastEvent ? Math.max(0, Math.round((now - lastEvent) / 1000)) : null;

  return (
    <>
      <PageHeader title="Fleet"
        subtitle={<span className={`live-pill ${state === "live" ? "live" : ""}`}><i />{state === "live" ? `Live${age != null ? ` · updated ${age}s ago` : ""}` : "Reconnecting…"}</span>}
        actions={<>
          <div className="seg">
            <button className={view === "cards" ? "on" : ""} onClick={() => setV("cards")}><LayoutGrid size={15} />Cards</button>
            <button className={view === "table" ? "on" : ""} onClick={() => setV("table")}><Rows3 size={15} />Table</button>
          </div>
          <Btn icon={RefreshCw} busy={refreshing} onClick={refreshAll}>Refresh all</Btn>
          <Btn icon={Plus} className="primary" onClick={() => setAdding(true)}>Add VM</Btn>
        </>} />
      <ErrorBox error={error} />
      {duplicates.map((names, i) => (
        <div key={i} className="alert warn"><TriangleAlert size={14} style={{ verticalAlign: -2 }} /> {names.join(", ")} report the <b>same machine</b> (identical boot ID). One of these entries probably has the wrong SSH command.</div>
      ))}
      <div className="tiles">
        <div className="tile"><b>{vms.length}</b><span>VMs</span></div>
        <div className="tile"><b className="okc">{online}</b><span>online</span></div>
        <div className="tile"><b className={offline ? "critc" : ""}>{offline}</b><span>offline</span></div>
        <div className="tile"><b className={alerts ? "warnc" : ""}>{alerts}</b><span>active alerts</span></div>
        <div className="tile"><b className="mono">{avgCpu == null ? "-" : pct(avgCpu)}</b><span>average CPU</span></div>
        <div className="tile"><b className="mono">{memTotal ? pct((100 * memUsed) / memTotal) : "-"}</b><span>memory {memTotal ? `· ${bytes(memUsed)} / ${bytes(memTotal)}` : ""}</span></div>
      </div>
      {!isLoading && vms.length === 0 && <Empty icon={LayoutGrid} title="No VMs yet">Click “Add VM” and paste the SSH command InstaBox gave you.</Empty>}

      {view === "cards" ? (
        <div className="grid">
          {vms.map((v) => {
            const s = v.summary;
            return (
              <article key={v.id} className="card vmcard dash" onClick={() => nav(`/vm/${v.id}`)}>
                <div className="vm-head">
                  <div><strong>{v.name}</strong><div className="muted small">{s ? `${s.os} · ${s.cores} vCPU${s.ips?.length ? ` · ${s.ips[0]}` : ""}` : v.host}</div></div>
                  <StatusBadge status={v.status} enabled={v.enabled} />
                </div>
                {s ? (
                  <>
                    <div className="meters">
                      <Meter label="CPU" value={s.cpu} spark={getSeries(v.id, "cpu")} sub={`load ${s.load_raw[0] ?? "-"}`} />
                      <Meter label="Memory" value={s.mem} spark={getSeries(v.id, "mem")} sub={`${bytes(s.mem_used)} / ${bytes(s.mem_total)}`} />
                      <Meter label="Disk" value={s.disk} sub="busiest volume" />
                    </div>
                    <div className="stats">
                      <div><span>Load 1/5/15</span><b className="mono">{s.load_raw.join(" ")}</b></div>
                      <div><span>Uptime</span><b className="mono">{uptime(s.uptime_seconds)}</b></div>
                      <div><span>Network</span><b className="mono">↓{rate(s.rx_rate)} ↑{rate(s.tx_rate)}</b></div>
                    </div>
                    <div className="chips">
                      <span className="chip">{s.ports} ports{s.public_ports ? ` (${s.public_ports} public)` : ""}</span>
                      {s.containers > 0 && <span className="chip">{s.containers} containers</span>}
                      {s.alerts.map((a, i) => <span key={i} className={`chip ${a.level}`}>{a.message}</span>)}
                      {v.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  </>
                ) : <div className="muted small">No data yet</div>}
                {v.status === "offline" && v.last_error && <div className="alert error small">{v.last_error}</div>}
                <footer>
                  <span className="muted small mono" title="Time of the last successful sample">
                    {s && <i key={s.collected_at} className="tick" />}{fullTime(s?.collected_at || v.last_seen)}
                  </span>
                  <span className="actions" onClick={(e) => e.stopPropagation()}>
                    <Link className="btn sm" to={`/terminals?vms=${v.id}`}><TerminalSquare size={14} />Terminal</Link>
                    <Link className="btn sm" to={`/files?left=${v.id}`}><FolderTree size={14} />Files</Link>
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Name</th><th>Status</th><th>CPU</th><th>Memory</th><th>Disk (max)</th><th>Load 1/5/15</th><th>Uptime</th><th>Ports</th><th>Last sample</th><th /></tr></thead>
            <tbody>
              {vms.map((v) => (
                <tr key={v.id} className="clickable" onClick={() => nav(`/vm/${v.id}`)}>
                  <td><strong>{v.name}</strong><div className="muted small">{v.summary?.hostname || v.host}</div></td>
                  <td><StatusBadge status={v.status} enabled={v.enabled} /></td>
                  <td className="mono">{pct(v.summary?.cpu)}</td>
                  <td className="mono">{pct(v.summary?.mem)}</td>
                  <td className="mono">{v.summary ? pct(v.summary.disk) : "-"}</td>
                  <td className="mono">{v.summary?.load_raw.join(" ") || "-"}</td>
                  <td className="mono">{v.summary ? uptime(v.summary.uptime_seconds) : "-"}</td>
                  <td className="mono">{v.summary ? `${v.summary.ports} (${v.summary.public_ports})` : "-"}</td>
                  <td className="mono">{fullTime(v.summary?.collected_at || v.last_seen)}</td>
                  <td onClick={(e) => e.stopPropagation()}><Link className="btn sm" to={`/terminals?vms=${v.id}`}><TerminalSquare size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddVM onClose={() => setAdding(false)} />}
    </>
  );
}
