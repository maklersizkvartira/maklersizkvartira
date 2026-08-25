"""Admin CRM API.

Every route here requires a staff token issued by ``/admin/auth/login``.
A normal user's token can never satisfy these dependencies, whatever role it
carries, because the token's subject type is checked as well as its role.

Every mutation writes an audit row, which is what the "Barcha harakatlar"
feed reads back.
"""

from __future__ import annotations

import secrets

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit as audit_log
from app.core.config import settings
from app.core.database import commit_then_raise
from app.core.deps import (
    CurrentAdmin,
    DbSession,
    Lang,
    RequestCtx,
    RequireAdmin,
    RequireModerator,
    RequireSuperadmin,
)
from app.core.errors import BadRequest, Forbidden, NotFound, Unauthorized
from app.core.phone import mask_phone
from app.core.rate_limit import enforce
from app.core.security import (
    PasswordPolicyError,
    decrypt_secret,
    encrypt_secret,
    hash_password,
    validate_password,
)
from app.core.tokens import (
    TokenError,
    revoke_all_for_subject,
    rotate_token_pair,
)
from app.models.ai import AIMessage, AISession
from app.models.analytics import SmsLog
from app.models.audit import AuditLog
from app.models.auth import LoginAttempt, RefreshToken
from app.models.enums import (
    AdminRole,
    AuditAction,
    ListingStatus,
    ReportStatus,
    UserStatus,
    VerificationStatus,
)
from app.models.listing import Favorite, Listing
from app.models.moderation import Report, VerificationRequest
from app.models.settings import SystemSetting
from app.models.user import AdminUser, User
from app.schemas.admin import (
    AdminAiSessionRow,
    AdminListingFilters,
    AdminListingRow,
    AdminLoginAttemptRow,
    AdminReportRow,
    AdminSetPasswordRequest,
    AdminSmsRow,
    AdminStaffRow,
    AdminUpdateUserRequest,
    AdminUserFilters,
    AdminUserRow,
    AdminVerificationRow,
    AuditFilters,
    AuditLogRow,
    CreateAdminRequest,
    ResolveReportRequest,
    RevealPasswordResponse,
    ReviewVerificationRequest,
)
from app.schemas.auth import AdminLoginRequest, AdminOut, RefreshRequest, TokenResponse
from app.schemas.common import MessageResponse, PaginationParams, build_page_meta
from app.schemas.listing import ListingFeatureRequest, ListingModerationRequest
from app.services import admin as admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ok(data: Any, **extra: Any) -> dict:
    return {"status": "success", "data": data, **extra}


# ===========================================================================
# Authentication
# ===========================================================================
@router.post("/auth/login", response_model=TokenResponse, summary="Staff sign-in")
async def admin_login(payload: AdminLoginRequest, db: DbSession) -> TokenResponse:
    admin, pair = await admin_service.admin_login(
        db, username=payload.username, password=payload.password
    )
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        admin=AdminOut.model_validate(admin),
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def admin_refresh(
    payload: RefreshRequest, db: DbSession, ctx: RequestCtx
) -> TokenResponse:
    row = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == _hash(payload.refresh_token)
            )
        )
    ).scalar_one_or_none()
    if row is None or row.admin_id is None:
        raise Unauthorized("refresh_invalid")

    admin = (
        await db.execute(select(AdminUser).where(AdminUser.id == row.admin_id))
    ).scalar_one_or_none()
    if admin is None or not admin.is_active:
        raise Unauthorized("refresh_invalid")

    try:
        pair, _ = await rotate_token_pair(
            db,
            raw_refresh=payload.refresh_token,
            subject_type="admin",
            role=admin.role,
            token_version=admin.token_version,
            ip=ctx.ip,
            user_agent=ctx.user_agent,
        )
    except TokenError as exc:
        raise Unauthorized(exc.code) from exc

    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        admin=AdminOut.model_validate(admin),
    )


def _hash(token: str) -> str:
    from app.core.security import hash_token

    return hash_token(token)


@router.post("/auth/logout", response_model=MessageResponse)
async def admin_logout(admin: CurrentAdmin, db: DbSession) -> MessageResponse:
    await revoke_all_for_subject(
        db, subject_id=admin.id, subject_type="admin", reason="logout"
    )
    admin.token_version += 1
    await audit_log.record(
        db,
        AuditAction.ADMIN_LOGOUT,
        entity_type="admin",
        entity_id=admin.id,
        entity_label=admin.username,
    )
    return MessageResponse(message="Chiqildi.")


@router.get("/auth/me", summary="Current staff account")
async def admin_me(admin: CurrentAdmin) -> dict:
    return _ok(AdminOut.model_validate(admin).model_dump(by_alias=True))


@router.post(
    "/auth/bootstrap-reset-admin",
    summary="Recreate or reset the first administrator",
)
async def bootstrap_reset_admin(
    db: DbSession, ctx: RequestCtx, token: str = Header(default="", alias="X-Bootstrap-Token")
) -> dict:
    """Recover the first admin account when nobody can sign in any more.

    This used to be a GET with no authentication at all. Anyone who knew the
    URL could reset the administrator's password to whatever the environment
    held and, as a side effect of bumping ``token_version``, sign the real
    administrator out — repeatedly, from a browser address bar, with no trace
    beyond the change itself.

    Three things now stand in the way:

    * It is off unless ``BOOTSTRAP_TOKEN`` is set, and answers 404 otherwise,
      so the door is not merely locked but absent. Set it to run a recovery,
      then remove it again.
    * It requires that token in a header, compared in constant time. A header
      cannot be triggered by a link, an image tag or a redirect, which is what
      made the GET form usable as a drive-by.
    * It is rate limited and written to the audit log at CRITICAL, because an
      administrator's credentials changing is exactly the event someone should
      be able to find afterwards.

    ``scripts/create_admin.py`` remains the ordinary way to do this; it needs
    no open endpoint at all.
    """
    from sqlalchemy import select

    from app.core.security import (
        PasswordPolicyError,
        hash_password,
        validate_password,
    )
    from app.models.enums import AdminRole
    from app.models.user import AdminUser

    expected = (settings.BOOTSTRAP_TOKEN or "").strip()
    if not expected:
        raise NotFound("not_found")

    await enforce("bootstrap_admin", ctx.ip or "unknown")

    if not secrets.compare_digest(token.strip(), expected):
        await audit_log.record(
            db,
            AuditAction.ADMIN_LOGIN_FAILED,
            actor_type="SYSTEM",
            entity_type="admin",
            summary="Bootstrap admin reset attempted with a bad token",
            severity="CRITICAL",
            meta={"ip": ctx.ip},
        )
        await commit_then_raise(db, Forbidden("forbidden"))

    raw = (settings.BOOTSTRAP_ADMIN_PASSWORD or "").strip()
    if not raw:
        raise BadRequest("bootstrap_password_missing")

    # The same policy every other password goes through. Skipping it here let
    # a recovery install a credential the login form would have refused, which
    # is precisely the account that should have the strongest one.
    try:
        password = validate_password(raw)
    except PasswordPolicyError as exc:
        raise BadRequest(exc.code) from exc

    username = settings.BOOTSTRAP_ADMIN_USERNAME or "admin"
    existing = (
        await db.execute(select(AdminUser).where(AdminUser.username == username))
    ).scalar_one_or_none()

    if existing is not None:
        existing.password_hash = hash_password(password)
        existing.must_change_password = True
        # Retires every token issued to this account, including any an
        # attacker may hold.
        existing.token_version += 1
        existing.is_active = True
        entity_id = existing.id
        action = "reset"
    else:
        created = AdminUser(
            username=username,
            full_name="Bosh administrator",
            password_hash=hash_password(password),
            role=AdminRole.SUPERADMIN.value,
            is_active=True,
            must_change_password=True,
        )
        db.add(created)
        await db.flush()
        entity_id = created.id
        action = "created"

    await audit_log.record(
        db,
        AuditAction.ADMIN_LOGIN_SUCCESS,
        actor_type="SYSTEM",
        entity_type="admin",
        entity_id=entity_id,
        entity_label=username,
        summary=f"Bootstrap administrator {action}",
        severity="CRITICAL",
        meta={"action": action, "username": username, "ip": ctx.ip},
    )

    return {
        "status": "success",
        "action": action,
        "username": username,
        "message": (
            "Sign in with the password from BOOTSTRAP_ADMIN_PASSWORD, change it, "
            "then unset BOOTSTRAP_TOKEN."
        ),
    }


# ===========================================================================
# Dashboard & charts
# ===========================================================================
@router.get("/stats", summary="Dashboard counters")
async def stats(admin: RequireModerator, db: DbSession) -> dict:
    return _ok(await admin_service.dashboard_stats(db))


@router.post("/settings/toggle-monetization", summary="Toggle monetization")
async def toggle_monetization(admin: RequireSuperadmin, db: DbSession) -> MessageResponse:
    from sqlalchemy import text
    result = await db.execute(
        text("SELECT value FROM system_settings WHERE key = 'is_monetization_enabled'")
    )
    row = result.fetchone()
    current = row[0] == "true" if row else False
    new_val = "false" if current else "true"
    
    if row is None:
        await db.execute(
            text("INSERT INTO system_settings (key, value) VALUES ('is_monetization_enabled', :val)"),
            {"val": new_val}
        )
    else:
        await db.execute(
            text("UPDATE system_settings SET value = :val WHERE key = 'is_monetization_enabled'"),
            {"val": new_val}
        )
    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_UPDATED,
        entity_type="system_settings",
        entity_id=admin.id,
        entity_label="is_monetization_enabled",
        summary=f"{admin.full_name} turned {'off' if current else 'on'} monetization",
    )
    return MessageResponse(message="Sozlamalar yangilandi")


@router.get("/chart/registrations")
async def chart_registrations(
    admin: RequireModerator, db: DbSession, days: int = Query(7, ge=1, le=90)
) -> dict:
    return _ok(await admin_service.registrations_chart(db, days))


@router.get("/chart/traffic")
async def chart_traffic(
    admin: RequireModerator, db: DbSession, days: int = Query(7, ge=1, le=90)
) -> dict:
    return _ok(await admin_service.traffic_chart(db, days))


@router.get("/chart/districts")
async def chart_districts(
    admin: RequireModerator, db: DbSession, limit: int = Query(10, ge=1, le=30)
) -> dict:
    return _ok(await admin_service.district_chart(db, limit))


@router.get("/chart/activity")
async def chart_activity(
    admin: RequireModerator, db: DbSession, days: int = Query(7, ge=1, le=90)
) -> dict:
    return _ok(await admin_service.activity_chart(db, days))


# ===========================================================================
# Users
# ===========================================================================
@router.get("/users", summary="List users")
async def list_users(
    admin: RequireModerator,
    db: DbSession,
    filters: AdminUserFilters = Depends(),
    pagination: PaginationParams = Depends(),
) -> dict:
    listing_count = (
        select(func.count())
        .select_from(Listing)
        .where(Listing.owner_id == User.id, Listing.deleted_at.is_(None))
        .scalar_subquery()
    )
    approved_count = (
        select(func.count())
        .select_from(Listing)
        .where(
            Listing.owner_id == User.id,
            Listing.deleted_at.is_(None),
            Listing.status == ListingStatus.APPROVED.value,
        )
        .scalar_subquery()
    )
    favorites_count = (
        select(func.count())
        .select_from(Favorite)
        .where(Favorite.user_id == User.id)
        .scalar_subquery()
    )

    stmt = select(
        User,
        listing_count.label("listings_count"),
        approved_count.label("approved_listings"),
        favorites_count.label("favorites_count"),
    ).where(User.deleted_at.is_(None))

    if filters.search:
        pattern = f"%{filters.search}%"
        stmt = stmt.where(
            or_(
                User.name.ilike(pattern),
                User.phone.ilike(pattern),
                User.email.ilike(pattern),
                cast(User.id, String).ilike(pattern),
            )
        )
    if filters.role:
        stmt = stmt.where(User.role == filters.role.value)
    if filters.status:
        stmt = stmt.where(User.status == filters.status.value)
    if filters.has_listings is True:
        stmt = stmt.where(listing_count > 0)
    elif filters.has_listings is False:
        stmt = stmt.where(listing_count == 0)

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(User.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )

    order = {
        "NEWEST": User.created_at.desc(),
        "OLDEST": User.created_at.asc(),
        "NAME": User.name.asc(),
        "TRUST": User.trust_score.desc(),
        "LAST_LOGIN": User.last_login_at.desc().nullslast(),
    }[filters.sort_by]

    rows = (
        await db.execute(
            stmt.order_by(order).offset(pagination.offset).limit(pagination.page_size)
        )
    ).all()

    data = []
    for user, listings_n, approved_n, favorites_n in rows:
        row = AdminUserRow.model_validate(user)
        row.listings_count = int(listings_n or 0)
        row.approved_listings = int(approved_n or 0)
        row.favorites_count = int(favorites_n or 0)
        row.has_password = bool(user.password_hash)
        row.password_revealable = bool(
            user.password_secret and settings.PASSWORD_REVEAL_ENABLED
        )
        row.auth_type = "google" if user.google_uid else "phone"
        data.append(row.model_dump(by_alias=True))

    return {
        "status": "success",
        "data": data,
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.get("/users/{user_id}", summary="One user with full detail")
async def get_user(user_id: uuid.UUID, admin: RequireModerator, db: DbSession) -> dict:
    user = await _load_user(db, user_id)
    row = AdminUserRow.model_validate(user)
    row.has_password = bool(user.password_hash)
    row.password_revealable = bool(
        user.password_secret and settings.PASSWORD_REVEAL_ENABLED
    )
    row.auth_type = "google" if user.google_uid else "phone"

    recent_activity = (
        await db.execute(
            select(AuditLog)
            .where(
                or_(
                    and_(AuditLog.actor_type == "USER", AuditLog.actor_id == user.id),
                    and_(
                        AuditLog.entity_type == "user",
                        AuditLog.entity_id == str(user.id),
                    ),
                )
            )
            .order_by(AuditLog.created_at.desc())
            .limit(50)
        )
    ).scalars().all()

    sessions = (
        await db.execute(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.used_at.is_(None),
            )
            .order_by(RefreshToken.created_at.desc())
            .limit(20)
        )
    ).scalars().all()

    return _ok(
        row.model_dump(by_alias=True),
        activity=[
            AuditLogRow.model_validate(a).model_dump(by_alias=True)
            for a in recent_activity
        ],
        sessions=[
            {
                "id": str(s.id),
                "createdAt": s.created_at.isoformat(),
                "expiresAt": s.expires_at.isoformat(),
                "ip": s.ip,
                "userAgent": s.user_agent,
            }
            for s in sessions
        ],
    )


async def _load_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise NotFound("not_found")
    return user


@router.post(
    "/users/{user_id}/reveal-password",
    response_model=RevealPasswordResponse,
    summary="Reveal a user's password (audited)",
)
async def reveal_password(
    user_id: uuid.UUID, admin: RequireAdmin, db: DbSession, ctx: RequestCtx, lang: Lang
) -> RevealPasswordResponse:
    """Decrypt and return one user's password.

    Requires ADMIN or above, is rate-limited, and writes a CRITICAL audit
    entry naming the admin who did it. The plaintext is not stored anywhere:
    it is decrypted on the fly from the AES-GCM copy using a key that lives
    only in the environment, so a database dump alone cannot produce it.
    """
    if not settings.PASSWORD_REVEAL_ENABLED:
        raise Forbidden("password_reveal_disabled")

    await enforce("password_reveal", str(admin.id))
    user = await _load_user(db, user_id)

    plaintext = decrypt_secret(user.password_secret)
    if plaintext is None:
        raise NotFound("password_reveal_unavailable")

    entry = await audit_log.record(
        db,
        AuditAction.ADMIN_USER_PASSWORD_REVEALED,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{admin.full_name} revealed the password of {user.name}",
        severity="CRITICAL",
        meta={"admin": admin.username, "target_phone": mask_phone(user.phone)},
    )

    warning = {
        "uz": "Bu amal audit jurnaliga yozildi. Parolni hech kimga bermang.",
        "ru": "Это действие записано в журнал аудита. Не передавайте пароль третьим лицам.",
        "en": "This action was written to the audit log. Do not share this password.",
    }.get(lang, "Bu amal audit jurnaliga yozildi.")

    return RevealPasswordResponse(
        user_id=user.id, password=plaintext, audit_id=entry.id, warning=warning
    )


@router.patch("/users/{user_id}", summary="Update a user")
async def update_user(
    user_id: uuid.UUID,
    payload: AdminUpdateUserRequest,
    admin: RequireAdmin,
    db: DbSession,
) -> dict:
    user = await _load_user(db, user_id)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise BadRequest("validation_error")

    before = {key: getattr(user, key) for key in changes}
    previous_status = user.status

    for key, value in changes.items():
        setattr(user, key, value.value if hasattr(value, "value") else value)

    action = AuditAction.ADMIN_USER_UPDATED
    if "status" in changes and user.status != previous_status:
        if user.status in (UserStatus.SUSPENDED.value, UserStatus.BANNED.value):
            action = AuditAction.ADMIN_USER_SUSPENDED
            # Suspension must take effect immediately, not when the token expires.
            user.token_version += 1
            await revoke_all_for_subject(
                db, subject_id=user.id, subject_type="user", reason="suspended"
            )
        elif previous_status in (UserStatus.SUSPENDED.value, UserStatus.BANNED.value):
            action = AuditAction.ADMIN_USER_REACTIVATED

    await db.flush()
    await audit_log.record(
        db,
        action,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{admin.full_name} updated {user.name}",
        changes=audit_log.diff(before, changes),
    )
    row = AdminUserRow.model_validate(user)
    row.has_password = bool(user.password_hash)
    return _ok(row.model_dump(by_alias=True))


@router.post("/users/{user_id}/set-password", summary="Force a new password")
async def set_user_password(
    user_id: uuid.UUID,
    payload: AdminSetPasswordRequest,
    admin: RequireAdmin,
    db: DbSession,
    lang: Lang,
) -> MessageResponse:
    user = await _load_user(db, user_id)
    try:
        password = validate_password(payload.new_password, phone=user.phone, name=user.name)
    except PasswordPolicyError as exc:
        raise BadRequest(exc.code, params={"min": settings.PASSWORD_MIN_LENGTH}) from exc

    user.password_hash = hash_password(password)
    user.password_secret = encrypt_secret(password)
    user.password_updated_at = _now()
    user.must_change_password = payload.must_change
    user.failed_login_count = 0
    user.locked_until = None
    if payload.revoke_sessions:
        user.token_version += 1
        await revoke_all_for_subject(
            db, subject_id=user.id, subject_type="user", reason="admin_password_reset"
        )
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_USER_PASSWORD_RESET,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{admin.full_name} reset the password of {user.name}",
        severity="WARNING",
        meta={"must_change": payload.must_change, "sessions_revoked": payload.revoke_sessions},
    )
    return MessageResponse(message="Parol yangilandi.")


@router.post("/users/{user_id}/revoke-sessions", summary="Sign a user out everywhere")
async def revoke_user_sessions(
    user_id: uuid.UUID, admin: RequireAdmin, db: DbSession
) -> MessageResponse:
    user = await _load_user(db, user_id)
    count = await revoke_all_for_subject(
        db, subject_id=user.id, subject_type="user", reason="admin_revoked"
    )
    user.token_version += 1
    await audit_log.record(
        db,
        AuditAction.ADMIN_USER_SESSIONS_REVOKED,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{admin.full_name} revoked {count} session(s) of {user.name}",
        severity="WARNING",
    )
    return MessageResponse(message=f"{count} ta sessiya bekor qilindi.")


@router.delete("/users/{user_id}", summary="Delete a user")
async def delete_user(
    user_id: uuid.UUID, admin: RequireSuperadmin, db: DbSession
) -> MessageResponse:
    user = await _load_user(db, user_id)
    label = f"{user.name} {mask_phone(user.phone)}"

    # Soft delete, and free the phone number so it can be registered again.
    user.deleted_at = _now()
    user.status = UserStatus.BANNED.value
    user.phone = f"deleted:{user.id}"
    user.email = None
    user.google_uid = None
    user.password_hash = None
    user.password_secret = None
    user.token_version += 1
    await revoke_all_for_subject(
        db, subject_id=user.id, subject_type="user", reason="account_deleted"
    )
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_USER_DELETED,
        entity_type="user",
        entity_id=user.id,
        entity_label=label,
        summary=f"{admin.full_name} deleted {label}",
        severity="CRITICAL",
    )
    return MessageResponse(message="Foydalanuvchi o'chirildi.")


# ===========================================================================
# Listings
# ===========================================================================
@router.get("/listings", summary="List listings for moderation")
async def list_listings(
    admin: RequireModerator,
    db: DbSession,
    filters: AdminListingFilters = Depends(),
    pagination: PaginationParams = Depends(),
) -> dict:
    report_count = (
        select(func.count())
        .select_from(Report)
        .where(Report.listing_id == Listing.id)
        .scalar_subquery()
    )
    stmt = (
        select(Listing, User, report_count.label("report_count"))
        .join(User, User.id == Listing.owner_id)
        .where(Listing.deleted_at.is_(None))
    )

    if filters.search:
        pattern = f"%{filters.search}%"
        stmt = stmt.where(
            or_(
                Listing.title.ilike(pattern),
                Listing.description.ilike(pattern),
                Listing.district.ilike(pattern),
                User.name.ilike(pattern),
                User.phone.ilike(pattern),
            )
        )
    if filters.status:
        stmt = stmt.where(Listing.status == filters.status.value)
    if filters.district:
        stmt = stmt.where(Listing.district.ilike(f"%{filters.district}%"))
    if filters.is_featured is not None:
        stmt = stmt.where(Listing.is_featured.is_(filters.is_featured))
    if filters.min_risk_score is not None:
        stmt = stmt.where(Listing.risk_score >= filters.min_risk_score)

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(Listing.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )

    order = {
        "NEWEST": Listing.created_at.desc(),
        "OLDEST": Listing.created_at.asc(),
        "RISK": Listing.risk_score.desc(),
        "VIEWS": Listing.views_count.desc(),
        "PRICE_HIGH": Listing.price.desc(),
        "PRICE_LOW": Listing.price.asc(),
    }[filters.sort_by]

    rows = (
        await db.execute(
            stmt.order_by(order).offset(pagination.offset).limit(pagination.page_size)
        )
    ).unique().all()

    data = []
    for listing, owner, reports_n in rows:
        row = AdminListingRow.model_validate(listing)
        row.owner_name = owner.name
        row.owner_phone = owner.phone
        row.owner_role = owner.role
        row.owner_trust_score = owner.trust_score
        row.report_count = int(reports_n or 0)
        data.append(row.model_dump(by_alias=True))

    return {
        "status": "success",
        "data": data,
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


async def _load_listing(db: AsyncSession, listing_id: uuid.UUID) -> Listing:
    listing = (
        await db.execute(select(Listing).where(Listing.id == listing_id))
    ).unique().scalar_one_or_none()
    if listing is None:
        raise NotFound("listing_not_found")
    return listing


@router.patch("/listings/{listing_id}/status", summary="Approve or reject a listing")
async def moderate_listing(
    listing_id: uuid.UUID,
    payload: ListingModerationRequest,
    admin: RequireModerator,
    db: DbSession,
) -> dict:
    listing = await _load_listing(db, listing_id)
    before = listing.status
    listing.status = payload.status.value
    listing.moderation_note = payload.note
    listing.moderated_by_id = admin.id
    listing.moderated_at = _now()
    if payload.status == ListingStatus.APPROVED and listing.published_at is None:
        listing.published_at = _now()
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_LISTING_STATUS_CHANGED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{admin.full_name} set '{listing.title}' to {payload.status.value}",
        changes={"status": {"from": before, "to": listing.status}},
        meta={"note": payload.note},
    )
    return _ok(AdminListingRow.model_validate(listing).model_dump(by_alias=True))


@router.patch("/listings/{listing_id}/feature", summary="Promote a listing")
async def feature_listing(
    listing_id: uuid.UUID,
    payload: ListingFeatureRequest,
    admin: RequireModerator,
    db: DbSession,
) -> dict:
    listing = await _load_listing(db, listing_id)
    before = {"is_featured": listing.is_featured, "promotion_weight": listing.promotion_weight}

    listing.is_featured = payload.is_featured
    listing.promotion_weight = payload.promotion_weight if payload.is_featured else 0
    listing.featured_until = (
        _now() + timedelta(days=payload.days) if payload.is_featured else None
    )
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_LISTING_FEATURED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=(
            f"{admin.full_name} {'promoted' if payload.is_featured else 'unpromoted'} "
            f"'{listing.title}'"
        ),
        changes=audit_log.diff(
            before,
            {"is_featured": listing.is_featured, "promotion_weight": listing.promotion_weight},
        ),
    )
    return _ok(AdminListingRow.model_validate(listing).model_dump(by_alias=True))


@router.delete("/listings/{listing_id}", summary="Delete a listing")
async def delete_listing(
    listing_id: uuid.UUID, admin: RequireAdmin, db: DbSession
) -> MessageResponse:
    listing = await _load_listing(db, listing_id)
    listing.deleted_at = _now()
    listing.status = ListingStatus.ARCHIVED.value
    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_LISTING_DELETED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{admin.full_name} deleted '{listing.title}'",
        severity="WARNING",
    )
    return MessageResponse(message="E'lon o'chirildi.")


# ===========================================================================
# Audit log - "barcha harakatlar"
# ===========================================================================
#: Groups used by the admin UI's quick filters.
ACTION_GROUPS: dict[str, tuple[str, ...]] = {
    "auth": ("AUTH_",),
    "user": ("USER_",),
    "listing": ("LISTING_",),
    "admin": ("ADMIN_",),
    "ai": ("AI_",),
    "sms": ("SMS_", "TELEGRAM_"),
    "security": ("SECURITY_", "AUTH_TOKEN_REUSE", "AUTH_LOGIN_LOCKED"),
}


@router.get("/audit", summary="System-wide activity feed")
async def audit_feed(
    admin: RequireModerator,
    db: DbSession,
    filters: AuditFilters = Depends(),
    pagination: PaginationParams = Depends(),
) -> dict:
    stmt = select(AuditLog)

    if filters.action:
        stmt = stmt.where(AuditLog.action == filters.action)
    if filters.action_group:
        prefixes = ACTION_GROUPS.get(filters.action_group.lower())
        if prefixes:
            stmt = stmt.where(
                or_(*[AuditLog.action.startswith(p) for p in prefixes])
            )
    if filters.actor_type:
        stmt = stmt.where(AuditLog.actor_type == filters.actor_type.upper())
    if filters.actor_id:
        stmt = stmt.where(AuditLog.actor_id == filters.actor_id)
    if filters.entity_type:
        stmt = stmt.where(AuditLog.entity_type == filters.entity_type)
    if filters.entity_id:
        stmt = stmt.where(AuditLog.entity_id == filters.entity_id)
    if filters.severity:
        stmt = stmt.where(AuditLog.severity == filters.severity.upper())
    if filters.ip:
        stmt = stmt.where(cast(AuditLog.ip, String).ilike(f"%{filters.ip}%"))
    if filters.date_from:
        stmt = stmt.where(AuditLog.created_at >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(AuditLog.created_at <= filters.date_to)
    if filters.search:
        pattern = f"%{filters.search}%"
        stmt = stmt.where(
            or_(
                AuditLog.actor_label.ilike(pattern),
                AuditLog.entity_label.ilike(pattern),
                AuditLog.summary.ilike(pattern),
                AuditLog.action.ilike(pattern),
            )
        )

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(AuditLog.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )
    rows = (
        await db.execute(
            stmt.order_by(AuditLog.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).scalars().all()

    return {
        "status": "success",
        "data": [AuditLogRow.model_validate(r).model_dump(by_alias=True) for r in rows],
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.get("/audit/actions", summary="Distinct action names for the filter dropdown")
async def audit_actions(admin: RequireModerator, db: DbSession) -> dict:
    rows = (
        await db.execute(
            select(AuditLog.action, func.count().label("count"))
            .group_by(AuditLog.action)
            .order_by(func.count().desc())
        )
    ).all()
    return _ok(
        [{"action": r.action, "count": int(r.count)} for r in rows],
        groups=list(ACTION_GROUPS),
    )


# ===========================================================================
# Reports & verifications
# ===========================================================================
@router.get("/reports")
async def list_reports(
    admin: RequireModerator,
    db: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    pagination: PaginationParams = Depends(),
) -> dict:
    stmt = select(Report, Listing.title).join(Listing, Listing.id == Report.listing_id)
    if status_filter:
        stmt = stmt.where(Report.status == status_filter.upper())

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(Report.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )
    rows = (
        await db.execute(
            stmt.order_by(Report.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).unique().all()

    data = []
    for report, title in rows:
        row = AdminReportRow.model_validate(report)
        row.listing_title = title
        data.append(row.model_dump(by_alias=True))

    return {
        "status": "success",
        "data": data,
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.patch("/reports/{report_id}")
async def resolve_report(
    report_id: uuid.UUID,
    payload: ResolveReportRequest,
    admin: RequireModerator,
    db: DbSession,
) -> dict:
    report = (
        await db.execute(select(Report).where(Report.id == report_id))
    ).unique().scalar_one_or_none()
    if report is None:
        raise NotFound("not_found")

    before = report.status
    report.status = payload.status.value
    report.resolution_note = payload.note
    report.resolved_by_id = admin.id
    report.resolved_at = _now()

    if payload.listing_action != "NONE":
        listing = await _load_listing(db, report.listing_id)
        if payload.listing_action == "REJECT":
            listing.status = ListingStatus.REJECTED.value
        elif payload.listing_action == "APPROVE":
            listing.status = ListingStatus.APPROVED.value
        elif payload.listing_action == "DELETE":
            listing.deleted_at = _now()
            listing.status = ListingStatus.ARCHIVED.value
        listing.moderated_by_id = admin.id
        listing.moderated_at = _now()

    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_REPORT_RESOLVED,
        entity_type="report",
        entity_id=report.id,
        entity_label=report.reason,
        summary=f"{admin.full_name} resolved a report as {payload.status.value}",
        changes={"status": {"from": before, "to": report.status}},
        meta={"listing_action": payload.listing_action},
    )
    return _ok(AdminReportRow.model_validate(report).model_dump(by_alias=True))


@router.get("/verifications")
async def list_verifications(
    admin: RequireModerator,
    db: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    pagination: PaginationParams = Depends(),
) -> dict:
    stmt = select(VerificationRequest, User.name, User.phone).join(
        User, User.id == VerificationRequest.user_id
    )
    if status_filter:
        stmt = stmt.where(VerificationRequest.status == status_filter.upper())

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(VerificationRequest.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )
    rows = (
        await db.execute(
            stmt.order_by(VerificationRequest.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).unique().all()

    data = []
    for request, name, phone in rows:
        row = AdminVerificationRow.model_validate(request)
        row.user_name = name
        row.user_phone = phone
        data.append(row.model_dump(by_alias=True))

    return {
        "status": "success",
        "data": data,
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.patch("/verifications/{verification_id}")
async def review_verification(
    verification_id: uuid.UUID,
    payload: ReviewVerificationRequest,
    admin: RequireModerator,
    db: DbSession,
) -> dict:
    request = (
        await db.execute(
            select(VerificationRequest).where(VerificationRequest.id == verification_id)
        )
    ).unique().scalar_one_or_none()
    if request is None:
        raise NotFound("not_found")

    before = request.status
    request.status = payload.status.value
    request.rejection_reason = payload.rejection_reason
    request.reviewed_by_id = admin.id
    request.reviewed_at = _now()

    if payload.status == VerificationStatus.APPROVED:
        user = await _load_user(db, request.user_id)
        user.is_verified = True
        user.verification_level = max(user.verification_level, request.target_level)
        user.trust_score = min(100, user.trust_score + 15)

    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_VERIFICATION_REVIEWED,
        entity_type="verification",
        entity_id=request.id,
        summary=f"{admin.full_name} marked a verification {payload.status.value}",
        changes={"status": {"from": before, "to": request.status}},
    )
    return _ok(AdminVerificationRow.model_validate(request).model_dump(by_alias=True))


# ===========================================================================
# AI, SMS and security feeds
# ===========================================================================
@router.get("/ai/sessions")
async def ai_sessions(
    admin: RequireModerator, db: DbSession, pagination: PaginationParams = Depends()
) -> dict:
    stmt = select(AISession, User.name).outerjoin(User, User.id == AISession.user_id)
    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(AISession.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )
    rows = (
        await db.execute(
            stmt.order_by(AISession.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).unique().all()

    data = []
    for session, name in rows:
        row = AdminAiSessionRow.model_validate(session)
        row.user_name = name
        data.append(row.model_dump(by_alias=True))

    return {
        "status": "success",
        "data": data,
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.get("/ai/sessions/{session_id}/messages")
async def ai_session_messages(
    session_id: uuid.UUID, admin: RequireModerator, db: DbSession
) -> dict:
    rows = (
        await db.execute(
            select(AIMessage)
            .where(AIMessage.session_id == session_id)
            .order_by(AIMessage.created_at.asc())
            .limit(200)
        )
    ).scalars().all()
    return _ok(
        [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "createdAt": m.created_at.isoformat(),
                "listingIds": (m.listing_ids or {}).get("ids", []),
            }
            for m in rows
        ]
    )


@router.get("/sms")
async def sms_log(
    admin: RequireAdmin, db: DbSession, pagination: PaginationParams = Depends()
) -> dict:
    total = int(
        (await db.execute(select(func.count()).select_from(SmsLog))).scalar_one() or 0
    )
    rows = (
        await db.execute(
            select(SmsLog)
            .order_by(SmsLog.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).scalars().all()
    return {
        "status": "success",
        "data": [AdminSmsRow.model_validate(r).model_dump(by_alias=True) for r in rows],
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.get("/security/login-attempts")
async def login_attempts(
    admin: RequireAdmin,
    db: DbSession,
    only_failed: bool = Query(default=False),
    pagination: PaginationParams = Depends(),
) -> dict:
    stmt = select(LoginAttempt)
    if only_failed:
        stmt = stmt.where(LoginAttempt.successful.is_(False))
    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(LoginAttempt.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )
    rows = (
        await db.execute(
            stmt.order_by(LoginAttempt.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).scalars().all()
    return {
        "status": "success",
        "data": [
            AdminLoginAttemptRow.model_validate(r).model_dump(by_alias=True) for r in rows
        ],
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


# ===========================================================================
# Staff accounts
# ===========================================================================
@router.get("/staff")
async def list_staff(admin: RequireSuperadmin, db: DbSession) -> dict:
    rows = (
        await db.execute(select(AdminUser).order_by(AdminUser.created_at.asc()))
    ).scalars().all()
    return _ok(
        [AdminStaffRow.model_validate(r).model_dump(by_alias=True) for r in rows]
    )


@router.post("/staff")
async def create_staff(
    payload: CreateAdminRequest, admin: RequireSuperadmin, db: DbSession
) -> dict:
    existing = (
        await db.execute(
            select(AdminUser).where(AdminUser.username == payload.username)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise BadRequest("validation_error", field="username")

    try:
        password = validate_password(payload.password, name=payload.full_name)
    except PasswordPolicyError as exc:
        raise BadRequest(exc.code, params={"min": settings.PASSWORD_MIN_LENGTH}) from exc

    staff = AdminUser(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(password),
        password_updated_at=_now(),
        must_change_password=True,
        role=payload.role.value,
        ip_allowlist=payload.ip_allowlist,
    )
    db.add(staff)
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_ACCOUNT_CREATED,
        entity_type="admin",
        entity_id=staff.id,
        entity_label=staff.username,
        summary=f"{admin.full_name} created staff account @{staff.username} ({staff.role})",
        severity="WARNING",
    )
    return _ok(AdminStaffRow.model_validate(staff).model_dump(by_alias=True))


@router.patch("/staff/{staff_id}/active")
async def toggle_staff(
    staff_id: uuid.UUID,
    is_active: bool,
    admin: RequireSuperadmin,
    db: DbSession,
) -> MessageResponse:
    if staff_id == admin.id:
        raise BadRequest("cannot_modify_self")
    staff = (
        await db.execute(select(AdminUser).where(AdminUser.id == staff_id))
    ).scalar_one_or_none()
    if staff is None:
        raise NotFound("not_found")

    staff.is_active = is_active
    if not is_active:
        staff.token_version += 1
        await revoke_all_for_subject(
            db, subject_id=staff.id, subject_type="admin", reason="deactivated"
        )
    await audit_log.record(
        db,
        AuditAction.ADMIN_SETTINGS_CHANGED,
        entity_type="admin",
        entity_id=staff.id,
        entity_label=staff.username,
        summary=f"{admin.full_name} {'enabled' if is_active else 'disabled'} @{staff.username}",
        severity="WARNING",
    )
    return MessageResponse(message="Bajarildi.")
