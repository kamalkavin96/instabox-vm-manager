import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { api } from "../api";
import { fullTime } from "../format";
import { Btn, ErrorBox, Card, StatusBadge } from "./ui";

const SNIPPETS = [
  ["Disk usage", "df -hT -x tmpfs -x devtmpfs"], ["Memory", "free -h"], ["Uptime & load", "uptime"],
  ["Top CPU", "ps -eo pid,user,pcpu,pmem,comm --sort=-pcpu | head -10"], ["Listening ports", "ss -tulnp"],
  ["Failed services", "systemctl --failed --no-pager"], ["Recent errors", "journalctl -p err -n 30 --no-pager"],
  ["Docker ps", "docker ps -a"], ["Logged-in users", "who"], ["Update packages", "apt-get update && apt-get -y upgrade"],
];

export default function CommandRunner({ vms, fixed }) {
  const [cmd, setCmd] = useState("");
  const [sel, setSel] = useState(() => new Set(fixed ?? vms.filter((v) => v.enabled).map((v) => v.id)));
  const [timeout, setTimeoutS] = useState(60);
  const hist = useQuery({ queryKey: ["history"], queryFn: api.history });
  const m = useMutation({
    mutationFn: () => api.run({ command: cmd, vm_ids: [...sel], timeout: Number(timeout) }),
    onSuccess: () => hist.refetch(),
  });
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const run = () => cmd.trim() && sel.size && !m.isPending && m.mutate();
  return (
    <div className="stack">
      {!fixed && (
        <Card title={`Targets (${sel.size}/${vms.length})`} actions={<>
          <button className="btn sm" onClick={() => setSel(new Set(vms.map((v) => v.id)))}>All</button>
          <button className="btn sm" onClick={() => setSel(new Set())}>None</button></>}>
          <div className="checks">
            {vms.map((v) => (
              <label key={v.id} className="check"><input type="checkbox" checked={sel.has(v.id)} onChange={() => toggle(v.id)} /> {v.name} <StatusBadge status={v.status} enabled={v.enabled} /></label>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <div className="snippets">{SNIPPETS.map(([l, c]) => <button key={l} className="btn sm" onClick={() => setCmd(c)}>{l}</button>)}</div>
        <textarea rows={3} className="mono" value={cmd} onChange={(e) => setCmd(e.target.value)}
          placeholder="Command to run (bash)…  Ctrl+Enter to run"
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && run()} />
        <div className="row between" style={{ marginTop: 10 }}>
          <label className="inline">Timeout (s)
            <input type="number" min="1" max="900" value={timeout} onChange={(e) => setTimeoutS(e.target.value)} style={{ width: 90 }} />
          </label>
          <Btn className="primary" icon={Play} busy={m.isPending} disabled={!cmd.trim() || !sel.size} onClick={run}>
            {m.isPending ? "Running…" : `Run on ${sel.size} VM${sel.size === 1 ? "" : "s"}`}
          </Btn>
        </div>
        <ErrorBox error={m.error} />
        <p className="muted small" style={{ marginBottom: 0 }}>For interactive programs (htop, btop, mc, vim) use the Terminals page.</p>
      </Card>
      {m.data && <Results run={m.data} />}
      {!m.data && hist.data?.length > 0 && (
        <Card title="Recent commands">
          {hist.data.slice(0, 8).map((h) => (
            <div key={h.id} className="hist" onClick={() => setCmd(h.command)} title="Click to reuse">
              <code>{h.command.length > 90 ? h.command.slice(0, 90) + "…" : h.command}</code>
              <span className="muted small">{h.results.length} VMs · {fullTime(h.ts)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Results({ run }) {
  return (
    <div className="stack">
      <div className="muted small">Executed {fullTime(run.ts)}</div>
      {run.results.map((r) => {
        const ok = !r.error && r.exit_code === 0;
        return (
          <section key={r.vm_id} className={`card result ${ok ? "" : "failed"}`}>
            <div className="row between">
              <strong>{r.name}</strong>
              <span className="muted small">{r.error ? "error" : `exit ${r.exit_code}`} · {r.duration}s</span>
            </div>
            {r.error && <div className="alert error">{r.error}</div>}
            {r.stdout && <pre>{r.stdout}</pre>}
            {r.stderr && <pre className="stderr">{r.stderr}</pre>}
            {!r.error && !r.stdout && !r.stderr && <span className="muted">(no output)</span>}
          </section>
        );
      })}
    </div>
  );
}
