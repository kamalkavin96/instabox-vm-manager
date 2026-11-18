import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Empty, ErrorBox } from "../components/ui.jsx";

export default function Instabox() {
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ["instabox"], queryFn: api.instabox, retry: 0 });
  return (
    <>
      <div className="row between"><h1>InstaBox account</h1><button className="ghost" onClick={() => refetch()}>Reload</button></div>
      <ErrorBox error={error} />
      {data && (data.length === 0 ? <Empty>No machines on the account.</Empty> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>ID</th><th>State</th><th>Template</th><th>vCPU</th><th>RAM</th><th>Disk</th></tr></thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td><td className="mono muted">{m.id}</td>
                  <td><span className={`chip ${m.state === "running" ? "ok" : "info"}`}>{m.state}</span></td>
                  <td>{m.template || "-"}</td><td>{m.vcpus ?? "-"}</td>
                  <td>{m.memMiB ? `${Math.round(m.memMiB / 1024)} GiB` : "-"}</td>
                  <td>{m.persistentDiskGiB ? `${m.persistentDiskGiB} GiB` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {isLoading && <p className="muted">Loading…</p>}
      <p className="hint">Read-only view from the InstaBox API (GET /v1/machines). Set INSTABOX_API_KEY on the server to enable it. Use it to cross-check which machines are running against what you have added here.</p>
    </>
  );
}
