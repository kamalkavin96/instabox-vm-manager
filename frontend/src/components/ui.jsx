import { useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useIsMutating } from "@tanstack/react-query";
import { useBusy } from "../busy";

export function Bar({ label, value, right }) {
  const v = value == null ? 0 : Math.min(100, Math.max(0, value));
  const tone = v >= 90 ? "crit" : v >= 75 ? "warn" : "ok";
  return (
    <div className="bar-row">
      <span className="bar-label" title={label}>{label}</span>
      <div className="bar"><div className={`bar-fill ${tone}`} style={{ width: `${v}%` }} /></div>
      <span className="bar-val mono">{right ?? (value == null ? "-" : `${Number(value).toFixed(2)}%`)}</span>
    </div>
  );
}

export const StatusBadge = ({ status, enabled = true }) => {
  const s = enabled ? status : "disabled";
  return <span className={`badge ${s}`}><i className="dot" />{s}</span>;
};

export const Alerts = ({ alerts = [] }) =>
  alerts.length ? <div className="chips">{alerts.map((a, i) => <span key={i} className={`chip ${a.level}`}>{a.message}</span>)}</div> : null;

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

export const ErrorBox = ({ error }) => (error ? <div className="alert error">{String(error.message || error)}</div> : null);
export const Empty = ({ icon: Icon, title, children }) => (
  <div className="empty">{Icon && <Icon size={28} />}<strong>{title}</strong><span>{children}</span></div>
);
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-head"><div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div><div className="actions">{actions}</div></div>
);
export const Card = ({ title, actions, children, className = "" }) => (
  <section className={`card ${className}`}>
    {(title || actions) && <div className="card-head"><h3>{title}</h3><div className="actions">{actions}</div></div>}
    {children}
  </section>
);
export const KV = ({ rows }) => (
  <dl className="kv">{rows.filter(Boolean).map(([k, v, title]) => <div key={k}><dt>{k}</dt><dd className="mono" title={title}>{v ?? "-"}</dd></div>)}</dl>
);

export function CopyButton({ text, label }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="icon-btn" title="Copy" onClick={async (e) => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch {}
    }}>{ok ? <Check size={15} /> : <Copy size={15} />}{label}</button>
  );
}

/* tiny toast bus */
export const toast = (message, kind = "info") => window.dispatchEvent(new CustomEvent("vmm-toast", { detail: { message, kind, id: Math.random() } }));
export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const h = (e) => {
      setItems((x) => [...x.slice(-3), e.detail]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== e.detail.id)), 6000);
    };
    window.addEventListener("vmm-toast", h);
    return () => window.removeEventListener("vmm-toast", h);
  }, []);
  return <div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}</div>;
}

export const Spinner = ({ size = 15 }) => <Loader2 size={size} className="spin" aria-label="Working" />;

/** Button that swaps its icon for a spinner and disables itself while `busy`. */
export function Btn({ busy, icon: Icon, children, className = "", ...p }) {
  return (
    <button className={`btn ${className}`} {...p} disabled={busy || p.disabled}>
      {busy ? <Spinner /> : Icon && <Icon size={15} />}{children}
    </button>
  );
}

/** Thin animated line at the top of the page while any operation is in flight. */
export function ProgressLine() {
  const busy = useBusy() + useIsMutating();
  return <div className={`progress-line ${busy ? "on" : ""}`} role="progressbar" aria-hidden={!busy} />;
}

export function Sparkline({ data, color = "var(--accent)" }) {
  if (!data || data.length < 2) return <div className="spark" />;
  const w = 100, h = 24;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(2)},${(h - (Math.min(100, v) / 100) * h).toFixed(2)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
