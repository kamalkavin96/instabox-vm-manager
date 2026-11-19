"""Terminal WebSocket + SFTP + multi-VM copy, against an in-process SSH server that behaves like a VM:
no-password auth, commands run in a local bash, no-command sessions echo (PTY), SFTP serves the local disk."""
import asyncio
import os
import threading

import asyncssh
import pytest

from app import ssh


class NoAuth(asyncssh.SSHServer):
    def begin_auth(self, username):
        return False


async def handle(process):
    cmd = process.command
    if cmd:
        p = await asyncio.create_subprocess_exec("bash", "-c", cmd, stdout=asyncio.subprocess.PIPE,
                                                 stderr=asyncio.subprocess.PIPE)
        out, err = await p.communicate()
        process.stdout.write(out)
        process.stderr.write(err)
        process.exit(p.returncode)
        return
    process.stdout.write(b"READY\r\n")
    while True:
        try:
            data = await process.stdin.read(1024)
        except asyncssh.TerminalSizeChanged as size:       # window-change arrives as an exception in asyncssh servers
            process.stdout.write(f"size:{size.width}x{size.height}\r\n".encode())
            continue
        if not data:
            break
        process.stdout.write(b"echo:" + data)
    process.exit(0)


@pytest.fixture(scope="module")
def fake_vm_port():
    ready, box = threading.Event(), {}

    def run():
        async def main():
            srv = await asyncssh.listen("127.0.0.1", 0, server_factory=NoAuth, process_factory=handle, encoding=None,
                                        server_host_keys=[asyncssh.generate_private_key("ssh-ed25519")],
                                        sftp_factory=True, allow_scp=True)
            box["port"] = srv.sockets[0].getsockname()[1]
            ready.set()
            await asyncio.Event().wait()
        asyncio.run(main())

    threading.Thread(target=run, daemon=True).start()
    assert ready.wait(10)
    return box["port"]


@pytest.fixture
def vms(client, fake_vm_port, monkeypatch):
    monkeypatch.setattr(ssh, "_pool", ssh.SSHPool())        # real asyncssh pool for these tests
    ids = []
    for n in ("tf-a", "tf-b"):
        r = client.post("/api/vms", json={"name": n, "ssh_command": f"ssh code-{n}@127.0.0.1 -p {fake_vm_port}"})
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    yield ids
    for i in ids:
        client.delete(f"/api/vms/{i}")


def test_terminal_websocket(client, vms):
    with client.websocket_connect(f"/api/ws/terminal/{vms[0]}?token=test-token&cols=100&rows=30") as ws:
        assert b"READY" in ws.receive_bytes()
        ws.send_bytes(b"htop\n")
        assert ws.receive_bytes() == b"echo:htop\n"
        ws.send_text('{"type":"resize","cols":120,"rows":40}')
        assert ws.receive_bytes() == b"size:120x40\r\n"           # resize reached the remote PTY
        ws.send_bytes(b"x")
        assert ws.receive_bytes() == b"echo:x"
    from app.workers import manager
    assert manager.workers[vms[0]].terminals == 0              # counter restored after disconnect


def test_terminal_rejects_bad_token(client, vms):
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/ws/terminal/{vms[0]}?token=bad") as ws:
            ws.receive_bytes()


def test_sftp_roundtrip(client, vms, tmp_path):
    a = vms[0]
    d = str(tmp_path)
    assert client.post(f"/api/vms/{a}/fs/mkdir", json={"path": f"{d}/sub"}).status_code == 200
    r = client.post(f"/api/vms/{a}/fs/upload", params={"path": d}, files=[("files", ("hello.txt", b"hi there"))])
    assert r.status_code == 200 and r.json()["saved"] == ["hello.txt"]
    ls = client.get(f"/api/vms/{a}/fs", params={"path": d}).json()
    assert [e["name"] for e in ls["entries"]] == ["sub", "hello.txt"] and ls["entries"][0]["type"] == "dir"
    r = client.get(f"/api/vms/{a}/fs/get", params={"path": f"{d}/hello.txt", "token": "test-token"})
    assert r.content == b"hi there" and "hello.txt" in r.headers["content-disposition"]
    bad = {"Authorization": "Bearer wrong"}
    assert client.get(f"/api/vms/{a}/fs/get", params={"path": f"{d}/hello.txt"}, headers=bad).status_code == 401
    assert client.get(f"/api/vms/{a}/fs/get", params={"path": f"{d}/hello.txt", "token": "test-token"},
                      headers=bad).status_code == 200
    assert client.get(f"/api/vms/{a}/fs/get", params={"path": d, "token": "test-token"}).status_code == 400
    assert client.put(f"/api/vms/{a}/fs/write", json={"path": f"{d}/hello.txt", "content": "edited"}).status_code == 200
    assert client.get(f"/api/vms/{a}/fs/read", params={"path": f"{d}/hello.txt"}).json()["content"] == "edited"
    assert client.post(f"/api/vms/{a}/fs/rename", json={"src": f"{d}/hello.txt", "dst": f"{d}/renamed.txt"}).status_code == 200
    assert client.get(f"/api/vms/{a}/fs", params={"path": f"{d}/nope"}).status_code == 404
    assert client.delete(f"/api/vms/{a}/fs", params={"path": "/"}).status_code == 422
    assert client.delete(f"/api/vms/{a}/fs", params={"path": f"{d}/renamed.txt"}).status_code == 200
    assert client.delete(f"/api/vms/{a}/fs", params={"path": f"{d}/sub"}).status_code == 200
    assert os.listdir(d) == []


def test_copy_and_upload_many(client, vms, tmp_path):
    src, dst = tmp_path / "src", tmp_path / "dst"
    (src / "folder").mkdir(parents=True); dst.mkdir()
    (src / "a.txt").write_text("AAA"); (src / "folder" / "b.txt").write_text("BBB")
    r = client.post("/api/files/copy", json={"src_vm": vms[0], "src_paths": [str(src / "a.txt"), str(src / "folder")],
                                             "dst_vms": [vms[1]], "dst_dir": str(dst)})
    assert r.status_code == 200 and all(x["ok"] for x in r.json()["results"]), r.text
    assert (dst / "a.txt").read_text() == "AAA" and (dst / "folder" / "b.txt").read_text() == "BBB"
    up = tmp_path / "up"; up.mkdir()
    r = client.post("/api/files/upload-many", data={"vm_ids": f"{vms[0]},{vms[1]}", "path": str(up)},
                    files=[("files", ("m.txt", b"many"))])
    assert [x["ok"] for x in r.json()["results"]] == [True, True] and (up / "m.txt").read_bytes() == b"many"


def test_preview_and_link(client, vms):
    r = client.get(f"/api/vms/{vms[0]}/preview")
    assert r.status_code == 200 and r.json()["source"] == "ssh" and isinstance(r.json()["listening"], list)
    assert client.post(f"/api/vms/{vms[0]}/link", json={"instabox_id": "m_test"}).json()["instabox_id"] == "m_test"
    r = client.get(f"/api/vms/{vms[0]}/preview", params={"source": "rest"})
    assert r.status_code == 200 and r.json()["errors"]          # no API key configured -> clear error, no crash
    assert client.post(f"/api/vms/{vms[0]}/preview/publish", json={"port": 3000}).status_code == 503
    assert client.get("/api/workers").status_code == 200
    r = client.get(f"/api/vms/{vms[0]}/live")
    assert r.status_code == 200 and r.json()["latest"]["cpu"]["percent"] is not None
