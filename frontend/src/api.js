const KEY = "vmm_token";
export const getToken = () => sessionStorage.getItem(KEY) || "";
export const setToken = (t) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

import { track } from "./busy";

function req(path, opts = {}) {
  const p = doReq(path, opts);
  return opts.method && opts.method !== "GET" ? track(p) : p;
}

async function doReq(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch("/api" + path, {
    ...opts,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("vmm-unauthorized"));
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

const send = (method, body) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
const q = (o) => new URLSearchParams(o).toString();

export function wsUrl(path, params = {}) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api${path}?${q({ ...params, token: getToken() })}`;
}
export const downloadUrl = (id, path) => `/api/vms/${id}/fs/get?${q({ path, token: getToken() })}`;

export const api = {
  check: () => req("/auth/check"),
  vms: () => req("/vms"),
  vm: (id) => req(`/vms/${id}`),
  live: (id) => req(`/vms/${id}/live`),
  addVm: (b) => req("/vms", send("POST", b)),
  updateVm: (id, b) => req(`/vms/${id}`, send("PATCH", b)),
  deleteVm: (id) => req(`/vms/${id}`, send("DELETE")),
  refreshVm: (id) => req(`/vms/${id}/refresh`, send("POST")),
  refreshFleet: () => req("/fleet/refresh", send("POST")),
  workers: () => req("/workers"),
  metrics: (id, hours) => req(`/vms/${id}/metrics?hours=${hours}`),
  ports: () => req("/ports"),
  preview: (id, source) => req(`/vms/${id}/preview?source=${source}`),
  publish: (id, port) => req(`/vms/${id}/preview/publish`, send("POST", { port })),
  unpublish: (id, port) => req(`/vms/${id}/preview/${port}`, send("DELETE")),
  linkVm: (id, instabox_id) => req(`/vms/${id}/link`, send("POST", { instabox_id })),
  run: (b) => req("/commands", send("POST", b)),
  history: () => req("/commands/history"),
  // InstaBox
  ibStatus: () => req("/instabox/status"),
  ibSaveKey: (key) => req("/instabox/key", send("PUT", { key })),
  ibRemoveKey: () => req("/instabox/key", send("DELETE")),
  ibAccount: () => req("/instabox/account"),
  ibMachines: () => req("/instabox/machines"),
  ibAutolink: () => req("/instabox/autolink", send("POST")),
  ibPorts: (mid) => req(`/instabox/machines/${mid}/ports`),
  ibPublish: (mid, port) => req(`/instabox/machines/${mid}/ports`, send("POST", { port })),
  ibUnpublish: (mid, port) => req(`/instabox/machines/${mid}/ports/${port}`, send("DELETE")),
  ibPublished: () => req("/instabox/published"),
  // files
  ls: (id, path) => req(`/vms/${id}/fs?${q({ path })}`),
  mkdir: (id, path) => req(`/vms/${id}/fs/mkdir`, send("POST", { path })),
  rename: (id, src, dst) => req(`/vms/${id}/fs/rename`, send("POST", { src, dst })),
  rm: (id, path) => req(`/vms/${id}/fs?${q({ path })}`, send("DELETE")),
  readFile: (id, path) => req(`/vms/${id}/fs/read?${q({ path })}`),
  writeFile: (id, path, content) => req(`/vms/${id}/fs/write`, { method: "PUT", body: JSON.stringify({ path, content }) }),
  upload: (id, path, files) => {
    const f = new FormData();
    [...files].forEach((x) => f.append("files", x));
    return req(`/vms/${id}/fs/upload?${q({ path })}`, { method: "POST", body: f });
  },
  uploadMany: (vmIds, path, files) => {
    const f = new FormData();
    f.append("vm_ids", vmIds.join(","));
    f.append("path", path);
    [...files].forEach((x) => f.append("files", x));
    return req("/files/upload-many", { method: "POST", body: f });
  },
  copy: (src_vm, src_paths, dst_vms, dst_dir) => req("/files/copy", send("POST", { src_vm, src_paths, dst_vms, dst_dir })),
};
