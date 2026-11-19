// Small in-memory history of live samples per VM, used for dashboard sparklines.
const store = new Map();
export function pushSample(id, s) {
  const a = store.get(id) || [];
  if (a.length && a[a.length - 1].t === s.collected_at) return;
  a.push({ t: s.collected_at, cpu: s.cpu ?? 0, mem: s.mem ?? 0 });
  if (a.length > 45) a.shift();
  store.set(id, a);
}
export const getSeries = (id, key) => (store.get(id) || []).map((p) => p[key]);
