from .db import SessionLocal, Setting
from .security import decrypt, encrypt


async def get_secret(key: str) -> str:
    async with SessionLocal() as s:
        row = await s.get(Setting, key)
    if row is None:
        return ""
    try:
        return decrypt(row.value)
    except Exception:
        return ""


async def set_secret(key: str, value: str) -> None:
    async with SessionLocal() as s:
        row = await s.get(Setting, key)
        if row is None:
            s.add(Setting(key=key, value=encrypt(value)))
        else:
            row.value = encrypt(value)
        await s.commit()


async def delete_setting(key: str) -> None:
    async with SessionLocal() as s:
        row = await s.get(Setting, key)
        if row is not None:
            await s.delete(row)
            await s.commit()
