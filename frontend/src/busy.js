import { useSyncExternalStore } from "react";

let n = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

/** Mark a promise as an in-flight operation; the top progress line shows while any are running. */
export function track(p) {
  n++; emit();
  const done = () => { n--; emit(); };
  p.then(done, done);
  return p;
}
export const useBusy = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => n);
