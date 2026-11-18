import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Empty, ErrorBox } from "../components/ui.jsx";

export default function Ports() {
  const { data = [], error } = useQuery({ queryKey: ["ports"], queryFn: api.ports, refetchInterval: 30000 });
  const [q, setQ] = useState("");
  const [pub, setPub] = useState(false);
  const rows = data.filter((p) =>
    (!pub || p.exposed) && `${p.vm} ${p.port} ${p.process} ${p.service} ${p.proto}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <h1>Ports &amp; hosted apps</h1>
      <div className="row">
        <input placeholder="Filter by VM, port, process, service…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
        <label className="inline"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Publicly bound only</label>
        <span className="muted">{rows.length} listeners</span>
      </div>
      <ErrorBox error={error} />
      {rows.length === 0 ? <Empty>No listening ports found.</Empty> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>VM</th><th>Port</th><th>Proto</th><th>Bind</th><th>Process</th><th>Service</th></tr></thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={i}>
                  <td><Link to={`/vm/${p.vm_id}`}>{p.vm}</Link></td>
                  <td className="mono">{p.port}</td><td>{p.proto}</td>
                  <td><span className={`chip ${p.exposed ? "warning" : "info"}`}>{p.exposed ? "public" : "local"}</span> <span className="muted mono">{p.address}</span></td>
                  <td>{p.process || "-"}{p.pid ? <span className="muted"> ({p.pid})</span> : null}</td>
                  <td>{p.service || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">“Public” means the process listens on all interfaces. Whether it is reachable from the internet also depends on InstaBox networking and any firewall.</p>
    </>
  );
}
