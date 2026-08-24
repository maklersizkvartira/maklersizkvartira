"""FastAPI dependencies: authentication, authorisation, request metadata."""

from __future__ import annotations

import ipaddress
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext, get_context
from app.core.database import get_db
from app.core.errors import Forbidden, Unauthorized
from app.core.phone import mask_phone
from app.core.tokens import TokenError, decode_access_token
from app.models.enums import ActorType, AdminRole, UserRole, UserStatus
from app.models.user import AdminUser, User

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    return token or None


def get_request_context(request: Request) -> RequestContext:
    return getattr(request.state, "ctx", None) or get_context()


RequestCtx = Annotated[RequestContext, Depends(get_request_context)]


def get_language(ctx: RequestCtx) -> str:
    return ctx.language


Lang = Annotated[str, Depends(get_language)]


# ---------------------------------------------------------------------------
# End users
# ---------------------------------------------------------------------------
async def _load_user_from_token(request: Request, db: AsyncSession) -> User | None:
    token = _bearer(request)
    if not token:
        return None
    try:
        claims = decode_access_token(token)
    except TokenError as exc:
        raise Unauthorized(exc.code) from exc

    if claims.subject_type != "user":
        raise Unauthorized("token_invalid")

    user = (
        await db.execute(select(User).where(User.id == claims.subject_id))
    ).scalar_one_or_none()

    if user is None or user.deleted_at is not None:
        raise Unauthorized("token_invalid")

    # Account state is checked first so a blocked user gets the real reason.
    # Suspending also bumps token_version, so either check alone would deny
    # access; this ordering just makes the message accurate.
    if user.status == UserStatus.BANNED.value:
        raise Forbidden("account_banned")
    if user.status == UserStatus.SUSPENDED.value:
        raise Forbidden("account_suspended")
    if user.status == UserStatus.REGISTRATION_REQUIRED.value:
        raise Forbidden("reregistration_required")
    if user.status == UserStatus.PENDING_VERIFICATION.value:
        raise Forbidden("account_not_verified")

    # A password change or forced logout bumps token_version, which retires
    # every access token minted before it without a per-token lookup.
    if claims.token_version != user.token_version:
        raise Unauthorized("token_expired")

    ctx = getattr(request.state, "ctx", None) or get_context()
    ctx.actor_id = user.id
    ctx.actor_type = ActorType.USER.value
    ctx.actor_label = f"{user.name} {mask_phone(user.phone)}"
    return user


async def get_current_user(request: Request, db: DbSession) -> User:
    user = await _load_user_from_token(request, db)
    if user is None:
        raise Unauthorized("unauthorized")
    return user


async def get_optional_user(request: Request, db: DbSession) -> User | None:
    """For endpoints that work signed-out but personalise when signed in.

    A malformed or expired token is treated as "no user" rather than an error,
    so a stale token in localStorage cannot break public browsing.
    """
    try:
        return await _load_user_from_token(request, db)
    except (Unauthorized, Forbidden):
        return None


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_roles(*roles: UserRole):
    allowed = {r.value for r in roles}

    async def _dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise Forbidden("forbidden")
        return user

    return _dependency


RequireOwner = Annotated[User, Depends(require_roles(UserRole.OWNER))]


# ---------------------------------------------------------------------------
# Admin staff
# ---------------------------------------------------------------------------
def _ip_allowed(allowlist: str | None, ip: str | None) -> bool:
    if not allowlist or not allowlist.strip():
        return True
    if not ip:
        return False
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for entry in allowlist.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            if address in ipaddress.ip_network(entry, strict=False):
                return True
        except ValueError:
            continue
    return False


async def get_current_admin(request: Request, db: DbSession) -> AdminUser:
    token = _bearer(request)
    if not token:
        raise Unauthorized("admin_unauthorized")
    try:
        claims = decode_access_token(token)
    except TokenError as exc:
        raise Unauthorized(exc.code) from exc

    if claims.subject_type != "admin":
        # A normal user's token must never open an admin door, whatever role
        # string it happens to carry.
        raise Unauthorized("admin_unauthorized")

    admin = (
        await db.execute(select(AdminUser).where(AdminUser.id == claims.subject_id))
    ).scalar_one_or_none()

    if admin is None or not admin.is_active:
        raise Unauthorized("admin_unauthorized")
    if claims.token_version != admin.token_version:
        raise Unauthorized("token_expired")
    if admin.locked_until and admin.locked_until > datetime.now(timezone.utc):
        raise Forbidden("account_locked")

    ctx = getattr(request.state, "ctx", None) or get_context()
    if not _ip_allowed(admin.ip_allowlist, ctx.ip):
        raise Forbidden("admin_ip_not_allowed")

    ctx.actor_id = admin.id
    ctx.actor_type = ActorType.ADMIN.value
    ctx.actor_label = f"{admin.full_name} (@{admin.username})"
    return admin


CurrentAdmin = Annotated[AdminUser, Depends(get_current_admin)]

_ADMIN_RANK = {
    AdminRole.MODERATOR.value: 1,
    AdminRole.ADMIN.value: 2,
    AdminRole.SUPERADMIN.value: 3,
}


def require_admin_role(minimum: AdminRole):
    """Admin roles are ranked, so ADMIN satisfies a MODERATOR requirement."""
    threshold = _ADMIN_RANK[minimum.value]

    async def _dependency(admin: CurrentAdmin) -> AdminUser:
        if _ADMIN_RANK.get(admin.role, 0) < threshold:
            raise Forbidden("admin_forbidden")
        return admin

    return _dependency


RequireModerator = Annotated[AdminUser, Depends(require_admin_role(AdminRole.MODERATOR))]
RequireAdmin = Annotated[AdminUser, Depends(require_admin_role(AdminRole.ADMIN))]
RequireSuperadmin = Annotated[AdminUser, Depends(require_admin_role(AdminRole.SUPERADMIN))]
