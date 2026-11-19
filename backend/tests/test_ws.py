"""File operations over WebSocket and the live events stream."""
import json

import pytest
from starlette.websockets import WebSocketDisconnect

from tests.test_terminal_files import fake_vm_port, vms  # noqa: F401  (fixtures)


def call(ws, rid, **msg):
    ws.send_text(json.dumps({"id": rid, **msg}))
    progress = []
    while True:
        m = json.loads(ws.receive_text())
        if m["id"] == rid and m.get("type") == "progress":
            progress.append(m)
            continue
        if m["id"] == rid:
            return m, progress


def open_files(client, vm_id):
    ws = client.websocket_connect(f"/api/ws/files/{vm_id}?token=test-token")
    return ws


def test_files_ws_full_cycle(client, vms, tmp_path):                      # noqa: F811
    d = str(tmp_path)
    with open_files(client, vms[0]) as ws:
        assert json.loads(ws.receive_text())["type"] == "ready"
        r, _ = call(ws, 1, op="mkdir", path=f"{d}/sub")
        assert r["ok"]
        # upload in chunks: start, binary frames prefixed with the transfer id, end
        ws.send_text(json.dumps({"id": 2, "op": "put", "path": f"{d}/big.bin", "size": 600_000}))
        for i in range(3):
            ws.send_bytes((2).to_bytes(4, "big") + bytes([i]) * 200_000)
        ws.send_text(json.dumps({"id": 2, "op": "put_end"}))
        r = json.loads(ws.receive_text())
        assert r["id"] == 2 and r["ok"] and r["data"]["size"] == 600_000
        assert (tmp_path / "big.bin").read_bytes() == b"".join(bytes([i]) * 200_000 for i in range(3))

        r, _ = call(ws, 3, op="ls", path=d)
        assert [e["name"] for e in r["data"]["entries"]] == ["sub", "big.bin"]

        # download: progress message, binary frames, final ok
        ws.send_text(json.dumps({"id": 4, "op": "get", "path": f"{d}/big.bin"}))
        got, total = b"", None
        while True:
            m = ws.receive()
            if m.get("bytes") is not None:
                assert int.from_bytes(m["bytes"][:4], "big") == 4
                got += m["bytes"][4:]
            else:
                j = json.loads(m["text"])
                if j.get("type") == "progress":
                    total = j["total"]
                else:
                    assert j["ok"] and j["data"]["name"] == "big.bin"
                    break
        assert total == 600_000 and got == (tmp_path / "big.bin").read_bytes()

        assert call(ws, 5, op="write", path=f"{d}/t.txt", content="héllo")[0]["ok"]
        assert call(ws, 6, op="read", path=f"{d}/t.txt")[0]["data"]["content"] == "héllo"
        assert call(ws, 7, op="rename", src=f"{d}/t.txt", dst=f"{d}/u.txt")[0]["ok"]
        r, _ = call(ws, 8, op="ls", path=f"{d}/nope")
        assert not r["ok"] and "No such file" in r["error"]
        r, _ = call(ws, 9, op="rm", paths=["/"])
        assert not r["ok"] and "root" in r["error"]
        r, prog = call(ws, 10, op="rm", paths=[f"{d}/u.txt", f"{d}/sub", f"{d}/big.bin"])
        assert r["ok"] and r["data"]["deleted"] == 3 and len(prog) == 3
        assert call(ws, 11, op="bogus")[0]["ok"] is False
        r, _ = call(ws, 12, op="get", path=d)
        assert not r["ok"] and "directory" in r["error"]
    assert list(tmp_path.iterdir()) == []


def test_files_ws_copy_between_vms(client, vms, tmp_path):                # noqa: F811
    src, dst = tmp_path / "s", tmp_path / "d"
    src.mkdir(); dst.mkdir()
    (src / "a.txt").write_text("AAA")
    with open_files(client, vms[0]) as ws:
        ws.receive_text()
        r, prog = call(ws, 1, op="copy", src_paths=[str(src / "a.txt")], dst_vms=[vms[1]], dst_dir=str(dst))
        assert r["ok"] and r["data"]["results"][0]["ok"] and prog
    assert (dst / "a.txt").read_text() == "AAA"


def test_files_ws_rejects_bad_token(client, vms):                          # noqa: F811
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/ws/files/{vms[0]}?token=bad") as ws:
            ws.receive_text()


def test_events_stream(client, vms):                                       # noqa: F811
    with client.websocket_connect(f"/api/ws/events?token=test-token&vm={vms[0]}") as ws:
        snap = json.loads(ws.receive_text())
        assert snap["type"] == "snapshot" and {v["id"] for v in snap["vms"]} >= set(vms)
        mine = next(v for v in snap["vms"] if v["id"] == vms[0])
        other = next(v for v in snap["vms"] if v["id"] == vms[1])
        assert "latest" in mine and "latest" not in other                  # heavy snapshot only for the watched VM
        client.post(f"/api/vms/{vms[1]}/refresh")
        ev = json.loads(ws.receive_text())
        assert ev["type"] == "vm" and ev["vm"]["id"] == vms[1] and ev["vm"]["summary"]["cpu"] is not None
        assert "latest" not in ev["vm"]
        client.post(f"/api/vms/{vms[0]}/refresh")
        ev = json.loads(ws.receive_text())
        assert ev["vm"]["id"] == vms[0] and ev["vm"]["latest"]["cpu"]["percent"] is not None
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ws/events?token=bad") as ws:
            ws.receive_text()
