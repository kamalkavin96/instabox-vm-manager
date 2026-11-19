import json
import logging
from datetime import timedelta

from sqlalchemy import delete

from .collector import SCRIPT, parse_output
from .config import get_settings
from .db import Metric, SessionLocal, VM, utcnow
from .events import hub
from .serialize import vm_out
from .security import decrypt
from .ssh import Target, get_pool

log = logging.getLogger(__name__)


def target_for(vm: VM) -> Target:
    c = json.loads(decrypt(vm.conn_enc))
    return Target(host=vm.host, port=vm.port, username=c.get("username"), key=c.get("key"))


async def poll_vm(vm_id: int, persist: bool = True) -> str | None:
    """Collect one snapshot and persist it. Returns an error string, or None on success."""
    async with SessionLocal() as s:
        vm = await s.get(VM, vm_id)
        if vm is None:
            return "VM not found"
        target = target_for(vm)
    res = await get_pool().run(vm_id, target, SCRIPT, timeout=30)
    snap, error = None, res.error
    if not error:
        try:
            snap = parse_output(res.stdout)
        except ValueError as e:
            error = f"{e}: {(res.stderr or res.stdout)[:200]}"
    async with SessionLocal() as s:
        vm = await s.get(VM, vm_id)
        if vm is None:
            return error
        if snap:
            vm.status, vm.last_seen, vm.last_error, vm.latest = "online", utcnow(), None, snap
            if persist:
                s.add(Metric(vm_id=vm_id, cpu=snap["cpu"]["percent"], mem=snap["memory"]["percent"],
                             swap=snap["memory"]["swap_percent"], load1=(snap["cpu"]["load"] or [None])[0],
                             disk=max((d["percent"] for d in snap["disks"]), default=0)))
        else:
            vm.status, vm.last_error = "offline", error
        await s.commit()
        if hub.has_subscribers:
            hub.publish_vm(vm_out(vm, detail=True))
    return error


async def prune() -> None:
    cutoff = utcnow() - timedelta(days=get_settings().retention_days)
    async with SessionLocal() as s:
        await s.execute(delete(Metric).where(Metric.ts < cutoff))
        await s.commit()
