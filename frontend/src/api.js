const KEY = "vmm_token";
export const getToken = () => sessionStorage.getItem(KEY) || "";
export const setToken = (t) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

async function req(path, opts = {}) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) },
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

export const api = {
  check: () => req("/auth/check"),
  vms: () => req("/vms"),
  vm: (id) => req(`/vms/${id}`),
  addVm: (b) => req("/vms", send("POST", b)),
  updateVm: (id, b) => req(`/vms/${id}`, send("PATCH", b)),
  deleteVm: (id) => req(`/vms/${id}`, send("DELETE")),
  refreshVm: (id) => req(`/vms/${id}/refresh`, send("POST")),
  refreshFleet: () => req("/fleet/refresh", send("POST")),
  metrics: (id, hours) => req(`/vms/${id}/metrics?hours=${hours}`),
  ports: () => req("/ports"),
  run: (b) => req("/commands", send("POST", b)),
  history: () => req("/commands/history"),
  instabox: () => req("/instabox/machines"),
};
