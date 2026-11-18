import { useEffect } from "react";

export function Bar({ label, value, suffix = "%" }) {
  const v = value == null ? 0 : Math.min(100, Math.max(0, value));
  const tone = v >= 90 ? "crit" : v >= 75 ? "warn" : "ok";
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar"><div className={`bar-fill ${tone}`} style={{ width: `${v}%` }} /></div>
      <span className="bar-val">{value == null ? "-" : `${Math.round(value)}${suffix}`}</span>
    </div>
  );
}

export const Status = ({ status }) => <span className={`dot ${status}`} title={status} />;

export const Alerts = ({ alerts = [] }) =>
  alerts.length ? (
    <div className="alerts">
      {alerts.map((a, i) => <span key={i} className={`chip ${a.level}`}>{a.message}</span>)}
    </div>
  ) : null;

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button className="ghost" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

export const ErrorBox = ({ error }) => (error ? <div className="error">{String(error.message || error)}</div> : null);
export const Empty = ({ children }) => <div className="empty">{children}</div>;
