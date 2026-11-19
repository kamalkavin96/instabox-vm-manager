import { useEffect, useState } from "react";
import { wsUrl } from "./api";
import { track } from "./busy";

const CHUNK = 256 * 1024;

/** Request/response client for /api/ws/files/{vm}. One WebSocket per VM; every call is tracked as an operation. */
export class FileSocket {
  constructor(vmId, onState = () => {}) {
    this.vmId = vmId; this.onState = onState;
    this.next = 1; this.pending = new Map(); this.ws = null; this.opening = null; this.closed = false;
  }

  connect() {
    if (this.opening) return this.opening;
    this.onState("connecting");
    const p = new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl(`/ws/files/${this.vmId}`));
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      let ready = false;
      ws.onmessage = (e) => this._message(e, () => { ready = true; this.onState("open"); resolve(); }, (err) => { if (!ready) reject(new Error(err)); });
      ws.onerror = () => { if (!ready) reject(new Error("WebSocket connection failed")); };
      ws.onclose = () => {
        this.opening = null; this.ws = null;
        this.onState(this.closed ? "closed" : "disconnected");
        if (!ready) reject(new Error("Connection closed"));
        this.pending.forEach((x) => x.reject(new Error("Connection lost")));
        this.pending.clear();
      };
    });
    p.catch(() => { this.opening = null; });
    this.opening = p;
    return p;
  }

  _message(e, onReady, onFail) {
    if (typeof e.data === "string") {
      const m = JSON.parse(e.data);
      if (m.id === 0) { m.ok ? onReady() : onFail(m.error); return; }
      const p = this.pending.get(m.id);
      if (!p) return;
      if (m.type === "progress") { p.onProgress?.(m); return; }
      this.pending.delete(m.id);
      m.ok ? p.resolve(m.data) : p.reject(new Error(m.error));
    } else {
      const id = new DataView(e.data).getUint32(0);
      this.pending.get(id)?.onChunk?.(new Uint8Array(e.data, 4));
    }
  }

  async call(op, args = {}, handlers = {}) {
    await this.connect();
    const id = this.next++;
    const p = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, ...handlers });
      this.ws.send(JSON.stringify({ id, op, ...args }));
    });
    return track(p);
  }

  async upload(file, dir, onProgress) {
    await this.connect();
    const id = this.next++;
    const path = `${dir.replace(/\/$/, "")}/${file.name}`;
    const p = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      (async () => {
        this.ws.send(JSON.stringify({ id, op: "put", path, size: file.size }));
        let sent = 0;
        while (sent < file.size) {
          if (!this.pending.has(id)) return;                     // server already answered (error): stop sending
          const buf = new Uint8Array(await file.slice(sent, sent + CHUNK).arrayBuffer());
          const frame = new Uint8Array(4 + buf.length);
          new DataView(frame.buffer).setUint32(0, id);
          frame.set(buf, 4);
          while (this.ws && this.ws.bufferedAmount > 8 * CHUNK) await new Promise((r) => setTimeout(r, 20));
          if (!this.ws) throw new Error("Connection lost");
          this.ws.send(frame);
          sent += buf.length;
          onProgress?.(sent / file.size);
        }
        if (this.pending.has(id)) this.ws.send(JSON.stringify({ id, op: "put_end" }));
      })().catch((e) => { this.pending.delete(id); reject(e); });
    });
    return track(p);
  }

  async download(path, onProgress) {
    const chunks = [];
    let got = 0, total = 0;
    const data = await this.call("get", { path }, {
      onProgress: (m) => { total = m.total || total; },
      onChunk: (c) => { chunks.push(c); got += c.length; onProgress?.(total ? got / total : null); },
    });
    return { blob: new Blob(chunks), name: data.name };
  }

  close() { this.closed = true; this.ws?.close(); }
}

export function useFileSocket(vmId) {
  const [fs, setFs] = useState(null);
  const [state, setState] = useState("connecting");
  useEffect(() => {
    if (!vmId) { setFs(null); return; }
    const s = new FileSocket(vmId, setState);
    setFs(s);
    s.connect().catch(() => {});
    return () => { s.close(); setFs(null); };
  }, [vmId]);
  return { fs, state };
}
