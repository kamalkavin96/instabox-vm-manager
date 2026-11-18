#!/usr/bin/env bash
# One-command launcher: venv + deps + UI build + start server. Usage: ./run.sh   (PORT=9000 ./run.sh to change port)
set -e
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python || true)
[ -z "$PY" ] && { echo "Python 3.10+ not found. Install it from python.org"; exit 1; }

[ -d backend/.venv ] || "$PY" -m venv backend/.venv
. backend/.venv/bin/activate
pip install -q -r backend/requirements.txt

if [ ! -d frontend/dist ]; then
  if command -v npm >/dev/null 2>&1; then
    (cd frontend && npm install --no-audit --no-fund && npm run build)
  else
    echo "Node.js not found - skipping UI build (API only). Install Node 18+ and rerun for the web UI."
  fi
fi

if [ ! -f backend/.env ]; then
  python -c "import secrets;open('backend/.env','w').write('VMM_ADMIN_TOKEN='+secrets.token_urlsafe(24)+'\n')"
  chmod 600 backend/.env
  echo "Created backend/.env - your login token is:"
  grep VMM_ADMIN_TOKEN backend/.env | cut -d= -f2
fi

cd backend
echo "Open http://localhost:${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
