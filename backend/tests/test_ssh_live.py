"""Exercises the real asyncssh pool against an in-process SSH server that accepts any user without a password
(the same auth shape as a secret-code-in-username gateway)."""
import asyncio

import asyncssh
import pytest

from app.ssh import SSHPool, Target


class NoAuthServer(asyncssh.SSHServer):
    def begin_auth(self, username):
        self.user = username
        return False                       # no authentication required


async def handle(process):
    cmd = process.command
    if cmd == "sleep":
        await asyncio.sleep(5)
    process.stdout.write(f"ran:{cmd}\n")
    process.exit(0)


def _run(coro):
    return asyncio.run(coro)


def test_pool_against_real_ssh_server():
    async def main():
        host_key = asyncssh.generate_private_key("ssh-ed25519")
        server = await asyncssh.listen("127.0.0.1", 0, server_factory=NoAuthServer,
                                       server_host_keys=[host_key], process_factory=handle)
        port = server.sockets[0].getsockname()[1]
        pool, t = SSHPool(), Target(host="127.0.0.1", port=port, username="secretcode")
        r = await pool.run(1, t, "echo hi", timeout=5)
        assert (r.stdout, r.exit_code, r.error) == ("ran:echo hi\n", 0, None)
        pool._conns[1].close()                                   # simulate a dropped connection
        r = await pool.run(1, t, "again", timeout=5)             # must transparently reconnect
        assert r.stdout == "ran:again\n" and r.error is None
        r = await pool.run(1, t, "sleep", timeout=1)
        assert r.error and "timed out" in r.error
        r = await pool.run(1, t, "echo after-timeout", timeout=5)
        assert r.error is None
        bad = await pool.run(2, Target(host="127.0.0.1", port=1, username="x"), "echo", timeout=5)
        assert bad.error and bad.exit_code is None
        await pool.close_all()
        server.close()
        await server.wait_closed()
    _run(main())
