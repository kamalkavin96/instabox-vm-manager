"""SSH layer: parses the `ssh ...` command Instabox gives you and runs commands over pooled connections."""
import asyncio
import logging
import shlex
import time
from dataclasses import dataclass, field
from pathlib import Path

import asyncssh

from .config import get_settings

log = logging.getLogger(__name__)
MAX_OUTPUT = 256_000
_VALUE_FLAGS = set("bcDEeFIiJLlmOopQRSWw")  # ssh flags that consume an argument


@dataclass
class Target:
    host: str
    port: int = 22
    username: str | None = None
    key: str | None = None  # private key text; None = default keys / agent / no-auth gateways


@dataclass
class RunResult:
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    duration: float = 0.0
    error: str | None = None


def parse_ssh_command(command: str) -> Target:
    """Turn `ssh -p 2222 -i key secret@host` (or ssh -o User=.. -o HostName=..) into a Target."""
    try:
        parts = shlex.split(command.strip())
    except ValueError as e:
        raise ValueError(f"Cannot parse SSH command: {e}")
    if parts and (parts[0] == "ssh" or parts[0].endswith("/ssh")):
        parts = parts[1:]
    host = user = identity = None
    port = 22
    i = 0
    while i < len(parts):
        a = parts[i]
        if a.startswith("-") and len(a) > 1:
            flag, val, letter = a[1:], None, None
            for idx, ch in enumerate(flag):
                if ch in _VALUE_FLAGS:
                    letter, rest = ch, flag[idx + 1:]
                    if rest:
                        val = rest
                    else:
                        i += 1
                        if i >= len(parts):
                            raise ValueError(f"ssh option -{ch} needs a value")
                        val = parts[i]
                    break
            if letter == "p":
                try:
                    port = int(val)
                except ValueError:
                    raise ValueError(f"Invalid port: {val}")
            elif letter == "l":
                user = val
            elif letter == "i":
                identity = val
            elif letter == "J":
                raise ValueError("ProxyJump (-J) is not supported")
            elif letter == "o":
                k, _, v = val.replace("=", " ", 1).partition(" ")
                k, v = k.lower(), v.strip()
                if k == "port":
                    try:
                        port = int(v)
                    except ValueError:
                        raise ValueError(f"Invalid port: {v}")
                elif k == "user":
                    user = v
                elif k == "hostname":
                    host = host or v
                elif k == "identityfile":
                    identity = v
                elif k in ("proxycommand", "proxyjump"):
                    raise ValueError(f"{k} is not supported")
        elif host is None:
            h = a
            if "@" in h:
                user, h = h.rsplit("@", 1)
            host = h.strip("[]")
        i += 1
    if not host:
        raise ValueError("No host found in SSH command")
    key = None
    if identity:
        p = Path(identity).expanduser()
        if not p.is_file():
            raise ValueError(f"Identity file not found on the server: {identity} (paste the private key instead)")
        key = p.read_text()
    return Target(host=host, port=port, username=user, key=key)


def _trim(s: str) -> str:
    return s if len(s) <= MAX_OUTPUT else s[:MAX_OUTPUT] + "\n...[output truncated]"


@dataclass
class SSHPool:
    """One cached connection per VM, bounded global concurrency, one transparent reconnect."""
    _conns: dict = field(default_factory=dict)
    _locks: dict = field(default_factory=dict)
    _sem: asyncio.Semaphore | None = None

    def _semaphore(self) -> asyncio.Semaphore:
        if self._sem is None:
            self._sem = asyncio.Semaphore(get_settings().max_concurrency)
        return self._sem

    async def _get(self, key, t: Target):
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            conn = self._conns.get(key)
            if conn is not None and not conn.is_closed():
                return conn
            s = get_settings()
            opts = dict(
                host=t.host, port=t.port, username=t.username, password=None,
                known_hosts=s.known_hosts or None, connect_timeout=s.ssh_connect_timeout,
                keepalive_interval=30, keepalive_count_max=3,
            )
            if t.key:
                opts["client_keys"] = [asyncssh.import_private_key(t.key)]
            conn = await asyncssh.connect(**opts)
            self._conns[key] = conn
            return conn

    async def drop(self, key) -> None:
        conn = self._conns.pop(key, None)
        if conn is not None:
            conn.close()

    async def close_all(self) -> None:
        for k in list(self._conns):
            await self.drop(k)

    async def run(self, key, t: Target, command: str, timeout: int | None = None) -> RunResult:
        timeout = timeout or get_settings().ssh_command_timeout
        start = time.monotonic()
        err = "unknown error"
        async with self._semaphore():
            for attempt in (1, 2):
                try:
                    conn = await self._get(key, t)
                    r = await conn.run(command, check=False, timeout=timeout, encoding="utf-8", errors="replace")
                    return RunResult(_trim(str(r.stdout or "")), _trim(str(r.stderr or "")), r.exit_status,
                                     round(time.monotonic() - start, 2))
                except asyncssh.TimeoutError:
                    await self.drop(key)
                    err = f"Command timed out after {timeout}s"
                    break
                except asyncssh.PermissionDenied:
                    await self.drop(key)
                    err = "Authentication failed (check the SSH command / secret code)"
                    break
                except (asyncssh.Error, OSError, asyncio.TimeoutError, ValueError) as e:
                    await self.drop(key)
                    err = f"{type(e).__name__}: {e}"
                    if attempt == 2:
                        break
        return RunResult(error=err, duration=round(time.monotonic() - start, 2))


_pool: SSHPool | None = None


def get_pool() -> SSHPool:
    global _pool
    if _pool is None:
        _pool = SSHPool()
    return _pool
