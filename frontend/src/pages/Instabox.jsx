import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, ExternalLink, KeyRound, Link2, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { api } from "../api";
import { bytes, fullTime } from "../format";
import { Btn, Card, CopyButton, Empty, ErrorBox, KV, Modal, PageHeader, toast } from "../components/ui.jsx";

const label = (k) => k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
function flatten(obj, prefix = "") {
  return Object.entries(obj || {}).flatMap(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) return flatten(v, `${prefix}${label(k)} · `);
    const shown = /bytes/i.test(k) && typeof v === "number" ? `${bytes(v)} (${v.toLocaleString()} B)` : /At$|_at$/.test(k) && v ? fullTime(v) : Array.isArray(v) ? v.join(", ") : String(v);
    return [[prefix + label(k), shown]];
  });
}

export default function Instabox() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["ib-status"], queryFn: api.ibStatus });
  const ok = status.data?.configured;
  const account = useQuery({ queryKey: ["ib-account"], queryFn: api.ibAccount, enabled: !!ok, retry: 0 });
  const machines = useQuery({ queryKey: ["ib-machines"], queryFn: api.ibMachines, enabled: !!ok, retry: 0 });
  const vms = useQuery({ queryKey: ["vms"], queryFn: api.vms });
  const [key, setKey] = useState("");
  const [portsFor, setPortsFor] = useState(null);
  const inval = () => { qc.invalidateQueries({ queryKey: ["ib-machines"] }); qc.invalidateQueries({ queryKey: ["vms"] }); qc.invalidateQueries({ queryKey: ["published"] }); };
  const save = useMutation({ mutationFn: () => api.ibSaveKey(key.trim()), onSuccess: (r) => { setKey(""); toast(`Key verified, ${r.machines} machine(s) found`, "ok"); qc.invalidateQueries({ queryKey: ["ib-status"] }); inval(); qc.invalidateQueries({ queryKey: ["ib-account"] }); } });
  const remove = useMutation({ mutationFn: api.ibRemoveKey, onSuccess: () => { qc.invalidateQueries({ queryKey: ["ib-status"] }); qc.removeQueries({ queryKey: ["ib-machines"] }); qc.removeQueries({ queryKey: ["ib-account"] }); } });
  const auto = useMutation({ mutationFn: api.ibAutolink, onSuccess: (r) => { toast(r.linked.length ? `Linked ${r.linked.map((l) => l.vm).join(", ")}` : "No name matches found; link manually", r.linked.length ? "ok" : "info"); inval(); } });
  const link = async (m, vmId) => {
    try {
      if (m.vm_id && m.vm_id !== vmId) await api.linkVm(m.vm_id, null);
      if (vmId) await api.linkVm(vmId, m.id);
      inval();
    } catch (e) { toast(e.message, "error"); }
  };
  return (
    <>
      <PageHeader title="InstaBox account" subtitle="Machines, usage and published ports from the InstaBox API."
        actions={ok && <><Btn icon={Wand2} busy={auto.isPending} onClick={() => auto.mutate()}>Auto-link by name</Btn>
          <Btn icon={RefreshCw} busy={machines.isFetching || account.isFetching} onClick={() => { machines.refetch(); account.refetch(); }}>Reload</Btn></>} />
      <div className="stack">
        <Card title="API connection">
          {ok ? (
            <div className="row between">
              <span className="row"><span className="badge online"><i className="dot" />connected</span><span className="mono muted">{status.data.key_hint}</span><span className="muted small">({status.data.source === "saved" ? "saved in this app" : "from environment variable"})</span></span>
              {status.data.source === "saved" && <button className="btn sm danger" onClick={() => window.confirm("Remove the saved API key?") && remove.mutate()}><Trash2 size={14} />Remove key</button>}
            </div>
          ) : (
            <>
              <div className="alert info">Paste an InstaBox API key to enable this page. Create one in the InstaBox dashboard under API keys (it needs permission to read machines; publishing ports also needs write access). The key is verified, then stored encrypted on this server.</div>
              <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); key.trim() && save.mutate(); }}>
                <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ibk_…" autoComplete="off" className="mono" />
                <Btn className="primary" icon={KeyRound} busy={save.isPending} disabled={!key.trim()}>{save.isPending ? "Verifying…" : "Save & verify"}</Btn>
              </form>
              <ErrorBox error={save.error} />
            </>
          )}
          <ErrorBox error={remove.error} />
        </Card>
        {ok && (
          <>
            <Card title="Usage & limits">
              <ErrorBox error={account.error} />
              {account.data && <KV rows={flatten(account.data.usage)} />}
              {account.isLoading && <p className="muted">Loading…</p>}
            </Card>
            <Card title={`Machines${machines.data ? ` (${machines.data.length})` : ""}`}>
              <ErrorBox error={machines.error} />
              {machines.data?.length === 0 && <Empty icon={Cloud} title="No machines on this account" />}
              {machines.data?.length > 0 && (
                <div className="table-wrap"><table>
                  <thead><tr><th>Name</th><th>Machine ID</th><th>State</th><th>Template</th><th>vCPU</th><th>RAM</th><th>Disk</th><th>Created</th><th>Linked VM (in this app)</th><th /></tr></thead>
                  <tbody>{machines.data.map((m) => (
                    <tr key={m.id}>
                      <td><strong>{m.name}</strong></td>
                      <td className="mono">{m.id} <CopyButton text={m.id} /></td>
                      <td><span className={`badge ${m.state === "running" ? "running" : ""}`}><i className="dot" />{m.state}</span></td>
                      <td>{m.template || "-"}</td><td className="mono">{m.vcpus ?? "-"}</td>
                      <td className="mono">{m.mem_mib ? `${(m.mem_mib / 1024).toFixed(2)} GiB` : "-"}</td>
                      <td className="mono">{m.disk_gib ? `${m.disk_gib} GiB` : "-"}</td>
                      <td className="mono">{m.created_at ? fullTime(m.created_at) : "-"}</td>
                      <td><select className="compact" value={m.vm_id || ""} onChange={(e) => link(m, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— not linked —</option>{(vms.data || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></td>
                      <td><button className="btn sm" onClick={() => setPortsFor(m)}><Link2 size={14} />Ports & URLs</button></td>
                    </tr>))}</tbody></table></div>
              )}
              <p className="muted small">Linking a VM to its InstaBox machine unlocks preview URLs on the VM and Ports pages.</p>
            </Card>
          </>
        )}
      </div>
      {portsFor && <PortsModal machine={portsFor} onClose={() => setPortsFor(null)} />}
    </>
  );
}

function PortsModal({ machine, onClose }) {
  const qc = useQueryClient();
  const [port, setPort] = useState("");
  const ports = useQuery({ queryKey: ["ib-ports", machine.id], queryFn: () => api.ibPorts(machine.id), retry: 0 });
  const done = () => { qc.invalidateQueries({ queryKey: ["ib-ports", machine.id] }); qc.invalidateQueries({ queryKey: ["published"] }); };
  const pub = useMutation({ mutationFn: () => api.ibPublish(machine.id, Number(port)), onSuccess: () => { setPort(""); toast("Published", "ok"); done(); }, onError: (e) => toast(e.message, "error") });
  const unpub = useMutation({ mutationFn: (p) => api.ibUnpublish(machine.id, p), onSuccess: () => { toast("Unpublished", "ok"); done(); }, onError: (e) => toast(e.message, "error") });
  return (
    <Modal title={`Published ports · ${machine.name}`} onClose={onClose} wide>
      <ErrorBox error={ports.error} />
      {ports.data?.length === 0 && <p className="muted">No ports are published for this machine.</p>}
      {ports.data?.length > 0 && <div className="table-wrap"><table><thead><tr><th>Port</th><th>Public URL</th><th /></tr></thead><tbody>{ports.data.map((p) => (
        <tr key={p.port}><td className="mono">{p.port}</td>
          <td><a className="mono" href={p.url} target="_blank" rel="noreferrer">{p.url}</a> <CopyButton text={p.url} /> <a className="icon-btn" href={p.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>{p.derived && <span className="chip derived" title="The API did not return a URL; built from the machine id">derived</span>}</td>
          <td><Btn className="sm danger" busy={unpub.isPending && unpub.variables === p.port} onClick={() => window.confirm(`Unpublish ${p.port}?`) && unpub.mutate(p.port)}>Unpublish</Btn></td></tr>))}</tbody></table></div>}
      <div className="row" style={{ marginTop: 14 }}>
        <input type="number" className="compact" min="1024" max="65535" placeholder="Port (1024-65535)" value={port} onChange={(e) => setPort(e.target.value)} />
        <Btn className="primary" busy={pub.isPending} disabled={!port} onClick={() => pub.mutate()}>Publish port</Btn>
      </div>
      <p className="muted small">Published URLs are public until unpublished. The machine must be running for the URL to answer. Up to 16 ports per machine.</p>
    </Modal>
  );
}
