"""Thin async client for the InstaBox REST API (https://api.instabox.sh, auth via X-API-Key)."""
import re
import shutil
import asyncio
from typing import Any

import httpx

from .config import get_settings
from .settings_store import get_secret

KEY_NAME = "instabox_api_key"
PREVIEW_DOMAIN = "instabox.tech"       # public port URLs look like https://<PORT>-<MACHINE_ID>.instabox.tech


class InstaboxError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message, self.status = message, status


async def get_key() -> tuple[str, str]:
    """Returns (key, source) where source is 'saved' (UI), 'env' or ''."""
    saved = await get_secret(KEY_NAME)
    if saved:
        return saved, "saved"
    env = get_settings().instabox_api_key.strip()
    return (env, "env") if env else ("", "")


async def request(method: str, path: str, json: Any = None, key: str | None = None) -> Any:
    if key is None:
        key, _ = await get_key()
    if not key:
        raise InstaboxError("No InstaBox API key configured. Add one on the InstaBox page.", 503)
    try:
        async with httpx.AsyncClient(base_url=get_settings().instabox_api_url, timeout=25,
                                     headers={"X-API-Key": key}) as c:
            r = await c.request(method, path, json=json)
    except httpx.HTTPError as e:
        raise InstaboxError(f"InstaBox API unreachable: {type(e).__name__}: {e}")
    if r.status_code in (401, 403):
        raise InstaboxError("InstaBox rejected the API key (check it and its scopes: machines:read/write).", 502)
    if r.status_code >= 400:
        raise InstaboxError(f"InstaBox API {r.status_code} on {method} {path}: {r.text[:300]}", 502)
    if r.status_code == 204 or not r.content:
        return None
    try:
        return r.json()
    except ValueError:
        raise InstaboxError(f"InstaBox API returned non-JSON for {path}")


def _items(data: Any, *keys: str) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            if isinstance(data.get(k), list):
                return data[k]
    return []


def normalize_machine(m: dict) -> dict:
    return {"id": m.get("id"), "name": m.get("name"), "state": m.get("state"),
            "desired_state": m.get("desiredState"), "template": m.get("template") or m.get("templateId"),
            "vcpus": m.get("vcpus"), "mem_mib": m.get("memMiB"), "disk_gib": m.get("persistentDiskGiB"),
            "metadata": m.get("metadata") or {}, "created_at": m.get("createdAt"),
            "updated_at": m.get("updatedAt"), "raw": m}


async def list_machines(key: str | None = None) -> list[dict]:
    out, cursor = [], None
    for _ in range(20):                                   # follow pagination defensively
        data = await request("GET", "/v1/machines" + (f"?cursor={cursor}" if cursor else ""), key=key)
        out += [normalize_machine(m) for m in _items(data, "machines", "items", "data") if isinstance(m, dict)]
        cursor = data.get("nextCursor") or data.get("next_cursor") if isinstance(data, dict) else None
        if not cursor:
            break
    return out


def normalize_port(machine_id: str, p: Any) -> dict | None:
    if isinstance(p, int):
        p = {"port": p}
    if not isinstance(p, dict):
        return None
    port = p.get("port")
    if not isinstance(port, int):
        return None
    url = p.get("url") or p.get("publicUrl") or p.get("public_url") or p.get("hostname") or p.get("host")
    derived = not url
    if derived:
        url = f"https://{port}-{machine_id}.{PREVIEW_DOMAIN}"
    elif not str(url).startswith("http"):
        url = f"https://{url}"
    return {"port": port, "url": url, "derived": derived, "name": p.get("name") or "", "raw": p}


async def list_ports(machine_id: str) -> list[dict]:
    data = await request("GET", f"/v1/machines/{machine_id}/ports")
    ports = [normalize_port(machine_id, p) for p in _items(data, "ports", "items", "data")]
    return sorted([p for p in ports if p], key=lambda p: p["port"])


async def publish_port(machine_id: str, port: int) -> dict:
    data = await request("POST", f"/v1/machines/{machine_id}/ports", json={"port": port})
    return normalize_port(machine_id, data if isinstance(data, dict) and "port" in data else {"port": port}) or {"port": port}


async def unpublish_port(machine_id: str, port: int) -> None:
    await request("DELETE", f"/v1/machines/{machine_id}/ports/{port}")


async def cli_ports(machine: str) -> dict:
    """Best-effort: use the local `instabox` CLI (`instabox port ls <machine>`), if installed on this server."""
    exe = shutil.which("instabox")
    if not exe:
        return {"available": False, "output": "", "urls": []}
    key, _ = await get_key()
    env = {"INSTABOX_API_KEY": key} if key else None
    try:
        p = await asyncio.create_subprocess_exec(exe, "port", "ls", machine, stdout=asyncio.subprocess.PIPE,
                                                 stderr=asyncio.subprocess.STDOUT, env=None if env is None else {**__import__("os").environ, **env})
        out, _ = await asyncio.wait_for(p.communicate(), 20)
    except (OSError, asyncio.TimeoutError) as e:
        return {"available": True, "output": f"CLI failed: {e}", "urls": []}
    text = out.decode(errors="replace")
    return {"available": True, "output": text, "urls": re.findall(r"https?://[^\s\"']+", text)}
