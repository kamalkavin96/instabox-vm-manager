from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import get_settings

engine = create_async_engine(get_settings().database_url)


@event.listens_for(engine.sync_engine, "connect")
def _sqlite_pragmas(conn, _):
    cur = conn.cursor()
    for p in ("journal_mode=WAL", "foreign_keys=ON", "busy_timeout=5000", "synchronous=NORMAL"):
        cur.execute(f"PRAGMA {p}")
    cur.close()


SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


class Base(DeclarativeBase):
    pass


class VM(Base):
    __tablename__ = "vms"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    host: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(default=22)
    conn_enc: Mapped[str] = mapped_column(Text)            # encrypted {"username","key"}; the secret code lives here
    tags: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(20), default="unknown")   # online | offline | unknown
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    latest: Mapped[dict | None] = mapped_column(JSON, nullable=True)     # last full snapshot
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Metric(Base):
    __tablename__ = "metrics"
    __table_args__ = (Index("ix_metrics_vm_ts", "vm_id", "ts"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    vm_id: Mapped[int] = mapped_column(ForeignKey("vms.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    cpu: Mapped[float | None]
    mem: Mapped[float | None]
    swap: Mapped[float | None]
    disk: Mapped[float | None]
    load1: Mapped[float | None]


class CommandRun(Base):
    __tablename__ = "command_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    command: Mapped[str] = mapped_column(Text)
    results: Mapped[list] = mapped_column(JSON, default=list)
