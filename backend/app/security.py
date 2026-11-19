import secrets
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import Header, HTTPException

from .config import get_settings


@lru_cache
def _fernet() -> Fernet:
    s = get_settings()
    key = s.secret_key.strip()
    if not key:
        path = Path(s.data_dir) / ".secret_key"
        if not path.exists():
            path.write_text(Fernet.generate_key().decode())
            path.chmod(0o600)
        key = path.read_text().strip()
    return Fernet(key.encode())


def encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def require_auth(authorization: str = Header(default="")) -> None:
    token = authorization.removeprefix("Bearer ").strip()
    if not token or not secrets.compare_digest(token, get_settings().admin_token):
        raise HTTPException(401, "Invalid or missing token")


def token_ok(token: str) -> bool:
    return bool(token) and secrets.compare_digest(token, get_settings().admin_token)


def require_auth_flex(authorization: str = Header(default=""), token: str = "") -> None:
    """Header auth, or ?token= for browser downloads that cannot send headers."""
    if not (token_ok(authorization.removeprefix("Bearer ").strip()) or token_ok(token)):
        raise HTTPException(401, "Invalid or missing token")
