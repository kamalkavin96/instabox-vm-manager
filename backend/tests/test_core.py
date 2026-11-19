import pytest

from app.collector import SCRIPT, parse_output
from app.ssh import parse_ssh_command


def test_parse_plain():
    t = parse_ssh_command("ssh secretcode123@ssh.example.sh")
    assert (t.host, t.port, t.username) == ("ssh.example.sh", 22, "secretcode123")


def test_parse_options():
    t = parse_ssh_command("ssh -o StrictHostKeyChecking=no -tt -p 2222 abc@1.2.3.4 uptime")
    assert (t.host, t.port, t.username) == ("1.2.3.4", 2222, "abc")
    t = parse_ssh_command("ssh -p2200 -l bob host.example")
    assert (t.host, t.port, t.username) == ("host.example", 2200, "bob")
    t = parse_ssh_command("ssh -o User=u -o HostName=h.example -o Port=2020 alias")
    assert (t.host, t.port, t.username) == ("h.example", 2020, "u")


def test_parse_errors():
    for bad in ("ssh", "ssh -p", "ssh -p abc x@y", "ssh -J jump x@y", "ssh -i /nope/key x@y", "ssh 'unclosed"):
        with pytest.raises(ValueError):
            parse_ssh_command(bad)


def test_parse_ipv6_and_at_in_code():
    assert parse_ssh_command("ssh me@[::1]").host == "::1"
    t = parse_ssh_command("ssh a@b@host")
    assert (t.username, t.host) == ("a@b", "host")


def test_collector_real_script(tmp_path):
    import subprocess
    out = subprocess.run(["bash", "-c", SCRIPT], capture_output=True, text=True, timeout=30).stdout
    snap = parse_output(out)
    assert snap["memory"]["total"] > 0 and 0 <= snap["cpu"]["percent"] <= 100
    assert snap["cpu"]["cores"] >= 1 and snap["system"]["uptime_seconds"] > 0
    assert isinstance(snap["disks"], list) and isinstance(snap["ports"], list)


def test_ports_parsing():
    out = """###sys
cpus=2
load=0.1 0.2 0.3
###t1
1000.00
###t2
1001.00
###cpu1
cpu  100 0 100 800 0 0 0 0
cpu0 50 0 50 400 0 0 0 0
cpu1 50 0 50 400 0 0 0 0
###cpu2
cpu  110 0 110 880 0 0 0 0
cpu0 60 0 60 440 0 0 0 0
cpu1 50 0 50 440 0 0 0 0
###net1
eth0: 1000 1 0 0 0 0 0 0 2000 1 0 0 0 0 0 0
###net2
eth0: 3000 2 0 0 0 0 0 0 2500 2 0 0 0 0 0 0
###mem
MemTotal: 1000 kB
MemAvailable: 50 kB
###disk
/dev/vda1 ext4 1000 900 100 90% /
###ports
tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=10,fd=3))
tcp LISTEN 0 128 [::]:22 [::]:* users:(("sshd",pid=10,fd=4))
tcp LISTEN 0 511 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=99,fd=20))
udp UNCONN 0 0 127.0.0.53%lo:53 0.0.0.0:*
###end
"""
    s = parse_output(out)
    assert [(p["port"], p["exposed"]) for p in s["ports"]] == [(22, True), (53, False), (3000, False)]
    assert s["ports"][0]["process"] == "sshd" and s["ports"][2]["process"] == "node"
    assert s["cpu"]["percent"] == pytest.approx(20.0, abs=0.01) and len(s["cpu"]["per_core"]) == 2
    assert s["cpu"]["idle"] == pytest.approx(80.0, abs=0.01)
    assert (s["network"]["rx_rate"], s["network"]["tx_rate"]) == (2000.0, 500.0)
    assert any("Disk /" in a["message"] for a in s["alerts"]) and any("Memory" in a["message"] for a in s["alerts"])


def test_incomplete_output_rejected():
    from app.collector import parse_output as po
    with pytest.raises(ValueError):
        po("garbage")
