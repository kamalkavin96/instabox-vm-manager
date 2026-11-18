def test_auth_required(client):
    assert client.get("/api/vms", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/api/health").status_code == 200


def test_vm_lifecycle_and_commands(client):
    r = client.post("/api/vms", json={"name": "vm1", "ssh_command": "ssh secret1@localhost", "tags": ["a"]})
    assert r.status_code == 201, r.text
    vm = r.json()
    assert vm["status"] == "online" and vm["latest"]["memory"]["total"] > 0
    assert "secret1" not in r.text                           # the secret code is never returned
    assert client.post("/api/vms", json={"name": "vm1", "ssh_command": "ssh x@localhost"}).status_code == 409
    r = client.post("/api/vms", json={"name": "bad", "ssh_command": "ssh x@unreachable.invalid"})
    assert r.status_code == 422 and "Could not connect" in r.json()["detail"]
    assert client.post("/api/vms", json={"name": "nouser", "ssh_command": "ssh localhost"}).status_code == 422
    client.post("/api/vms", json={"name": "vm2", "ssh_command": "ssh secret2@localhost"})
    assert len(client.get("/api/vms").json()) == 2

    r = client.post("/api/commands", json={"command": "echo hello; echo err >&2; exit 3"})
    res = r.json()["results"]
    assert len(res) == 2 and all(x["stdout"] == "hello\n" and x["exit_code"] == 3 and x["stderr"] == "err\n" for x in res)
    r = client.post("/api/commands", json={"command": "echo one", "vm_ids": [vm["id"]]})
    assert len(r.json()["results"]) == 1
    assert client.post("/api/commands", json={"command": "x", "vm_ids": []}).status_code == 422
    assert len(client.get("/api/commands/history").json()) == 2

    assert len(client.get(f"/api/vms/{vm['id']}/metrics").json()) >= 1
    assert isinstance(client.get("/api/ports").json(), list)
    r = client.patch(f"/api/vms/{vm['id']}", json={"notes": "hi", "tags": ["x", " "]})
    assert r.json()["notes"] == "hi" and r.json()["tags"] == ["x"]
    assert client.post(f"/api/vms/{vm['id']}/refresh").status_code == 200
    assert client.delete(f"/api/vms/{vm['id']}").status_code == 204
    assert client.get(f"/api/vms/{vm['id']}").status_code == 404


def test_instabox_not_configured(client):
    assert client.get("/api/instabox/machines").status_code == 503
