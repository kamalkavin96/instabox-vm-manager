import json
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import monitor
from ..collector import summarize
from ..db import Metric, VM, get_session, iso, utcnow
from ..security import encrypt, require_auth
from ..ssh import get_pool, parse_ssh_command

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


class VMCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ssh_command: str = Field(min_length=3, max_length=4000)
    private_key: str | None = None
    tags: list[str] = []
    notes: str = ""
    test: bool = True            # connect before saving


class VMUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    ssh_command: str | None = None
    private_key: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    enabled: bool | None = None


def vm_out(vm: VM, detail: bool = False) -> dict:
    out = {"id": vm.id, "name": vm.name, "host": vm.host, "port": vm.port, "tags": vm.tags or [],
           "notes": vm.notes, "enabled": vm.enabled, "status": vm.status, "last_seen": iso(vm.last_seen),
           "last_error": vm.last_error, "created_at": iso(vm.created_at), "summary": summarize(vm.latest)}
    if detail:
        out["latest"] = vm.latest
    return out


def _conn_blob(ssh_command: str, private_key: str | None) -> tuple[str, int, str]:
    try:
        t = parse_ssh_command(ssh_command)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if not t.username:
        raise HTTPException(422, "The SSH command must include a user (the secret code), e.g. ssh <code>@host")
    key = (private_key.strip() + "\n") if private_key and private_key.strip() else t.key
    return t.host, t.port, encrypt(json.dumps({"username": t.username, "key": key}))


async def _get_vm(s: AsyncSession, vm_id: int) -> VM:
    vm = await s.get(VM, vm_id)
    if vm is None:
        raise HTTPException(404, "VM not found")
    return vm


@router.get("/vms")
async def list_vms(s: AsyncSession = Depends(get_session)):
    return [vm_out(v) for v in (await s.scalars(select(VM).order_by(VM.name))).all()]


@router.post("/vms", status_code=201)
async def create_vm(body: VMCreate, s: AsyncSession = Depends(get_session)):
    host, port, blob = _conn_blob(body.ssh_command, body.private_key)
    vm = VM(name=body.name.strip(), host=host, port=port, conn_enc=blob,
            tags=[t.strip() for t in body.tags if t.strip()], notes=body.notes)
    s.add(vm)
    try:
        await s.commit()
    except IntegrityError:
        await s.rollback()
        raise HTTPException(409, f"A VM named '{vm.name}' already exists")
    err = await monitor.poll_vm(vm.id)
    if err and body.test:
        await get_pool().drop(vm.id)
        await s.delete(vm)
        await s.commit()
        raise HTTPException(422, f"Could not connect: {err}")
    await s.refresh(vm)
    return vm_out(vm, detail=True)


@router.get("/vms/{vm_id}")
async def get_vm(vm_id: int, s: AsyncSession = Depends(get_session)):
    return vm_out(await _get_vm(s, vm_id), detail=True)


@router.patch("/vms/{vm_id}")
async def update_vm(vm_id: int, body: VMUpdate, s: AsyncSession = Depends(get_session)):
    vm = await _get_vm(s, vm_id)
    if body.name is not None:
        vm.name = body.name.strip()
    if body.tags is not None:
        vm.tags = [t.strip() for t in body.tags if t.strip()]
    if body.notes is not None:
        vm.notes = body.notes
    if body.enabled is not None:
        vm.enabled = body.enabled
    if body.ssh_command:
        vm.host, vm.port, vm.conn_enc = _conn_blob(body.ssh_command, body.private_key)
        await get_pool().drop(vm.id)
    try:
        await s.commit()
    except IntegrityError:
        await s.rollback()
        raise HTTPException(409, "A VM with that name already exists")
    return vm_out(vm, detail=True)


@router.delete("/vms/{vm_id}", status_code=204)
async def delete_vm(vm_id: int, s: AsyncSession = Depends(get_session)):
    vm = await _get_vm(s, vm_id)
    await get_pool().drop(vm_id)
    await s.delete(vm)
    await s.commit()


@router.post("/vms/{vm_id}/refresh")
async def refresh_vm(vm_id: int, s: AsyncSession = Depends(get_session)):
    await _get_vm(s, vm_id)
    await monitor.poll_vm(vm_id)
    vm = await s.get(VM, vm_id)
    await s.refresh(vm)
    return vm_out(vm, detail=True)


@router.post("/fleet/refresh")
async def refresh_fleet():
    await monitor.poll_all()
    return {"ok": True}


@router.get("/vms/{vm_id}/metrics")
async def vm_metrics(vm_id: int, hours: int = Query(6, ge=1, le=168), s: AsyncSession = Depends(get_session)):
    await _get_vm(s, vm_id)
    since = utcnow() - timedelta(hours=hours)
    rows = (await s.scalars(select(Metric).where(Metric.vm_id == vm_id, Metric.ts >= since)
                            .order_by(Metric.ts))).all()
    step = max(1, len(rows) // 300)
    return [{"ts": iso(r.ts), "cpu": r.cpu, "mem": r.mem, "swap": r.swap, "disk": r.disk, "load1": r.load1}
            for r in rows[::step]]


@router.get("/ports")
async def fleet_ports(s: AsyncSession = Depends(get_session)):
    out = []
    for vm in (await s.scalars(select(VM).order_by(VM.name))).all():
        for p in (vm.latest or {}).get("ports", []):
            out.append({**p, "vm_id": vm.id, "vm": vm.name, "status": vm.status})
    return out
