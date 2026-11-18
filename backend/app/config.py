from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from VMM_* environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_prefix="VMM_", env_file=".env", extra="ignore")

    admin_token: str                      # required: bearer token for the UI/API
    secret_key: str = ""                  # Fernet key; auto-generated in data_dir if empty
    data_dir: str = "./data"
    static_dir: str = ""                  # built React app; auto-detected if empty
    poll_interval: int = 60               # seconds between monitoring sweeps
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
    return s
