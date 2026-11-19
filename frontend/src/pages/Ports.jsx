import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Network, Upload } from "lucide-react";
import { api } from "../api";
import { Btn, CopyButton, Empty, ErrorBox, PageHeader, toast } from "../components/ui.jsx";

export default function Ports() {
  const qc = useQueryClient();
  const ports = useQuery({ queryKey: ["ports"], queryFn: api.ports, refetchInterval: 20000 });
  const pub = useQuery({ queryKey: ["published"], queryFn: api.ibPublished, refetchInterval: 30000, retry: 0 });
  const [q, setQ] = useState("");
  const [onlyPublic, setOnlyPublic] = useState(false);
  const [onlyUrl, setOnlyUrl] = useState(false);
  const urls = new Map((pub.data?.ports || []).map((p) => [`${p.vm_id}:${p.port}`, p]));
  const act = useMutation({
    mutationFn: ({ op, vm_id, port }) => (op === "publish" ? api.publish(vm_id, port) : api.unpublish(vm_id, port)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["published"] }); toast("Done", "ok"); },
    onError: (e) => toast(e.message, "error"),
  });
  const rows = (ports.data || []).filter((p) =>
    (!onlyPublic || p.exposed) && (!onlyUrl || urls.has(`${p.vm_id}:${p.port}`)) &&
    `${p.vm} ${p.port} ${p.process} ${p.service} ${p.proto}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Ports & preview URLs" subtitle="Listening ports discovered over SSH, joined with the public URLs InstaBox forwards to them." />
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Filter by VM, port, process, service…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340 }} />
        <label className="inline"><input type="checkbox" checked={onlyPublic} onChange={(e) => setOnlyPublic(e.target.checked)} />Public bind only</label>
        <label className="inline"><input type="checkbox" checked={onlyUrl} onChange={(e) => setOnlyUrl(e.target.checked)} />With preview URL</label>
        <span className="muted">{rows.length} listeners</span>
      </div>
      <ErrorBox error={ports.error} />
      {pub.error && <div className="alert warn">InstaBox URLs unavailable: {pub.error.message}</div>}
      {pub.data?.errors?.map((e) => <div key={e} className="alert warn">{e}</div>)}
      {!pub.error && (ports.data || []).some((p) => p.instabox_id) === false && (
        <div className="alert info">No VM is linked to an InstaBox machine yet, so preview URLs cannot be shown. Link them on the <Link to="/instabox">InstaBox page</Link>.</div>
      )}
      {rows.length === 0 ? <Empty icon={Network} title="No listening ports">Nothing matched.</Empty> : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>VM</th><th>Port</th><th>Proto</th><th>Bind</th><th>Process</th><th>Service</th><th>Preview URL</th></tr></thead>
            <tbody>
              {rows.map((p, i) => {
                const u = urls.get(`${p.vm_id}:${p.port}`);
                return (
                  <tr key={i}>
                    <td><Link to={`/vm/${p.vm_id}`}>{p.vm}</Link></td>
                    <td className="mono">{p.port}</td><td>{p.proto}</td>
                    <td><span className={`chip ${p.exposed ? "warning" : "info"}`}>{p.exposed ? "public" : "local"}</span> <span className="muted mono">{p.address}</span></td>
                    <td>{p.process || "-"}{p.pid ? <span className="muted"> ({p.pid})</span> : null}</td>
                    <td>{p.service || "-"}</td>
                    <td>
                      {u ? (
                        <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          <a href={u.url} target="_blank" rel="noreferrer" className="mono">{u.url.replace("https://", "")}</a>
                          <CopyButton text={u.url} />
                          <a className="icon-btn" href={u.url} target="_blank" rel="noreferrer" title="Open"><ExternalLink size={15} /></a>
                          <Btn className="sm danger" busy={act.isPending && act.variables?.port === p.port && act.variables?.vm_id === p.vm_id} onClick={() => window.confirm(`Unpublish port ${p.port}?`) && act.mutate({ op: "unpublish", vm_id: p.vm_id, port: p.port })}>Unpublish</Btn>
                        </span>
                      ) : p.instabox_id && p.port >= 1024 ? (
                        <Btn className="sm" icon={Upload} busy={act.isPending && act.variables?.port === p.port && act.variables?.vm_id === p.vm_id} onClick={() => act.mutate({ op: "publish", vm_id: p.vm_id, port: p.port })}>Publish</Btn>
                      ) : <span className="muted">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">A published InstaBox URL is public: anyone with the link can reach that service. Ports below 1024 cannot be published.</p>
    </>
  );
}
