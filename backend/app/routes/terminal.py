"""Interactive terminal over WebSocket: browser (xterm.js) <-> asyncssh PTY session on the VM.

Protocol: binary frames carry raw terminal bytes in both directions; text frames from the client are JSON control
messages, currently {"type":"resize","cols":N,"rows":N}.
"""
import asyncio
import json
import logging

import asyncssh
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..db import SessionLocal, VM
from ..monitor import target_for
from ..security import token_ok
from ..ssh import get_pool
from ..workers import manager

log = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/api/ws/terminal/{vm_id}")
async def terminal(ws: WebSocket, vm_id: int, token: str = Query(""), cols: int = Query(80, ge=10, le=500),
                   rows: int = Query(24, ge=2, le=200)):
    if not token_ok(token):
        await ws.close(code=4401)
        return
    await ws.accept()
    async with SessionLocal() as s:
        vm = await s.get(VM, vm_id)
        target = target_for(vm) if vm else None
    if target is None:
        await ws.send_text(json.dumps({"type": "error", "message": "VM not found"}))
        await ws.close(code=4404)
        return
    worker = manager.workers.get(vm_id)
    conn = proc = None
    try:
        conn = await get_pool().open_connection(target)     # dedicated connection: isolated from monitoring
        proc = await conn.create_process(term_type="xterm-256color", term_size=(cols, rows), encoding=None)
        if worker:
            worker.terminals += 1

        async def pump_out():
            while True:
                data = await proc.stdout.read(65536)
                if not data:
                    return
                await ws.send_bytes(data)

        async def pump_in():
            while True:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    return
                if msg.get("bytes") is not None:
                    proc.stdin.write(msg["bytes"])
                elif msg.get("text"):
                    try:
                        c = json.loads(msg["text"])
                    except ValueError:
                        continue
                    if c.get("type") == "resize":
                        proc.change_terminal_size(max(10, int(c.get("cols", 80))), max(2, int(c.get("rows", 24))))

        tasks = [asyncio.create_task(pump_out()), asyncio.create_task(pump_in())]
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    except (asyncssh.Error, OSError, asyncio.TimeoutError) as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "message": f"{type(e).__name__}: {e}"}))
        except Exception:
            pass
    except WebSocketDisconnect:
        pass
    finally:
        if worker and worker.terminals > 0 and proc is not None:
            worker.terminals -= 1
        if proc is not None:
            proc.close()
        if conn is not None:
            conn.close()
        try:
            await ws.close()
        except Exception:
            pass
