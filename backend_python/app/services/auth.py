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
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit as audit_log
from app.core.config import settings
from app.core.context import get_context
from app.core.database import commit_then_raise
from app.core.errors import BadRequest, Forbidden, TooManyRequests, Unauthorized
from app.core.phone import mask_phone
from app.core.rate_limit import clear as clear_limit
from app.core.rate_limit import enforce, refund
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
from app.models.enums import (
    SIGNUP_ROLE_VALUES,
    AuditAction,
    OtpPurpose,
    SmsStatus,
    UserRole,
    UserStatus,
)
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
def otp_ttl_minutes(purpose: OtpPurpose) -> int:
    """How long a code issued for ``purpose`` stays usable.

    The single source for this, deliberately: the row's ``expires_at`` and the
    ``expiresIn`` the API hands the client are computed from the same call, so
    the countdown on screen cannot run out at a different moment than the one
    the server enforces. They used to be two separate reads of the same setting,
    which was fine only for as long as every purpose shared one lifetime.
    """
    if purpose == OtpPurpose.PASSWORD_RESET:
        return settings.OTP_PASSWORD_RESET_TTL_MINUTES
    return settings.OTP_TTL_MINUTES


async def _active_otp(
    db: AsyncSession, phone: str, purpose: str, *, for_update: bool = False
) -> OtpCode | None:
    """The newest code for this phone and purpose that has not been used up.

    Expiry is deliberately NOT part of the filter. Hiding an aged-out row here
    left the callers unable to tell "you were never sent a code" from "the code
    you are holding is too old", so both came back as ``otp_not_found`` — whose
    wording tells a user staring at the SMS on their screen that nothing was
    ever sent. Every caller checks ``expires_at`` itself and says which it is.
    """
    stmt = (
        select(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.purpose == purpose,
            OtpCode.consumed_at.is_(None),
            OtpCode.invalidated_at.is_(None),
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    # `for_update` is what makes the attempt cap an actual cap. Reading the row
    # plainly and then writing `attempts + 1` is a read-modify-write with no
    # lock across it: fire six guesses at once and all six read `attempts = 0`,
    # all six pass the `attempts >= max_attempts` test, and the six of them
    # together cost one attempt. A guesser with a little concurrency therefore
    # got orders of magnitude more tries than the five the design promises,
    # with somebody's password reset as the prize.
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
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

    # Locked, because the cooldown is decided from what this read returns and
    # `invalidated_at` is written back to it. Two resends arriving together
    # both read "no cooldown", both invalidate, and both send — on the one path
    # in this file that costs money.
    existing = await _active_otp(db, phone, purpose.value, for_update=True)
    if existing is not None and existing.expires_at > _now():
        # Only a code that could still be typed in holds the resend door shut.
        # `_active_otp` returns expired rows as well, so without this test a
        # user whose code aged out would be told to wait for a cooldown on a
        # code nobody can use any more — the resend button refusing to do the
        # one thing left that would help them.
        age = (_now() - existing.created_at).total_seconds()
        if age < settings.OTP_RESEND_COOLDOWN_SECONDS:
            raise TooManyRequests(
                "otp_cooldown",
                params={"seconds": int(settings.OTP_RESEND_COOLDOWN_SECONDS - age)},
            )

    # The old code is NOT retired here. It is retired below, once the new one
    # has actually gone out — because a resend that the provider refuses used
    # to take the working code down with it: the row was invalidated first, the
    # failure then committed that invalidation, and a visitor who pressed
    # "resend" while holding a perfectly good SMS was left with two dead codes
    # and a fifteen-minute wait.

    code = generate_numeric_code(settings.OTP_LENGTH)
    entry = OtpCode(
        phone=phone,
        purpose=purpose.value,
        code_hash=hash_token(code),
        max_attempts=settings.OTP_MAX_ATTEMPTS,
        expires_at=_now() + timedelta(minutes=otp_ttl_minutes(purpose)),
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
            meta={
                "purpose": purpose.value,
                "delivered": result.ok,
                "status": result.status,
                "error": result.error,
            },
        )
        # UNKNOWN belongs here beside FAILED. It means the provider never
        # answered, which is an outage whether or not this particular message
        # got through, and it is the shape a provider hang takes — so leaving
        # it out made the most common incident the one nothing recorded.
        if result.status in (SmsStatus.FAILED.value, SmsStatus.UNKNOWN.value):
            await audit_log.record(
                db,
                AuditAction.SMS_FAILED,
                entity_type="phone",
                entity_id=phone,
                entity_label=mask_phone(phone),
                summary=f"SMS delivery failed ({purpose.value})",
                meta={"error": result.error, "status": result.status},
            )
        # SKIPPED means SMS is switched off, which is a working configuration
        # (local development, tests) and not a failure to report. UNKNOWN means
        # the provider never answered: the message may be on the handset right
        # now, so the code stays live and the user is told it was sent — the
        # alternative is destroying a code they can see and can use.
        if not result.ok and result.status not in (
            SmsStatus.SKIPPED.value,
            SmsStatus.UNKNOWN.value,
        ):
            # The provider definitively refused, so the two hourly tokens
            # charged above bought nothing. Keeping them made a provider outage
            # far worse than it needed to be: a user pressing "try again" spent
            # their twelve hourly sends on messages that never left the
            # building, and every one of those attempts also spent from the
            # shared otp_ip bucket that everyone behind the same carrier NAT
            # draws on — so a handful of retrying neighbours took OTP down for
            # the whole address. Refunding is safe because the cap that actually
            # bounds SMS spend is the per-phone daily count of OtpCode rows,
            # which is in the database — and which this path is careful to
            # leave alone, see below.
            #
            # `refund`, never `clear`. Clearing pops the whole window, which
            # turns any failure the caller can provoke into a way to empty a
            # bucket on demand — and `otp_ip` is shared by everyone behind one
            # carrier NAT, so emptying it is a favour to an attacker and to
            # nobody else. Giving back exactly what was taken leaves the rest
            # of the window standing.
            await refund("otp_phone", phone)
            if ctx.ip:
                await refund("otp_ip", ctx.ip)
            # The row goes, and the records of why it went stay: the SmsLog
            # entry, both audit rows above. Deleting rather than invalidating
            # is the point — `_daily_otp_count` counts rows, not deliveries, so
            # an invalidated one still spent a day's allowance on a message
            # that never left the building. Ten retries against a dead provider
            # locked the user's own number out for twenty-four hours, on a rule
            # whose entire purpose is to cap what the platform is billed for.
            #
            # A bare raise used to hand all of it to get_db's rollback, so the
            # only evidence of an outage was destroyed by the error reporting
            # it. That is what `commit_then_raise` is for.
            await db.delete(entry)
            await db.flush()
            # An un-refundable charge, unlike the two above.
            #
            # Refunding the send buckets is right — the user should not pay an
            # hour of their allowance for a message that never left the
            # building — but refunding BOTH of them and deleting the row that
            # the daily cap counts leaves nothing at all bounding how fast a
            # retry loop can hammer a provider that is already unwell. This is
            # the floor: a handful of retries, then a short wait. It is charged
            # only on this branch, so a working provider never touches it.
            await enforce("otp_retry", phone)
            await commit_then_raise(db, BadRequest("sms_send_failed"))

    # Sent, or at least plausibly sent. Only now does the previous code stop
    # working — see the note above the cooldown check.
    if existing is not None and existing is not entry:
        existing.invalidated_at = _now()
        await db.flush()

    return code, entry


def _otp_failure(purpose: OtpPurpose, code: str, **params: object) -> BadRequest:
    """The error a CALLER is allowed to see, which is not always the real one.

    A password reset is the one flow where the phone number is not already
    known to belong to the person asking. `request_password_reset` goes to
    some trouble over that: it answers 200 whether or not the number has an
    account, so the endpoint cannot be used to enumerate one. The code step
    then gave the whole thing away — "no code exists for this number" for a
    stranger's phone against "that code is wrong" for a real account's, two
    requests and you know which numbers are registered.

    So every reset failure answers `otp_invalid`, whose wording covers a wrong
    code and an expired one alike and whose next step — press resend, which is
    on the same screen — is the same either way. The audit rows keep the real
    reason, because an operator asking "why can this person not get in" is not
    the party this is hiding from.

    The attempts-remaining count goes with it. A count only exists when a code
    does, so "3 attempts remaining" answers the same question the error code
    was just stopped from answering.

    Registration is deliberately untouched: the number there is one the caller
    typed a moment ago and is proving they hold, so there is nothing to learn.
    """
    if purpose == OtpPurpose.PASSWORD_RESET:
        return BadRequest("otp_reset_invalid")
    return BadRequest(code, params=dict(params) or None)


async def verify_otp(
    db: AsyncSession, *, phone: str, code: str, purpose: OtpPurpose
) -> OtpCode:
    """Consume a code, or raise. Attempts are counted on the row itself."""
    # The endpoints that reach here spend a code, and until now they were the
    # only OTP paths with no rate limit at all — the limiter sat on the
    # non-consuming check instead, which is exactly backwards.
    await enforce("otp_verify", phone)
    _verify_ctx = get_context()
    if _verify_ctx.ip:
        await enforce("otp_verify_ip", _verify_ctx.ip)

    entry = await _active_otp(db, phone, purpose.value, for_update=True)
    if entry is None:
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "no_active_code", "purpose": purpose.value},
        )
        await commit_then_raise(db, _otp_failure(purpose, "otp_not_found"))

    if entry.expires_at <= _now():
        # Answered separately from "no code" because the two read completely
        # differently to somebody holding the SMS: otp_not_found tells them the
        # message was never sent, which is both wrong and unfixable-sounding,
        # while otp_expired tells them to press resend. The row is left alone —
        # not invalidated — so a second attempt gets the same honest answer
        # instead of falling back to otp_not_found.
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "expired", "purpose": purpose.value},
        )
        await commit_then_raise(db, _otp_failure(purpose, "otp_expired"))

    if entry.attempts >= entry.max_attempts:
        entry.invalidated_at = _now()
        await commit_then_raise(
            db, _otp_failure(purpose, "otp_too_many_attempts")
        )

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
            await commit_then_raise(
                db, _otp_failure(purpose, "otp_too_many_attempts")
            )
        await commit_then_raise(
            db, _otp_failure(purpose, "otp_invalid", remaining=remaining)
        )

    entry.consumed_at = _now()
    await db.flush()
    # The bucket exists to bound volume, not to punish. Left charged, an
    # attacker could spend a stranger's allowance on their number — one
    # request a minute, well under every other limit — and lock them out of
    # finishing a registration or a password reset. A correct code is proof
    # the caller holds the phone, so it hands the allowance back.
    await clear_limit("otp_verify", phone)
    await audit_log.record(
        db,
        AuditAction.AUTH_OTP_VERIFIED,
        entity_type="phone",
        entity_id=phone,
        entity_label=mask_phone(phone),
        meta={"purpose": purpose.value},
    )
    return entry


async def check_otp(
    db: AsyncSession, *, phone: str, code: str, purpose: OtpPurpose
) -> OtpCode:
    """Judge a code without spending it.

    ``verify_otp`` consumes the row it accepts, which is right for the call
    that completes an operation and wrong for a wizard step that only wants to
    know whether it may show the next screen. The password reset had no such
    call, so its code screen advanced on *any* six digits and the code was
    first judged on the password screen — where a wrong one is not something
    the visitor can fix.

    A wrong guess costs an attempt exactly as it does in ``verify_otp``; this
    would otherwise be a free oracle to brute-force against. A correct one
    costs nothing, so the same code still has its full budget left for the
    ``reset_password`` call that follows and actually spends it.
    """
    await enforce("otp_check", phone)
    ctx = get_context()
    if ctx.ip:
        await enforce("otp_check_ip", ctx.ip)

    entry = await _active_otp(db, phone, purpose.value, for_update=True)
    if entry is None:
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "no_active_code", "purpose": purpose.value, "check": True},
        )
        await commit_then_raise(db, _otp_failure(purpose, "otp_not_found"))

    if entry.expires_at <= _now():
        # Same reasoning as in verify_otp, and it matters more here: this is the
        # wizard step the visitor sees first, so an expired reset code has to
        # say "expired, ask for a new one" on the code screen rather than send
        # them on to choose a password against a code that cannot be spent.
        await audit_log.record(
            db,
            AuditAction.AUTH_OTP_FAILED,
            entity_type="phone",
            entity_id=phone,
            entity_label=mask_phone(phone),
            meta={"reason": "expired", "purpose": purpose.value, "check": True},
        )
        await commit_then_raise(db, _otp_failure(purpose, "otp_expired"))

    if entry.attempts >= entry.max_attempts:
        entry.invalidated_at = _now()
        await commit_then_raise(
            db, _otp_failure(purpose, "otp_too_many_attempts")
        )

    if secrets.compare_digest(entry.code_hash, hash_token(code)):
        return entry

    entry.attempts += 1
    await db.flush()
    remaining = max(0, entry.max_attempts - entry.attempts)
    await audit_log.record(
        db,
        AuditAction.AUTH_OTP_FAILED,
        entity_type="phone",
        entity_id=phone,
        entity_label=mask_phone(phone),
        meta={
            "reason": "bad_code",
            "remaining": remaining,
            "purpose": purpose.value,
            "check": True,
        },
    )
    if remaining == 0:
        entry.invalidated_at = _now()
        await commit_then_raise(
            db, _otp_failure(purpose, "otp_too_many_attempts")
        )
    await commit_then_raise(db, _otp_failure(purpose, "otp_invalid", remaining=remaining))


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
    agency_name: str | None = None,
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

    if role not in SIGNUP_ROLE_VALUES:
        role = UserRole.STUDENT.value

    # An agency name on a student account is meaningless, and on an owner it
    # is a claim the role does not back up.
    agency = (agency_name or "").strip()[:120] or None
    if role != UserRole.AGENT.value:
        agency = None

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

    # The code is obtained BEFORE the staged signup is touched, and that order
    # is the whole point. `issue_otp` commits on a definitive send failure, so
    # anything written to `pending_registrations` first became permanent: the
    # previous attempt's staged row was already deleted and the new one was
    # already inserted, leaving a signup nobody could complete and — because
    # the guard above refuses a staged row whose IP is not the caller's — one
    # that a user on a rotating carrier address could not restart either, for
    # the better part of an hour. Nothing here has touched the table yet, so
    # that commit now carries only the ledger explaining the failure.
    code, _ = await issue_otp(
        db, phone=phone, purpose=OtpPurpose.REGISTER, language=language
    )

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
        agency_name=agency,
        language=language,
        expires_at=_now() + timedelta(minutes=settings.OTP_TTL_MINUTES * 4),
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    db.add(pending)
    await db.flush()

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
            agency_name=pending.agency_name,
            referral_code=_referral_code(),
        )
        db.add(user)
    else:
        user.name = pending.name
        user.role = pending.role
        user.agency_name = pending.agency_name
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
    if purpose == OtpPurpose.PASSWORD_RESET:
        # Delegated rather than reimplemented: the forgot-password endpoint is
        # careful to send nothing to a number with no account (or a Google-only
        # one), and to swallow cooldown errors that would otherwise reveal which
        # numbers are registered. Resending is the same request pressed twice,
        # so it has to inherit the same guards - otherwise a mistyped number on
        # the reset screen bills a real SMS to a stranger, and the property the
        # forgot-password route documents is voidable through its sibling.
        return await request_password_reset(db, phone=phone, language=language)

    if purpose != OtpPurpose.REGISTER:
        # LOGIN and PHONE_CHANGE codes are not issued by any flow that reaches
        # here; falling through would make this an open SMS sender.
        raise BadRequest("validation_error")

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
async def _log_suppressed_reset(db: AsyncSession, phone: str, reason: str) -> None:
    """Record a reset that was silently turned into a success response.

    The suppression is what makes the endpoint safe, and it is also what makes
    it undiagnosable: a user reporting "I never get the reset SMS" left no trace
    anywhere, because the request returned 200 and the audit row only says a
    reset was asked for. The phone is masked, and the reason is the error code
    that was swallowed, never the wording shown to the visitor.

    Both a log line and an audit row, because they are read by different people
    at different times. The log is where an incident is diagnosed; the audit
    row is where somebody answering a support message can see that this
    number's reset was refused, and why, without a shell.
    """
    log.warning(
        "auth.password_reset_suppressed", phone=mask_phone(phone), reason=reason
    )
    await audit_log.record(
        db,
        AuditAction.AUTH_OTP_FAILED,
        entity_type="phone",
        entity_id=phone,
        entity_label=mask_phone(phone),
        summary="Password reset suppressed",
        meta={
            "purpose": OtpPurpose.PASSWORD_RESET.value,
            "reason": reason,
            "suppressed": True,
        },
    )


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
    except TooManyRequests as exc:
        # A cooldown or daily-cap error only fires for a phone that HAS an
        # account, so surfacing it would tell an attacker which numbers are
        # registered. The caller's response is identical either way.
        await _log_suppressed_reset(db, phone, exc.code)
        return None, settings.OTP_RESEND_COOLDOWN_SECONDS
    except BadRequest as exc:
        # Everything above is equally true of sms_send_failed, which is the one
        # this endpoint forgot. An unknown number returns above without sending
        # anything and always answers 200; a registered one went through the
        # provider, and during an outage answered 400 — so the difference
        # between the two responses was exactly the fact the docstring promises
        # to hide, and it showed up when an attacker could most easily provoke
        # it. Suppressed here, the visitor is told a code is on its way and
        # finds no SMS, which is precisely what an unknown number sees.
        await _log_suppressed_reset(db, phone, exc.code)
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
        # Reachable only if the account went away between the code being
        # issued and being spent, so this is not an enumeration hole — but it
        # is the one answer the reset flow can give that is not the collapsed
        # one, and a single odd error code is exactly the kind of thread
        # somebody pulls on. From out there the honest summary is the same:
        # the code did not work.
        raise _otp_failure(OtpPurpose.PASSWORD_RESET, "registration_not_found")

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
