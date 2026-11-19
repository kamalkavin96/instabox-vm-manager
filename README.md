# VM Manager

Manage and monitor a fleet of Linux VMs (built for InstaBox) over SSH from one web UI.

**Stack:** FastAPI + asyncssh + SQLAlchemy/SQLite (backend) · React + Vite + TanStack Query + xterm.js + Recharts (frontend)

## Features
- **Live dashboard:** the server pushes every VM sample over a WebSocket (every ~5 s while a browser is watching), with sparklines, exact metrics (two decimals, raw load averages, exact timestamps), cards or table view, alerts, duplicate-machine warning.
- **VM detail:** CPU (user/system/iowait/steal/idle, per-core), memory (exact bytes, buffers/cache/swap), volumes with inodes, network rates and totals, processes, containers, history charts, **Live** mode (fresh sample every ~3 s).
- **Terminals:** real PTY shells in the browser (htop, btop, mc, vim). Open any number side by side, **broadcast typing** to all, one-click "send to all" for htop/btop/mc/top, resize, maximize, reconnect.
- **Files (SFTP):** all operations run over a WebSocket with per-operation spinners and progress. Dual-pane browser. Upload (drag and drop), download, edit text files, rename, delete, new folder, **copy between two VMs**, copy to many VMs, upload to many VMs.
- **Run commands:** same command on all, a selection, or one VM, in parallel, with history.
- **Ports & URLs:** listening ports from inside each VM (SSH) joined with InstaBox public preview URLs; publish/unpublish. Sources: InstaBox REST API, local `instabox` CLI, or SSH only.
- **InstaBox page:** save and verify your API key in the UI, usage/limits, machines, link machines to your VMs (or auto-link by name), manage published ports.
- **Processing indicators everywhere:** a top progress line plus spinners on every button and operation.
- **Dark / light / system theme**, responsive layout (phone to ultrawide).
- **One worker per VM:** each VM has its own monitoring task, schedule and failure isolation (Settings page shows them).

## Run
    ./run.sh          # Mac/Linux      (or run.bat on Windows)
The first run creates a venv, installs everything, builds the UI (needs Node 18+), generates `backend/.env` with your admin token and prints it, then serves http://localhost:8000.

Docker: `cp .env.example .env`, set `VMM_ADMIN_TOKEN`, `docker compose up -d --build`.

Development: `cd backend && pip install -r requirements-dev.txt && VMM_ADMIN_TOKEN=dev uvicorn app.main:app --reload`, then `cd frontend && npm install && npm run dev` (http://localhost:5173, proxies /api and WebSockets to :8000).

## Tests
    cd backend && python -m pytest -q      # API, SSH pool, terminal/file/event WebSockets, SFTP, copy, parsers
    cd frontend && npm test                # every page rendered against real backend data shapes

## Notes
- Existing databases are upgraded automatically on start.
- Per-VM workers are asyncio tasks, not OS threads: asyncssh is asyncio-native, so this isolates VMs without locks or thread overhead.
- InstaBox: set the API key on the InstaBox page (stored encrypted) or via `INSTABOX_API_KEY`. Port endpoints used: `GET/POST /v1/machines/{id}/ports`, `DELETE /v1/machines/{id}/ports/{port}`.

## Security
- Anyone with the admin token can run commands and open shells as the SSH user on every VM. Serve over HTTPS (Caddy/nginx) and restrict access.
- The terminal and download endpoints accept the token as a `?token=` query parameter (browsers cannot set headers on WebSockets/downloads); keep access logs private.
- SSH host keys are not verified unless `VMM_KNOWN_HOSTS` is set.
- Back up `data/` (SQLite DB + `.secret_key`).
