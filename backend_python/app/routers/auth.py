"""Public authentication endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, status
from sqlalchemy import select

from app.core import audit as audit_log
from app.core.config import settings
from app.core.database import commit_then_raise
from app.core.deps import CurrentUser, DbSession, Lang, RequestCtx
from app.core.errors import NotFound, Unauthorized, translate
from app.core.phone import mask_phone
from app.core.rate_limit import enforce
from app.core.security import PasswordPolicyError, password_strength, validate_password
from app.core.tokens import (
    TokenError,
    decode_access_token,
    issue_token_pair,
    revoke_family,
    rotate_token_pair,
)
from app.models.auth import RefreshToken
from app.models.enums import AuditAction, OtpPurpose, SIGNUP_ROLES
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    PasswordStrengthRequest,
    PasswordStrengthResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResendCodeRequest,
    ResetPasswordRequest,
    SessionOut,
    SubmitVerificationRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
    VerifyCodeRequest,
)
from app.schemas.common import MessageResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _utcnow():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Registration: name + phone + password -> SMS code -> account
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Step 1 - stage a signup and send the SMS code",
)
async def register(payload: RegisterRequest, db: DbSession, lang: Lang) -> RegisterResponse:
    debug_code, resend_after = await auth_service.start_registration(
        db,
        name=payload.name,
        phone=payload.phone,
        password=payload.password,
        role=payload.role.value,
        language=payload.language.value,
    )
    return RegisterResponse(
        message=_sent_message(lang),
        phone=mask_phone(payload.phone),
        resend_after=resend_after,
        expires_in=settings.OTP_TTL_MINUTES * 60,
        debug_code=debug_code,
    )


def _sent_message(lang: str) -> str:
    return {
        "uz": "Tasdiqlash kodi telefon raqamingizga yuborildi.",
        "ru": "Код подтверждения отправлен на ваш номер.",
        "en": "A verification code has been sent to your phone.",
    }.get(lang, "Tasdiqlash kodi telefon raqamingizga yuborildi.")


@router.post(
    "/verify-code",
    response_model=TokenResponse,
    summary="Step 2 - confirm the SMS code and create the account",
)
async def verify_code(
    payload: VerifyCodeRequest, db: DbSession, ctx: RequestCtx
) -> TokenResponse:
    if payload.purpose != OtpPurpose.REGISTER:
        # Password-reset codes are consumed by /reset-password, not here.
        from app.core.errors import BadRequest

        raise BadRequest("validation_error")

    user, pair = await auth_service.complete_registration(
        db, phone=payload.phone, code=payload.code
    )
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        user=UserOut.model_validate(user),
    )


@router.post("/resend-code", response_model=RegisterResponse)
async def resend_code(
    payload: ResendCodeRequest, db: DbSession, lang: Lang
) -> RegisterResponse:
    debug_code, resend_after = await auth_service.resend_registration_code(
        db, phone=payload.phone, purpose=payload.purpose, language=lang
    )
    return RegisterResponse(
        message=_sent_message(lang),
        phone=mask_phone(payload.phone),
        resend_after=resend_after,
        expires_in=settings.OTP_TTL_MINUTES * 60,
        debug_code=debug_code,
    )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse, summary="Sign in with phone + password")
async def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    user, pair = await auth_service.login(
        db, phone=payload.phone, password=payload.password
    )
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: DbSession, ctx: RequestCtx) -> TokenResponse:
    from app.models.user import User

    if ctx.ip:
        await enforce("auth_ip", ctx.ip)

    # Resolve the owning user first so the new access token carries the
    # current role and token_version, not whatever the old one claimed.
    row = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == _hash(payload.refresh_token)
            )
        )
    ).scalar_one_or_none()
    if row is None or row.user_id is None:
        raise Unauthorized("refresh_invalid")

    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if user is None or user.deleted_at is not None or not user.is_active:
        raise Unauthorized("refresh_invalid")

    try:
        pair, _ = await rotate_token_pair(
            db,
            raw_refresh=payload.refresh_token,
            subject_type="user",
            role=user.role,
            token_version=user.token_version,
            ip=ctx.ip,
            user_agent=ctx.user_agent,
        )
    except TokenError as exc:
        if exc.code == "refresh_reused":
            await audit_log.record(
                db,
                AuditAction.AUTH_TOKEN_REUSE_DETECTED,
                entity_type="user",
                entity_id=user.id,
                entity_label=f"{user.name} {mask_phone(user.phone)}",
                summary="Refresh token replay detected - all sessions revoked",
            )
        # The family revocation performed while detecting the replay must
        # outlive the error, or the stolen token would keep working.
        await commit_then_raise(db, Unauthorized(exc.code))

    await audit_log.record(
        db,
        AuditAction.AUTH_TOKEN_REFRESHED,
        entity_type="user",
        entity_id=user.id,
        severity="INFO",
    )
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        user=UserOut.model_validate(user),
    )


def _hash(token: str) -> str:
    from app.core.security import hash_token

    return hash_token(token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    payload: LogoutRequest, user: CurrentUser, db: DbSession, lang: Lang
) -> MessageResponse:
    await auth_service.logout(
        db,
        user=user,
        refresh_token=payload.refresh_token,
        all_devices=payload.all_devices,
    )
    return MessageResponse(message=_logout_message(lang))


def _logout_message(lang: str) -> str:
    return {
        "uz": "Tizimdan chiqdingiz.",
        "ru": "Вы вышли из системы.",
        "en": "You have been signed out.",
    }.get(lang, "Tizimdan chiqdingiz.")


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------
@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser) -> MeResponse:
    return MeResponse(user=UserOut.model_validate(user))


@router.patch("/profile", response_model=MeResponse)
async def update_profile(
    payload: UpdateProfileRequest, user: CurrentUser, db: DbSession
) -> MeResponse:
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)

    # Self-service role switching exists so a STUDENT can become an OWNER. It
    # must not touch a role that was granted: a MODERATOR, ADMIN or DEVELOPER
    # who opens the profile page would otherwise be silently demoted to OWNER
    # by a form that has no idea those roles exist, with no way back except a
    # seeding script.
    if "role" in changes and user.role not in {r.value for r in SIGNUP_ROLES}:
        changes.pop("role")

    before = {key: getattr(user, key) for key in changes}

    for key, value in changes.items():
        setattr(user, key, value.value if hasattr(value, "value") else value)
    await db.flush()

    action = AuditAction.USER_PROFILE_UPDATED
    if set(changes) == {"avatar"}:
        action = AuditAction.USER_AVATAR_UPDATED
    elif set(changes) == {"role"}:
        action = AuditAction.USER_ROLE_SWITCHED
    elif set(changes) == {"language"}:
        action = AuditAction.USER_LANGUAGE_CHANGED
    elif set(changes) == {"theme"}:
        action = AuditAction.USER_THEME_CHANGED

    await audit_log.record(
        db,
        action,
        entity_type="user",
        entity_id=user.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        changes=audit_log.diff(before, changes),
    )
    return MeResponse(user=UserOut.model_validate(user))


def _presented_session_id(request: Request) -> uuid.UUID | None:
    """The refresh-token family the caller's access token belongs to.

    Read from the bearer token rather than passed down from the dependency,
    because ``CurrentUser`` resolves to the account and deliberately says
    nothing about which of its devices is asking. Anything unreadable comes
    back as None: a token minted before ``sid`` existed simply has no current
    session to point at, and "we could not tell" must never be an error on a
    read-only listing.
    """
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("bearer "):
        return None
    try:
        return decode_access_token(header[7:].strip()).session_id
    except TokenError:
        return None


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    request: Request, user: CurrentUser, db: DbSession
) -> list[SessionOut]:
    """Active sessions, so a user can see and revoke logins they don't recognise.

    ``expires_at`` is part of the filter, not decoration: a refresh token that
    simply aged out has neither ``revoked_at`` nor ``used_at`` set, so without
    it every login the user ever ended by closing the browser is still listed
    as a live device — with a sign-out button that does nothing anyone needs.
    Nothing deletes those rows, so this predicate is the source of truth.
    """
    rows = (
        await db.execute(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.used_at.is_(None),
                RefreshToken.expires_at > _utcnow(),
            )
            .order_by(RefreshToken.created_at.desc())
            .limit(50)
        )
    ).scalars().all()

    # Compared against family_id, not the row id: refreshing rotates the row
    # but keeps the family, and the family is what the token's `sid` names —
    # so "this device" survives every rotation. None matches nothing, which is
    # the right outcome when the claim could not be read.
    current_session = _presented_session_id(request)

    sessions = []
    for row in rows:
        out = SessionOut.model_validate(row)
        out.current = row.family_id == current_session
        sessions.append(out)
    return sessions


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    lang: Lang,
) -> MessageResponse:
    """Sign one device out, leaving every other session alone.

    Deliberately narrower than ``/logout`` with ``allDevices``: it revokes one
    refresh family and does NOT bump ``token_version``, because that counter is
    global to the account and bumping it would log the user out everywhere —
    the exact opposite of dropping one unrecognised device.

    Somebody else's session id answers 404 rather than 403, so the response
    cannot be used to learn that a given session exists.
    """
    # Keyed on the account rather than the IP, and NOT on the shared "auth_ip"
    # bucket: this is authenticated housekeeping, and charging it to the IP made
    # a user tidying up a long session list spend the login/refresh allowance of
    # every other person behind the same NAT. Still enforced before the
    # ownership check below, or the 404 branch becomes an unlimited probe for
    # other people's session ids.
    await enforce("session_revoke", str(user.id))

    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.id == session_id))
    ).scalar_one_or_none()
    if row is None or row.user_id != user.id:
        raise NotFound("not_found")

    # Revoke by family, not by row id. A device is a family: every refresh
    # rotates its live row and leaves the spent one behind, and `/sessions`
    # only ever lists the live one. If a client posts back an id it read a
    # rotation ago, revoking that single row would mark an already-spent row
    # revoked and answer "signed out" while the device kept working. The
    # family is still the caller's own — it was reached through a row already
    # checked against `user.id`, and a family belongs to exactly one subject.
    await revoke_family(db, row.family_id, reason="user_revoked")
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.AUTH_LOGOUT,
        entity_type="session",
        entity_id=row.id,
        entity_label=f"{user.name} {mask_phone(user.phone)}",
        summary=f"{user.name} revoked one session",
        meta={"reason": "user_revoked", "ip": str(row.ip) if row.ip else None},
    )
    return MessageResponse(message=_session_revoked_message(lang))


def _session_revoked_message(lang: str) -> str:
    return {
        "uz": "Sessiya bekor qilindi.",
        "ru": "Сессия завершена.",
        "en": "That session was signed out.",
    }.get(lang, "Sessiya bekor qilindi.")


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
@router.post("/forgot-password", response_model=RegisterResponse)
async def forgot_password(
    payload: ForgotPasswordRequest, db: DbSession, lang: Lang
) -> RegisterResponse:
    debug_code, resend_after = await auth_service.request_password_reset(
        db, phone=payload.phone, language=lang
    )
    # Identical response whether or not the account exists.
    return RegisterResponse(
        message=_sent_message(lang),
        phone=mask_phone(payload.phone),
        resend_after=resend_after,
        expires_in=settings.OTP_TTL_MINUTES * 60,
        debug_code=debug_code,
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest, db: DbSession, lang: Lang
) -> MessageResponse:
    await auth_service.reset_password(
        db, phone=payload.phone, code=payload.code, new_password=payload.new_password
    )
    return MessageResponse(
        message={
            "uz": "Parol yangilandi. Endi yangi parol bilan kiring.",
            "ru": "Пароль обновлён. Войдите с новым паролем.",
            "en": "Your password has been updated. Sign in with the new one.",
        }.get(lang, "Parol yangilandi.")
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbSession, lang: Lang
) -> MessageResponse:
    await auth_service.change_password(
        db,
        user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return MessageResponse(
        message={
            "uz": "Parol o‘zgartirildi. Boshqa qurilmalardan chiqarildingiz.",
            "ru": "Пароль изменён. Вы вышли на других устройствах.",
            "en": "Password changed. You were signed out on other devices.",
        }.get(lang, "Parol o'zgartirildi.")
    )


@router.post("/password-strength", response_model=PasswordStrengthResponse)
async def check_password_strength(
    payload: PasswordStrengthRequest, lang: Lang
) -> PasswordStrengthResponse:
    """Live feedback for the registration form's strength meter."""
    score = password_strength(payload.password)
    try:
        validate_password(payload.password)
    except PasswordPolicyError as exc:
        return PasswordStrengthResponse(
            score=score,
            acceptable=False,
            code=exc.code,
            message=translate(exc.code, lang, min=settings.PASSWORD_MIN_LENGTH),
        )
    return PasswordStrengthResponse(score=score, acceptable=True)


# ---------------------------------------------------------------------------
# Google / Firebase sign-in
# ---------------------------------------------------------------------------
@router.post("/google", response_model=TokenResponse, summary="Sign in with Google")
async def google_login(
    payload: GoogleAuthRequest, db: DbSession, ctx: RequestCtx
) -> TokenResponse:
    """Exchange a Google/Firebase ID token for our own session.

    The ID token's signature, issuer, audience and expiry are all verified
    against Google's published keys. Nothing the client merely asserts - an
    email address, a display name, a uid - is trusted on its own, which is
    what made the previous implementation a complete authentication bypass.
    """
    from app.core.errors import Forbidden, ServiceUnavailable
    from app.models.enums import UserStatus
    from app.models.user import User
    from app.services.google_auth import verify_id_token

    if ctx.ip:
        await enforce("auth_ip", ctx.ip)
    if not settings.FIREBASE_PROJECT_ID:
        raise ServiceUnavailable("service_unavailable")

    identity = await verify_id_token(
        payload.id_token, firebase_project_id=settings.FIREBASE_PROJECT_ID
    )

    user = (
        await db.execute(select(User).where(User.google_uid == identity.uid))
    ).scalar_one_or_none()

    # Linking to an existing account by email is only safe when Google itself
    # attests that the address is verified. Without that check, anyone able to
    # mint a token for an unverified address could claim someone else's account.
    if user is None and identity.email and identity.email_verified:
        user = (
            await db.execute(select(User).where(User.email == identity.email))
        ).scalar_one_or_none()

    if user is None:
        # A Google account has no phone number, so the row is created without
        # one; the user is asked to add and verify a phone before posting.
        user = User(
            name=identity.name or "Google foydalanuvchisi",
            phone=f"google:{identity.uid}",
            email=identity.email,
            google_uid=identity.uid,
            avatar=identity.picture,
            role=payload.role.value,
            status=UserStatus.ACTIVE.value,
            language=payload.language.value,
            is_verified=identity.email_verified,
            trust_score=55,
        )
        db.add(user)
        await db.flush()
    else:
        if user.deleted_at is not None:
            raise Forbidden("account_banned")
        if user.status == UserStatus.BANNED.value:
            raise Forbidden("account_banned")
        if user.status == UserStatus.SUSPENDED.value:
            raise Forbidden("account_suspended")
        if user.status == UserStatus.REGISTRATION_REQUIRED.value:
            # A legacy account must be reclaimed through phone re-registration,
            # not silently activated by a Google sign-in.
            raise Forbidden("reregistration_required")
        if user.status == UserStatus.PENDING_VERIFICATION.value:
            raise Forbidden("account_not_verified")
        user.google_uid = user.google_uid or identity.uid
        user.email = user.email or identity.email
        user.avatar = user.avatar or identity.picture

    user.last_login_at = _utcnow()
    user.last_login_ip = ctx.ip
    await db.flush()

    ctx.actor_id = user.id
    ctx.actor_type = "USER"
    ctx.actor_label = f"{user.name} (google)"

    pair = await issue_token_pair(
        db,
        subject_id=user.id,
        subject_type="user",
        role=user.role,
        token_version=user.token_version,
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    await audit_log.record(
        db,
        AuditAction.AUTH_GOOGLE_LOGIN,
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
        summary=f"{user.name} signed in with Google",
        meta={"provider": identity.provider, "email_verified": identity.email_verified},
    )
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        user=UserOut.model_validate(user),
    )


# ---------------------------------------------------------------------------
# Identity / property verification requests
# ---------------------------------------------------------------------------
@router.post("/verifications", summary="Submit documents for verification")
async def submit_verification(
    payload: SubmitVerificationRequest, user: CurrentUser, db: DbSession, lang: Lang
) -> dict:
    from app.models.moderation import VerificationRequest

    request = VerificationRequest(
        user_id=user.id,
        target_level=payload.target_level,
        document_type=payload.document_type.value,
        document_url=payload.document_url,
        selfie_url=payload.selfie_url,
    )
    db.add(request)
    await db.flush()
    await audit_log.record(
        db,
        AuditAction.USER_PROFILE_UPDATED,
        entity_type="verification",
        entity_id=request.id,
        entity_label=f"{user.name} -> level {payload.target_level}",
        summary=f"{user.name} submitted {payload.document_type.value} for verification",
    )
    return {
        "status": "success",
        "data": {"id": str(request.id), "status": request.status},
        "message": {
            "uz": "Hujjatlaringiz qabul qilindi. Tekshiruv 24 soat ichida yakunlanadi.",
            "ru": "Документы приняты. Проверка займёт до 24 часов.",
            "en": "Your documents were received. Review takes up to 24 hours.",
        }.get(lang, "Hujjatlaringiz qabul qilindi."),
    }


@router.get("/verifications", summary="My verification requests")
async def my_verifications(user: CurrentUser, db: DbSession) -> dict:
    from app.models.moderation import VerificationRequest

    rows = (
        await db.execute(
            select(VerificationRequest)
            .where(VerificationRequest.user_id == user.id)
            .order_by(VerificationRequest.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return {
        "status": "success",
        "data": [
            {
                "id": str(r.id),
                "targetLevel": r.target_level,
                "documentType": r.document_type,
                "status": r.status,
                "rejectionReason": r.rejection_reason,
                "createdAt": r.created_at.isoformat(),
            }
            for r in rows
        ],
    }
