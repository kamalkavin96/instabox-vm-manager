import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .db import Base, engine
from .workers import manager
from .routes import commands, events, files, files_ws, instabox, terminal, vms
from .security import require_auth
from .ssh import get_pool

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        cols = {r[1] for r in (await conn.exec_driver_sql("PRAGMA table_info(vms)")).fetchall()}
        if "instabox_id" not in cols:                     # tiny in-place migration for databases from v1
            await conn.exec_driver_sql("ALTER TABLE vms ADD COLUMN instabox_id VARCHAR(100)")
    if get_settings().monitor_enabled:
        await manager.start_all()
    yield
    await manager.stop_all()
    await get_pool().close_all()
    await engine.dispose()


app = FastAPI(title="VM Manager", lifespan=lifespan)
s = get_settings()
if s.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in s.cors_origins.split(",")],
                       allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/auth/check", dependencies=[Depends(require_auth)])
async def auth_check():
    return {"ok": True}


for r in (vms.router, commands.router, instabox.router, files.router, terminal.router, events.router, files_ws.router):
    app.include_router(r)

_static = Path(s.static_dir) if s.static_dir else Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _static.is_dir():
    app.mount("/", StaticFiles(directory=_static, html=True), name="ui")
