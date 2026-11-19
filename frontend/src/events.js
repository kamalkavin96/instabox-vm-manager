import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wsUrl } from "./api";
import { pushSample } from "./series";

const strip = ({ latest, ...rest }) => rest;

/** Live fleet updates pushed by the server over a WebSocket. With {vm}, that VM's full snapshot is pushed too. */
export function useEvents({ vm = 0 } = {}) {
  const qc = useQueryClient();
  const [state, setState] = useState("connecting");
  const [lastEvent, setLast] = useState(null);
  useEffect(() => {
    let ws, stop = false, retry = 0, timer;
    const apply = (v) => {
      if (v.latest) qc.setQueryData(["vm", v.id], v);
      else qc.setQueryData(["vm", v.id], (old) => (old ? { ...old, ...v } : old));
      qc.setQueryData(["vms"], (old = []) => {
        const light = strip(v);
        return old.some((x) => x.id === v.id)
          ? old.map((x) => (x.id === v.id ? light : x))
          : [...old, light].sort((a, b) => a.name.localeCompare(b.name));
      });
      if (v.summary) pushSample(v.id, v.summary);
    };
    const open = () => {
      ws = new WebSocket(wsUrl("/ws/events", vm ? { vm } : {}));
      ws.onopen = () => { retry = 0; setState("live"); };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === "snapshot") {
          qc.setQueryData(["vms"], m.vms.map(strip));
          m.vms.forEach((v) => { if (v.latest) qc.setQueryData(["vm", v.id], v); if (v.summary) pushSample(v.id, v.summary); });
        } else if (m.type === "vm") apply(m.vm);
        else if (m.type === "vm_removed") qc.setQueryData(["vms"], (old = []) => old.filter((x) => x.id !== m.id));
        setLast(Date.now());
      };
      ws.onclose = (ev) => {
        setState("reconnecting");
        if (ev.code === 4401) window.dispatchEvent(new Event("vmm-unauthorized"));
        else if (!stop) timer = setTimeout(open, Math.min(10000, 500 * 2 ** retry++));
      };
    };
    open();
    return () => { stop = true; clearTimeout(timer); ws && ws.close(); };
  }, [vm, qc]);
  return { state, lastEvent };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
