"""Startup check that explains itself.

Runs before migrations and before uvicorn. If the environment is wrong it
prints exactly which variable is at fault and what to do about it, then exits
non-zero — instead of letting a pydantic traceback or a psycopg stack scroll
past in the deploy log, which is what a misconfigured container used to do.

    python -m scripts.preflight
"""

from __future__ import annotations

import asyncio
import os
import sys

from app.core import platform as _platform

_platform.configure_event_loop()

LINE = "=" * 68


def _banner(title_uz: str, title_en: str) -> None:
    print(LINE, flush=True)
    print(f"  {title_uz}", flush=True)
    print(f"  {title_en}", flush=True)
    print(LINE, flush=True)


#: Variable -> (what it is in Uzbek, how to produce it)
GUIDE: dict[str, tuple[str, str]] = {
    "JWT_SECRET": (
        "Sessiya tokenlarini imzolash kaliti",
        'python -c "import secrets; print(secrets.token_urlsafe(48))"',
    ),
    "PASSWORD_REVEAL_KEY": (
        "Admin panelda parolni ko'rsatish uchun AES kaliti (32 bayt, base64)",
        'python -c "import base64,secrets; '
        'print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"',
    ),
    "DATABASE_URL": (
        "PostgreSQL ulanish manzili",
        "Railway: DATABASE_URL=${{Postgres.DATABASE_URL}} "
        "(Postgres o'rniga baza servisingiz nomini yozing)",
    ),
    "ENVIRONMENT": (
        "Ish rejimi",
        "ENVIRONMENT=production",
    ),
    "CORS_ORIGINS": (
        "Ruxsat etilgan frontend manzillari",
        "CORS_ORIGINS=https://maklersizuy.uz,https://www.maklersizuy.uz",
    ),
    "OTP_DEBUG_RETURN_CODE": (
        "SMS kodini javobda qaytarish (productionda taqiqlangan)",
        "OTP_DEBUG_RETURN_CODE=false",
    ),
}


def report_config() -> object | None:
    from app.core.config import load_settings_or_report

    settings, problems = load_settings_or_report()
    if settings is not None:
        return settings

    _banner(
        "SOZLAMALARDA XATO — konteyner ishga tushmaydi",
        "CONFIGURATION ERROR — the container cannot start",
    )
    for problem in problems:
        print(f"  ✗ {problem}", flush=True)

        # Name every variable the message mentions, with a concrete fix.
        for name, (what, how) in GUIDE.items():
            if name in problem:
                print(f"      {name} — {what}", flush=True)
                print(f"      → {how}", flush=True)

    print(flush=True)
    print("  Railway: Service → Variables → Raw Editor", flush=True)
    print("  To'liq ro'yxat / full list: RAILWAY_ENV.md", flush=True)
    print(LINE, flush=True)
    return None


def report_missing_in_production(settings) -> bool:
    """Warn about variables that are legal but will disable a feature."""
    notes: list[tuple[str, str]] = []

    if not settings.DEVSMS_API_TOKEN or not settings.SMS_ENABLED:
        notes.append((
            "SMS o'chiq — ro'yxatdan o'tish yakunlanmaydi",
            "SMS is off: public signup cannot complete. Seed accounts with "
            "scripts/create_account.py until DEVSMS_API_TOKEN is set.",
        ))
    if not settings.FIREBASE_PROJECT_ID:
        notes.append((
            "Google orqali kirish o'chiq",
            "FIREBASE_PROJECT_ID is empty: Google sign-in is disabled.",
        ))
    if not settings.OPENAI_API_KEY:
        notes.append((
            "AI faqat qoidalar bo'yicha ishlaydi",
            "OPENAI_API_KEY is empty: moderation falls back to the rule engine "
            "and Shield AI replies are templated. This is safe, just reduced.",
        ))
    if not settings.TELEGRAM_BOT_TOKEN:
        notes.append((
            "Telegram xabarnomalari o'chiq",
            "TELEGRAM_BOT_TOKEN is empty: operations notifications are off.",
        ))

    if notes:
        print(LINE, flush=True)
        print("  DIQQAT / NOTICE — ishga tushadi, lekin ba'zi imkoniyat o'chiq", flush=True)
        print(LINE, flush=True)
        for uz, en in notes:
            print(f"  • {uz}", flush=True)
            print(f"    {en}", flush=True)
        print(LINE, flush=True)
    return True


async def check_database(settings) -> bool:
    """Confirm the database is actually reachable before alembic runs."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = None
    try:
        # Engine construction itself throws when the URL is malformed — for
        # example when a Railway ${{...}} reference was never substituted —
        # so it has to be inside the guard, not before it.
        engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001
        _banner(
            "BAZAGA ULANIB BO'LMADI",
            "CANNOT REACH THE DATABASE",
        )
        detail = str(exc).splitlines()[0][:200]
        print(f"  ✗ {detail}", flush=True)
        print(flush=True)

        raw = os.environ.get("DATABASE_URL", "")
        if "${{" in raw:
            print(
                "  DATABASE_URL hali havola holida qolgan — Railway uni "
                "almashtira olmadi.",
                flush=True,
            )
            print(
                "  The reference was not substituted: the service name inside "
                "${{...}} does not match your Postgres service.",
                flush=True,
            )
        elif "railway.internal" in raw:
            print(
                "  Ichki manzil faqat bir loyiha ichidan ishlaydi — API va "
                "Postgres bitta loyihada ekanini tekshiring.",
                flush=True,
            )
            print(
                "  An internal host only resolves inside the same project.",
                flush=True,
            )
        else:
            print("  DATABASE_URL ni tekshiring / check DATABASE_URL.", flush=True)
        print(LINE, flush=True)
        return False
    finally:
        if engine is not None:
            await engine.dispose()


def main() -> int:
    settings = report_config()
    if settings is None:
        return 1

    print(
        f"preflight: environment={settings.ENVIRONMENT} "
        f"reveal={'on' if settings.PASSWORD_REVEAL_ENABLED else 'off'} "
        f"sms={'on' if (settings.SMS_ENABLED and settings.DEVSMS_API_TOKEN) else 'off'}",
        flush=True,
    )

    if not asyncio.run(check_database(settings)):
        return 1

    report_missing_in_production(settings)
    print("preflight: OK", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
