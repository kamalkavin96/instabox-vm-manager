"""Runs one dependency-free shell script on a VM and turns the output into a structured snapshot."""
import re
from datetime import datetime, timezone

SCRIPT = r"""
export LC_ALL=C
sec(){ echo "###$1"; }
sec sys
echo "hostname=$(hostname)"
echo "os=$( . /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")"
echo "kernel=$(uname -r)"
echo "arch=$(uname -m)"
echo "uptime=$(cut -d' ' -f1 /proc/uptime)"
echo "load=$(cut -d' ' -f1-3 /proc/loadavg)"
echo "cpus=$(nproc)"
echo "users=$(who 2>/dev/null | wc -l)"
echo "procs=$(ls -d /proc/[0-9]* 2>/dev/null | wc -l)"
echo "failed_units=$(systemctl --failed --no-legend 2>/dev/null | wc -l)"
echo "reboot_required=$([ -f /var/run/reboot-required ] && echo 1 || echo 0)"
sec cpu
head -1 /proc/stat; sleep 1; head -1 /proc/stat
sec mem
grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo
sec disk
df -PT -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | tail -n +2
sec ports
ss -H -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null | tail -n +3
sec top
ps -eo pid,user:20,pcpu,pmem,comm --sort=-pcpu --no-headers 2>/dev/null | head -5
sec docker
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' 2>/dev/null
sec net
tail -n +3 /proc/net/dev 2>/dev/null
sec end
"""

SERVICES = {22: "ssh", 25: "smtp", 53: "dns", 80: "http", 443: "https", 3000: "web app", 3306: "mysql",
            5432: "postgres", 5672: "rabbitmq", 6379: "redis", 8000: "web app", 8080: "web app",
            8443: "https", 9090: "prometheus", 9100: "node_exporter", 27017: "mongodb"}
_PUBLIC = {"0.0.0.0", "*", "::", ""}


def _sections(text: str) -> dict:
    out, cur = {}, None
    for line in text.splitlines():
        if line.startswith("###"):
            cur = line[3:].strip()
            out[cur] = []
        elif cur:
            out[cur].append(line.rstrip())
    return out


def _num(v, cast=float, default=0):
    try:
        return cast(v)
    except (TypeError, ValueError):
        return default


def _cpu_percent(lines):
    rows = [l.split() for l in lines if l.startswith("cpu ")]
    if len(rows) < 2:
        return None
    a, b = [[int(x) for x in r[1:9]] for r in rows[:2]]
    total = sum(b) - sum(a)
    idle = (b[3] + b[4]) - (a[3] + a[4]) if len(b) > 4 else b[3] - a[3]
    return round(100 * (total - idle) / total, 1) if total > 0 else 0.0


def _memory(lines):
    m = {}
    for l in lines:
        k, _, v = l.partition(":")
        parts = v.split()
        m[k] = _num(parts[0] if parts else 0, int) * 1024
    total, avail = m.get("MemTotal", 0), m.get("MemAvailable", 0)
    st, sf = m.get("SwapTotal", 0), m.get("SwapFree", 0)
    used = max(total - avail, 0)
    return {"total": total, "used": used, "available": avail,
            "percent": round(100 * used / total, 1) if total else 0.0,
            "swap_total": st, "swap_used": max(st - sf, 0),
            "swap_percent": round(100 * (st - sf) / st, 1) if st else 0.0}


def _disks(lines):
    seen, out = set(), []
    for l in lines:
        p = l.split()
        if len(p) < 7:
            continue
        size, used, avail = (_num(x, int) for x in p[2:5])
        mount = " ".join(p[6:])
        if size <= 0 or mount in seen:
            continue
        seen.add(mount)
        pct = _num(p[5].rstrip("%"), float, round(100 * used / size, 1))
        out.append({"fs": p[0], "type": p[1], "size": size, "used": used, "avail": avail,
                    "percent": pct, "mount": mount})
    return out


def _ports(lines):
    found = {}
    for l in lines:
        p = l.split()
        if len(p) < 5 or not p[0].startswith(("tcp", "udp")):
            continue
        if not p[1].isdigit():                       # ss: Netid State Recv-Q Send-Q Local Peer [Process]
            proto, local, proc = p[0], p[4], " ".join(p[6:])
        else:                                        # netstat: Proto Recv-Q Send-Q Local Foreign [State] PID/Prog
            proto, local = p[0], p[3]
            proc = p[-1] if "/" in p[-1] else ""
        addr, _, port = local.rpartition(":")
        addr = addr.split("%")[0].strip("[]")
        if not port.isdigit():
            continue
        m = re.search(r'users:\(\("([^"]+)",pid=(\d+)', proc)
        if m:
            name, pid = m.group(1), int(m.group(2))
        elif "/" in proc:
            pid_s, name = proc.split("/", 1)
            pid = int(pid_s) if pid_s.isdigit() else None
        else:
            name, pid = "", None
        base = proto.rstrip("6")
        exposed = addr in _PUBLIC
        found.setdefault((base, int(port), exposed), {
            "proto": base, "port": int(port), "address": addr or "*", "exposed": exposed,
            "process": name, "pid": pid, "service": SERVICES.get(int(port), "")})
    return sorted(found.values(), key=lambda x: (x["port"], x["proto"]))


def _net(lines):
    rx = tx = 0
    for l in lines:
        iface, _, rest = l.partition(":")
        iface, f = iface.strip(), rest.split()
        if iface == "lo" or iface.startswith(("veth", "docker", "br-")) or len(f) < 9:
            continue
        rx += _num(f[0], int)
        tx += _num(f[8], int)
    return {"rx_bytes": rx, "tx_bytes": tx}


def alerts_for(snap: dict) -> list:
    a = []
    cpu, mem = snap["cpu"]["percent"], snap["memory"]["percent"]
    if cpu is not None and cpu >= 90:
        a.append({"level": "critical", "message": f"CPU at {cpu}%"})
    if mem >= 90:
        a.append({"level": "critical", "message": f"Memory at {mem}%"})
    for d in snap["disks"]:
        if d["percent"] >= 90:
            a.append({"level": "critical", "message": f"Disk {d['mount']} at {d['percent']:.0f}%"})
        elif d["percent"] >= 80:
            a.append({"level": "warning", "message": f"Disk {d['mount']} at {d['percent']:.0f}%"})
    if snap["system"]["failed_units"]:
        a.append({"level": "warning", "message": f"{snap['system']['failed_units']} failed systemd unit(s)"})
    if snap["system"]["reboot_required"]:
        a.append({"level": "info", "message": "Reboot required"})
    return a


def parse_output(text: str) -> dict:
    sec = _sections(text)
    if "sys" not in sec or "end" not in sec:
        raise ValueError("Incomplete monitoring output")
    kv = {k: v for k, _, v in (l.partition("=") for l in sec["sys"]) if k}
    load = [_num(x) for x in kv.get("load", "").split()]
    snap = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "system": {"hostname": kv.get("hostname", ""), "os": kv.get("os", ""), "kernel": kv.get("kernel", ""),
                   "arch": kv.get("arch", ""), "uptime_seconds": int(_num(kv.get("uptime"))),
                   "users": _num(kv.get("users"), int), "processes": _num(kv.get("procs"), int),
                   "failed_units": _num(kv.get("failed_units"), int),
                   "reboot_required": kv.get("reboot_required") == "1"},
        "cpu": {"percent": _cpu_percent(sec.get("cpu", [])), "cores": _num(kv.get("cpus"), int), "load": load},
        "memory": _memory(sec.get("mem", [])),
        "disks": _disks(sec.get("disk", [])),
        "ports": _ports(sec.get("ports", [])),
        "top": [dict(zip(("pid", "user", "cpu", "mem", "command"), l.split(None, 4)))
                for l in sec.get("top", []) if len(l.split(None, 4)) == 5],
        "containers": [dict(zip(("name", "image", "status", "ports"), l.split("|", 3)))
                       for l in sec.get("docker", []) if l.count("|") == 3],
        "network": _net(sec.get("net", [])),
    }
    snap["alerts"] = alerts_for(snap)
    return snap


def summarize(snap: dict | None) -> dict | None:
    if not snap:
        return None
    return {"cpu": snap["cpu"]["percent"], "mem": snap["memory"]["percent"],
            "disk": max((d["percent"] for d in snap["disks"]), default=0),
            "load1": (snap["cpu"]["load"] or [0])[0], "os": snap["system"]["os"],
            "uptime_seconds": snap["system"]["uptime_seconds"],
            "ports": len(snap["ports"]), "public_ports": sum(p["exposed"] for p in snap["ports"]),
            "containers": len(snap["containers"]), "alerts": snap["alerts"]}
