import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ExternalLink, FolderTree, HardDrive, Network, Pause, Play, Power, RefreshCw, TerminalSquare, Trash2 } from "lucide-react";
import { api } from "../api";
import { useEvents } from "../events";
import { ago, bytes, bytesExact, fullTime, int, n2, pct, rate, uptime } from "../format";
import CommandRunner from "../components/CommandRunner.jsx";
import { Alerts, Bar, Btn, Card, CopyButton, Empty, ErrorBox, KV, StatusBadge, toast } from "../components/ui.jsx";

const TABS = ["Overview", "History", "Storage", "Ports & URLs", "Processes", "Run"];

export default function VMDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("Overview");
  const { state: wsState } = useEvents({ vm: id });          // server pushes a fresh snapshot of this VM every few seconds
  const { data: vm, error } = useQuery({ queryKey: ["vm", id], queryFn: () => api.vm(id), refetchInterval: wsState === "live" ? false : 15000 });

  const done = (d) => { qc.setQueryData(["vm", id], d); qc.invalidateQueries({ queryKey: ["vms"] }); };
  const refresh = useMutation({ mutationFn: () => api.refreshVm(id), onSuccess: done });
  const toggle = useMutation({ mutationFn: () => api.updateVm(id, { enabled: !vm.enabled }), onSuccess: done });
  const del = useMutation({ mutationFn: () => api.deleteVm(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["vms"] }); nav("/"); } });
  if (error) return <ErrorBox error={error} />;
  if (!vm) return <p className="muted">Loading…</p>;
  const s = vm.latest;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="row"><h1>{vm.name}</h1><StatusBadge status={vm.status} enabled={vm.enabled} /><span className={`live-pill ${wsState === "live" ? "live" : ""}`}><i />{wsState === "live" ? "Live" : "Reconnecting…"}</span></div>
          <p className="muted mono">{vm.host}:{vm.port} · last sample {fullTime(vm.last_seen, true)} ({ago(vm.last_seen)}){vm.notes ? ` · ${vm.notes}` : ""}</p>
          {vm.tags.length > 0 && <div className="chips">{vm.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
        </div>
        <div className="actions">
          <Link className="btn primary" to={`/terminals?vms=${id}`}><TerminalSquare size={15} />Terminal</Link>
          <Link className="btn" to={`/files?left=${id}`}><FolderTree size={15} />Files</Link>
          <Btn icon={RefreshCw} busy={refresh.isPending} onClick={() => refresh.mutate()}>Refresh</Btn>
          <Btn icon={vm.enabled ? Power : Play} busy={toggle.isPending} onClick={() => toggle.mutate()}>{vm.enabled ? "Disable" : "Enable"}</Btn>
          <Btn className="danger" icon={Trash2} busy={del.isPending} onClick={() => window.confirm(`Remove ${vm.name}? Its history will be deleted.`) && del.mutate()}>Remove</Btn>
        </div>
      </div>
      {vm.status === "offline" && vm.last_error && <div className="alert error">{vm.last_error}</div>}
      <ErrorBox error={refresh.error || toggle.error || del.error} />
      <div className="tabs">{TABS.map((t) => <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Run" ? <CommandRunner vms={[vm]} fixed={[vm.id]} />
        : tab === "History" ? <History id={id} />
        : tab === "Ports & URLs" ? <PortsTab vm={vm} />
        : !s ? <Empty icon={Activity} title="No data collected yet">Click Refresh.</Empty>
        : tab === "Overview" ? <Overview s={s} />
        : tab === "Storage" ? <Storage s={s} />
        : <Processes s={s} />}
    </>
  );
}

function Overview({ s }) {
  const m = s.memory, c = s.cpu, sys = s.system, net = s.network;
  return (
    <div className="stack">
      <Alerts alerts={s.alerts} />
      <div className="grid2">
        <Card title="CPU">
          <div className="big mono">{pct(c.percent)}</div>
          <KV rows={[["User", pct(c.user)], ["System", pct(c.system)], ["I/O wait", pct(c.iowait)], ["Steal", pct(c.steal)], ["Idle", pct(c.idle)],
            ["Load 1 / 5 / 15 min", c.load_raw.join("  /  ")], ["Run queue (running/total)", c.run_queue], ["Cores", c.cores], ["Model", sys.cpu_model]]} />
          {c.per_core?.length > 0 && <div style={{ marginTop: 10 }}>{c.per_core.map((v, i) => <Bar key={i} label={`core ${i}`} value={v} />)}</div>}
        </Card>
        <Card title="Memory">
          <div className="big mono">{pct(m.percent)}</div>
          <Bar label="RAM" value={m.percent} right={`${bytes(m.used)} / ${bytes(m.total)}`} />
          {m.swap_total > 0 && <Bar label="Swap" value={m.swap_percent} right={`${bytes(m.swap_used)} / ${bytes(m.swap_total)}`} />}
          <KV rows={[["Total", bytesExact(m.total)], ["Used", bytesExact(m.used)], ["Available", bytesExact(m.available)], ["Free", bytesExact(m.free)],
            ["Buffers", bytesExact(m.buffers)], ["Cache", bytesExact(m.cached)], ["Shared", bytesExact(m.shared)], ["Dirty", bytesExact(m.dirty)],
            ["Swap used", bytesExact(m.swap_used)], ["Swap total", bytesExact(m.swap_total)]]} />
        </Card>
        <Card title="System">
          <KV rows={[["OS", sys.os], ["Kernel", `${sys.kernel} (${sys.arch})`], ["Hostname", sys.hostname], ["IP addresses", sys.ips.join(", ")],
            ["Booted at", sys.boot_time], ["Uptime", uptime(sys.uptime_seconds)], ["Boot ID", sys.boot_id], ["Processes", int(sys.processes)],
            ["Logged-in users", sys.users], ["Failed systemd units", sys.failed_units], ["Reboot required", sys.reboot_required ? "yes" : "no"]]} />
        </Card>
        <Card title="Network">
          <KV rows={[["Receive rate", `${rate(net.rx_rate)}  (${n2(net.rx_rate, 1)} B/s)`], ["Transmit rate", `${rate(net.tx_rate)}  (${n2(net.tx_rate, 1)} B/s)`],
            ["Received total", bytesExact(net.rx_bytes)], ["Transmitted total", bytesExact(net.tx_bytes)]]} />
          <h3 style={{ margin: "14px 0 6px" }}>Volumes</h3>
          {s.disks.map((d) => <Bar key={d.mount} label={d.mount} value={d.percent} right={`${bytes(d.used)} / ${bytes(d.size)}`} />)}
        </Card>
      </div>
      <div className="muted small mono">Collected {fullTime(s.collected_at, true)} · sample window {s.sample_seconds}s</div>
    </div>
  );
}

function History({ id }) {
  const [hours, setHours] = useState(6);
  const { data = [], error } = useQuery({ queryKey: ["metrics", id, hours], queryFn: () => api.metrics(id, hours), refetchInterval: 30000 });
  const rows = data.map((r) => ({ ...r, t: new Date(r.ts).toLocaleString("sv-SE", { hour12: false }).slice(hours > 24 ? 5 : 11, 16) }));
  const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }, formatter: (v, n) => [n === "Load 1m" ? Number(v).toFixed(2) : `${Number(v).toFixed(2)}%`, n] };
  return (
    <div className="stack">
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        {[1, 6, 24, 72, 168].map((h) => <button key={h} className={h === hours ? "on" : ""} onClick={() => setHours(h)}>{h < 24 ? `${h}h` : `${h / 24}d`}</button>)}
      </div>
      <ErrorBox error={error} />
      {rows.length < 2 ? <Empty icon={Activity} title="Not enough samples yet">Metrics are recorded every minute.</Empty> : (
        <>
          <Card title="CPU, memory and disk (%)"><div style={{ height: 300 }}><ResponsiveContainer>
            <LineChart data={rows}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="var(--muted)" minTickGap={40} /><YAxis domain={[0, 100]} stroke="var(--muted)" unit="%" /><Tooltip {...tip} /><Legend />
              <Line type="monotone" dataKey="cpu" name="CPU" stroke="#4f7cff" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="mem" name="Memory" stroke="#e8a317" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="disk" name="Disk (max)" stroke="#8b5cf6" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div></Card>
          <Card title="Load average (1 min)"><div style={{ height: 220 }}><ResponsiveContainer>
            <LineChart data={rows}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="var(--muted)" minTickGap={40} /><YAxis stroke="var(--muted)" /><Tooltip {...tip} />
              <Line type="monotone" dataKey="load1" name="Load 1m" stroke="#1fa971" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div></Card>
        </>
      )}
    </div>
  );
}

function Storage({ s }) {
  if (!s.disks.length) return <Empty icon={HardDrive} title="No mounted volumes reported" />;
  return (
    <Card><div className="table-wrap"><table>
      <thead><tr><th>Mount</th><th>Device</th><th>Type</th><th>Size</th><th>Used</th><th>Free</th><th>Use</th><th>Inodes used</th></tr></thead>
      <tbody>{s.disks.map((d) => (
        <tr key={d.mount}>
          <td className="mono">{d.mount}</td><td className="muted">{d.fs}</td><td>{d.type}</td>
          <td className="mono" title={bytesExact(d.size)}>{bytes(d.size)}</td><td className="mono" title={bytesExact(d.used)}>{bytes(d.used)}</td><td className="mono" title={bytesExact(d.avail)}>{bytes(d.avail)}</td>
          <td><span className={`chip ${d.percent >= 90 ? "critical" : d.percent >= 80 ? "warning" : "ok"}`}>{pct(d.percent)}</span></td>
          <td className="mono">{d.inode_percent != null ? `${pct(d.inode_percent)} (${int(d.inodes_used)}/${int(d.inodes)})` : "-"}</td>
        </tr>))}</tbody></table></div><p className="muted small">Hover a size for the exact byte count.</p></Card>
  );
}

function PortsTab({ vm }) {
  const qc = useQueryClient();
  const [source, setSource] = useState("auto");
  const [port, setPort] = useState("");
  const { data, error, isFetching, refetch } = useQuery({ queryKey: ["preview", vm.id, source, vm.instabox_id], queryFn: () => api.preview(vm.id, source), retry: 0 });
  const act = useMutation({
    mutationFn: ({ op, p }) => (op === "publish" ? api.publish(vm.id, p) : api.unpublish(vm.id, p)),
    onSuccess: () => { toast("Done", "ok"); qc.invalidateQueries({ queryKey: ["preview", vm.id] }); },
    onError: (e) => toast(e.message, "error"),
  });
  const pubMap = new Map((data?.published || []).map((p) => [p.port, p]));
  const listening = data?.listening || [];
  const extra = (data?.published || []).filter((p) => !listening.some((l) => l.port === p.port));
  return (
    <div className="stack">
      <div className="row between">
        <div className="row">
          <div className="seg">{[["auto", "Auto"], ["rest", "InstaBox API"], ["cli", "InstaBox CLI"], ["ssh", "SSH only"]].map(([k, l]) => <button key={k} className={source === k ? "on" : ""} onClick={() => setSource(k)}>{l}</button>)}</div>
          {data && <span className="chip info">source: {data.source}</span>}
        </div>
        <Btn icon={RefreshCw} busy={isFetching} onClick={() => refetch()}>Reload</Btn>
      </div>
      <ErrorBox error={error} />
      {data?.errors?.map((e) => <div key={e} className="alert warn">{e}</div>)}
      {!vm.instabox_id && <div className="alert info">This VM is not linked to an InstaBox machine, so no preview URLs are available. <Link to="/instabox">Link it on the InstaBox page</Link>.</div>}
      <Card title={`Listening ports (${listening.length})`}>
        <div className="table-wrap"><table>
          <thead><tr><th>Port</th><th>Proto</th><th>Bind</th><th>Process</th><th>Service</th><th>Preview URL</th></tr></thead>
          <tbody>{listening.map((p, i) => {
            const u = pubMap.get(p.port);
            return (
              <tr key={i}>
                <td className="mono">{p.port}</td><td>{p.proto}</td>
                <td><span className={`chip ${p.exposed ? "warning" : "info"}`}>{p.exposed ? "public" : "local"}</span> <span className="muted mono">{p.address}</span></td>
                <td>{p.process || "-"}{p.pid ? <span className="muted"> ({p.pid})</span> : null}</td><td>{p.service || "-"}</td>
                <td>{u ? <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}><a className="mono" href={u.url} target="_blank" rel="noreferrer">{u.url.replace("https://", "")}</a><CopyButton text={u.url} /><a className="icon-btn" href={u.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>
                  <button className="btn sm danger" onClick={() => window.confirm(`Unpublish ${p.port}?`) && act.mutate({ op: "unpublish", p: p.port })}>Unpublish</button></span>
                  : vm.instabox_id && p.port >= 1024 ? <Btn className="sm" busy={act.isPending && act.variables?.p === p.port} onClick={() => act.mutate({ op: "publish", p: p.port })}>Publish</Btn> : <span className="muted">-</span>}</td>
              </tr>);
          })}</tbody></table></div>
        {listening.length === 0 && <p className="muted">No listening ports found.</p>}
      </Card>
      {vm.instabox_id && (
        <Card title="Published by InstaBox">
          {extra.length > 0 && <div className="table-wrap"><table><thead><tr><th>Port</th><th>URL</th><th /></tr></thead><tbody>{extra.map((p) => (
            <tr key={p.port}><td className="mono">{p.port}</td><td><a className="mono" href={p.url} target="_blank" rel="noreferrer">{p.url}</a> {p.derived && <span className="chip derived" title="Built from the machine id; the API did not return a URL">derived</span>}</td>
              <td><button className="btn sm danger" onClick={() => act.mutate({ op: "unpublish", p: p.port })}>Unpublish</button></td></tr>))}</tbody></table></div>}
          {extra.length === 0 && <p className="muted">Nothing else is published (ports that are published and listening appear in the table above).</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <input type="number" className="compact" placeholder="Port (1024-65535)" min="1024" max="65535" value={port} onChange={(e) => setPort(e.target.value)} />
            <Btn className="primary" busy={act.isPending} disabled={!port} onClick={() => { act.mutate({ op: "publish", p: Number(port) }); setPort(""); }}>Publish port</Btn>
          </div>
        </Card>
      )}
      {data?.cli && (
        <Card title="InstaBox CLI output">{data.cli.available ? <pre>{data.cli.output || "(empty)"}</pre> : <p className="muted">The <code>instabox</code> CLI is not installed on the machine running this app (install it and run <code>instabox login</code> there to use this source).</p>}</Card>
      )}
      <p className="muted small">A published InstaBox URL is public: anyone with the link can reach that service until you unpublish it.</p>
    </div>
  );
}

function Processes({ s }) {
  return (
    <div className="stack">
      <Card title="Top processes by CPU"><div className="table-wrap"><table>
        <thead><tr><th>PID</th><th>User</th><th>CPU %</th><th>MEM %</th><th>Command</th></tr></thead>
        <tbody>{s.top.map((p) => <tr key={p.pid}><td className="mono">{p.pid}</td><td>{p.user}</td><td className="mono">{p.cpu}</td><td className="mono">{p.mem}</td><td>{p.command}</td></tr>)}</tbody></table></div></Card>
      <Card title="Docker containers">
        {s.containers.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Image</th><th>Status</th><th>Ports</th></tr></thead>
          <tbody>{s.containers.map((c) => <tr key={c.name}><td>{c.name}</td><td className="muted">{c.image}</td><td>{c.status}</td><td className="mono">{c.ports || "-"}</td></tr>)}</tbody></table></div>
          : <p className="muted">No running containers (or Docker is not installed).</p>}
      </Card>
    </div>
  );
}
