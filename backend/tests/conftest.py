import asyncio
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ.update(VMM_ADMIN_TOKEN="test-token", VMM_DATA_DIR=_tmp, VMM_MONITOR_ENABLED="false")

import pytest
from fastapi.testclient import TestClient

from app import ssh
from app.main import app


class LocalPool(ssh.SSHPool):
    """Runs commands in a local bash instead of over SSH, so the whole stack is testable offline."""
    async def run(self, key, t, command, timeout=None):
        if t.host == "unreachable.invalid":
            return ssh.RunResult(error="OSError: connection refused")
        p = await asyncio.create_subprocess_exec("bash", "-c", command, stdout=asyncio.subprocess.PIPE,
                                                 stderr=asyncio.subprocess.PIPE)
        out, err = await p.communicate()
        return ssh.RunResult(out.decode(), err.decode(), p.returncode, 0.1)


@pytest.fixture(scope="session")
def client():
    ssh._pool = LocalPool()
    with TestClient(app) as c:
        c.headers["Authorization"] = "Bearer test-token"
        yield c
