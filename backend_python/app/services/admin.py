"""Admin authentication and dashboard aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit as audit_log
from app.core.config import settings
from app.core.context import get_context
from app.core.database import commit_then_raise
from app.core.errors import Forbidden, Unauthorized
from app.core.rate_limit import enforce
from app.core.security import hash_password, needs_rehash, verify_password
from app.core.tokens import TokenPair, issue_token_pair
from app.models.ai import AIMessage, AISession
from app.models.analytics import SmsLog, TrafficEvent
from app.models.audit import AuditLog
from app.models.auth import LoginAttempt
from app.models.enums import (
    AuditAction,
    ListingStatus,
    ReportStatus,
    UserRole,
    UserStatus,
    VerificationStatus,
)
from app.models.listing import Listing
from app.models.moderation import Report, VerificationRequest
from app.models.user import AdminUser, User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_day() -> datetime:
    return _now().replace(hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# Admin login
# ---------------------------------------------------------------------------
async def admin_login(
    db: AsyncSession, *, username: str, password: str
) -> tuple[AdminUser, TokenPair]:
    ctx = get_context()
    if ctx.ip:
        await enforce("admin_login_ip", ctx.ip)

    admin = (
        await db.execute(select(AdminUser).where(AdminUser.username == username))
    ).scalar_one_or_none()

    if admin is not None and admin.locked_until and admin.locked_until > _now():
        minutes = max(1, int((admin.locked_until - _now()).total_seconds() // 60) + 1)
        db.add(
            LoginAttempt(
                username=username,
                admin_id=admin.id,
                successful=False,
                failure_reason="locked",
                is_admin_portal=True,
                ip=ctx.ip,
                user_agent=ctx.user_agent,
            )
        )
        await commit_then_raise(
            db, Forbidden("account_locked", params={"minutes": minutes})
        )

    password_ok = verify_password(password, admin.password_hash if admin else None)

    if admin is None or not password_ok or not admin.is_active:
        if admin is not None:
            admin.failed_login_count = (admin.failed_login_count or 0) + 1
            if admin.failed_login_count >= settings.MAX_FAILED_LOGINS:
                admin.locked_until = _now() + timedelta(minutes=settings.LOCKOUT_MINUTES)
                admin.failed_login_count = 0
        db.add(
            LoginAttempt(
                username=username,
                admin_id=admin.id if admin else None,
                successful=False,
                failure_reason="bad_password" if admin else "unknown_user",
                is_admin_portal=True,
                ip=ctx.ip,
                user_agent=ctx.user_agent,
            )
        )
        await audit_log.record(
            db,
            AuditAction.ADMIN_LOGIN_FAILED,
            actor_type="ANONYMOUS",
            entity_type="admin",
            entity_id=admin.id if admin else None,
            entity_label=username,
            meta={"reason": "bad_password" if admin else "unknown_user"},
        )
        # Without this the lockout counter is discarded by the rollback and
        # admin brute-force protection silently does nothing.
        await commit_then_raise(db, Unauthorized("invalid_credentials"))

    from app.core.deps import _ip_allowed

    if not _ip_allowed(admin.ip_allowlist, ctx.ip):
        await audit_log.record(
            db,
            AuditAction.ADMIN_LOGIN_FAILED,
            entity_type="admin",
            entity_id=admin.id,
            entity_label=admin.username,
            meta={"reason": "ip_not_allowed", "ip": ctx.ip},
        )
        await commit_then_raise(db, Forbidden("admin_ip_not_allowed"))

    if needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(password)

    admin.failed_login_count = 0
    admin.locked_until = None
    admin.last_login_at = _now()
    admin.last_login_ip = ctx.ip
    await db.flush()

    ctx.actor_id = admin.id
    ctx.actor_type = "ADMIN"
    ctx.actor_label = f"{admin.full_name} (@{admin.username})"

    pair = await issue_token_pair(
        db,
        subject_id=admin.id,
        subject_type="admin",
        role=admin.role,
        token_version=admin.token_version,
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    db.add(
        LoginAttempt(
            username=username,
            admin_id=admin.id,
            successful=True,
            is_admin_portal=True,
            ip=ctx.ip,
            user_agent=ctx.user_agent,
        )
    )
    await audit_log.record(
        db,
        AuditAction.ADMIN_LOGIN_SUCCESS,
        entity_type="admin",
        entity_id=admin.id,
        entity_label=admin.username,
        summary=f"{admin.full_name} signed in to the admin panel",
    )
    return admin, pair


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
async def _count(db: AsyncSession, stmt: Select) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def dashboard_stats(db: AsyncSession) -> dict[str, Any]:
    today = _start_of_day()
    week_ago = _now() - timedelta(days=7)

    def count_of(model, *where) -> Select:
        stmt = select(func.count()).select_from(model)
        return stmt.where(*where) if where else stmt

    total_users = await _count(db, count_of(User, User.deleted_at.is_(None)))
    active_users = await _count(
        db, count_of(User, User.status == UserStatus.ACTIVE.value, User.deleted_at.is_(None))
    )
    owners = await _count(
        db, count_of(User, User.role == UserRole.OWNER.value, User.deleted_at.is_(None))
    )
    students = await _count(
        db, count_of(User, User.role == UserRole.STUDENT.value, User.deleted_at.is_(None))
    )
    pending_users = await _count(
        db,
        count_of(
            User,
            User.status == UserStatus.PENDING_VERIFICATION.value,
            User.deleted_at.is_(None),
        ),
    )
    suspended_users = await _count(
        db,
        count_of(
            User,
            User.status.in_([UserStatus.SUSPENDED.value, UserStatus.BANNED.value]),
            User.deleted_at.is_(None),
        ),
    )
    today_users = await _count(
        db, count_of(User, User.created_at >= today, User.deleted_at.is_(None))
    )
    week_users = await _count(
        db, count_of(User, User.created_at >= week_ago, User.deleted_at.is_(None))
    )

    total_listings = await _count(db, count_of(Listing, Listing.deleted_at.is_(None)))
    approved = await _count(
        db,
        count_of(
            Listing,
            Listing.status == ListingStatus.APPROVED.value,
            Listing.deleted_at.is_(None),
        ),
    )
    rejected = await _count(
        db,
        count_of(
            Listing,
            Listing.status == ListingStatus.REJECTED.value,
            Listing.deleted_at.is_(None),
        ),
    )
    pending_listings = await _count(
        db,
        count_of(
            Listing,
            Listing.status.in_(
                [ListingStatus.PENDING.value, ListingStatus.UNDER_REVIEW.value,
                 ListingStatus.WARNING.value]
            ),
            Listing.deleted_at.is_(None),
        ),
    )
    featured = await _count(
        db, count_of(Listing, Listing.is_featured.is_(True), Listing.deleted_at.is_(None))
    )
    today_listings = await _count(
        db, count_of(Listing, Listing.created_at >= today, Listing.deleted_at.is_(None))
    )

    open_reports = await _count(
        db, count_of(Report, Report.status == ReportStatus.OPEN.value)
    )
    pending_verifications = await _count(
        db,
        count_of(
            VerificationRequest,
            VerificationRequest.status == VerificationStatus.PENDING.value,
        ),
    )

    ai_sessions = await _count(db, count_of(AISession))
    ai_guest_sessions = await _count(db, count_of(AISession, AISession.user_id.is_(None)))
    ai_queries = await _count(db, count_of(AIMessage, AIMessage.role == "user"))
    today_ai = await _count(
        db, count_of(AIMessage, AIMessage.role == "user", AIMessage.created_at >= today)
    )

    sms_today = await _count(db, count_of(SmsLog, SmsLog.created_at >= today))
    sms_failed_today = await _count(
        db, count_of(SmsLog, SmsLog.created_at >= today, SmsLog.status == "FAILED")
    )

    visitors_today = int(
        (
            await db.execute(
                select(func.count(func.distinct(TrafficEvent.session_id))).where(
                    TrafficEvent.created_at >= today, TrafficEvent.is_bot.is_(False)
                )
            )
        ).scalar_one()
        or 0
    )
    failed_logins_today = await _count(
        db,
        count_of(
            LoginAttempt,
            LoginAttempt.successful.is_(False),
            LoginAttempt.created_at >= today,
        ),
    )
    total_views = int(
        (
            await db.execute(
                select(func.coalesce(func.sum(Listing.views_count), 0)).where(
                    Listing.deleted_at.is_(None)
                )
            )
        ).scalar_one()
        or 0
    )

    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "owners": owners,
        "students": students,
        "tenants": students,
        "pendingUsers": pending_users,
        "suspendedUsers": suspended_users,
        "todayNewUsers": today_users,
        "weekNewUsers": week_users,
        "totalListings": total_listings,
        "approvedListings": approved,
        "rejectedListings": rejected,
        "pendingListings": pending_listings,
        "featuredListings": featured,
        "todayNewListings": today_listings,
        "totalViews": total_views,
        "openReports": open_reports,
        "pendingVerifications": pending_verifications,
        "aiSessions": ai_sessions,
        "guests": ai_guest_sessions,
        "aiQueries": ai_queries,
        "todayAiQueries": today_ai,
        "smsToday": sms_today,
        "smsFailedToday": sms_failed_today,
        "visitorsToday": visitors_today,
        "failedLoginsToday": failed_logins_today,
    }


async def registrations_chart(db: AsyncSession, days: int = 7) -> list[dict[str, Any]]:
    start = _start_of_day() - timedelta(days=days - 1)
    rows = (
        await db.execute(
            select(
                func.date_trunc("day", User.created_at).label("day"),
                func.count().label("count"),
            )
            .where(User.created_at >= start, User.deleted_at.is_(None))
            .group_by("day")
            .order_by("day")
        )
    ).all()
    by_day = {row.day.date().isoformat(): int(row.count) for row in rows}

    output: list[dict[str, Any]] = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).date()
        output.append({"date": day.isoformat(), "count": by_day.get(day.isoformat(), 0)})
    return output


async def traffic_chart(db: AsyncSession, days: int = 7) -> list[dict[str, Any]]:
    start = _start_of_day() - timedelta(days=days - 1)
    rows = (
        await db.execute(
            select(
                func.date_trunc("day", TrafficEvent.created_at).label("day"),
                func.count(func.distinct(TrafficEvent.session_id)).label("visitors"),
                func.count().label("views"),
            )
            .where(TrafficEvent.created_at >= start, TrafficEvent.is_bot.is_(False))
            .group_by("day")
            .order_by("day")
        )
    ).all()
    by_day = {
        row.day.date().isoformat(): {"visitors": int(row.visitors), "views": int(row.views)}
        for row in rows
    }
    output: list[dict[str, Any]] = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).date().isoformat()
        entry = by_day.get(day, {"visitors": 0, "views": 0})
        output.append({"date": day, **entry})
    return output


async def district_chart(db: AsyncSession, limit: int = 10) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(Listing.district, func.count().label("count"))
            .where(Listing.deleted_at.is_(None), Listing.district.isnot(None))
            .group_by(Listing.district)
            .order_by(func.count().desc())
            .limit(limit)
        )
    ).all()
    return [{"district": row.district, "count": int(row.count)} for row in rows]


async def activity_chart(db: AsyncSession, days: int = 7) -> list[dict[str, Any]]:
    """Audit events per day, grouped by severity - the security pulse."""
    start = _start_of_day() - timedelta(days=days - 1)
    rows = (
        await db.execute(
            select(
                func.date_trunc("day", AuditLog.created_at).label("day"),
                AuditLog.severity,
                func.count().label("count"),
            )
            .where(AuditLog.created_at >= start)
            .group_by("day", AuditLog.severity)
            .order_by("day")
        )
    ).all()
    buckets: dict[str, dict[str, int]] = {}
    for row in rows:
        key = row.day.date().isoformat()
        buckets.setdefault(key, {})[row.severity] = int(row.count)

    output: list[dict[str, Any]] = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).date().isoformat()
        entry = buckets.get(day, {})
        output.append(
            {
                "date": day,
                "info": entry.get("INFO", 0),
                "notice": entry.get("NOTICE", 0),
                "warning": entry.get("WARNING", 0),
                "critical": entry.get("CRITICAL", 0),
            }
        )
    return output
