"""Registration, verification, login and password management.

Flow, exactly as specified:

    register(name, phone, password)  -> nothing written to `users`, SMS sent
    verify(phone, code)              -> account created + verified, tokens issued
    login(phone, password)           -> tokens issued

Guarantees enforced here:
  * A phone number is never claimed until its owner proves control of it.
  * Passwords are Argon2id-hashed; login compares hashes, never plaintext.
  * Failed logins are counted and lock the account temporarily.
  * OTP codes are stored hashed, single-use, attempt-capped and expiring.
  * Enumeration is avoided: "wrong phone" and "wrong password" are one error.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit as audit_log
from app.core.config import settings
from app.core.context import get_context
from app.core.database import commit_then_raise
from app.core.errors import BadRequest, Forbidden, TooManyRequests, Unauthorized
from app.core.phone import mask_phone
from app.core.rate_limit import clear as clear_limit
from app.core.rate_limit import enforce
from app.core.security import (
    encrypt_secret,
    generate_numeric_code,
    hash_password,
    hash_token,
    needs_rehash,
    verify_password,
)
from app.core.tokens import TokenPair, issue_token_pair, revoke_all_for_subject
from app.models.auth import LoginAttempt, OtpCode, PendingRegistration
from app.models.enums import AuditAction, OtpPurpose, UserRole, UserStatus
from app.models.user import User
from app.services.sms import send_otp_sms

log = structlog.get_logger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _referral_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


# ---------------------------------------------------------------------------
# OTP plumbing
# ---------------------------------------------------------------------------
async def _active_otp(
    db: AsyncSession, phone: str, purpose: str
) -> OtpCode | None:
    result = await db.execute(
        select(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.purpose == purpose,
            OtpCode.consumed_at.is_(None),
            OtpCode.invalidated_at.is_(None),
            OtpCode.expires_at > _now(),
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _daily_otp_count(db: AsyncSession, phone: str) -> int:
    since = _now() - timedelta(days=1)
    result = await db.execute(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.phone == phone, OtpCode.created_at >= since)
    )
    return int(result.scalar_one() or 0)


async def issue_otp(
    db: AsyncSession,
    *,
    phone: str,
    purpose: OtpPurpose,
    language: str = "uz",
    send: bool = True,
) -> tuple[str, OtpCode]:
    """Create (and optionally send) a fresh code, superseding any previous one."""
    ctx = get_context()

    # Persistent per-phone daily cap: survives restarts, unlike the in-memory
    # limiter, so SMS spend cannot be reset by bouncing the process.
    if await _daily_otp_count(db, phone) >= settings.OTP_MAX_PER_PHONE_PER_DAY:
        raise TooManyRequests("otp_daily_limit")

    await enforce("otp_phone", phone)
    if ctx.ip:
        await enforce("otp_ip", ctx.ip)

    existing = await _active_otp(db, phone, purpose.value)
    if existing is not None:
        age = (_now() - existing.created_at).total_seconds()
        if age < settings.OTP_RESEND_COOLDOWN_SECONDS:
            raise TooManyRequests(
                "otp_cooldown",
                params={"seconds": int(settings.OTP_RESEND_COOLDOWN_SECONDS - age)},
            )
        existing.invalidated_at = _now()

    code = generate_numeric_code(settings.OTP_LENGTH)
    entry = OtpCode(
        phone=phone,
        purpose=purpose.value,
        code_hash=hash_token(code),
        max_attempts=settings.OTP_MAX_ATTEMPTS,
        expires_at=_now() + timedelta(minutes=settings.OTP_TTL_MINUTES),
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    db.add(entry)
    await db.flush()

    if send:
        result = await send_otp_sms(
            db, phone=phone, code=code, purpose=purpose.value, language=language
        )
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_SENT,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            summary=f"OTP {purpose.value}",
            meta={"purpose": purpose.value, "delivered": result.ok, "error": result.error},
        )
        if result.status == "FAILED":
            await audit_log.record(
                db,
                AuditAction.SMS_FAILED,
                entity_type="phone",
                entity_id=phone,
                entity_label=mask_phone(phone),
                summary=f"SMS delivery failed ({purpose.value})",
                meta={"error": result.error},
            )
        if not result.ok and result.status != "SKIPPED":
            raise BadRequest("sms_send_failed")

    return code, entry


async def verify_otp(
    db: AsyncSession, *, phone: str, code: str, purpose: OtpPurpose
) -> OtpCode:
    """Consume a code, or raise. Attempts are counted on the row itself."""
    entry = await _active_otp(db, phone, purpose.value)
    if entry is None:
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "no_active_code", "purpose": purpose.value},
        )
        await commit_then_raise(db, BadRequest("otp_not_found"))

    if entry.attempts >= entry.max_attempts:
        entry.invalidated_at = _now()
        await commit_then_raise(db, BadRequest("otp_too_many_attempts"))

    entry.attempts += 1
    await db.flush()

    if not secrets.compare_digest(entry.code_hash, hash_token(code)):
        remaining = max(0, entry.max_attempts - entry.attempts)
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "bad_code", "remaining": remaining, "purpose": purpose.value},
        )
        if remaining == 0:
            entry.invalidated_at = _now()
            await commit_then_raise(db, BadRequest("otp_too_many_attempts"))
        await commit_then_raise(
            db, BadRequest("otp_invalid", params={"remaining": remaining})
        )

    entry.consumed_at = _now()
    await db.flush()
    await audit_log.record(
        db,
        AuditAction.AUTH_OTP_VERIFIED,
        entity_type="phone",
        entity_id=phone,
        entity_label=mask_phone(phone),
        meta={"purpose": purpose.value},
    )
    return entry


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    result = await db.execute(
        select(User).where(User.phone == phone, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def start_registration(
    db: AsyncSession,
    *,
    name: str,
    phone: str,
    password: str,
    role: str,
    language: str,
) -> tuple[str | None, int]:
    """Stage a signup and send the confirmation code.

    Returns ``(debug_code_or_None, resend_after_seconds)``. Nothing is written
    to ``users`` here, so an abandoned registration leaves no account behind
    and cannot be used to squat on somebody else's number.
    """
    ctx = get_context()
    if ctx.ip:
        await enforce("register_ip", ctx.ip)

    existing = await get_user_by_phone(db, phone)
    if existing is not None:
        if existing.status == UserStatus.REGISTRATION_REQUIRED.value:
            # A legacy account with no password: let its owner reclaim it by
            # re-registering on the same number.
            pass
        elif existing.password_hash:
            await audit_log.record(
                db,
                AuditAction.AUTH_REGISTER_BLOCKED,
                entity_type="phone",
                entity_id=phone,
                entity_label=mask_phone(phone),
                meta={"reason": "already_registered"},
            )
            await commit_then_raise(db, BadRequest("phone_already_registered"))

    if role not in {UserRole.STUDENT.value, UserRole.OWNER.value}:
        role = UserRole.STUDENT.value

    # A pending signup belongs to whoever started it. Letting a third party
    # overwrite it would let them replace the victim's staged password (and
    # invalidate their code) simply by submitting the same phone number.
    staged = (
        await db.execute(
            select(PendingRegistration).where(PendingRegistration.phone == phone)
        )
    ).scalar_one_or_none()
    if (
        staged is not None
        and staged.expires_at > _now()
        and staged.ip is not None
        and ctx.ip is not None
        and str(staged.ip) != str(ctx.ip)
    ):
        raise TooManyRequests("otp_cooldown", params={"seconds": settings.OTP_RESEND_COOLDOWN_SECONDS})

    await db.execute(
        PendingRegistration.__table__.delete().where(
            PendingRegistration.phone == phone
        )
    )
    pending = PendingRegistration(
        phone=phone,
        name=name,
        password_hash=hash_password(password),
        password_secret=encrypt_secret(password),
        role=role,
        language=language,
        expires_at=_now() + timedelta(minutes=settings.OTP_TTL_MINUTES * 4),
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    db.add(pending)
    await db.flush()

    code, _ = await issue_otp(
        db, phone=phone, purpose=OtpPurpose.REGISTER, language=language
    )

    await audit_log.record(
        db,
        AuditAction.AUTH_REGISTER_STARTED,
        entity_type="phone",
        entity_id=phone,
        entity_label=f"{name} {mask_phone(phone)}",
        summary=f"{name} started registration as {role}",
        meta={"role": role, "language": language},
    )

    debug_code = code if settings.OTP_DEBUG_RETURN_CODE else None
    return debug_code, settings.OTP_RESEND_COOLDOWN_SECONDS


async def complete_registration(
    db: AsyncSession, *, phone: str, code: str
) -> tuple[User, TokenPair]:
    """Confirm the SMS code and create (or reclaim) the account."""
    ctx = get_context()
    await verify_otp(db, phone=phone, code=code, purpose=OtpPurpose.REGISTER)

    pending = (
        await db.execute(
            select(PendingRegistration).where(PendingRegistration.phone == phone)
        )
    ).scalar_one_or_none()

    if pending is None or pending.expires_at <= _now():
        raise BadRequest("registration_not_found")

    user = await get_user_by_phone(db, phone)
    is_new = user is None

    if user is None:
        user = User(
            name=pending.name,
            phone=phone,
            role=pending.role,
            referral_code=_referral_code(),
        )
        db.add(user)
    else:
        user.name = pending.name
        user.role = pending.role
        if not user.referral_code:
            user.referral_code = _referral_code()

    user.password_hash = pending.password_hash
    user.password_secret = pending.password_secret
    user.password_updated_at = _now()
    user.must_change_password = False
    user.language = pending.language
    user.status = UserStatus.ACTIVE.value
    user.phone_verified_at = _now()
    user.is_verified = True
    user.trust_score = max(user.trust_score or 0, 60)
    user.verification_level = max(user.verification_level or 1, 2)
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = _now()
    user.last_login_ip = ctx.ip
    # Retire any token minted for a previous incarnation of this account.
    user.token_version = (user.token_version or 0) + 1

    await db.flush()
    await db.delete(pending)

    pair = await issue_token_pair(
        db,
        subject_id=user.id,
        subject_type="user",
        role=user.role,
        token_version=user.token_version,
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )

    ctx.actor_id = user.id
    ctx.actor_type = "USER"
    ctx.actor_label = f"{user.name} {mask_phone(user.phone)}"

    await audit_log.record(
        db,
        AuditAction.AUTH_REGISTER_COMPLETED,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{user.name} completed registration as {user.role}",
        meta={"role": user.role, "new_account": is_new},
    )
    db.add(
        LoginAttempt(
            phone=phone,
            user_id=user.id,
            successful=True,
            ip=ctx.ip,
            user_agent=ctx.user_agent,
            meta={"via": "registration"},
        )
    )
    return user, pair


async def resend_registration_code(
    db: AsyncSession, *, phone: str, purpose: OtpPurpose, language: str
) -> tuple[str | None, int]:
    if purpose == OtpPurpose.REGISTER:
        pending = (
            await db.execute(
                select(PendingRegistration).where(PendingRegistration.phone == phone)
            )
        ).scalar_one_or_none()
        if pending is None or pending.expires_at <= _now():
            raise BadRequest("registration_not_found")
        language = pending.language or language

    code, _ = await issue_otp(db, phone=phone, purpose=purpose, language=language)
    await audit_log.record(
        db,
        AuditAction.AUTH_OTP_RESENT,
        entity_type="phone",
        entity_id=phone,
        entity_label=mask_phone(phone),
        meta={"purpose": purpose.value},
    )
    return (
        code if settings.OTP_DEBUG_RETURN_CODE else None,
        settings.OTP_RESEND_COOLDOWN_SECONDS,
    )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
async def _record_attempt(
    db: AsyncSession,
    *,
    phone: str,
    user: User | None,
    successful: bool,
    reason: str | None = None,
) -> None:
    ctx = get_context()
    db.add(
        LoginAttempt(
            phone=phone,
            user_id=user.id if user else None,
            successful=successful,
            failure_reason=reason,
            ip=ctx.ip,
            user_agent=ctx.user_agent,
        )
    )


async def login(db: AsyncSession, *, phone: str, password: str) -> tuple[User, TokenPair]:
    ctx = get_context()
    await enforce("login_phone", phone)
    if ctx.ip:
        await enforce("auth_ip", ctx.ip)

    user = await get_user_by_phone(db, phone)

    # Locked accounts are rejected before the password is even considered.
    if user is not None and user.locked_until and user.locked_until > _now():
        minutes = max(1, int((user.locked_until - _now()).total_seconds() // 60) + 1)
        await _record_attempt(db, phone=phone, user=user, successful=False, reason="locked")
        await audit_log.record(
            db,
            AuditAction.AUTH_LOGIN_LOCKED,
            entity_type="user",
            entity_id=user.id,
            entity_label=f"{user.name} {mask_phone(phone)}",
            meta={"locked_for_minutes": minutes},
        )
        await commit_then_raise(
            db, Forbidden("account_locked", params={"minutes": minutes})
        )

    # verify_password runs against a dummy hash when the user is absent, so an
    # attacker cannot distinguish "no such number" from "wrong password" by
    # response time or by message.
    password_ok = verify_password(password, user.password_hash if user else None)

    if user is None or not password_ok:
        if user is not None:
            user.failed_login_count = (user.failed_login_count or 0) + 1
            if user.failed_login_count >= settings.MAX_FAILED_LOGINS:
                user.locked_until = _now() + timedelta(minutes=settings.LOCKOUT_MINUTES)
                user.failed_login_count = 0
                await audit_log.record(
                    db,
                    AuditAction.AUTH_LOGIN_LOCKED,
                    entity_type="user",
                    entity_id=user.id,
                    entity_label=f"{user.name} {mask_phone(phone)}",
                    meta={"locked_for_minutes": settings.LOCKOUT_MINUTES},
                )
        await _record_attempt(
            db,
            phone=phone,
            user=user,
            successful=False,
            reason="bad_password" if user else "unknown_phone",
        )
        await audit_log.record(
            db,
            AuditAction.AUTH_LOGIN_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "bad_password" if user else "unknown_phone"},
        )
        await commit_then_raise(db, Unauthorized("invalid_credentials"))

    # Password is correct - now the account's own state decides.
    if user.status == UserStatus.REGISTRATION_REQUIRED.value:
        raise Forbidden("reregistration_required")
    if user.status == UserStatus.BANNED.value:
        raise Forbidden("account_banned")
    if user.status == UserStatus.SUSPENDED.value:
        raise Forbidden("account_suspended")
    if user.status == UserStatus.PENDING_VERIFICATION.value:
        raise Forbidden("account_not_verified")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = _now()
    user.last_login_ip = ctx.ip
    await db.flush()

    ctx.actor_id = user.id
    ctx.actor_type = "USER"
    ctx.actor_label = f"{user.name} {mask_phone(user.phone)}"

    pair = await issue_token_pair(
        db,
        subject_id=user.id,
        subject_type="user",
        role=user.role,
        token_version=user.token_version,
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    await _record_attempt(db, phone=phone, user=user, successful=True)
    await audit_log.record(
        db,
        AuditAction.AUTH_LOGIN_SUCCESS,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{user.name} signed in",
    )
    await clear_limit("login_phone", phone)
    return user, pair


# ---------------------------------------------------------------------------
# Password reset / change
# ---------------------------------------------------------------------------
async def request_password_reset(
    db: AsyncSession, *, phone: str, language: str
) -> tuple[str | None, int]:
    """Always reports success so the endpoint cannot enumerate accounts."""
    user = await get_user_by_phone(db, phone)
    await audit_log.record(
        db,
        AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
        entity_type="user" if user else "phone",
        entity_id=user.id if user else phone,
        entity_label=mask_phone(phone),
        meta={"account_exists": user is not None},
    )
    if user is None or not user.password_hash:
        return None, settings.OTP_RESEND_COOLDOWN_SECONDS

    try:
        code, _ = await issue_otp(
            db,
            phone=phone,
            purpose=OtpPurpose.PASSWORD_RESET,
            language=user.language or language,
        )
    except TooManyRequests:
        # A cooldown or daily-cap error only fires for a phone that HAS an
        # account, so surfacing it would tell an attacker which numbers are
        # registered. The caller's response is identical either way.
        return None, settings.OTP_RESEND_COOLDOWN_SECONDS

    return (
        code if settings.OTP_DEBUG_RETURN_CODE else None,
        settings.OTP_RESEND_COOLDOWN_SECONDS,
    )


async def reset_password(
    db: AsyncSession, *, phone: str, code: str, new_password: str
) -> User:
    await verify_otp(db, phone=phone, code=code, purpose=OtpPurpose.PASSWORD_RESET)
    user = await get_user_by_phone(db, phone)
    if user is None:
        raise BadRequest("registration_not_found")

    await _apply_new_password(db, user, new_password)
    await audit_log.record(
        db,
        AuditAction.AUTH_PASSWORD_RESET_COMPLETED,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary="Password reset via SMS code",
    )
    return user


async def change_password(
    db: AsyncSession, *, user: User, current_password: str, new_password: str
) -> None:
    # An authenticated session is not a licence to brute-force the current
    # password (which is what a stolen access token would try next).
    await enforce("login_phone", f"change:{user.id}")

    if not verify_password(current_password, user.password_hash):
        await audit_log.record(
            db,
            AuditAction.AUTH_LOGIN_FAILED,
            entity_type="user",
            entity_id=user.id,
            entity_label=f"{user.name} {mask_phone(user.phone)}",
            meta={"reason": "bad_current_password"},
        )
        await commit_then_raise(db, BadRequest("current_password_invalid"))

    await _apply_new_password(db, user, new_password)
    await audit_log.record(
        db,
        AuditAction.AUTH_PASSWORD_CHANGED,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary="Password changed by the user",
    )


async def _apply_new_password(db: AsyncSession, user: User, new_password: str) -> None:
    """Set a new password and log every other session out.

    Bumping ``token_version`` invalidates outstanding access tokens; revoking
    the refresh tokens stops them being renewed. A stolen session cannot
    survive a password change.
    """
    user.password_hash = hash_password(new_password)
    user.password_secret = encrypt_secret(new_password)
    user.password_updated_at = _now()
    user.must_change_password = False
    user.failed_login_count = 0
    user.locked_until = None
    user.token_version = (user.token_version or 0) + 1
    await db.flush()
    await revoke_all_for_subject(
        db, subject_id=user.id, subject_type="user", reason="password_changed"
    )


async def logout(
    db: AsyncSession, *, user: User, refresh_token: str | None, all_devices: bool
) -> None:
    from app.core.tokens import revoke_family

    if all_devices:
        user.token_version = (user.token_version or 0) + 1
        await revoke_all_for_subject(
            db, subject_id=user.id, subject_type="user", reason="logout_all"
        )
    elif refresh_token:
        from app.models.auth import RefreshToken

        row = (
            await db.execute(
                select(RefreshToken).where(
                    RefreshToken.token_hash == hash_token(refresh_token)
                )
            )
        ).scalar_one_or_none()
        if row is not None and row.user_id == user.id:
            await revoke_family(db, row.family_id, reason="logout")

    await audit_log.record(
        db,
        AuditAction.AUTH_LOGOUT,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        meta={"all_devices": all_devices},
    )
