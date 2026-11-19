import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { wsUrl } from "../api";
import { useTheme } from "../theme.jsx";

const THEMES = {
  dark: { background: "#0b0e14", foreground: "#d6deeb", cursor: "#7fdbca", selectionBackground: "#264f78" },
  light: { background: "#ffffff", foreground: "#1f2328", cursor: "#0969da", selectionBackground: "#b6d6fd",
    black: "#24292f", brightBlack: "#57606a", white: "#6e7781", brightWhite: "#24292f" },
};
const enc = new TextEncoder();

/** One xterm.js terminal bound to one VM over a WebSocket. Exposes send()/focus()/reconnect() to the parent. */
const TermPane = forwardRef(function TermPane({ vm, fontSize, focused, maximized, onInput, onFocus, onClose, onToggleMax }, ref) {
  const host = useRef(null);
  const term = useRef(null);
  const fit = useRef(null);
  const ws = useRef(null);
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  const { resolved } = useTheme();
  const [status, setStatus] = useState("connecting");
  const [nonce, setNonce] = useState(0);

  useImperativeHandle(ref, () => ({
    send: (s) => { if (ws.current?.readyState === 1) ws.current.send(enc.encode(s)); },
    focus: () => term.current?.focus(),
    reconnect: () => setNonce((n) => n + 1),
  }));

  useEffect(() => {
    const t = new Terminal({ cursorBlink: true, fontSize, scrollback: 5000, theme: THEMES[resolved], allowProposedApi: true,
      fontFamily: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace" });
    const f = new FitAddon();
    t.loadAddon(f);
    t.loadAddon(new WebLinksAddon());
    t.open(host.current);
    try { f.fit(); } catch {}
    term.current = t; fit.current = f;
    setStatus("connecting");
    const sock = new WebSocket(wsUrl(`/ws/terminal/${vm.id}`, { cols: t.cols, rows: t.rows }));
    sock.binaryType = "arraybuffer";
    ws.current = sock;
    sock.onopen = () => setStatus("connected");
    sock.onmessage = (e) => {
      if (typeof e.data === "string") {
        try { const m = JSON.parse(e.data); if (m.type === "error") t.writeln(`\r\n\x1b[31m${m.message}\x1b[0m`); } catch {}
      } else t.write(new Uint8Array(e.data));
    };
    sock.onclose = (e) => { setStatus(e.code === 4401 ? "unauthorized" : "closed"); t.writeln("\r\n\x1b[2m[session closed]\x1b[0m"); };
    const d = t.onData((data) => {
      if (sock.readyState === 1) sock.send(enc.encode(data));
      onInputRef.current?.(vm.id, data);
    });
    const resize = () => {
      try { f.fit(); } catch { return; }
      if (sock.readyState === 1) sock.send(JSON.stringify({ type: "resize", cols: t.cols, rows: t.rows }));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host.current);
    return () => { ro.disconnect(); d.dispose(); sock.close(); t.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.id, nonce]);

  useEffect(() => { if (term.current) term.current.options.theme = THEMES[resolved]; }, [resolved]);
  useEffect(() => {
    if (term.current) { term.current.options.fontSize = fontSize; try { fit.current.fit(); } catch {} }
  }, [fontSize]);

  return (
    <div className={`term-pane ${focused ? "focus" : ""} ${maximized ? "max" : ""}`} onMouseDown={onFocus}>
      <div className="term-head">
        <strong className="grow">{vm.name}</strong>
        <span className={`badge ${status === "connected" ? "online" : status === "connecting" ? "" : "offline"}`}><i className="dot" />{status}</span>
        <button className="icon-btn" title="Reconnect" onClick={() => setNonce((n) => n + 1)}><RotateCw size={15} /></button>
        <button className="icon-btn" title={maximized ? "Restore" : "Maximize"} onClick={onToggleMax}>{maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        <button className="icon-btn" title="Close" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="term-body"><div ref={host} style={{ height: "100%" }} /></div>
    </div>
  );
});
export default TermPane;
