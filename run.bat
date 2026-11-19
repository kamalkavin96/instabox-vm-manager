@echo off
rem One-command launcher: venv + deps + UI build + start server. Double-click or run run.bat
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10+ not found. Install it from python.org and tick Add Python to PATH.
  pause
  exit /b 1
)

if not exist backend\.venv\Scripts\activate.bat (
  python -m venv backend\.venv
  if errorlevel 1 (
    echo Could not create the virtual environment.
    pause
    exit /b 1
  )
)
call backend\.venv\Scripts\activate.bat
pip install -q -r backend\requirements.txt
if errorlevel 1 (
  echo Dependency install failed.
  pause
  exit /b 1
)

if not exist frontend\dist\.ui-v3 (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Node.js not found - skipping UI build. Install Node 18+ and rerun for the web UI.
  ) else (
    pushd frontend
    call npm install --no-audit --no-fund
    call npm run build
    echo ok> dist\.ui-v3
    popd
  )
)

if not exist backend\.env (
  python -c "import secrets;open('backend/.env','w').write('VMM_ADMIN_TOKEN='+secrets.token_urlsafe(24)+'\n')"
  echo Created backend\.env - your login token is the value after the equals sign:
  type backend\.env
)

cd backend
echo Open http://localhost:8000
uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
