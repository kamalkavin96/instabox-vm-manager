"""File operations over one WebSocket per VM.

Client -> server (text JSON): {"id": N, "op": "ls|read|write|mkdir|rename|rm|copy|get|put|put_end|abort", ...args}
Client -> server (binary):   4-byte big-endian transfer id + file bytes (upload chunks after a "put")
Server -> client (text):     {"id", "ok": true, "data": ...} | {"id", "ok": false, "error": "..."} | {"id", "type": "progress", ...}
Server -> client (binary):   4-byte transfer id + file bytes (download chunks for a "get")
"""
import asyncio
import json
import posixpath

import asyncssh
from fastapi import APIRouter, HTTPException, Query, WebSocket
from sqlalchemy import select

from ..db import SessionLocal, VM
from ..monitor import target_for
from ..security import token_ok
from ..ssh import get_pool
from .files import CHUNK, MAX_EDIT_BYTES, _guard, _sftp_error, copy_between, list_dir_data

router = APIRouter()


def error_text(e: Exception) -> str:
    if isinstance(e, HTTPException):
        return str(e.detail)
    if isinstance(e, asyncssh.Error):
        return str(_sftp_error(e).detail)
    return f"{type(e).__name__}: {e}"


class Upload:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=32)
        self.failed = False
        self.task: asyncio.Task | None = None


@router.websocket("/api/ws/files/{vm_id}")
async def files_ws(ws: WebSocket, vm_id: int, token: str = Query("")):
    if not token_ok(token):
        await ws.close(code=4401)
        return
    await ws.accept()
    async with SessionLocal() as s:
        vm = await s.get(VM, vm_id)
        target = target_for(vm) if vm else None
    send_lock = asyncio.Lock()

    async def send_json(obj):
        async with send_lock:
            await ws.send_text(json.dumps(obj))

    async def send_bin(tid: int, data: bytes):
        async with send_lock:
            await ws.send_bytes(tid.to_bytes(4, "big") + data)

    if target is None:
        await send_json({"id": 0, "ok": False, "error": "VM not found"})
        await ws.close(code=4404)
        return
    try:
        conn = await get_pool().connection(vm_id, target)
        sftp = await conn.start_sftp_client()
    except (asyncssh.Error, OSError, asyncio.TimeoutError) as e:
        await send_json({"id": 0, "ok": False, "error": f"SSH/SFTP connection failed: {type(e).__name__}: {e}"})
        await ws.close(code=4502)
        return
    await send_json({"id": 0, "ok": True, "type": "ready"})

    uploads: dict[int, Upload] = {}
    tasks: set[asyncio.Task] = set()

    async def handle(rid: int, m: dict):
        op = m.get("op")
        try:
            if op == "ls":
                data = await list_dir_data(sftp, m.get("path", "."))
            elif op == "read":
                attrs = await sftp.stat(m["path"])
                if (attrs.size or 0) > MAX_EDIT_BYTES:
                    raise HTTPException(413, f"File is larger than {MAX_EDIT_BYTES // 1000} KB; download it instead")
                async with sftp.open(m["path"], "rb") as f:
                    raw = await f.read(MAX_EDIT_BYTES + 1)
                if b"\x00" in raw[:8192]:
                    raise HTTPException(415, "Binary file; download it instead")
                data = {"path": m["path"], "content": raw.decode("utf-8", errors="replace"), "size": len(raw)}
            elif op == "write":
                raw = str(m.get("content", "")).encode()
                if len(raw) > MAX_EDIT_BYTES:
                    raise HTTPException(413, "Content too large")
                async with sftp.open(m["path"], "wb") as f:
                    await f.write(raw)
                data = {"size": len(raw)}
            elif op == "mkdir":
                await sftp.makedirs(m["path"], exist_ok=False)
                data = {}
            elif op == "rename":
                _guard(m["src"])
                await sftp.rename(m["src"], m["dst"])
                data = {}
            elif op == "rm":
                n = 0
                for p in m.get("paths", []):
                    p = _guard(p)
                    await send_json({"id": rid, "type": "progress", "message": f"Deleting {posixpath.basename(p)}", "done": n, "total": len(m["paths"])})
                    if (await sftp.lstat(p)).type == 2:
                        await sftp.rmtree(p)
                    else:
                        await sftp.remove(p)
                    n += 1
                data = {"deleted": n}
            elif op == "get":
                path = m["path"]
                attrs = await sftp.stat(path)
                if attrs.type == 2:
                    raise HTTPException(400, "That is a directory; copy it between VMs instead")
                total, done = attrs.size or 0, 0
                await send_json({"id": rid, "type": "progress", "done": 0, "total": total})
                async with sftp.open(path, "rb") as f:
                    while chunk := await f.read(CHUNK):
                        await send_bin(rid, chunk)
                        done += len(chunk)
                data = {"size": done, "name": posixpath.basename(path)}
            elif op == "copy":
                async with SessionLocal() as s:
                    dsts = (await s.scalars(select(VM).where(VM.id.in_(m["dst_vms"])))).all()
                if not dsts:
                    raise HTTPException(422, "No destination VMs")

                async def progress(msg):
                    await send_json({"id": rid, "type": "progress", "message": msg})
                data = {"results": await copy_between(vm, list(dsts), m["src_paths"], m["dst_dir"], progress)}
            else:
                raise HTTPException(400, f"Unknown operation: {op}")
            await send_json({"id": rid, "ok": True, "data": data})
        except asyncio.CancelledError:
            raise
        except Exception as e:
            try:
                await send_json({"id": rid, "ok": False, "error": error_text(e)})
            except Exception:
                pass

    async def writer(rid: int, f, up: Upload):
        written = 0
        try:
            while (chunk := await up.queue.get()) is not None:
                await f.write(chunk)
                written += len(chunk)
            await f.close()
            await send_json({"id": rid, "ok": True, "data": {"size": written}})
        except Exception as e:
            up.failed = True
            try:
                await f.close()
            except Exception:
                pass
            await send_json({"id": rid, "ok": False, "error": error_text(e)})

    async def begin_upload(rid: int, m: dict):
        try:
            f = await sftp.open(m["path"], "wb")
        except Exception as e:
            await send_json({"id": rid, "ok": False, "error": error_text(e)})
            up = Upload(); up.failed = True
            uploads[rid] = up                        # swallow the chunks that are already on their way
            return
        up = Upload()
        uploads[rid] = up
        up.task = asyncio.create_task(writer(rid, f, up))
        up.task.add_done_callback(lambda _t: uploads.pop(rid, None))

    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                b = msg["bytes"]
                up = uploads.get(int.from_bytes(b[:4], "big"))
                if up and not up.failed:
                    await up.queue.put(b[4:])
            elif msg.get("text"):
                try:
                    m = json.loads(msg["text"])
                    rid = int(m["id"])
                except (ValueError, KeyError, TypeError):
                    continue
                op = m.get("op")
                if op == "put":
                    await begin_upload(rid, m)
                elif op == "put_end":
                    up = uploads.get(rid)
                    if up and not up.failed:
                        await up.queue.put(None)
                    elif up:
                        uploads.pop(rid, None)
                elif op == "abort":
                    up = uploads.pop(rid, None)
                    if up and up.task:
                        up.task.cancel()
                else:
                    t = asyncio.create_task(handle(rid, m))
                    tasks.add(t)
                    t.add_done_callback(tasks.discard)
    except Exception:
        pass
    finally:
        for t in list(tasks):
            t.cancel()
        for up in list(uploads.values()):
            if up.task:
                up.task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        sftp.exit()
        try:
            await ws.close()
        except Exception:
            pass
