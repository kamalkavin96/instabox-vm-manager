import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { ago, uptime } from "../format";
import AddVM from "../components/AddVM.jsx";
import { Alerts, Bar, Empty, ErrorBox, Status } from "../components/ui.jsx";

export default function Dashboard() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: vms = [], error, isLoading } = useQuery({ queryKey: ["vms"], queryFn: api.vms, refetchInterval: 15000 });
  const refresh = useMutation({ mutationFn: api.refreshFleet, onSuccess: () => qc.invalidateQueries({ queryKey: ["vms"] }) });
  const online = vms.filter((v) => v.status === "online").length;
  const offline = vms.filter((v) => v.enabled && v.status === "offline").length;
  const alerts = vms.reduce((n, v) => n + (v.summary?.alerts?.filter((a) => a.level !== "info").length || 0), 0);
  const withCpu = vms.filter((v) => v.summary?.cpu != null);
  const avgCpu = withCpu.length ? Math.round(withCpu.reduce((s, v) => s + v.summary.cpu, 0) / withCpu.length) : null;
  return (
    <>
      <div className="row between">
        <h1>Fleet</h1>
        <span>
          <button className="ghost" disabled={refresh.isPending} onClick={() => refresh.mutate()}>{refresh.isPending ? "Refreshing…" : "Refresh all"}</button>
          <button onClick={() => setAdding(true)}>+ Add VM</button>
        </span>
      </div>
      <ErrorBox error={error || refresh.error} />
      <div className="tiles">
        <div className="tile"><b>{vms.length}</b><span>VMs</span></div>
        <div className="tile"><b className="okc">{online}</b><span>online</span></div>
        <div className="tile"><b className={offline ? "critc" : ""}>{offline}</b><span>offline</span></div>
        <div className="tile"><b className={alerts ? "warnc" : ""}>{alerts}</b><span>active alerts</span></div>
        <div className="tile"><b>{avgCpu == null ? "-" : `${avgCpu}%`}</b><span>avg CPU</span></div>
      </div>
      {!isLoading && vms.length === 0 && <Empty>No VMs yet. Click “Add VM” and paste the SSH command InstaBox gave you.</Empty>}
      <div className="grid">
        {vms.map((v) => (
          <Link key={v.id} to={`/vm/${v.id}`} className="card vmcard">
            <div className="row between">
              <strong><Status status={v.enabled ? v.status : "unknown"} /> {v.name}</strong>
              <span className="muted">{v.enabled ? ago(v.last_seen) : "disabled"}</span>
            </div>
            <div className="muted small">{v.summary?.os || v.host}{v.summary ? ` · up ${uptime(v.summary.uptime_seconds)}` : ""}</div>
            {v.summary ? (
              <>
                <Bar label="CPU" value={v.summary.cpu} />
                <Bar label="MEM" value={v.summary.mem} />
                <Bar label="DISK" value={v.summary.disk} />
                <div className="muted small">{v.summary.ports} listening ports ({v.summary.public_ports} public){v.summary.containers ? ` · ${v.summary.containers} containers` : ""}</div>
                <Alerts alerts={v.summary.alerts} />
              </>
            ) : <div className="muted small">No data yet</div>}
            {v.status === "offline" && v.last_error && <div className="error small">{v.last_error}</div>}
            {v.tags.length > 0 && <div className="tags">{v.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
          </Link>
        ))}
      </div>
      {adding && <AddVM onClose={() => setAdding(false)} />}
    </>
  );
}
