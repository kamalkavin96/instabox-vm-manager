"""Live fleet updates over WebSocket: a snapshot on connect, then one message per VM sample."""
import asyncio
import json

from fastapi import APIRouter, Query, WebSocket
from sqlalchemy import select

from ..db import SessionLocal, VM
from ..events import hub
from ..security import token_ok
from ..serialize import vm_out
from ..workers import manager

router = APIRouter()


@router.websocket("/api/ws/events")
async def events(ws: WebSocket, token: str = Query(""), vm: int = Query(0)):
    if not token_ok(token):
        await ws.close(code=4401)
        return
    await ws.accept()
    q = hub.subscribe(detail_vm=vm)
    try:
        async with SessionLocal() as s:
            vms = (await s.scalars(select(VM).order_by(VM.name))).all()
        await ws.send_text(json.dumps({"type": "snapshot", "vms": [vm_out(v, detail=(v.id == vm)) for v in vms]}))
        for vid in list(manager.workers):              # watchers appeared: sample now instead of waiting out the slow cadence
            manager.trigger(vid)

        async def send_loop():
            while True:
                await ws.send_text(json.dumps(await q.get()))

        async def recv_loop():
            while True:
                if (await ws.receive())["type"] == "websocket.disconnect":
                    return

        tasks = [asyncio.create_task(send_loop()), asyncio.create_task(recv_loop())]
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    except Exception:
        pass
    finally:
        hub.unsubscribe(q)
        try:
            await ws.close()
        except Exception:
            pass
