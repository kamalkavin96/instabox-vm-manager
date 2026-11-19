import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { api } from "../api";
import { fullTime } from "../format";
import { useTheme } from "../theme.jsx";
import { useState } from "react";
import { Btn, Card, ErrorBox, PageHeader, StatusBadge, toast } from "../components/ui.jsx";

export default function Settings() {
  const { pref, setPref } = useTheme();
  const qc = useQueryClient();
  const vms = useQuery({ queryKey: ["vms"], queryFn: api.vms });
  const workers = useQuery({ queryKey: ["workers"], queryFn: api.workers, refetchInterval: 5000 });
  const [polling, setPolling] = useState(null);
  const poll = async (id) => {
    setPolling(id);
    try { await api.refreshVm(id); toast("Sample collected", "ok"); qc.invalidateQueries({ queryKey: ["workers"] }); qc.invalidateQueries({ queryKey: ["vms"] }); }
    catch (e) { toast(e.message, "error"); }
    finally { setPolling(null); }
  };
  return (
    <>
      <PageHeader title="Settings" />
      <div className="stack">
        <Card title="Appearance">
          <div className="seg">
            {[["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]].map(([k, l, Icon]) => (
              <button key={k} className={pref === k ? "on" : ""} onClick={() => setPref(k)}><Icon size={15} />{l}</button>
            ))}
          </div>
        </Card>
        <Card title="VM workers" actions={<span className="muted small">One independent worker per VM: its own schedule, connection and failure isolation.</span>}>
          <ErrorBox error={workers.error} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>VM</th><th>Status</th><th>Worker</th><th>Polls</th><th>Failures</th><th>Last duration</th><th>Last poll</th><th>Open terminals</th><th>Last error</th><th /></tr></thead>
              <tbody>
                {(vms.data || []).map((v) => {
                  const w = workers.data?.[v.id];
                  return (
                    <tr key={v.id}>
                      <td><strong>{v.name}</strong></td>
                      <td><StatusBadge status={v.status} enabled={v.enabled} /></td>
                      <td>{w ? (w.running ? <span className="badge running"><i className="dot" />running</span> : <span className="badge">stopped</span>) : <span className="badge">none</span>}</td>
                      <td className="mono">{w?.polls ?? "-"}</td><td className="mono">{w?.failures ?? "-"}</td>
                      <td className="mono">{w?.last_duration != null ? `${w.last_duration}s` : "-"}</td>
                      <td className="mono">{fullTime(w?.last_poll_at)}</td><td className="mono">{w?.terminals ?? 0}</td>
                      <td className="wrap small" style={{ maxWidth: 260 }}>{w?.last_error || "-"}</td>
                      <td><Btn className="sm" icon={RefreshCw} busy={polling === v.id} onClick={() => poll(v.id)}>Poll now</Btn></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
