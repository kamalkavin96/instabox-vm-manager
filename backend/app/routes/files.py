"""SFTP file manager: browse, upload, download, edit, rename, delete, and copy between VMs."""
import asyncio
import posixpath
import shutil
import tempfile
from pathlib import Path
from urllib.parse import quote

import asyncssh
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import VM, get_session
from ..monitor import target_for
from ..security import require_auth, require_auth_flex
from ..ssh import get_pool

router = APIRouter(prefix="/api")
auth = [Depends(require_auth)]
MAX_EDIT_BYTES = 1_000_000
CHUNK = 256 * 1024


async def _vm(s: AsyncSession, vm_id: int) -> VM:
    vm = await s.get(VM, vm_id)
    if vm is None:
        raise HTTPException(404, "VM not found")
    return vm


async def _sftp(vm: VM):
    """Open an SFTP channel on the VM's shared connection."""
    try:
        conn = await get_pool().connection(vm.id, target_for(vm))
        return await conn.start_sftp_client()
    except (asyncssh.Error, OSError, asyncio.TimeoutError) as e:
        raise HTTPException(502, f"SSH/SFTP connection failed: {type(e).__name__}: {e}")


def _sftp_error(e: Exception) -> HTTPException:
    if isinstance(e, asyncssh.SFTPNoSuchFile):
        return HTTPException(404, "No such file or directory")
    if isinstance(e, asyncssh.SFTPPermissionDenied):
        return HTTPException(403, "Permission denied")
    return HTTPException(400, f"{type(e).__name__}: {getattr(e, 'reason', None) or e}")


def _guard(path: str) -> str:
    p = posixpath.normpath(path or "/")
    if p in ("/", "."):
        raise HTTPException(422, "Refusing to operate on the root directory")
    return p


async def list_dir_data(sftp, path: str) -> dict:
    real = await sftp.realpath(path or ".")
    names = await sftp.readdir(real)
    entries = []
    for n in names:
        if n.filename in (".", ".."):
            continue
        a = n.attrs
        kind = {1: "file", 2: "dir", 3: "link"}.get(a.type, "file")
        full = posixpath.join(real, n.filename)
        if kind == "link":
            try:
                if (await sftp.stat(full)).type == 2:
                    kind = "linkdir"
            except asyncssh.Error:
                pass
        entries.append({"name": n.filename, "path": full, "type": kind, "size": a.size or 0,
                        "mtime": a.mtime, "mode": oct((a.permissions or 0) & 0o7777)[2:].zfill(3),
                        "uid": a.uid, "gid": a.gid})
    entries.sort(key=lambda e: (e["type"] not in ("dir", "linkdir"), e["name"].lower()))
    return {"path": real, "parent": posixpath.dirname(real) if real != "/" else None, "entries": entries}


@router.get("/vms/{vm_id}/fs", dependencies=auth)
async def list_dir(vm_id: int, path: str = ".", s: AsyncSession = Depends(get_session)):
    vm = await _vm(s, vm_id)
    async with await _sftp(vm) as sftp:
        try:
            return await list_dir_data(sftp, path)
        except asyncssh.Error as e:
            raise _sftp_error(e)


@router.get("/vms/{vm_id}/fs/get")
async def download_file(vm_id: int, path: str, _=Depends(require_auth_flex), s: AsyncSession = Depends(get_session)):
    vm = await _vm(s, vm_id)
    sftp = await _sftp(vm)
    try:
        attrs = await sftp.stat(path)
        if attrs.type == 2:
            sftp.exit()
            raise HTTPException(400, "That is a directory; open it or copy it between VMs instead")
        f = await sftp.open(path, "rb")
    except asyncssh.Error as e:
        sftp.exit()
        raise _sftp_error(e)

    async def stream():
        try:
            while True:
                chunk = await f.read(CHUNK)
                if not chunk:
                    break
                yield chunk
        finally:
            await f.close()
            sftp.exit()

    name = posixpath.basename(path)
    return StreamingResponse(stream(), media_type="application/octet-stream",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}",
                                      **({"Content-Length": str(attrs.size)} if attrs.size is not None else {})})


@router.post("/vms/{vm_id}/fs/upload", dependencies=auth)
async def upload(vm_id: int, path: str = Query("."), files: list[UploadFile] = File(...),
                 s: AsyncSession = Depends(get_session)):
    vm = await _vm(s, vm_id)
    saved = []
    async with await _sftp(vm) as sftp:
        try:
            base = await sftp.realpath(path)
            for uf in files:
                name = posixpath.basename(uf.filename or "upload")
                if not name:
                    continue
                async with sftp.open(posixpath.join(base, name), "wb") as f:
                    while chunk := await uf.read(CHUNK):
                        await f.write(chunk)
                saved.append(name)
        except asyncssh.Error as e:
            raise _sftp_error(e)
    return {"saved": saved, "path": base}


class PathBody(BaseModel):
    path: str = Field(min_length=1)


class RenameBody(BaseModel):
    src: str = Field(min_length=1)
    dst: str = Field(min_length=1)


class WriteBody(BaseModel):
    path: str = Field(min_length=1)
    content: str


@router.post("/vms/{vm_id}/fs/mkdir", dependencies=auth)
async def mkdir(vm_id: int, body: PathBody, s: AsyncSession = Depends(get_session)):
    async with await _sftp(await _vm(s, vm_id)) as sftp:
        try:
            await sftp.makedirs(body.path, exist_ok=False)
        except asyncssh.Error as e:
            raise _sftp_error(e)
    return {"ok": True}


@router.post("/vms/{vm_id}/fs/rename", dependencies=auth)
async def rename(vm_id: int, body: RenameBody, s: AsyncSession = Depends(get_session)):
    _guard(body.src)
    async with await _sftp(await _vm(s, vm_id)) as sftp:
        try:
            await sftp.rename(body.src, body.dst)
        except asyncssh.Error as e:
            raise _sftp_error(e)
    return {"ok": True}


@router.delete("/vms/{vm_id}/fs", dependencies=auth)
async def delete(vm_id: int, path: str, s: AsyncSession = Depends(get_session)):
    path = _guard(path)
    async with await _sftp(await _vm(s, vm_id)) as sftp:
        try:
            if (await sftp.lstat(path)).type == 2:
                await sftp.rmtree(path)
            else:
                await sftp.remove(path)
        except asyncssh.Error as e:
            raise _sftp_error(e)
    return {"ok": True}


@router.get("/vms/{vm_id}/fs/read", dependencies=auth)
async def read_text(vm_id: int, path: str, s: AsyncSession = Depends(get_session)):
    async with await _sftp(await _vm(s, vm_id)) as sftp:
        try:
            attrs = await sftp.stat(path)
            if (attrs.size or 0) > MAX_EDIT_BYTES:
                raise HTTPException(413, f"File is larger than {MAX_EDIT_BYTES // 1000} KB; download it instead")
            async with sftp.open(path, "rb") as f:
                data = await f.read(MAX_EDIT_BYTES + 1)
        except asyncssh.Error as e:
            raise _sftp_error(e)
    if b"\x00" in data[:8192]:
        raise HTTPException(415, "Binary file; download it instead")
    return {"path": path, "content": data.decode("utf-8", errors="replace"), "size": len(data)}


@router.put("/vms/{vm_id}/fs/write", dependencies=auth)
async def write_text(vm_id: int, body: WriteBody, s: AsyncSession = Depends(get_session)):
    data = body.content.encode()
    if len(data) > MAX_EDIT_BYTES:
        raise HTTPException(413, "Content too large")
    async with await _sftp(await _vm(s, vm_id)) as sftp:
        try:
            async with sftp.open(body.path, "wb") as f:
                await f.write(data)
        except asyncssh.Error as e:
            raise _sftp_error(e)
    return {"ok": True, "size": len(data)}


# ---------- multi-VM operations ----------

@router.post("/files/upload-many", dependencies=auth)
async def upload_many(vm_ids: str = Form(...), path: str = Form("."), files: list[UploadFile] = File(...),
                      s: AsyncSession = Depends(get_session)):
    """Upload the same files to the same directory on several VMs."""
    try:
        ids = [int(x) for x in vm_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(422, "vm_ids must be comma separated integers")
    vms = (await s.scalars(select(VM).where(VM.id.in_(ids)))).all()
    if not vms:
        raise HTTPException(422, "No target VMs")
    with tempfile.TemporaryDirectory() as tmp:
        local = []
        for uf in files:
            name = posixpath.basename(uf.filename or "upload")
            dest = Path(tmp) / name
            with dest.open("wb") as out:
                shutil.copyfileobj(uf.file, out)
            local.append(dest)

        async def one(vm: VM):
            try:
                async with await _sftp(vm) as sftp:
                    base = await sftp.realpath(path)
                    for p in local:
                        await sftp.put(str(p), posixpath.join(base, p.name))
                return {"vm_id": vm.id, "name": vm.name, "ok": True}
            except (asyncssh.Error, HTTPException, OSError) as e:
                return {"vm_id": vm.id, "name": vm.name, "ok": False,
                        "error": e.detail if isinstance(e, HTTPException) else f"{type(e).__name__}: {e}"}

        return {"results": await asyncio.gather(*(one(v) for v in vms))}


class CopyBody(BaseModel):
    src_vm: int
    src_paths: list[str] = Field(min_length=1)
    dst_vms: list[int] = Field(min_length=1)
    dst_dir: str = Field(min_length=1)


async def copy_between(src: VM, dsts: list[VM], paths: list[str], dst_dir: str, progress=None) -> list[dict]:
    """scp-style copy of files/directories from one VM to a directory on each destination VM."""
    with tempfile.TemporaryDirectory() as tmp:
        if progress:
            await progress(f"Reading from {src.name}")
        async with await _sftp(src) as sftp:
            await sftp.get(paths, tmp, recurse=True)
        names = [posixpath.basename(posixpath.normpath(p)) for p in paths]

        async def one(vm: VM):
            try:
                async with await _sftp(vm) as sftp:
                    dst = await sftp.realpath(dst_dir)
                    await sftp.put([str(Path(tmp) / n) for n in names], dst, recurse=True)
                if progress:
                    await progress(f"Copied to {vm.name}")
                return {"vm_id": vm.id, "name": vm.name, "ok": True}
            except (asyncssh.Error, HTTPException, OSError) as e:
                return {"vm_id": vm.id, "name": vm.name, "ok": False,
                        "error": e.detail if isinstance(e, HTTPException) else f"{type(e).__name__}: {getattr(e, 'reason', None) or e}"}

        return list(await asyncio.gather(*(one(v) for v in dsts)))


class CopyBody(BaseModel):
    src_vm: int
    src_paths: list[str] = Field(min_length=1)
    dst_vms: list[int] = Field(min_length=1)
    dst_dir: str = Field(min_length=1)


@router.post("/files/copy", dependencies=auth)
async def copy_endpoint(body: CopyBody, s: AsyncSession = Depends(get_session)):
    src = await _vm(s, body.src_vm)
    dsts = (await s.scalars(select(VM).where(VM.id.in_(body.dst_vms)))).all()
    if not dsts:
        raise HTTPException(422, "No destination VMs")
    try:
        return {"results": await copy_between(src, list(dsts), body.src_paths, body.dst_dir)}
    except asyncssh.Error as e:
        raise _sftp_error(e)
