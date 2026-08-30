"""Test fixtures: a real Postgres, a real app, a real HTTP client.

These are integration tests on purpose. The bugs that mattered in the old
backend - forgeable tokens, a login that ignored the password, unauthenticated
admin routes - all live in the seams between layers, which unit tests with
mocked databases would have stepped straight over.
"""

from __future__ import annotations

import os
import uuid

import pytest

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:devpass@localhost:55432/uyiz"
)
os.environ.setdefault("OTP_DEBUG_RETURN_CODE", "true")
os.environ.setdefault("SMS_ENABLED", "false")
os.environ.setdefault("RATE_LIMIT_GLOBAL_PER_MINUTE", "100000")

from app.core import platform as _platform  # noqa: E402

_platform.configure_event_loop()

import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import AdminRole  # noqa: E402
from app.models.user import AdminUser  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as ac:
        yield ac


@pytest.fixture
async def db():
    async with SessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
async def clean_tables():
    """Truncate between tests so each one starts from a known state."""
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, admin_users, listings, top_requests, favorites, "
                "reports, verification_requests, refresh_tokens, otp_codes, "
                "pending_registrations, login_attempts, audit_logs, "
                "ai_sessions, ai_messages, sms_logs, traffic_events "
                "RESTART IDENTITY CASCADE"
            )
        )
    # Rate limiters are process-global; reset so tests do not lock each other out.
    from app.core.rate_limit import limiter

    limiter._windows.clear()
    yield


@pytest.fixture
def unique_phone():
    """A distinct, valid Uzbek number per call."""
    counter = {"n": 0}

    def _next() -> str:
        counter["n"] += 1
        suffix = f"{(uuid.uuid4().int % 10_000_000) + counter['n']:07d}"[-7:]
        return f"+99890{suffix}"

    return _next


@pytest.fixture
async def admin_account(db):
    admin = AdminUser(
        username="testadmin",
        full_name="Test Admin",
        password_hash=hash_password("AdminPass2026!x"),
        role=AdminRole.SUPERADMIN.value,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    return admin


async def register_and_verify(
    client: httpx.AsyncClient, phone: str, password: str = "Salom2026x", **kwargs
) -> dict:
    """Complete the full three-step signup and return the token payload."""
    payload = {
        "name": kwargs.get("name", "Test Foydalanuvchi"),
        "phone": phone,
        "password": password,
        "confirmPassword": password,
        "role": kwargs.get("role", "STUDENT"),
        "language": kwargs.get("language", "uz"),
    }
    started = await client.post("/api/v1/auth/register", json=payload)
    assert started.status_code == 202, started.text
    code = started.json()["debugCode"]
    assert code, "debug code should be returned in test mode"

    verified = await client.post(
        "/api/v1/auth/verify-code", json={"phone": phone, "code": code}
    )
    assert verified.status_code == 200, verified.text
    return verified.json()


def auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}
