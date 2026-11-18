import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..security import require_auth

router = APIRouter(prefix="/api/instabox", dependencies=[Depends(require_auth)])


@router.get("/machines")
async def instabox_machines():
    """Read-only view of the machines on your InstaBox account (GET /v1/machines)."""
    s = get_settings()
    if not s.instabox_api_key:
        raise HTTPException(503, "Set INSTABOX_API_KEY (an ibk_... key with machines:read) to enable this page")
    try:
        async with httpx.AsyncClient(base_url=s.instabox_api_url, timeout=20,
                                     headers={"X-API-Key": s.instabox_api_key}) as c:
            r = await c.get("/v1/machines")
    except httpx.HTTPError as e:
        raise HTTPException(502, f"InstaBox API unreachable: {e}")
    if r.status_code in (401, 403):
        raise HTTPException(502, "InstaBox rejected the API key (needs machines:read)")
    if r.status_code >= 400:
        raise HTTPException(502, f"InstaBox API error {r.status_code}: {r.text[:200]}")
    data = r.json()
    machines = data.get("machines", []) if isinstance(data, dict) else data
    return [{"id": m.get("id"), "name": m.get("name"), "state": m.get("state"),
             "template": m.get("template"), "vcpus": m.get("vcpus"), "memMiB": m.get("memMiB"),
             "persistentDiskGiB": m.get("persistentDiskGiB"), "metadata": m.get("metadata") or {}}
            for m in machines]
