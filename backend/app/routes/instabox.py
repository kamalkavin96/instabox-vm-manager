import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import instabox_api as ib
from ..db import VM, get_session
from ..security import require_auth
from ..settings_store import delete_setting, set_secret

router = APIRouter(prefix="/api/instabox", dependencies=[Depends(require_auth)])


class KeyBody(BaseModel):
    key: str = Field(min_length=8, max_length=200)


class PortBody(BaseModel):
    port: int = Field(ge=1, le=65535)


def _wrap(e: ib.InstaboxError):
    return HTTPException(e.status, e.message)


@router.get("/status")
async def status():
    key, source = await ib.get_key()
    return {"configured": bool(key), "source": source, "key_hint": f"{key[:4]}…{key[-4:]}" if key else ""}


@router.put("/key")
async def save_key(body: KeyBody):
    key = body.key.strip()
    try:
        machines = await ib.list_machines(key=key)          # validate before saving
    except ib.InstaboxError as e:
        raise _wrap(e)
    await set_secret(ib.KEY_NAME, key)
    return {"ok": True, "machines": len(machines)}


@router.delete("/key", status_code=204)
async def remove_key():
    await delete_setting(ib.KEY_NAME)


@router.get("/account")
async def account():
    """Usage/limits as returned by GET /v1/usage (shape passed through) plus the machine count."""
    try:
        usage = await ib.request("GET", "/v1/usage")
    except ib.InstaboxError as e:
        raise _wrap(e)
    return {"usage": usage}


@router.get("/machines")
async def machines(s: AsyncSession = Depends(get_session)):
    try:
        ms = await ib.list_machines()
    except ib.InstaboxError as e:
        raise _wrap(e)
    vms = (await s.scalars(select(VM))).all()
    by_id = {v.instabox_id: v for v in vms if v.instabox_id}
    for m in ms:
        v = by_id.get(m["id"])
        m["vm_id"], m["vm_name"] = (v.id, v.name) if v else (None, None)
    return ms


@router.post("/autolink")
async def autolink(s: AsyncSession = Depends(get_session)):
    """Link VMs to machines whose InstaBox name equals the VM name or its hostname (case-insensitive)."""
    try:
        ms = await ib.list_machines()
    except ib.InstaboxError as e:
        raise _wrap(e)
    names = {(m["name"] or "").lower(): m["id"] for m in ms}
    linked = []
    for v in (await s.scalars(select(VM))).all():
        if v.instabox_id:
            continue
        host = ((v.latest or {}).get("system") or {}).get("hostname", "").lower()
        mid = names.get(v.name.lower()) or (names.get(host) if host else None)
        if mid:
            v.instabox_id = mid
            linked.append({"vm": v.name, "machine": mid})
    await s.commit()
    return {"linked": linked}


@router.get("/machines/{machine_id}/ports")
async def machine_ports(machine_id: str):
    try:
        return await ib.list_ports(machine_id)
    except ib.InstaboxError as e:
        raise _wrap(e)


@router.post("/machines/{machine_id}/ports")
async def publish(machine_id: str, body: PortBody):
    try:
        return await ib.publish_port(machine_id, body.port)
    except ib.InstaboxError as e:
        raise _wrap(e)


@router.delete("/machines/{machine_id}/ports/{port}", status_code=204)
async def unpublish(machine_id: str, port: int):
    try:
        await ib.unpublish_port(machine_id, port)
    except ib.InstaboxError as e:
        raise _wrap(e)


@router.get("/published")
async def published(s: AsyncSession = Depends(get_session)):
    """Published preview URLs for every VM that is linked to an InstaBox machine."""
    vms = [v for v in (await s.scalars(select(VM))).all() if v.instabox_id]

    async def one(v: VM):
        try:
            return [{**p, "vm_id": v.id, "vm": v.name, "machine_id": v.instabox_id} for p in await ib.list_ports(v.instabox_id)], None
        except ib.InstaboxError as e:
            return [], f"{v.name}: {e.message}"

    res = await asyncio.gather(*(one(v) for v in vms))
    return {"ports": [p for r, _ in res for p in r], "errors": [e for _, e in res if e]}
