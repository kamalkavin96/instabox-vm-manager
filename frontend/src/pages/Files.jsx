import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, ArrowUp, Check, Copy, Download, File as FileIcon, FilePen, Folder, FolderPlus, Link2, Pencil, RefreshCw, Trash2, Upload, Users, X } from "lucide-react";
import { api } from "../api";
import { useFileSocket } from "../fileSocket";
import { bytes, fullTime } from "../format";
import { Btn, Empty, ErrorBox, Modal, PageHeader, Spinner } from "../components/ui.jsx";

const isDir = (e) => e.type === "dir" || e.type === "linkdir";

/** Operations tray state: every file operation gets a row with a spinner, progress and final result. */
function useOps() {
  const [ops, setOps] = useState([]);
  const patch = (id, p) => setOps((o) => o.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const start = useCallback((label) => {
    const id = Math.random().toString(36).slice(2);
    setOps((o) => [...o, { id, label, status: "running", pct: null, msg: "" }]);
    return {
      progress: (pct, msg) => patch(id, { pct, ...(msg ? { msg } : {}) }),
      ok: (msg = "Done") => { patch(id, { status: "ok", pct: 1, msg }); setTimeout(() => setOps((o) => o.filter((x) => x.id !== id)), 4000); },
      fail: (msg) => patch(id, { status: "error", msg }),
    };
  }, []);
  const dismiss = (id) => setOps((o) => o.filter((x) => x.id !== id));
  /** run(label, async (h) => result): wraps an operation with tray reporting; never throws. */
  const run = async (label, fn) => {
    const h = start(label);
    try { const r = await fn(h); h.ok(typeof r === "string" ? r : "Done"); return true; } catch (e) { h.fail(e.message || String(e)); return false; }
  };
  return { ops, run, dismiss };
}

function OpsTray({ ops, dismiss }) {
  if (!ops.length) return null;
  return (
    <div className="ops">
      {ops.map((o) => (
        <div key={o.id} className={`op ${o.status}`}>
          <div className="op-row">
            {o.status === "running" ? <Spinner /> : o.status === "ok" ? <Check size={15} className="okc" /> : <X size={15} className="critc" />}
            <span className="grow" title={o.label}>{o.label}</span>
            {o.pct != null && o.status === "running" && <span className="mono small">{Math.round(o.pct * 100)}%</span>}
            {o.status !== "running" && <button className="icon-btn" onClick={() => dismiss(o.id)}><X size={14} /></button>}
          </div>
          {o.status === "running" && <div className="bar"><div className="bar-fill" style={{ width: `${o.pct != null ? o.pct * 100 : 100}%`, opacity: o.pct != null ? 1 : 0.35 }} /></div>}
          {o.msg && <div className={`small ${o.status === "error" ? "critc" : "muted"}`}>{o.msg}</div>}
        </div>
      ))}
    </div>
  );
}

export default function Files() {
  const [params, setParams] = useSearchParams();
  const { data: vms = [] } = useQuery({ queryKey: ["vms"], queryFn: api.vms });
  const [pane, setPane] = useState({ left: { path: "." }, right: { path: "." } });
  const [sel, setSel] = useState({ left: new Set(), right: new Set() });
  const [version, setVersion] = useState(0);
  const [many, setMany] = useState(false);
  const ops = useOps();
  const cur = useRef({});                          // each pane reports its resolved absolute path (target for "copy to other pane")
  const left = Number(params.get("left")) || vms[0]?.id || null;
  const right = Number(params.get("right")) || vms.find((v) => v.id !== left)?.id || null;
  const setVm = (side, id) => {
    const next = new URLSearchParams(params);
    next.set(side, id);
    if (!next.get("left") && left) next.set("left", left);
    setParams(next, { replace: true });
    setPane((p) => ({ ...p, [side]: { path: "." } }));
    setSel((s) => ({ ...s, [side]: new Set() }));
  };
  const setPath = (side) => (path) => { setPane((p) => ({ ...p, [side]: { path } })); setSel((s) => ({ ...s, [side]: new Set() })); };
  if (vms.length === 0) return <><PageHeader title="Files" /><Empty icon={Folder} title="No VMs">Add a VM first.</Empty></>;
  return (
    <>
      <PageHeader title="Files (SFTP)" subtitle="Everything here runs over a live WebSocket to the server, with progress for each operation."
        actions={<Btn icon={Users} onClick={() => setMany(true)}>Upload to many VMs</Btn>} />
      <div className="panes">
        {["left", "right"].map((side) => {
          const id = side === "left" ? left : right;
          const other = side === "left" ? right : left;
          const otherSide = side === "left" ? "right" : "left";
          return (
            <FilePane key={side} side={side} vms={vms} vmId={id} path={pane[side].path} version={version} bump={() => setVersion((v) => v + 1)}
              onVm={(v) => setVm(side, v)} onPath={setPath(side)} selected={sel[side]} onSelected={(s) => setSel((x) => ({ ...x, [side]: s }))}
              cur={cur} ops={ops}
              copyTarget={other ? { vmId: other, name: vms.find((v) => v.id === other)?.name, getDir: () => cur.current[otherSide] } : null} />
          );
        })}
      </div>
      {many && <UploadMany vms={vms} ops={ops} onClose={() => setMany(false)} bump={() => setVersion((v) => v + 1)} />}
      <OpsTray ops={ops.ops} dismiss={ops.dismiss} />
    </>
  );
}

function FilePane({ side, vms, vmId, path, version, bump, onVm, onPath, selected, onSelected, copyTarget, cur, ops }) {
  const { fs, state } = useFileSocket(vmId);
  const fileInput = useRef(null);
  const seq = useRef(0);
  const [drop, setDrop] = useState(false);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [copyAll, setCopyAll] = useState(false);
  const [addr, setAddr] = useState(path);
  const here = listing?.path;

  useEffect(() => {
    if (!fs) return;
    const n = ++seq.current;
    setLoading(true); setError(null);
    fs.call("ls", { path })
      .then((d) => { if (n === seq.current) { setListing(d); setAddr(d.path); cur.current[side] = d.path; } })
      .catch((e) => { if (n === seq.current) setError(e); })
      .finally(() => { if (n === seq.current) setLoading(false); });
  }, [fs, path, version, side, cur]);
  useEffect(() => { setListing(null); }, [vmId]);

  const entries = listing?.entries || [];
  const chosen = entries.filter((e) => selected.has(e.path));
  const one = chosen.length === 1 ? chosen[0] : null;
  const toggle = (e, ev) => {
    const n = ev.ctrlKey || ev.metaKey || ev.target.type === "checkbox" ? new Set(selected) : new Set();
    n.has(e.path) ? n.delete(e.path) : n.add(e.path);
    onSelected(n);
  };
  const run = async (label, fn) => { const ok = await ops.run(label, fn); bump(); return ok; };

  const upload = async (files) => {
    for (const f of [...files]) await run(`Uploading ${f.name}`, (h) => fs.upload(f, here, (p) => h.progress(p, `${bytes(f.size)}`)));
  };
  const download = async () => {
    for (const e of chosen.filter((x) => !isDir(x))) {
      await ops.run(`Downloading ${e.name}`, async (h) => {
        const { blob, name } = await fs.download(e.path, (p) => h.progress(p));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      });
    }
  };
  const edit = (e) => ops.run(`Opening ${e.name}`, async () => { setEditing(await fs.call("read", { path: e.path })); });
  const mkdir = () => { const n = window.prompt("New folder name"); if (n) run(`Creating folder ${n}`, () => fs.call("mkdir", { path: `${here}/${n}` })); };
  const rename = () => { const n = window.prompt("Rename to", one.name); if (n && n !== one.name) run(`Renaming ${one.name}`, () => fs.call("rename", { src: one.path, dst: `${here}/${n}` })); };
  const remove = () => window.confirm(`Delete ${chosen.length} item(s)? This cannot be undone.`) && run(`Deleting ${chosen.length} item(s)`, async (h) => {
    await fs.call("rm", { paths: chosen.map((e) => e.path) }, { onProgress: (m) => h.progress(m.total ? m.done / m.total : null, m.message) });
    onSelected(new Set());
  });
  const copyOther = () => {
    const dir = copyTarget?.getDir();
    if (!dir) return ops.run("Copy", async () => { throw new Error("Open a folder in the other pane first"); });
    run(`Copying ${chosen.length} item(s) to ${copyTarget.name}`, async (h) => {
      const r = await fs.call("copy", { src_paths: chosen.map((e) => e.path), dst_vms: [copyTarget.vmId], dst_dir: dir }, { onProgress: (m) => h.progress(null, m.message) });
      const bad = r.results.filter((x) => !x.ok);
      if (bad.length) throw new Error(bad.map((b) => `${b.name}: ${b.error}`).join("; "));
      return `Copied to ${copyTarget.name}:${dir}`;
    });
  };

  return (
    <section className={`card pane ${drop ? "drop" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrop(true); }} onDragLeave={() => setDrop(false)}
      onDrop={(e) => { e.preventDefault(); setDrop(false); here && upload(e.dataTransfer.files); }}>
      <div className="row">
        <select className="compact" value={vmId || ""} onChange={(e) => onVm(Number(e.target.value))}>{vms.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <form className="grow row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); onPath(addr); }}>
          <input className="mono" value={addr} onChange={(e) => setAddr(e.target.value)} aria-label="Path" />
        </form>
        <span className="conn" title={`WebSocket: ${state}`}>{loading || state === "connecting" ? <Spinner size={14} /> : <i className={`dot ${state === "open" ? "ok" : "bad"}`} style={{ width: 8, height: 8, borderRadius: "50%", background: state === "open" ? "var(--ok)" : "var(--crit)", display: "inline-block" }} />}{state === "open" ? "live" : state}</span>
      </div>
      <div className="actions">
        <Btn className="sm" icon={ArrowUp} disabled={!listing?.parent} onClick={() => onPath(listing.parent)}>Up</Btn>
        <Btn className="sm" icon={RefreshCw} busy={loading} onClick={bump}>Refresh</Btn>
        <Btn className="sm" icon={FolderPlus} disabled={!here} onClick={mkdir}>Folder</Btn>
        <Btn className="sm" icon={Upload} disabled={!here} onClick={() => fileInput.current.click()}>Upload</Btn>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <Btn className="sm" icon={Download} disabled={!chosen.some((e) => !isDir(e))} onClick={download}>Download</Btn>
        <Btn className="sm" icon={FilePen} disabled={!one || isDir(one)} onClick={() => edit(one)}>Edit</Btn>
        <Btn className="sm" icon={Pencil} disabled={!one} onClick={rename}>Rename</Btn>
        <Btn className="sm danger" icon={Trash2} disabled={!chosen.length} onClick={remove}>Delete</Btn>
        <Btn className="sm" icon={ArrowRightLeft} disabled={!chosen.length || !copyTarget} onClick={copyOther}>Copy to {copyTarget?.name || "other pane"}</Btn>
        <Btn className="sm" icon={Copy} disabled={!chosen.length} onClick={() => setCopyAll(true)}>Copy to VMs…</Btn>
      </div>
      <ErrorBox error={error} />
      <div className="file-list">
        <div className="file-row head"><span /><span>Name</span><span>Size</span><span className="mtime">Modified</span></div>
        {loading && !listing && <div className="file-row"><span><Spinner /></span><span className="muted">Loading…</span></div>}
        {entries.map((e) => (
          <div key={e.path} className={`file-row ${selected.has(e.path) ? "sel" : ""}`} onClick={(ev) => toggle(e, ev)}
            onDoubleClick={() => (isDir(e) ? onPath(e.path) : e.size <= 1_000_000 && edit(e))}>
            <span><input type="checkbox" checked={selected.has(e.path)} readOnly /></span>
            <span className="name">{isDir(e) ? <Folder size={15} style={{ verticalAlign: -3, color: "var(--accent)" }} /> : e.type === "link" ? <Link2 size={15} style={{ verticalAlign: -3 }} /> : <FileIcon size={15} style={{ verticalAlign: -3, color: "var(--muted)" }} />} {e.name}</span>
            <span className="mono muted" title={`${e.size.toLocaleString()} B · mode ${e.mode}`}>{isDir(e) ? "" : bytes(e.size, 1)}</span>
            <span className="mono muted mtime">{e.mtime ? fullTime(new Date(e.mtime * 1000).toISOString()) : ""}</span>
          </div>
        ))}
        {listing && entries.length === 0 && <div className="file-row"><span /><span className="muted">Empty folder</span></div>}
      </div>
      <div className="muted small">{entries.length} items{chosen.length ? ` · ${chosen.length} selected` : ""} · double-click to open · Ctrl/⌘-click or tick boxes for multi-select · drop files to upload</div>
      {editing && <Editor fs={fs} file={editing} ops={ops} onClose={() => setEditing(null)} onSaved={bump} />}
      {copyAll && <CopyToVMs fs={fs} vms={vms} srcVm={vmId} paths={chosen.map((e) => e.path)} defaultDir={here} onClose={() => setCopyAll(false)} bump={bump} />}
    </section>
  );
}

function Editor({ fs, file, ops, onClose, onSaved }) {
  const [text, setText] = useState(file.content);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const save = async () => {
    setSaving(true); setErr(null);
    try { await fs.call("write", { path: file.path, content: text }); onSaved(); onClose(); }
    catch (e) { setErr(e); } finally { setSaving(false); }
  };
  return (
    <Modal title={file.path} onClose={onClose} wide>
      <textarea className="mono" rows={22} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "s" && (e.preventDefault(), save())} />
      <ErrorBox error={err} />
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn className="primary" busy={saving} disabled={text === file.content} onClick={save}>Save (Ctrl+S)</Btn>
      </div>
    </Modal>
  );
}

function VmChecks({ vms, sel, setSel }) {
  return (
    <>
      <div className="row"><button className="btn sm" onClick={() => setSel(new Set(vms.map((v) => v.id)))}>All</button><button className="btn sm" onClick={() => setSel(new Set())}>None</button></div>
      <div className="checks">{vms.map((v) => <label key={v.id} className="check"><input type="checkbox" checked={sel.has(v.id)}
        onChange={() => setSel((s) => { const n = new Set(s); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })} />{v.name}</label>)}</div>
    </>
  );
}

const Results = ({ results }) => <div className="stack" style={{ marginTop: 10 }}>{results.map((r) => <div key={r.vm_id} className={`alert ${r.ok ? "info" : "error"}`}><b>{r.name}</b>: {r.ok ? "done" : r.error}</div>)}</div>;

function CopyToVMs({ fs, vms, srcVm, paths, defaultDir, onClose, bump }) {
  const [sel, setSel] = useState(new Set());
  const [dir, setDir] = useState(defaultDir || ".");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const go = async () => {
    setBusy(true); setErr(null); setRes(null);
    try { const r = await fs.call("copy", { src_paths: paths, dst_vms: [...sel], dst_dir: dir }, { onProgress: (m) => setMsg(m.message || "") }); setRes(r.results); bump(); }
    catch (e) { setErr(e); } finally { setBusy(false); setMsg(""); }
  };
  return (
    <Modal title={`Copy ${paths.length} item(s) to VMs`} onClose={onClose}>
      <label>Destination directory on every target<input className="mono" value={dir} onChange={(e) => setDir(e.target.value)} /></label>
      <VmChecks vms={vms.filter((v) => v.id !== srcVm)} sel={sel} setSel={setSel} />
      <ErrorBox error={err} />
      {busy && <div className="alert info row"><Spinner />{msg || "Working…"}</div>}
      {res && <Results results={res} />}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
        <Btn onClick={onClose}>Close</Btn>
        <Btn className="primary" busy={busy} disabled={!sel.size || !dir} onClick={go}>{busy ? "Copying…" : `Copy to ${sel.size} VM(s)`}</Btn>
      </div>
    </Modal>
  );
}

function UploadMany({ vms, ops, onClose, bump }) {
  const [sel, setSel] = useState(new Set());
  const [dir, setDir] = useState("/tmp");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const go = async () => {
    setBusy(true); setErr(null); setRes(null);
    try { const r = await api.uploadMany([...sel], dir, files); setRes(r.results); bump(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Upload to many VMs" onClose={onClose}>
      <label>Files<input type="file" multiple onChange={(e) => setFiles([...e.target.files])} /></label>
      <label>Destination directory<input className="mono" value={dir} onChange={(e) => setDir(e.target.value)} /></label>
      <VmChecks vms={vms} sel={sel} setSel={setSel} />
      <ErrorBox error={err} />
      {busy && <div className="alert info row"><Spinner />Uploading to {sel.size} VM(s)…</div>}
      {res && <Results results={res} />}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
        <Btn onClick={onClose}>Close</Btn>
        <Btn className="primary" busy={busy} disabled={!sel.size || !files.length || !dir} onClick={go}>{busy ? "Uploading…" : `Upload to ${sel.size} VM(s)`}</Btn>
      </div>
    </Modal>
  );
}
