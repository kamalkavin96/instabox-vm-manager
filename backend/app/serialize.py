from .collector import summarize
from .db import VM, iso


def vm_out(vm: VM, detail: bool = False) -> dict:
    out = {"id": vm.id, "name": vm.name, "host": vm.host, "port": vm.port, "tags": vm.tags or [],
           "notes": vm.notes, "enabled": vm.enabled, "status": vm.status, "last_seen": iso(vm.last_seen),
           "last_error": vm.last_error, "created_at": iso(vm.created_at), "instabox_id": vm.instabox_id,
           "summary": summarize(vm.latest)}
    if detail:
        out["latest"] = vm.latest
    return out
