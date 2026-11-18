# VM Manager

Manage and monitor a fleet of Linux VMs (built for InstaBox) over SSH from one web UI.

**Stack:** FastAPI + asyncssh + SQLAlchemy/SQLite (backend) · React + Vite + TanStack Query + Recharts (frontend)

## Features
- Add a VM by pasting the `ssh ...` command InstaBox gives you (secret code, no password). Connection is tested before saving; the secret is Fernet-encrypted in SQLite and never returned by the API.
- Run one command on all VMs, a selection, or one VM, in parallel, with per-VM stdout/stderr/exit code/duration, timeouts and history.
- Monitoring every 60 s (configurable): CPU, load, memory, swap, every mounted volume, OS/kernel/uptime, failed systemd units, reboot-required, top processes, Docker containers, network totals; 7 days of history charts; alerts (CPU/mem >= 90 %, disk >= 80/90 %).
- Listening ports for every VM (TCP/UDP, bind address, owning process, public vs local), fleet-wide filterable view.
- InstaBox page: read-only list of machines from the InstaBox API (`GET /v1/machines`, `X-API-Key`).

## Run (Docker)
    cp .env.example .env     # set VMM_ADMIN_TOKEN
    docker compose up -d --build
    open http://localhost:8000

## Run (development)
    cd backend && pip install -r requirements-dev.txt
    VMM_ADMIN_TOKEN=dev uvicorn app.main:app --reload
    cd frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api to :8000)

## Tests
    cd backend && python -m pytest -q

## Security notes
- Anyone with the admin token can run commands as root on every VM. Serve over HTTPS (reverse proxy such as Caddy/nginx) and do not expose it publicly without IP restrictions or SSO in front.
- Host keys are not verified unless `VMM_KNOWN_HOSTS` points to a known_hosts file.
- Back up the `data/` directory (SQLite DB + `.secret_key`); without the key the stored secrets cannot be decrypted.

## Layout
    backend/app/ssh.py        SSH command parser + pooled connections (reconnect, timeouts, concurrency cap)
    backend/app/collector.py  remote monitoring script + parser + alert rules
    backend/app/monitor.py    polling loop, persistence, retention
    backend/app/routes/       REST API (vms, commands, instabox)
    frontend/src/pages/       Dashboard, VM detail, Commands, Ports, InstaBox
