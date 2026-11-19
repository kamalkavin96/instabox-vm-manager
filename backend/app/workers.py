"""One long-lived worker task per VM.

Each worker owns that VM's monitoring schedule and can be woken, stopped or inspected independently, so one slow
or unreachable VM never delays the others. They are asyncio tasks rather than OS threads on purpose: asyncssh is
asyncio-native, so 10 (or 1000) idle SSH sessions cost almost nothing and need no locks.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from .config import get_settings
from .db import SessionLocal, VM
from .events import hub
from .monitor import poll_vm, prune
from .ssh import get_pool

log = logging.getLogger(__name__)


class VMWorker:
    def __init__(self, vm_id: int):
        self.vm_id = vm_id
        self.wake = asyncio.Event()
        self.task: asyncio.Task | None = None
        self.terminals = 0
        self.last_persist = 0.0
        self.state = {"polls": 0, "failures": 0, "last_duration": None, "last_error": None, "last_poll_at": None}

    def start(self, delay: float = 0.0) -> None:
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._run(delay), name=f"vm-worker-{self.vm_id}")

    async def _run(self, delay: float) -> None:
        if delay:
            await asyncio.sleep(delay)
        while True:
            t0 = time.monotonic()
            try:
                persist = (t0 - self.last_persist) >= get_settings().poll_interval - 1
                err = await poll_vm(self.vm_id, persist=persist)
                if persist:
                    self.last_persist = t0
                self.state["polls"] += 1
                self.state["failures"] += 1 if err else 0
                self.state["last_error"] = err
            except asyncio.CancelledError:
                raise
            except Exception as e:                                  # a worker must never die
                log.exception("worker %s failed", self.vm_id)
                self.state["last_error"] = f"{type(e).__name__}: {e}"
            self.state["last_duration"] = round(time.monotonic() - t0, 2)
            self.state["last_poll_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            self.wake.clear()
            try:
                cfg = get_settings()
                await asyncio.wait_for(self.wake.wait(), cfg.live_interval if hub.has_subscribers else cfg.poll_interval)
            except asyncio.TimeoutError:
                pass

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        await get_pool().drop(self.vm_id)


class WorkerManager:
    def __init__(self):
        self.workers: dict[int, VMWorker] = {}
        self._maint: asyncio.Task | None = None

    def ensure(self, vm_id: int, delay: float = 0.0) -> VMWorker:
        w = self.workers.get(vm_id)
        if w is None:
            w = self.workers[vm_id] = VMWorker(vm_id)
        w.start(delay)
        return w

    async def remove(self, vm_id: int) -> None:
        w = self.workers.pop(vm_id, None)
        if w:
            await w.stop()

    def trigger(self, vm_id: int) -> None:
        if vm_id in self.workers:
            self.workers[vm_id].wake.set()

    async def start_all(self) -> None:
        async with SessionLocal() as s:
            ids = (await s.scalars(select(VM.id).where(VM.enabled.is_(True)).order_by(VM.id))).all()
        spread = min(2.0, get_settings().poll_interval / max(len(ids), 1))
        for n, i in enumerate(ids):                                 # stagger first polls
            self.ensure(i, delay=n * spread)
        self._maint = asyncio.create_task(self._maintenance())

    async def _maintenance(self) -> None:
        while True:
            try:
                await prune()
            except Exception:
                log.exception("prune failed")
            await asyncio.sleep(3600)

    async def stop_all(self) -> None:
        if self._maint:
            self._maint.cancel()
        await asyncio.gather(*(w.stop() for w in list(self.workers.values())), return_exceptions=True)
        self.workers.clear()

    def stats(self) -> dict:
        return {i: {**w.state, "terminals": w.terminals, "running": bool(w.task and not w.task.done())}
                for i, w in self.workers.items()}


manager = WorkerManager()
