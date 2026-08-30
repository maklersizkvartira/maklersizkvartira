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
        # Admin panel alohida deployment - uning manzili ham shu ro‘yxatda
        # bo‘lishi shart, aks holda panel ochiladi-yu, har bir so‘rov uziladi.
        "Ruxsat etilgan frontend manzillari (sayt + admin panel)",
        # Eski domen maklersizuy.uz hozircha uyiz.uz ga 301 bilan yo'naltiriladi,
        # shuning uchun u ham ro'yxatda qoladi — CORS aniq mos kelishni talab
        # qiladi, joker belgi ishlamaydi.
        "CORS_ORIGINS=https://uyiz.uz,https://www.uyiz.uz,https://admin.uyiz.uz,"
        "https://maklersizuy.uz,https://www.maklersizuy.uz,"
        "https://admin.maklersizuy.uz",
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


async def report_sms_balance(settings) -> None:
    """Show how much SMS credit is left, when SMS is on.

    Running out stops signup dead and nothing inside the app explains why —
    the code is generated, the send fails, and the visitor sees a generic
    error. Printing it at boot is the cheapest place to notice.
    """
    if not settings.SMS_ENABLED or not settings.DEVSMS_API_TOKEN:
        return
    from app.services.sms import check_balance

    credit = await check_balance()
    if credit is None:
        print(
            "preflight: sms=on (balansni tekshirib bo'lmadi / balance check failed)",
            flush=True,
        )
        return

    remaining = credit["remaining_sms"]
    print(
        f"preflight: sms=on balance={credit['balance']:.0f} "
        f"price={credit['sms_price']:.0f} remaining={remaining}",
        flush=True,
    )
    if remaining is not None and remaining < 50:
        print(LINE, flush=True)
        print(
            f"  DIQQAT: SMS krediti tugayapti — atigi {remaining} ta SMS qoldi.",
            flush=True,
        )
        print(
            f"  WARNING: only {remaining} messages of credit left. Signup stops "
            "working when it runs out.",
            flush=True,
        )
        print(LINE, flush=True)


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
            "Uyiz AI faqat tayyor javoblar bilan ishlaydi",
            "OPENAI_API_KEY is empty: Uyiz AI falls back to templated replies "
            "and cannot hold a real conversation. This is safe, just reduced.",
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
        print(
            "  Muqobil: Postgres servisidan PGHOST, PGUSER, PGPASSWORD, "
            "PGDATABASE ni API servisiga qo'shsangiz ham yetadi.",
            flush=True,
        )
        print(
            "  Alternative: copying PGHOST/PGUSER/PGPASSWORD/PGDATABASE into "
            "the API service is enough - the URL is assembled from them.",
            flush=True,
        )
        print(LINE, flush=True)
        return False
    finally:
        if engine is not None:
            await engine.dispose()


def main() -> int:
    settings = report_config()
    if settings is None:
        return 1

    # Show where the database actually resolved to, with the password removed,
    # so a wrong host is obvious without exposing the credential.
    from urllib.parse import urlparse

    try:
        parsed = urlparse(settings.DATABASE_URL)
        target = f"{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    except Exception:  # noqa: BLE001
        target = "(unparseable)"

    raw = os.environ.get("DATABASE_URL", "").strip()
    source = "DATABASE_URL" if (raw and "${{" not in raw) else "PG* variables"

    print(
        f"preflight: environment={settings.ENVIRONMENT} "
        f"reveal={'on' if settings.PASSWORD_REVEAL_ENABLED else 'off'} "
        f"sms={'on' if (settings.SMS_ENABLED and settings.DEVSMS_API_TOKEN) else 'off'}",
        flush=True,
    )
    print(f"preflight: database={target} (source: {source})", flush=True)

    if not asyncio.run(check_database(settings)):
        return 1

    report_missing_in_production(settings)
    asyncio.run(report_sms_balance(settings))
    print("preflight: OK", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
