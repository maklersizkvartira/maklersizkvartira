"""Access-token minting and refresh-token rotation.

Access tokens are short-lived signed JWTs. Refresh tokens are opaque random
secrets stored only as SHA-256 hashes, rotated on every use, and grouped into
a "family" so that replaying a spent token revokes the whole chain.

This replaces the previous scheme, where a token was literally
``token_<userId>_<timestamp>`` and could be forged for any account by anyone
who knew a user id.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_token, hash_token
from app.models.auth import RefreshToken

ISSUER = "uyiz.uz"
AUDIENCE = "uyiz.uz/api"

#: The claims the brand used before the rename to Uyiz. Every access token
#: minted from now on carries the new pair, but tokens issued by the previous
#: release are still inside their 15-minute (user) / 30-minute (admin) window
#: when the new one starts serving, and rejecting them would fail one request
#: per active client. `decode_access_token` therefore accepts either pair.
#:
#: Delete both constants — and the fallback in decode_access_token — once the
#: longest access-token TTL has elapsed since the deploy. Nothing else depends
#: on them: refresh tokens are opaque random rows with no issuer inside.
LEGACY_ISSUER = "maklersiz.uz"
LEGACY_AUDIENCE = "maklersiz.uz/api"

SubjectType = Literal["user", "admin"]


class TokenError(Exception):
    """Raised for any token that is missing, malformed, expired or revoked."""

    def __init__(self, code: str = "token_invalid") -> None:
        super().__init__(code)
        self.code = code


@dataclass(slots=True)
class AccessTokenClaims:
    subject_id: uuid.UUID
    subject_type: SubjectType
    role: str
    token_version: int
    session_id: uuid.UUID
    jti: str
    expires_at: datetime


@dataclass(slots=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int
    session_id: uuid.UUID


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Access tokens
# ---------------------------------------------------------------------------
def create_access_token(
    *,
    subject_id: uuid.UUID,
    subject_type: SubjectType,
    role: str,
    token_version: int,
    session_id: uuid.UUID,
) -> tuple[str, int]:
    """Return ``(jwt, ttl_seconds)``."""
    ttl_minutes = (
        settings.ADMIN_ACCESS_TOKEN_TTL_MINUTES
        if subject_type == "admin"
        else settings.ACCESS_TOKEN_TTL_MINUTES
    )
    now = _now()
    expires_at = now + timedelta(minutes=ttl_minutes)
    payload: dict[str, Any] = {
        "sub": str(subject_id),
        "typ": subject_type,
        "role": role,
        "tv": token_version,
        "sid": str(session_id),
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, ttl_minutes * 60


def decode_access_token(token: str) -> AccessTokenClaims:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            # A list of audiences means "any one of these", which is exactly
            # the transition rule: new tokens carry the new audience, tokens
            # still in flight from the previous release carry the old one.
            audience=[AUDIENCE, LEGACY_AUDIENCE],
            options={"require": ["exp", "iat", "sub", "typ", "sid", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("token_invalid") from exc

    # The issuer is checked here rather than through jwt.decode's `issuer=`
    # kwarg because that argument takes a single value in the PyJWT releases
    # this project has to run on, and during the rename two are valid. The
    # claim itself is still mandatory - it is in the `require` list above - so
    # a token without one never reaches this comparison.
    if payload.get("iss") not in (ISSUER, LEGACY_ISSUER):
        raise TokenError("token_invalid")

    try:
        subject_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (KeyError, ValueError) as exc:
        raise TokenError("token_invalid") from exc

    subject_type = payload.get("typ")
    if subject_type not in ("user", "admin"):
        raise TokenError("token_invalid")

    return AccessTokenClaims(
        subject_id=subject_id,
        subject_type=subject_type,
        role=str(payload.get("role", "")),
        token_version=int(payload.get("tv", 0)),
        session_id=session_id,
        jti=str(payload.get("jti", "")),
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
    )


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------
async def issue_refresh_token(
    db: AsyncSession,
    *,
    subject_id: uuid.UUID,
    subject_type: SubjectType,
    family_id: uuid.UUID | None = None,
    parent_id: uuid.UUID | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, RefreshToken]:
    raw = generate_token(32)
    ttl_days = (
        settings.ADMIN_REFRESH_TOKEN_TTL_DAYS
        if subject_type == "admin"
        else settings.REFRESH_TOKEN_TTL_DAYS
    )
    row = RefreshToken(
        token_hash=hash_token(raw),
        family_id=family_id or uuid.uuid4(),
        parent_id=parent_id,
        user_id=subject_id if subject_type == "user" else None,
        admin_id=subject_id if subject_type == "admin" else None,
        expires_at=_now() + timedelta(days=ttl_days),
        ip=ip,
        user_agent=(user_agent or "")[:400] or None,
    )
    db.add(row)
    await db.flush()
    return raw, row


async def issue_token_pair(
    db: AsyncSession,
    *,
    subject_id: uuid.UUID,
    subject_type: SubjectType,
    role: str,
    token_version: int,
    ip: str | None = None,
    user_agent: str | None = None,
) -> TokenPair:
    """Start a brand-new session (a fresh refresh-token family)."""
    raw_refresh, row = await issue_refresh_token(
        db,
        subject_id=subject_id,
        subject_type=subject_type,
        ip=ip,
        user_agent=user_agent,
    )
    access, ttl = create_access_token(
        subject_id=subject_id,
        subject_type=subject_type,
        role=role,
        token_version=token_version,
        session_id=row.family_id,
    )
    return TokenPair(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=ttl,
        session_id=row.family_id,
    )


async def revoke_family(
    db: AsyncSession, family_id: uuid.UUID, reason: str = "revoked"
) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now(), revoked_reason=reason)
    )


async def revoke_all_for_subject(
    db: AsyncSession,
    *,
    subject_id: uuid.UUID,
    subject_type: SubjectType,
    reason: str = "revoked",
) -> int:
    column = RefreshToken.user_id if subject_type == "user" else RefreshToken.admin_id
    result = await db.execute(
        update(RefreshToken)
        .where(column == subject_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now(), revoked_reason=reason)
    )
    return int(result.rowcount or 0)


@dataclass(slots=True)
class RotationResult:
    row: RefreshToken
    replay_detected: bool = False


async def consume_refresh_token(
    db: AsyncSession, raw_token: str, *, subject_type: SubjectType
) -> RefreshToken:
    """Validate a refresh token and mark it used.

    Raises ``TokenError``. On replay of an already-used token the entire
    family is revoked, which logs out the attacker and the victim alike -
    the correct outcome, because one of them is holding a stolen token.
    """
    if not raw_token:
        raise TokenError("refresh_missing")

    token_hash = hash_token(raw_token)
    row = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()

    if row is None:
        raise TokenError("refresh_invalid")

    expected_column = row.user_id if subject_type == "user" else row.admin_id
    if expected_column is None:
        raise TokenError("refresh_invalid")

    if row.used_at is not None:
        await revoke_family(db, row.family_id, reason="reuse_detected")
        raise TokenError("refresh_reused")

    if row.revoked_at is not None:
        raise TokenError("refresh_revoked")

    if row.expires_at <= _now():
        raise TokenError("refresh_expired")

    row.used_at = _now()
    await db.flush()
    return row


async def rotate_token_pair(
    db: AsyncSession,
    *,
    raw_refresh: str,
    subject_type: SubjectType,
    role: str,
    token_version: int,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[TokenPair, uuid.UUID]:
    """Exchange a refresh token for a new pair. Returns ``(pair, subject_id)``."""
    old = await consume_refresh_token(db, raw_refresh, subject_type=subject_type)
    subject_id = old.user_id if subject_type == "user" else old.admin_id
    assert subject_id is not None  # guaranteed by consume_refresh_token

    raw_new, new_row = await issue_refresh_token(
        db,
        subject_id=subject_id,
        subject_type=subject_type,
        family_id=old.family_id,
        parent_id=old.id,
        ip=ip,
        user_agent=user_agent,
    )
    access, ttl = create_access_token(
        subject_id=subject_id,
        subject_type=subject_type,
        role=role,
        token_version=token_version,
        session_id=new_row.family_id,
    )
    return (
        TokenPair(
            access_token=access,
            refresh_token=raw_new,
            expires_in=ttl,
            session_id=new_row.family_id,
        ),
        subject_id,
    )


async def purge_expired_tokens(db: AsyncSession) -> int:
    """Housekeeping: drop refresh rows that can never be used again."""
    from sqlalchemy import delete

    cutoff = _now() - timedelta(days=7)
    result = await db.execute(
        delete(RefreshToken).where(RefreshToken.expires_at < cutoff)
    )
    return int(result.rowcount or 0)
