const tz = () => new Date().toLocaleTimeString("en", { timeZoneName: "short" }).split(" ").pop();

/** Exact local date-time: 2026-11-18 14:03:22 IST (optionally with milliseconds). */
export function fullTime(iso, ms = false) {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const base = d.toLocaleString("sv-SE", { hour12: false });
  return `${base}${ms ? "." + String(d.getMilliseconds()).padStart(3, "0") : ""} ${tz()}`;
}
export const n2 = (v, d = 2) => (v == null || isNaN(v) ? "-" : Number(v).toFixed(d));
export const pct = (v) => (v == null ? "-" : `${Number(v).toFixed(2)}%`);
export const int = (v) => (v == null ? "-" : Number(v).toLocaleString());

export function bytes(n, digits = 2) {
  if (n == null) return "-";
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(digits)} ${u[i]}`;
}
export const bytesExact = (n) => (n == null ? "-" : `${Number(n).toLocaleString()} B`);
export const rate = (bps) => (bps == null ? "-" : `${bytes(bps)}/s`);

export function uptime(s) {
  if (s == null) return "-";
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${d ? d + "d " : ""}${h}h ${m}m ${x}s`;
}
export function ago(iso) {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return `${Math.round(s)}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
