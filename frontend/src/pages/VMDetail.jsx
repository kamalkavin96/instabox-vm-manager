import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { ago, bytes, uptime } from "../format";
import CommandRunner from "../components/CommandRunner.jsx";
import { Alerts, Bar, Empty, ErrorBox, Status } from "../components/ui.jsx";

const TABS = ["Overview", "History", "Storage", "Ports", "Processes", "Run"];

export default function VMDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("Overview");
  const { data: vm, error } = useQuery({ queryKey: ["vm", id], queryFn: () => api.vm(id), refetchInterval: 15000 });
  const refresh = useMutation({
    mutationFn: () => api.refreshVm(id),
    onSuccess: (d) => { qc.setQueryData(["vm", id], d); qc.invalidateQueries({ queryKey: ["vms"] }); },
  });
  const toggle = useMutation({
    mutationFn: () => api.updateVm(id, { enabled: !vm.enabled }),
    onSuccess: (d) => { qc.setQueryData(["vm", id], d); qc.invalidateQueries({ queryKey: ["vms"] }); },
  });
  const del = useMutation({
    mutationFn: () => api.deleteVm(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vms"] }); nav("/"); },
  });
  if (error) return <ErrorBox error={error} />;
  if (!vm) return <p className="muted">Loading…</p>;
  const s = vm.latest;
  return (
    <>
      <div className="row between">
        <h1><Status status={vm.enabled ? vm.status : "unknown"} /> {vm.name}</h1>
        <span>
          <button className="ghost" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Collecting…" : "Refresh"}</button>
          <button className="ghost" onClick={() => toggle.mutate()}>{vm.enabled ? "Disable monitoring" : "Enable"}</button>
          <button className="danger" onClick={() => window.confirm(`Remove ${vm.name}? Its history will be deleted.`) && del.mutate()}>Remove</button>
        </span>
      </div>
      <div className="muted">{vm.host}:{vm.port} · last seen {ago(vm.last_seen)}{vm.notes ? ` · ${vm.notes}` : ""}</div>
      {vm.status === "offline" && vm.last_error && <div className="error">{vm.last_error}</div>}
      <ErrorBox error={refresh.error || toggle.error || del.error} />
      <div className="tabs">{TABS.map((t) => <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Run" ? <CommandRunner vms={[vm]} fixed={[vm.id]} />
        : tab === "History" ? <History id={id} />
        : !s ? <Empty>No data collected yet. Click Refresh.</Empty>
        : tab === "Overview" ? <Overview s={s} />
        : tab === "Storage" ? <Storage s={s} />
        : tab === "Ports" ? <PortsTab s={s} />
        : <Processes s={s} />}
    </>
  );
}

function Overview({ s }) {
  const rows = [
    ["OS", s.system.os], ["Kernel", `${s.system.kernel} (${s.system.arch})`], ["Hostname", s.system.hostname],
    ["Uptime", uptime(s.system.uptime_seconds)], ["Load (1/5/15)", s.cpu.load.join(" / ")], ["CPU cores", s.cpu.cores],
    ["Processes", s.system.processes], ["Logged-in users", s.system.users],
    ["Memory", `${bytes(s.memory.used)} / ${bytes(s.memory.total)}`],
    ["Swap", s.memory.swap_total ? `${bytes(s.memory.swap_used)} / ${bytes(s.memory.swap_total)}` : "none"],
    ["Network (total)", `↓ ${bytes(s.network.rx_bytes)}  ↑ ${bytes(s.network.tx_bytes)}`],
    ["Failed units", s.system.failed_units],
  ];
  return (
    <div className="stack">
      <Alerts alerts={s.alerts} />
      <div className="card">
        <Bar label="CPU" value={s.cpu.percent} /><Bar label="Memory" value={s.memory.percent} />
        {s.memory.swap_total > 0 && <Bar label="Swap" value={s.memory.swap_percent} />}
        {s.disks.map((d) => <Bar key={d.mount} label={d.mount} value={d.percent} />)}
      </div>
      <div className="card kv">{rows.map(([k, v]) => <div key={k}><span className="muted">{k}</span><span>{v}</span></div>)}</div>
      <div className="muted small">Collected {ago(s.collected_at)}</div>
    </div>
  );
}

function History({ id }) {
  const [hours, setHours] = useState(6);
  const { data = [], error } = useQuery({ queryKey: ["metrics", id, hours], queryFn: () => api.metrics(id, hours), refetchInterval: 30000 });
  const rows = data.map((r) => ({ ...r, t: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
  return (
    <div className="stack">
      <div className="row">
        {[1, 6, 24, 72, 168].map((h) => <button key={h} className={h === hours ? "" : "ghost"} onClick={() => setHours(h)}>{h < 24 ? `${h}h` : `${h / 24}d`}</button>)}
      </div>
      <ErrorBox error={error} />
      {rows.length < 2 ? <Empty>Not enough samples yet. Metrics are collected every minute.</Empty> : (
        <div className="card" style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid stroke="#2a3040" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#8b93a7" minTickGap={40} /><YAxis domain={[0, 100]} stroke="#8b93a7" unit="%" />
              <Tooltip contentStyle={{ background: "#171b26", border: "1px solid #2a3040" }} /><Legend />
              <Line type="monotone" dataKey="cpu" name="CPU" stroke="#5b9dff" dot={false} />
              <Line type="monotone" dataKey="mem" name="Memory" stroke="#f5a524" dot={false} />
              <Line type="monotone" dataKey="disk" name="Disk (max)" stroke="#9b7bff" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Storage({ s }) {
  return s.disks.length ? (
    <div className="card table-wrap"><table>
      <thead><tr><th>Mount</th><th>Device</th><th>Type</th><th>Size</th><th>Used</th><th>Free</th><th>Use%</th></tr></thead>
      <tbody>{s.disks.map((d) => (
        <tr key={d.mount}><td className="mono">{d.mount}</td><td className="muted">{d.fs}</td><td>{d.type}</td>
          <td>{bytes(d.size)}</td><td>{bytes(d.used)}</td><td>{bytes(d.avail)}</td>
          <td><span className={`chip ${d.percent >= 90 ? "critical" : d.percent >= 80 ? "warning" : "ok"}`}>{d.percent}%</span></td></tr>
      ))}</tbody></table></div>
  ) : <Empty>No mounted volumes reported.</Empty>;
}

function PortsTab({ s }) {
  return s.ports.length ? (
    <div className="card table-wrap"><table>
      <thead><tr><th>Port</th><th>Proto</th><th>Bind</th><th>Process</th><th>Service</th></tr></thead>
      <tbody>{s.ports.map((p, i) => (
        <tr key={i}><td className="mono">{p.port}</td><td>{p.proto}</td>
          <td><span className={`chip ${p.exposed ? "warning" : "info"}`}>{p.exposed ? "public" : "local"}</span> <span className="muted mono">{p.address}</span></td>
          <td>{p.process || "-"}{p.pid ? <span className="muted"> ({p.pid})</span> : null}</td><td>{p.service || "-"}</td></tr>
      ))}</tbody></table></div>
  ) : <Empty>No listening ports found (the user may lack permission to read them).</Empty>;
}

function Processes({ s }) {
  return (
    <div className="stack">
      <div className="card table-wrap"><strong>Top processes by CPU</strong><table>
        <thead><tr><th>PID</th><th>User</th><th>CPU%</th><th>MEM%</th><th>Command</th></tr></thead>
        <tbody>{s.top.map((p) => <tr key={p.pid}><td className="mono">{p.pid}</td><td>{p.user}</td><td>{p.cpu}</td><td>{p.mem}</td><td>{p.command}</td></tr>)}</tbody></table></div>
      <div className="card table-wrap"><strong>Docker containers</strong>
        {s.containers.length ? <table><thead><tr><th>Name</th><th>Image</th><th>Status</th><th>Ports</th></tr></thead>
          <tbody>{s.containers.map((c) => <tr key={c.name}><td>{c.name}</td><td className="muted">{c.image}</td><td>{c.status}</td><td className="mono">{c.ports || "-"}</td></tr>)}</tbody></table>
          : <p className="muted">No running containers (or Docker is not installed).</p>}
      </div>
    </div>
  );
}
