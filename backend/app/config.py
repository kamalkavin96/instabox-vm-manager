import secrets
import sys
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from VMM_* environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_prefix="VMM_", env_file=".env", extra="ignore")

    admin_token: str = ""                # login token for the UI/API; auto-generated into data_dir if empty
    secret_key: str = ""                  # Fernet key; auto-generated in data_dir if empty
    data_dir: str = "./data"
    static_dir: str = ""                  # built React app; auto-detected if empty
    poll_interval: int = 60               # seconds between monitoring sweeps
    live_interval: int = 5                # seconds between samples while a browser is watching the dashboard
    monitor_enabled: bool = True
    ssh_connect_timeout: int = 15
    ssh_command_timeout: int = 60
    max_concurrency: int = 10             # parallel SSH sessions
    retention_days: int = 7               # metric history kept
    known_hosts: str = ""                 # path to known_hosts; empty = do not verify host keys
    cors_origins: str = ""                # comma separated, only needed for dev servers
    instabox_api_key: str = Field(default="", validation_alias=AliasChoices("VMM_INSTABOX_API_KEY", "INSTABOX_API_KEY"))
    instabox_api_url: str = Field(default="https://api.instabox.sh", validation_alias=AliasChoices("VMM_INSTABOX_API_URL", "INSTABOX_API_URL"))

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{Path(self.data_dir).resolve() / 'vmm.db'}"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    Path(s.data_dir).mkdir(parents=True, exist_ok=True)
    if not s.admin_token.strip():
        f = Path(s.data_dir) / ".admin_token"
        if not f.exists():
            f.write_text(secrets.token_urlsafe(24))
            f.chmod(0o600)
        s.admin_token = f.read_text().strip()
        print(f"\n  VMM_ADMIN_TOKEN is not set - using the generated login token:\n  {s.admin_token}\n"
              f"  (stored in {f}; set VMM_ADMIN_TOKEN to choose your own)\n", file=sys.stderr, flush=True)
    return s
