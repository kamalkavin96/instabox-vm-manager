import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import CommandRun, VM, get_session, iso
from ..monitor import target_for
from ..security import require_auth
from ..ssh import get_pool

router = APIRouter(prefix="/api/commands", dependencies=[Depends(require_auth)])
HISTORY_FIELD_LIMIT = 20_000


class CommandReq(BaseModel):
    command: str = Field(min_length=1, max_length=10_000)
    vm_ids: list[int] | None = None      # None = every enabled VM
    timeout: int = Field(60, ge=1, le=900)


@router.post("")
async def run_command(body: CommandReq, s: AsyncSession = Depends(get_session)):
    q = select(VM).order_by(VM.name)
    q = q.where(VM.id.in_(body.vm_ids)) if body.vm_ids is not None else q.where(VM.enabled.is_(True))
    vms = (await s.scalars(q)).all()
    if not vms:
        raise HTTPException(422, "No target VMs")
    pool = get_pool()
    targets = [(v.id, v.name, target_for(v)) for v in vms]
    runs = await asyncio.gather(*(pool.run(i, t, body.command, body.timeout) for i, _, t in targets))
    results = [{"vm_id": i, "name": n, "exit_code": r.exit_code, "stdout": r.stdout, "stderr": r.stderr,
                "duration": r.duration, "error": r.error} for (i, n, _), r in zip(targets, runs)]
    trimmed = [{**r, "stdout": r["stdout"][:HISTORY_FIELD_LIMIT], "stderr": r["stderr"][:HISTORY_FIELD_LIMIT]}
               for r in results]
    run = CommandRun(command=body.command, results=trimmed)
    s.add(run)
    await s.commit()
    return {"id": run.id, "ts": iso(run.ts), "command": body.command, "results": results}


@router.get("/history")
async def history(limit: int = 30, s: AsyncSession = Depends(get_session)):
    rows = (await s.scalars(select(CommandRun).order_by(CommandRun.id.desc()).limit(min(limit, 100)))).all()
    return [{"id": r.id, "ts": iso(r.ts), "command": r.command, "results": r.results} for r in rows]
