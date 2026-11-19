import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../theme.jsx";
import fx from "./fixtures.json";
import Dashboard from "../pages/Dashboard.jsx";
import VMDetail from "../pages/VMDetail.jsx";
import Ports from "../pages/Ports.jsx";
import Files from "../pages/Files.jsx";
import Instabox from "../pages/Instabox.jsx";
import Settings from "../pages/Settings.jsx";
import Commands from "../pages/Commands.jsx";

const routes = {
  "/api/vms": [fx.vm, fx.vm2],
  "/api/vms/1": fx.vm,
  "/api/ports": fx.vm.latest.ports.map((p) => ({ ...p, vm_id: 1, vm: "VM-1", status: "online", instabox_id: "m_abc" })),
  "/api/instabox/published": { ports: [{ port: 3000, url: "https://3000-m_abc.instabox.tech", derived: false, vm_id: 1, vm: "VM-1" }], errors: [] },
  "/api/instabox/status": { configured: true, source: "saved", key_hint: "ibk_…wxyz" },
  "/api/instabox/account": { usage: { machines: 2, storedBytes: 6442450944, computedAt: "2026-10-13T10:00:00Z", limits: { machines: 5 } } },
  "/api/instabox/machines": [{ id: "m_abc", name: "vm-1", state: "running", template: "universal", vcpus: 2, mem_mib: 4096, disk_gib: 20, vm_id: 1, vm_name: "VM-1" }],
  "/api/workers": { 1: { running: true, polls: 4, failures: 0, last_duration: 1.2, last_poll_at: "2026-11-18T10:00:00+00:00", terminals: 0, last_error: null } },
  "/api/commands/history": [],
  "/api/vms/1/preview": { instabox_id: "m_abc", source: "rest", listening: fx.vm.latest.ports, published: [{ port: 3000, url: "https://3000-m_abc.instabox.tech", derived: false }], cli: null, errors: [] },
  "/api/vms/1/metrics": [],
  "/api/vms/1/fs": { path: "/home/user", parent: "/home", entries: [{ name: "docs", path: "/home/user/docs", type: "dir", size: 4096, mtime: 1760000000, mode: "755" }, { name: "a.txt", path: "/home/user/a.txt", type: "file", size: 12, mtime: 1760000000, mode: "644" }] },
};
const fsData = routes["/api/vms/1/fs"];
class FakeWS {                                    // stands in for the server's /ws/events and /ws/files/{id} sockets
  static instances = [];
  constructor(url) {
    this.url = url; this.readyState = 0; FakeWS.instances.push(this);
    setTimeout(() => {
      this.readyState = 1; this.onopen?.();
      if (url.includes("/ws/events")) this.emit({ type: "snapshot", vms: [fx.vm, fx.vm2] });
      if (url.includes("/ws/files/")) this.emit({ id: 0, ok: true, type: "ready" });
    }, 0);
  }
  emit(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  send(d) { const m = JSON.parse(d); if (m.op === "ls") setTimeout(() => this.emit({ id: m.id, ok: true, data: fsData }), 0); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
}
beforeEach(() => {
  FakeWS.instances = [];
  globalThis.WebSocket = FakeWS;
  sessionStorage.setItem("vmm_token", "t");
  globalThis.fetch = vi.fn(async (url) => {
    const path = String(url).split("?")[0];
    const body = routes[path] ?? routes[path.replace(/\/vms\/\d+\/fs$/, "/vms/1/fs")];
    if (body === undefined) return new Response(JSON.stringify({ detail: "not mocked " + path }), { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  });
});
const mount = (ui, at = "/") => render(
  <ThemeProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[at]}><Routes><Route path="/vm/:id" element={ui} /><Route path="*" element={ui} /></Routes></MemoryRouter>
  </QueryClientProvider></ThemeProvider>);

describe("pages render with real backend data shapes", () => {
  it("Dashboard updates live when the server pushes a sample", async () => {
    mount(<Dashboard />);
    await screen.findByText("VM-1");
    const ws = FakeWS.instances.find((w) => w.url.includes("/ws/events"));
    await waitFor(() => expect(screen.getAllByText(/Live/).length).toBeGreaterThan(0));
    act(() => ws.emit({ type: "vm", vm: { ...fx.vm, latest: undefined, summary: { ...fx.vm.summary, cpu: 42.42 } } }));
    expect(await screen.findAllByText("42.42%")).toBeTruthy();
    act(() => ws.emit({ type: "vm_removed", id: 2 }));
    await waitFor(() => expect(screen.queryByText("VM-2")).toBeNull());
  });
  it("Dashboard shows exact metrics and flags duplicate machines", async () => {
    mount(<Dashboard />);
    expect(await screen.findByText("VM-1")).toBeTruthy();
    expect(await screen.findByText(/report the/)).toBeTruthy();           // fx.vm and fx.vm2 share a boot id
    expect(document.body.textContent).toMatch(/\d+\.\d{2}%/);             // two-decimal percentages
  });
  it.each(["Overview", "Storage", "History", "Ports & URLs", "Processes", "Run"])("VM detail tab %s", async (tab) => {
    mount(<VMDetail />, "/vm/1");
    const btn = await screen.findByRole("button", { name: tab });
    btn.click();
    await waitFor(() => expect(document.querySelector(".tabs button.active").textContent).toBe(tab));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.body.textContent).not.toMatch(/Something went wrong|undefined/);
  });
  it("Ports shows the InstaBox preview URL", async () => {
    mount(<Ports />);
    expect(await screen.findByText("3000-m_abc.instabox.tech")).toBeTruthy();
  });
  it("Files lists the directory", async () => {
    mount(<Files />, "/files?left=1&right=1");
    expect((await screen.findAllByText("a.txt")).length).toBeGreaterThan(0);
  });
  it("InstaBox page shows account, machines and link", async () => {
    mount(<Instabox />);
    expect(await screen.findByText("Machines (1)")).toBeTruthy();
    expect(await screen.findByText(/Stored Bytes/)).toBeTruthy();
  });
  it("Settings shows workers", async () => { mount(<Settings />); expect(await screen.findByText("running")).toBeTruthy(); });
  it("Commands renders", async () => { mount(<Commands />); expect(await screen.findByText(/Run on/)).toBeTruthy(); });
});
