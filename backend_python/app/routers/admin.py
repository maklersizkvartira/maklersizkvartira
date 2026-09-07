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
from typing import Any

from fastapi import APIRouter, Depends, Header, Query, Request
from pydantic import BaseModel
from sqlalchemy import String, and_, cast, func, or_, select, true, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.core.errors import (
    APIError,
    BadRequest,
    Conflict,
    Forbidden,
    NotFound,
    Unauthorized,
)
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
    decode_access_token,
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
    TopRequestStatus,
    UserStatus,
    VerificationStatus,
)
from app.models.chat import SupportConversation, SupportMessage
from app.models.listing import Favorite, Listing, TopRequest
from app.models.moderation import Report, VerificationRequest
from app.models.user import AdminUser, User
from app.schemas.chat import (
    SupportConversationDetailOut,
    SupportConversationOut,
    SupportMessageCreate,
    SupportMessageOut,
)
from app.schemas.admin import (
    AdminAiReplyCreate,
    AdminAiSessionRow,
    AdminListingFilters,
    AdminListingRow,
    AdminLoginAttemptRow,
    AdminReportRow,
    AdminSetPasswordRequest,
    AdminSmsRow,
    AdminStaffRow,
    AdminTopRequestRow,
    AdminUpdateUserRequest,
    AdminUserFilters,
    AdminUserRow,
    AdminVerificationRow,
    AiSettingsUpdate,
    AuditFilters,
    AuditLogRow,
    CreateAdminRequest,
    FaceDeleteRequest,
    FaceLoginRequest,
    FaceRegisterRequest,
    FaceStatusResponse,
    ResolveReportRequest,
    VerifyCredentialsRequest,
    VerifyCredentialsResponse,
    RevealPasswordResponse,
    ReviewTopRequestRequest,
    ReviewVerificationRequest,
)
from app.schemas.auth import AdminLoginRequest, AdminOut, RefreshRequest, TokenResponse
from app.schemas.common import MessageResponse, PaginationParams, build_page_meta
from app.schemas.listing import ListingFeatureRequest, ListingModerationRequest
from app.services import admin as admin_service
from app.services import ai_settings
from app.services import sms as sms_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ok(data: Any, **extra: Any) -> dict:
    return {"status": "success", "data": data, **extra}


# ---------------------------------------------------------------------------
# Biometric Feature Helpers
# ---------------------------------------------------------------------------
import base64
import io
import json


def _image_bytes_from_data_url(data_url: str) -> bytes:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url.replace(" ", "+"))


def _extract_single_descriptor(face_img) -> list[float]:
    import numpy as np
    from PIL import ImageFilter

    # Mild gaussian blur removes high-frequency webcam sensor noise
    blurred = face_img.filter(ImageFilter.GaussianBlur(radius=0.8))
    gray = np.array(blurred.convert("L"), dtype=np.float32)
    # Lighting and contrast standardization (eliminates dim / bright room variations)
    gray = (gray - np.mean(gray)) / (np.std(gray) + 1e-5)

    gx = np.zeros_like(gray)
    gy = np.zeros_like(gray)
    gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
    gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
    mag = np.sqrt(gx**2 + gy**2)
    angle = np.mod(np.arctan2(gy, gx), np.pi)

    features = []
    # Multi-scale spatial cells: 4x4 (coarse geometry) and 6x6 (fine geometry)
    for num_cells in [4, 6]:
        cell_sz = 128 // num_cells
        bins = 8
        for r in range(num_cells):
            for c in range(num_cells):
                c_mag = mag[r * cell_sz:(r + 1) * cell_sz, c * cell_sz:(c + 1) * cell_sz]
                c_ang = angle[r * cell_sz:(r + 1) * cell_sz, c * cell_sz:(c + 1) * cell_sz]
                bin_idx = np.clip((c_ang / np.pi * bins).astype(int), 0, bins - 1)
                cell_hist = np.zeros(bins, dtype=np.float32)
                for b in range(bins):
                    cell_hist[b] = np.sum(c_mag[bin_idx == b])
                n = np.linalg.norm(cell_hist)
                if n > 1e-5:
                    cell_hist = cell_hist / n
                features.extend(cell_hist.tolist())

    vec = np.array(features, dtype=np.float32)
    vec = vec - np.mean(vec)
    norm = np.linalg.norm(vec)
    if norm > 1e-5:
        vec = vec / norm
    return vec.tolist()


def _compute_face_encoding(image_bytes: bytes) -> list[float] | None:
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        if w < 20 or h < 20:
            return None

        # Center square 1:1 crop
        side = min(w, h)
        crop_box = (
            (w - side) // 2,
            (h - side) // 2,
            (w + side) // 2,
            (h + side) // 2,
        )
        face_img = img.crop(crop_box).resize((128, 128), Image.Resampling.LANCZOS)
        return _extract_single_descriptor(face_img)
    except Exception:
        return None


def _compute_multi_probe_encodings(image_bytes: bytes) -> list[list[float]]:
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        if w < 20 or h < 20:
            return []

        side = min(w, h)
        cx, cy = w // 2, h // 2
        probes = []
        for scale in [0.90, 0.95, 1.0, 1.05]:
            for dx in [-0.03, 0.0, 0.03]:
                for dy in [-0.03, 0.0, 0.03]:
                    half_sz = int(side * scale / 2)
                    center_x = cx + int(side * dx)
                    center_y = cy + int(side * dy)
                    l = max(0, center_x - half_sz)
                    t = max(0, center_y - half_sz)
                    r = min(w, center_x + half_sz)
                    b = min(h, center_y + half_sz)
                    crop_img = img.crop((l, t, r, b)).resize((128, 128), Image.Resampling.LANCZOS)
                    probes.append(_extract_single_descriptor(crop_img))
                    probes.append(_extract_single_descriptor(crop_img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)))
        return probes
    except Exception:
        return []


def _face_similarity(enc_a: list[float] | list[list[float]], enc_b: list[float]) -> float:
    import numpy as np

    b = np.array(enc_b, dtype=np.float64)
    b = b - np.mean(b)

    if enc_a and isinstance(enc_a[0], list):
        best = -1.0
        for cand in enc_a:
            a = np.array(cand, dtype=np.float64)
            min_len = min(len(a), len(b))
            if min_len < 10:
                continue
            a_sub, b_sub = a[:min_len], b[:min_len]
            a_sub = a_sub - np.mean(a_sub)
            norm_a = np.linalg.norm(a_sub)
            norm_b = np.linalg.norm(b_sub)
            if norm_a == 0 or norm_b == 0:
                continue
            sim = float(np.dot(a_sub, b_sub) / (norm_a * norm_b))
            if sim > best:
                best = sim
        return max(0.0, best)
    else:
        a = np.array(enc_a, dtype=np.float64)
        min_len = min(len(a), len(b))
        if min_len < 10:
            return 0.0
        a_sub, b_sub = a[:min_len], b[:min_len]
        a_sub = a_sub - np.mean(a_sub)
        norm_a = np.linalg.norm(a_sub)
        norm_b = np.linalg.norm(b_sub)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a_sub, b_sub) / (norm_a * norm_b))


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


@router.post("/auth/verify-credentials", response_model=VerifyCredentialsResponse, summary="Validate login credentials before biometric check")
async def admin_verify_credentials(
    payload: VerifyCredentialsRequest,
    db: DbSession,
) -> VerifyCredentialsResponse:
    if not payload.username or not payload.password:
        raise BadRequest("credentials_required")

    # The same check `POST /admin/auth/login` makes, and not a second copy of
    # it. This ran its own lookup and its own `verify_password`, which meant it
    # answered the question "is this the administrator's password?" with no
    # rate limit, no lockout, no failed-attempt counter and no audit entry —
    # every guard the real login has, absent from the endpoint next to it. It
    # was the door a brute-force would have used.
    admin = await admin_service.verify_admin_credentials(
        db, username=payload.username, password=payload.password
    )

    return VerifyCredentialsResponse(
        valid=True,
        username=admin.username,
        full_name=admin.full_name,
        has_face=bool(admin.face_encoding),
    )


@router.get("/auth/face-status", response_model=FaceStatusResponse, summary="Whether YOUR Face ID is enrolled")
async def admin_face_status(admin: CurrentAdmin) -> FaceStatusResponse:
    """Does the signed-in administrator have a Face ID on file.

    This used to take no token and answer with the whole staff roster — every
    active administrator's username, full name and role — and, for each of
    them, ``face_image``: the base64 of the reference photo enrolment had
    stored. ``POST /auth/face-login`` then accepted a photo and a username as
    complete proof of identity. The two composed into an unauthenticated
    takeover in two requests: ask who the administrators are and what they look
    like, hand the second endpoint back the picture the first one just gave
    you, and it matches itself and returns a SUPERADMIN token pair. No
    guessing, nothing to rate-limit, and the password lockout next door was
    irrelevant because that path never asks for a password.

    A biometric template is worse to publish than a password hash. A hash has
    to be cracked and the password behind it can be changed afterwards; nobody
    gets a new face.

    So: a token is required, and the answer is about the caller and nobody
    else. No roster, no other accounts, and the stored image is never sent
    anywhere — the only thing that needs it is the comparison, which happens
    here on the server.
    """
    return FaceStatusResponse(
        enrolled=bool(admin.face_encoding),
        count=1 if admin.face_encoding else 0,
        username=admin.username,
        full_name=admin.full_name,
        # Deliberately never populated. It is the credential on the face-login
        # path; there is no caller that needs it back.
        face_image=None,
        admins=[],
    )


@router.post("/auth/face-login", response_model=TokenResponse, summary="Biometric Face ID sign-in")
async def admin_face_login(payload: FaceLoginRequest, db: DbSession, ctx: RequestCtx) -> TokenResponse:
    """Sign in with a password AND a face. Never with a face alone.

    It used to be the face alone, and that made it the softest way into the
    panel by a wide margin: no password, no lockout, no rate limit, no record
    of a failure, and a reference photo any anonymous caller could fetch from
    ``/auth/face-status`` and replay straight back here for a perfect match.

    Even without that leak it could not have carried a login on its own. The
    comparison below is a gradient histogram over a blind centre-square crop
    with no face detection and no liveness check, thresholded at a 0.45 cosine.
    That is a convenience laid on top of an authenticator, not an
    authenticator.

    `verify_admin_credentials` is the authenticator, and going through it
    brings the whole of the password path's protection with it: the per-IP
    limiter, the lockout, the failed-attempt counter that feeds it, and the
    audit line. The face is then checked as a second factor against that one
    account — and a face that does not match still counts as a failed attempt,
    because otherwise this door is free to hammer while the other one locks.
    """
    if not payload.image:
        raise BadRequest("face_image_required")
    if not payload.username:
        raise BadRequest("username_required")

    admin = await admin_service.verify_admin_credentials(
        db, username=payload.username, password=payload.password
    )
    if not admin.face_encoding:
        raise NotFound("face_not_enrolled")

    image_bytes = _image_bytes_from_data_url(payload.image)
    live_probes = _compute_multi_probe_encodings(image_bytes)
    if not live_probes:
        single = _compute_face_encoding(image_bytes)
        if single is None:
            raise BadRequest("face_not_detected")
        live_probes = [single]

    # One account, and it is the one whose password was just verified. There
    # used to be a second lookup here, by username, searching for whichever
    # enrolled admin scored highest — which is a different question from "is
    # this that person", and the answer to it was being trusted on its own.
    best_admin = admin
    best_sim = -1.0
    try:
        stored = json.loads(admin.face_encoding)
        if isinstance(stored, list) and len(stored) == len(live_probes[0]):
            best_sim = _face_similarity(live_probes, stored)
        else:
            raise Unauthorized("face_legacy_format")
    except Unauthorized:
        raise
    except Exception:
        raise Unauthorized("face_legacy_format")

    SIMILARITY_THRESHOLD = 0.45
    if best_sim < SIMILARITY_THRESHOLD:
        # Counted, and committed before the raise. A second factor that is free
        # to retry is not a second factor: without this the password path locks
        # after five misses while this one could be hammered forever, using a
        # password the attacker already has.
        admin.failed_login_count = (admin.failed_login_count or 0) + 1
        if admin.failed_login_count >= settings.MAX_FAILED_LOGINS:
            admin.locked_until = _now() + timedelta(minutes=settings.LOCKOUT_MINUTES)
            admin.failed_login_count = 0
        db.add(
            LoginAttempt(
                username=admin.username,
                admin_id=admin.id,
                successful=False,
                failure_reason="face_mismatch",
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
            entity_id=admin.id,
            entity_label=admin.username,
            meta={"reason": "face_mismatch", "similarity": round(best_sim, 4)},
        )
        await commit_then_raise(db, Unauthorized("face_mismatch"))

    from app.core.tokens import issue_token_pair
    pair = await issue_token_pair(
        db,
        subject_id=best_admin.id,
        subject_type="admin",
        role=best_admin.role,
        token_version=best_admin.token_version,
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    best_admin.last_login_at = _now()
    best_admin.last_login_ip = ctx.ip
    best_admin.failed_login_count = 0
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_LOGIN_SUCCESS,
        entity_type="admin",
        entity_id=best_admin.id,
        entity_label=best_admin.username,
        meta={"method": "face_id", "similarity": round(best_sim, 4)},
    )

    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        admin=AdminOut.model_validate(best_admin),
    )


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    return token or None


@router.post("/auth/face-register", response_model=MessageResponse, summary="Register or update Face ID")
async def admin_face_register(
    payload: FaceRegisterRequest,
    db: DbSession,
    request: Request,
    ctx: RequestCtx,
) -> MessageResponse:
    if not payload.image:
        raise BadRequest("face_image_required")

    target_admin = None
    clean_username = payload.username.strip() if payload.username else ""

    # 1. Check if caller has active admin bearer token
    token = _bearer_token(request)
    if token:
        try:
            claims = decode_access_token(token)
            if claims.subject_type == "admin":
                caller_admin = (
                    await db.execute(
                        select(AdminUser).where(AdminUser.id == claims.subject_id, AdminUser.is_active == True)
                    )
                ).scalar_one_or_none()
                if caller_admin:
                    # Your own account, and only ever your own. A token used to
                    # let the caller name any `username` and enrol their face on
                    # it, with no role check whatsoever — so the lowest
                    # MODERATOR could put their face on the SUPERADMIN account
                    # and, back when a face alone signed you in, walk straight
                    # in as them. It is still not theirs to overwrite: a face is
                    # personal, and replacing somebody else's locks them out of
                    # their own biometric login.
                    #
                    # Enrolling on another account is still possible — it just
                    # takes that account's password, through the branch below,
                    # which is the same bar as signing in as them.
                    if clean_username:
                        named = await admin_service.find_admin_by_username(
                            db, clean_username
                        )
                        if named is not None and named.id != caller_admin.id:
                            raise Forbidden("face_enrol_self_only")
                    target_admin = caller_admin
        except APIError:
            # A deliberate refusal, not a malformed token. `except Exception:
            # pass` swallowed this the first time it was written — the 403
            # above became a fall-through into the password branch and came
            # back as a 401, which is a different answer to a different
            # question. Only a token that cannot be read should be ignored
            # here; a decision made about a token that could be must stand.
            raise
        except Exception:
            # An unreadable, expired or forged token. Not an error in itself:
            # the caller simply has not proved anything, and the branch below
            # asks them for a password instead.
            pass

    # 2. If unauthenticated / no valid token
    if target_admin is None:
        if not clean_username:
            raise BadRequest("username_required")
        if not payload.password:
            raise Unauthorized("credentials_required_for_face_registration")

        # Enrolling a face on somebody else's account is a login in every way
        # that matters — it hands over a second, permanent way in — so it goes
        # through the same guarded check as the login form. It used to do its
        # own lookup and its own `verify_password`, which made it a third
        # unmetered oracle for an administrator's password, and one that said
        # "admin_not_found" for a name that did not exist and something else
        # for one that did.
        target_admin = await admin_service.verify_admin_credentials(
            db, username=clean_username, password=payload.password
        )

    image_bytes = _image_bytes_from_data_url(payload.image)
    encoding = _compute_face_encoding(image_bytes)
    if encoding is None:
        raise BadRequest("face_not_detected")

    target_admin.face_image = payload.image
    target_admin.face_encoding = json.dumps(encoding)
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.ADMIN_USER_UPDATED,
        entity_type="admin",
        entity_id=target_admin.id,
        entity_label=target_admin.username,
        meta={"action": "face_id_enrolled"},
    )

    return MessageResponse(message=f"'{target_admin.full_name}' uchun Face ID muvaffaqiyatli saqlandi!")


@router.post("/auth/face-delete", response_model=MessageResponse, summary="Remove Face ID data")
async def admin_face_delete(
    admin: CurrentAdmin,
    db: DbSession,
    payload: FaceDeleteRequest | None = None,
) -> MessageResponse:
    target_id = admin.id
    if payload and payload.username and admin.role in ("SUPERADMIN", "ADMIN"):
        target_adm = (
            await db.execute(select(AdminUser).where(AdminUser.username == payload.username.strip()))
        ).scalar_one_or_none()
        if target_adm is not None:
            target_id = target_adm.id

    adm = (await db.execute(select(AdminUser).where(AdminUser.id == target_id))).scalar_one_or_none()
    if adm is not None:
        adm.face_image = None
        adm.face_encoding = None
        await db.flush()
        await audit_log.record(
            db,
            AuditAction.ADMIN_USER_UPDATED,
            entity_type="admin",
            entity_id=adm.id,
            entity_label=adm.username,
            meta={"action": "face_id_deleted"},
        )
    return MessageResponse(message="Face ID ma'lumotlari muvaffaqiyatli o'chirildi.")


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
        if exc.code == "refresh_reused":
            await audit_log.record(
                db,
                AuditAction.AUTH_TOKEN_REUSE_DETECTED,
                entity_type="admin",
                entity_id=admin.id,
                entity_label=admin.username,
                summary="Admin refresh token replay detected - all sessions revoked",
            )
        # The family revocation performed while detecting the replay must
        # outlive the error, or the stolen token would keep working: a bare
        # raise is rolled back by get_db together with the very UPDATE that
        # describes the theft.
        await commit_then_raise(db, Unauthorized(exc.code))

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


@router.get("/balances", summary="What the paid services have left")
async def balances(admin: RequireModerator, db: DbSession) -> dict:
    """Credit at the SMS provider, and how much the assistant is being used.

    Kept off /stats deliberately. That endpoint is database counters and
    answers in milliseconds; this one calls the SMS provider over the network,
    so a slow or unreachable provider would otherwise hold up the whole
    dashboard. It is requested separately and its card can fail on its own.

    SMS credit is the number that matters most here: running out stops
    registration dead, and nothing in the product says why — a visitor simply
    never receives a code.
    """
    sms = await sms_service.check_balance()
    return _ok(
        {
            # `None` when the provider could not be reached or no token is
            # configured. The panel shows that as unknown rather than as zero,
            # because zero is a real and alarming value.
            "sms": sms,
            "ai": await admin_service.ai_usage(db),
        }
    )


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
    # ADMIN_SETTINGS_CHANGED, not the ADMIN_UPDATED this used to name: that
    # member does not exist on the enum, so the first superadmin to press the
    # toggle would have got an AttributeError rather than a setting change.
    #
    # The entity is the SETTING, not the admin. Recording the acting admin's
    # id as entity_id put this row in the target's history instead of the
    # setting's — and the actor is already captured from the request context,
    # so it was never missing in the first place.
    await audit_log.record(
        db,
        AuditAction.ADMIN_SETTINGS_CHANGED,
        entity_type="system_settings",
        entity_id="is_monetization_enabled",
        entity_label="is_monetization_enabled",
        summary=f"{admin.full_name} turned {'off' if current else 'on'} monetization",
        changes={"value": {"from": "true" if current else "false", "to": new_val}},
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
                # An aged-out row sets neither revoked_at nor used_at, and
                # nothing deletes it, so without this a moderator sees every
                # long-dead login of this account as a live device.
                RefreshToken.expires_at > _now(),
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
    #
    # The tombstone has to FIT: `phone` is String(20), and the obvious
    # "deleted:{uuid}" is 44 characters, so Postgres raised
    # StringDataRightTruncation, the SQLAlchemyError handler turned it into a
    # 500, and the rollback took the soft delete AND its audit row with it —
    # the delete button simply failed, invisibly, every time.
    #
    # "del:" plus 14 hex digits is 18 characters and still unique in the two
    # ways that matter: no real phone can collide, because every live one is
    # E.164 and starts with "+"; and 14 hex digits of a random UUIDv4 are 56
    # bits, so two tombstones colliding needs on the order of 2^28 deleted
    # accounts before it is even worth thinking about.
    #
    # The digits are taken from the END of the uuid, not the start: hex[12] is
    # the version nibble and is always "4", so a 14-character prefix carries
    # only 52 random bits, while the last 14 characters are random throughout.
    user.deleted_at = _now()
    user.status = UserStatus.BANNED.value
    user.phone = f"del:{user.id.hex[-14:]}"
    # email is String(255) and cleared rather than rewritten, so it has no
    # equivalent problem — but it does share the unique index, which is why it
    # is set to NULL: Postgres treats NULLs as distinct, so any number of
    # deleted accounts can hold it at once and the address is freed for reuse.
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
# Top (promotion) requests
# ===========================================================================
def _top_row(request: TopRequest, listing: Listing) -> AdminTopRequestRow:
    """Build a queue row, filling the joined listing columns by hand.

    The PATCH route joins nothing, so without this the admin table's Listing
    column blanks the moment a request is decided.
    """
    row = AdminTopRequestRow.model_validate(request)
    row.listing_title = listing.title
    row.listing_district = listing.district
    row.listing_price = listing.price
    row.listing_currency = listing.currency
    row.listing_image = listing.images[0] if listing.images else None
    row.listing_is_featured = listing.is_featured
    row.listing_featured_until = listing.featured_until
    return row


@router.get("/top-requests", summary="Listings asking for the Top rail")
async def list_top_requests(
    admin: RequireModerator,
    db: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    pagination: PaginationParams = Depends(),
) -> dict:
    stmt = (
        select(TopRequest, Listing, User)
        .join(Listing, Listing.id == TopRequest.listing_id)
        .join(User, User.id == Listing.owner_id)
    )
    if status_filter:
        stmt = stmt.where(TopRequest.status == status_filter.upper())

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(
                    stmt.with_only_columns(TopRequest.id).subquery()
                )
            )
        ).scalar_one()
        or 0
    )
    # .unique() is required because Listing.owner is lazy="joined".
    rows = (
        await db.execute(
            stmt.order_by(TopRequest.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.page_size)
        )
    ).unique().all()

    data = []
    for request, listing, owner in rows:
        row = _top_row(request, listing)
        row.owner_id = owner.id
        row.owner_name = owner.name
        row.owner_phone = owner.phone
        data.append(row.model_dump(by_alias=True))

    return {
        "status": "success",
        "data": data,
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.patch("/top-requests/{request_id}", summary="Approve or reject a Top request")
async def review_top_request(
    request_id: uuid.UUID,
    payload: ReviewTopRequestRequest,
    admin: RequireModerator,
    db: DbSession,
) -> dict:
    """The only thing that actually promotes a listing.

    Gated at MODERATOR, matching PATCH /admin/listings/{id}/feature, which
    writes the same three columns by hand.
    """
    request = (
        await db.execute(select(TopRequest).where(TopRequest.id == request_id))
    ).unique().scalar_one_or_none()
    if request is None:
        raise NotFound("not_found")
    # A settled request cannot be re-decided: without this, re-submitting an
    # approval grants a second run of promotion for one request. 409 rather
    # than 400 because the body is perfectly valid - it is the row's state
    # that refuses the call, exactly like `top_request_pending` on the owner
    # side. The admin panel branches on the status as well as the code.
    if request.status != TopRequestStatus.PENDING.value:
        raise Conflict("top_request_already_reviewed")
    if payload.status == TopRequestStatus.PENDING:
        raise BadRequest("validation_error")

    listing = await _load_listing(db, request.listing_id)
    before = {
        "status": request.status,
        "is_featured": listing.is_featured,
        "promotion_weight": listing.promotion_weight,
    }

    request.status = payload.status.value
    request.reviewed_by_id = admin.id
    request.reviewed_at = _now()

    if payload.status == TopRequestStatus.APPROVED:
        days = payload.days or request.requested_days
        until = _now() + timedelta(days=days)
        # Extend, never truncate: a listing already promoted keeps the later
        # of the two dates, so a second grant cannot shorten a live run.
        if listing.featured_until and listing.featured_until > until:
            until = listing.featured_until
        listing.is_featured = True
        listing.featured_until = until
        listing.promotion_weight = max(
            listing.promotion_weight, payload.promotion_weight
        )
        request.granted_days = days
        request.granted_weight = listing.promotion_weight
        request.granted_until = until
        request.rejection_reason = None
    else:
        request.rejection_reason = payload.rejection_reason

    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_TOP_APPROVED
        if payload.status == TopRequestStatus.APPROVED
        else AuditAction.ADMIN_TOP_REJECTED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=(
            f"{admin.full_name} "
            f"{'approved' if payload.status == TopRequestStatus.APPROVED else 'rejected'} "
            f"the Top request for '{listing.title}'"
        ),
        changes=audit_log.diff(
            before,
            {
                "status": request.status,
                "is_featured": listing.is_featured,
                "promotion_weight": listing.promotion_weight,
            },
        ),
        meta={
            "request_id": str(request.id),
            "days": request.granted_days,
            "weight": request.granted_weight,
            "reason": request.rejection_reason,
        },
    )

    return _ok(_top_row(request, listing).model_dump(by_alias=True))


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

    # The listing is loaded whichever way this goes, because confirming or
    # un-confirming a complaint is the only thing that moves the public
    # reliability percentage. Loaded defensively: a listing already removed by
    # an earlier DELETE action must not 404 the whole resolution.
    listing = (
        await db.execute(select(Listing).where(Listing.id == report.listing_id))
    ).unique().scalar_one_or_none()

    if listing is not None and payload.listing_action != "NONE":
        if payload.listing_action == "REJECT":
            listing.status = ListingStatus.REJECTED.value
        elif payload.listing_action == "APPROVE":
            listing.status = ListingStatus.APPROVED.value
        elif payload.listing_action == "DELETE":
            listing.deleted_at = _now()
            listing.status = ListingStatus.ARCHIVED.value
        listing.moderated_by_id = admin.id
        listing.moderated_at = _now()

    # RESOLVED means the admin confirmed the complaint, so it costs the
    # listing points; anything else costs nothing and gives back whatever a
    # previous confirmation had taken. Recomputed from every confirmed report
    # after the new status is written, so both directions work and a repeated
    # save cannot charge twice. The listing action is independent: an admin
    # can confirm a complaint without taking the listing down.
    trust: dict[str, int] | None = None
    if listing is not None:
        # The session runs with autoflush off, and the recompute reads the
        # reports table - so this report's new status has to reach the
        # database before it is counted, or the score lags one decision behind.
        await db.flush()
        trust = await admin_service.recompute_trust_score(db, listing=listing)

    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_REPORT_RESOLVED,
        entity_type="report",
        entity_id=report.id,
        entity_label=report.reason,
        summary=f"{admin.full_name} resolved a report as {payload.status.value}",
        changes={"status": {"from": before, "to": report.status}},
        meta={
            "listing_action": payload.listing_action,
            "trust_penalty": (trust["from"] - trust["to"]) if trust else 0,
            "trust_score_after": trust["to"] if trust else None,
        },
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
async def _ai_settings_payload(db: AsyncSession) -> dict[str, Any]:
    """The assistant's configuration as the AI page needs to render it.

    Read with ``force=True`` on purpose. The panel calls this straight after a
    save, and the whole point of the cache in :mod:`app.services.ai_settings`
    is that a worker may be up to half a minute behind — showing the previous
    model on the screen that was just used to change it would read as "the save
    did not work" and get pressed again.
    """
    effective = await ai_settings.load(db, force=True)
    return {
        **effective.as_payload(),
        # A choice, not a free-text box — but see KNOWN_MODELS: any id that
        # passes validation may still be saved, because this list is stale the
        # week after it is written.
        "models": [dict(model) for model in ai_settings.KNOWN_MODELS],
        "limits": {
            "minToolSteps": ai_settings.MIN_TOOL_STEPS,
            "maxToolSteps": ai_settings.MAX_TOOL_STEPS,
            "modelIdMaxLength": ai_settings.MODEL_ID_MAX_LENGTH,
        },
        # What clearing a stored value falls back to, so "reset to default" can
        # say what it will do before it does it. `reasoningModel` is null when
        # no smart tier is deployed at all, which means it mirrors the everyday
        # model — the same thing `sources.reasoningModel: "inherited"` says.
        "defaults": {
            "chatModel": settings.OPENAI_MODEL,
            "reasoningModel": settings.OPENAI_MODEL_SMART or None,
            "maxToolSteps": settings.AI_MAX_TOOL_STEPS,
        },
        # Whether there is an API key at all. Without one the assistant falls
        # back to templated replies and no model choice on this page changes
        # anything, which the page has to be able to say. The key itself is
        # never sent — only whether it exists.
        "assistantEnabled": bool(settings.OPENAI_API_KEY),
    }


@router.get("/ai/settings", summary="How the assistant is configured")
async def ai_settings_read(admin: RequireAdmin, db: DbSession) -> dict:
    """The models and tool budget in force, and where each value came from.

    ADMIN may look; only SUPERADMIN can change it below, because a model id is
    a platform-wide setting that spends money on every visitor's turn.
    """
    return _ok(await _ai_settings_payload(db))


@router.patch("/ai/settings", summary="Change the assistant's models or tool budget")
async def ai_settings_update(
    payload: AiSettingsUpdate, admin: RequireSuperadmin, db: DbSession
) -> dict:
    """Store a model choice so it survives a restart and needs no deploy.

    Only the fields actually present in the request body are touched. A field
    sent as ``null`` deletes its row, which hands the setting back to the
    environment variable rather than freezing today's default into the
    database — the difference ``model_fields_set`` is read for.
    """
    sent = payload.model_fields_set
    values: dict[str, str | None] = {}
    if "chat_model" in sent:
        values[ai_settings.KEY_CHAT_MODEL] = payload.chat_model
    if "reasoning_model" in sent:
        values[ai_settings.KEY_REASONING_MODEL] = payload.reasoning_model
    if "max_tool_steps" in sent:
        values[ai_settings.KEY_MAX_TOOL_STEPS] = (
            None if payload.max_tool_steps is None else str(payload.max_tool_steps)
        )
    if not values:
        raise BadRequest("ai_settings_empty")

    changes = await ai_settings.store(db, values)

    # One row per setting that moved, not one row for the request. The entity
    # is the SETTING — the same rule toggle_monetization follows — so each
    # key's history is its own, and "who changed the model, and from what" is
    # answerable by filtering the audit feed on that one entity id.
    for key, change in changes.items():
        before = change["from"] or "(deploy default)"
        after = change["to"] or "(deploy default)"
        await audit_log.record(
            db,
            AuditAction.ADMIN_SETTINGS_CHANGED,
            entity_type="system_settings",
            entity_id=key,
            entity_label=key,
            summary=f"{admin.full_name} changed {key} from {before} to {after}",
            changes={"value": change},
        )

    payload = await _ai_settings_payload(db)
    # Built, then forgotten again.
    #
    # `_ai_settings_payload` reads with `force=True`, which writes what it read
    # into the module-level cache the assistant runs on — and at this point the
    # rows are flushed but NOT committed. If the commit `get_db` is about to
    # attempt fails, the database rolls back to the old model while the process
    # keeps serving real visitor turns on the new one for the whole cache TTL.
    # The response is unaffected: it is already built from the values above.
    ai_settings.invalidate()

    return _ok(
        {
            **payload,
            # Which keys actually moved. An empty list means the request asked
            # for what was already stored, which is a successful no-op and not
            # a failure — the panel should not claim a change it did not make.
            "changed": sorted(changes),
        }
    )


# Visitor turns the operator has not seen yet. A correlated aggregate for the
# reason admin_list_support_conversations spells out at length: every open
# chat desk re-reads the list every few seconds, so nothing in it may grow
# with the transcript. `to_timestamp(0)` rather than an OR against NULL,
# because `created_at > NULL` is NULL and counts as false - a conversation
# nobody has opened yet would badge as zero unread, and that is precisely the
# thread an operator most needs to see.
_AI_UNREAD_COUNT = (
    select(func.count())
    .select_from(AIMessage)
    .where(
        AIMessage.session_id == AISession.id,
        AIMessage.role == "user",
        AIMessage.created_at
        > func.coalesce(AISession.admin_read_at, func.to_timestamp(0)),
    )
    .scalar_subquery()
)
# When this conversation last moved. The desk sorts on it, and `created_at`
# cannot stand in: a thread opened yesterday and answered a minute ago is at
# the bottom of the queue by one and at the top by the other.
_AI_LAST_MESSAGE_AT = (
    select(func.max(AIMessage.created_at))
    .where(AIMessage.session_id == AISession.id)
    .scalar_subquery()
)


def _ai_sessions_select():
    """The conversation list query, shared so one row reads back like the page.

    Takeover, release and an operator's own reply each answer with a single
    conversation in exactly the list's shape, and the panel merges that answer
    straight into the list it already holds. Two hand-built copies of these
    joins is how the merged row starts differing from the polled one.
    """
    return (
        select(
            AISession,
            User.name,
            AdminUser.full_name,
            _AI_UNREAD_COUNT.label("unread_count"),
            _AI_LAST_MESSAGE_AT.label("last_message_at"),
        )
        .outerjoin(User, User.id == AISession.user_id)
        .outerjoin(AdminUser, AdminUser.id == AISession.taken_over_by)
    )


def _ai_session_payload(
    session: AISession,
    user_name: str | None,
    operator_name: str | None,
    unread: int | None,
    last_message_at: datetime | None,
) -> dict:
    """One row of `_ai_sessions_select` as the panel receives it.

    Every column `AdminAiSessionRow` declares rides along on `model_validate`
    - `lead_delivered` among them, which is what lets the desk badge a lead
    Telegram refused instead of leaving it looking exactly like one the team
    was actually paged about. Only the four values that come from the joins
    and the aggregates are filled in by hand, because they belong to no
    column of `ai_sessions`.
    """
    row = AdminAiSessionRow.model_validate(session)
    row.user_name = user_name
    row.taken_over_by_name = operator_name
    row.unread_count = int(unread or 0)
    row.last_message_at = last_message_at
    return row.model_dump(by_alias=True)


def _ai_message_payload(msg: AIMessage) -> dict:
    """The four keys every reader of an AI transcript depends on.

    `role` is passed through verbatim and is now one of user, assistant or
    admin. There is deliberately no per-message author name: the session's
    `takenOverByName` answers "who", and a thread released and retaken by a
    second operator is the rare case the label "Operator" already covers.
    """
    return {
        "id": str(msg.id),
        "role": msg.role,
        "content": msg.content,
        "createdAt": msg.created_at.isoformat(),
        "listingIds": (msg.listing_ids or {}).get("ids", []),
    }


async def _ai_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> AISession:
    session = (
        await db.execute(select(AISession).where(AISession.id == session_id))
    ).scalar_one_or_none()
    if session is None:
        raise NotFound("ai_session_not_found")
    return session


async def _ai_session_response(db: AsyncSession, session_id: uuid.UUID) -> dict:
    """Re-read one conversation after a write, in the list's own shape."""
    row = (
        await db.execute(_ai_sessions_select().where(AISession.id == session_id))
    ).first()
    if row is None:
        raise NotFound("ai_session_not_found")
    return _ai_session_payload(*row)


@router.get("/ai/sessions")
async def ai_sessions(
    admin: RequireModerator,
    db: DbSession,
    taken_over: bool | None = None,
    has_lead: bool | None = None,
    pagination: PaginationParams = Depends(),
) -> dict:
    """The live chat desk's queue: every AI conversation, newest first.

    `taken_over` and `has_lead` are bare route parameters, so they arrive
    snake_case - `?taken_over=true` - while `page` and `pageSize` come through
    the `Depends()` model and stay camelCase. Getting that split wrong fails
    silently: FastAPI ignores a query key it does not know and answers 200
    with the whole unfiltered queue, which reads as "the filter found
    everything" rather than as "the filter was never applied".
    """
    stmt = _ai_sessions_select()
    if taken_over is not None:
        stmt = stmt.where(
            AISession.taken_over_by.isnot(None)
            if taken_over
            else AISession.taken_over_by.is_(None)
        )
    if has_lead is not None:
        stmt = stmt.where(
            AISession.lead_phone.isnot(None)
            if has_lead
            else AISession.lead_phone.is_(None)
        )

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

    return {
        "status": "success",
        "data": [_ai_session_payload(*row) for row in rows],
        "meta": build_page_meta(
            pagination.page, pagination.page_size, total
        ).model_dump(by_alias=True),
    }


@router.get("/ai/sessions/{session_id}/messages")
async def ai_session_messages(
    session_id: uuid.UUID,
    admin: RequireModerator,
    db: DbSession,
    limit: int | None = Query(default=None, ge=1, le=500),
    mark_read: bool = False,
) -> dict:
    """The transcript, oldest first; marking it read is opt-in.

    `limit` is opt-in and never defaulted, for the reason
    admin_get_support_messages spells out: the desk polls this every few
    seconds and reconciles by id, so a silent window would make every message
    older than that window look to the merge like a message the server had
    dropped. When it is asked for it keeps the tail, which is the half an
    operator is actually reading.

    Reading a thread is what clears its unread badge - the same mark
    `_AI_UNREAD_COUNT` counts past - so the write happens here rather than on
    a separate endpoint the panel would have to remember to call. `now()` is
    the database's clock on purpose: it is the clock `created_at` is stamped
    from, and comparing the two against each other across two machines is how
    a freshly read thread comes back still showing unread messages.

    H-FIX-6: that write is `mark_read`, a bare snake_case route parameter for
    the reason `ai_sessions` above spells out - `?mark_read=true` - and it
    defaults to off because two screens share this URL. The live desk on
    `/chat` opens a thread in order to answer it, so it asks for the mark. The
    read-only auditing sheet on `/ai` opens a transcript in order to look at
    it, and it must not: a colleague auditing a conversation used to zero the
    very badge the desk picks its next thread by, while the visitor's
    questions sat unanswered. Defaulting to off also stops the desk's
    three-second thread poll from issuing an UPDATE and a COMMIT on
    `ai_sessions` twenty times a minute per open operator.
    """
    if mark_read:
        await db.execute(
            update(AISession)
            .where(AISession.id == session_id)
            .values(admin_read_at=func.now())
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    # Ordered by ``seq``, the identity column, and not by ``created_at``.
    # ``created_at`` is Postgres ``now()``, the transaction timestamp, so a
    # visitor's turn and the answer to it — written by one request inside one
    # transaction — carry identical values and sort in heap order. In the
    # ``limit`` branch that was actively wrong: the reverse below flipped each
    # tied pair, and the operator read the assistant answering before it was
    # asked. ``seq`` is assigned at INSERT, so it is a real total order.
    stmt = select(AIMessage).where(AIMessage.session_id == session_id)
    if limit:
        # Newest first so the cap keeps the tail, then reversed back into the
        # order the panel renders.
        rows = list(
            (await db.execute(stmt.order_by(AIMessage.seq.desc()).limit(limit)))
            .scalars()
            .all()
        )
        rows.reverse()
    else:
        rows = list(
            (await db.execute(stmt.order_by(AIMessage.seq.asc()).limit(200)))
            .scalars()
            .all()
        )
    return _ok([_ai_message_payload(m) for m in rows])


@router.post(
    "/ai/sessions/{session_id}/takeover", summary="Answer this visitor yourself"
)
async def ai_session_takeover(
    session_id: uuid.UUID, db: DbSession, admin: RequireModerator
) -> dict:
    """Stop the model and put this operator into the conversation.

    `taken_over_by` is the whole switch. routers/ai.py reads it on the
    visitor's very next turn and returns without calling the agent at all, so
    the visitor is never answered by a person and a machine at the same time.

    Re-taking a thread you already hold is a no-op that answers 200, not a
    409: the desk sends this whenever it opens a thread it believes it owns,
    and a reload should not be told it lost a conversation it never lost.

    H-FIX-7: the guarantee above is made by one conditional UPDATE, not by a
    SELECT, a test and then a write. Two moderators tapping "take over" on the
    same hot thread within a few milliseconds both used to read
    `taken_over_by` as NULL, both pass the check and both write - last writer
    won, both clients rendered an enabled composer, and the loser's next reply
    came back 409 telling them to take over a thread they had just been told
    they held. Now the row itself decides, and "no row matched" is the losing
    tap.
    """
    result = await db.execute(
        update(AISession)
        .where(
            AISession.id == session_id,
            or_(
                AISession.taken_over_by.is_(None),
                AISession.taken_over_by == admin.id,
            ),
        )
        .values(
            taken_over_by=admin.id,
            taken_over_at=func.now(),
            # Opening a thread in order to answer it is reading it.
            admin_read_at=func.now(),
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        # Nothing matched for one of two reasons, and they are different
        # answers to the operator: the conversation is gone, or a colleague
        # got there first. `_ai_session_or_404` raises the 404 half.
        await _ai_session_or_404(db, session_id)
        raise Conflict("ai_session_already_taken")

    await audit_log.record(
        db,
        AuditAction.ADMIN_AI_TAKEOVER,
        entity_type="ai_session",
        entity_id=session_id,
    )
    await db.commit()
    return _ok(await _ai_session_response(db, session_id))


@router.post(
    "/ai/sessions/{session_id}/release", summary="Hand the conversation back to the AI"
)
async def ai_session_release(
    session_id: uuid.UUID, db: DbSession, admin: RequireModerator
) -> dict:
    """Give the thread back to the model.

    Any moderator may release, including one who did not take it. Desks hand
    off and shifts end, and a conversation held by an operator who has gone
    home would otherwise answer nobody at all until somebody edited the row.

    `taken_over_at` is deliberately left where it is. Cleared, the history
    would say the thread had never been touched by a person; kept, a closed
    conversation still shows when a human was on it.
    """
    session = await _ai_session_or_404(db, session_id)
    session.taken_over_by = None
    await audit_log.record(
        db,
        AuditAction.ADMIN_AI_RELEASED,
        entity_type="ai_session",
        entity_id=session.id,
    )
    await db.commit()
    return _ok(await _ai_session_response(db, session_id))


@router.post(
    "/ai/sessions/{session_id}/messages", summary="Reply to the visitor yourself"
)
async def ai_session_reply(
    session_id: uuid.UUID,
    payload: AdminAiReplyCreate,
    db: DbSession,
    admin: RequireModerator,
) -> dict:
    """Write one operator turn into a taken-over conversation.

    Takeover is a precondition rather than a convenience, and refusing here
    with a 409 is what makes the panel's disabled composer honest: the button
    being greyed out is a courtesy to one tab, this is the rule for all of
    them.

    `role` is the lowercase string "admin" on purpose. `_used_today` in
    routers/ai.py and the counters in services/admin.py both filter on
    `role == "user"` literally, so an operator's turn stored as "user" would
    silently burn the visitor's own daily quota; stored as "assistant" it
    would be replayed to the model as something the model itself had said.

    H-FIX-7: the precondition is the WHERE clause of the same statement that
    counts the turn, for the reason the takeover route above gives. Tested on
    its own it is only true at the instant it is read - a release or a rival
    takeover landing between that SELECT and this INSERT would file one
    operator's words into a conversation somebody else is holding.
    """
    content = payload.content.strip()
    held = await db.execute(
        update(AISession)
        .where(AISession.id == session_id, AISession.taken_over_by == admin.id)
        .values(
            message_count=AISession.message_count + 1,
            # The operator is looking at the thread they just answered.
            admin_read_at=func.now(),
        )
        .execution_options(synchronize_session=False)
    )
    if held.rowcount == 0:
        # Three outcomes the operator has to be able to tell apart: the
        # thread is gone, nobody holds it, or somebody else does.
        session = await _ai_session_or_404(db, session_id)
        raise Conflict(
            "ai_session_not_taken"
            if session.taken_over_by is None
            else "ai_session_taken_by_other"
        )

    msg = AIMessage(session_id=session_id, role="admin", content=content)
    db.add(msg)
    await db.flush()
    await audit_log.record(
        db,
        AuditAction.ADMIN_AI_REPLIED,
        entity_type="ai_session",
        entity_id=session_id,
        summary=content[:200],
    )
    await db.commit()
    await db.refresh(msg)
    return _ok(_ai_message_payload(msg))


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


@router.get("/sms/overview", summary="SMS credit and delivery health")
async def sms_overview(admin: RequireAdmin, db: DbSession) -> dict:
    """Everything the SMS page needs except the log itself.

    The log is ``GET /admin/sms``, which is paginated and already exists;
    folding it in here would make the one request that has to cross the network
    to DevSMS carry a page of rows as well.

    ``provider`` is null when the token is unset or the provider could not be
    reached. The panel shows that as unknown rather than as zero: running out
    of credit stops registration, code sign-in and password reset dead with
    nothing in the product to say why, so a false zero and a false balance are
    dangerous in opposite directions.
    """
    provider = await sms_service.check_balance()
    return _ok(
        {
            "provider": provider,
            # Our own threshold, sent rather than duplicated in the panel, so
            # "low" means the same thing on the screen as it does in the log
            # line that warns about it.
            "lowBalanceWarnSum": sms_service.LOW_BALANCE_WARN_SUM,
            # The company name screened on every OTP send. Twenty consecutive
            # refusals suspend sending for a day, so which name is in force is
            # part of the SMS page's diagnosis, not a detail.
            "senderName": settings.DEVSMS_SERVICE_NAME,
            "smsEnabled": settings.SMS_ENABLED,
            "counters": await admin_service.sms_overview(db),
        }
    )


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


# ---------------------------------------------------------------------------
# Customer Support / Mijozlar bilan ishlash
# ---------------------------------------------------------------------------


@router.get("/support/conversations")
async def admin_list_support_conversations(
    db: DbSession,
    admin: RequireModerator,
    status: str | None = None,
    search: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
) -> dict:
    """List customer support threads for the admin panel.

    Every open operator tab re-reads this every few seconds, so nothing in it
    may grow with the support history. It used to eager-load every message of
    every conversation and then count and slice them in Python: one poll
    dragged the whole `support_messages` table into the process to produce one
    integer and one 160-character snippet per thread, and the cost of that grew
    with every message ever sent while the response stayed small enough that
    nothing looked wrong. Both values are aggregates now.

    `search` moved into the WHERE for the same reason. Filtered in Python after
    the load, it would have been applied *after* the cap below, so an operator
    would page over unfiltered threads and be told "no such customer" about a
    customer who is simply further down the queue.
    """
    unread_count = (
        select(func.count())
        .select_from(SupportMessage)
        .where(
            SupportMessage.conversation_id == SupportConversation.id,
            SupportMessage.sender_type == "USER",
            SupportMessage.read_at.is_(None),
        )
        .scalar_subquery()
    )
    # The snippet needs the row itself rather than an aggregate, so it comes
    # from a lateral that stops at the newest message. `created_at DESC` is the
    # relationship's own `order_by` read backwards (models/chat.py), so this is
    # still the message the eager load used to end on.
    newest = (
        select(
            SupportMessage.text.label("text"),
            SupportMessage.created_at.label("created_at"),
            SupportMessage.sender_type.label("sender_type"),
        )
        .where(SupportMessage.conversation_id == SupportConversation.id)
        .order_by(SupportMessage.created_at.desc())
        .limit(1)
        .lateral("newest_message")
    )

    stmt = (
        select(
            SupportConversation,
            unread_count.label("unread_count"),
            newest.c.text,
            newest.c.created_at,
            newest.c.sender_type,
        )
        .select_from(SupportConversation)
        .outerjoin(newest, true())
        .options(selectinload(SupportConversation.user))
        .order_by(SupportConversation.updated_at.desc())
    )
    if status and status.upper() in ("OPEN", "RESOLVED"):
        stmt = stmt.where(SupportConversation.status == status.upper())
    if search:
        pattern = f"%{search.strip()}%"
        # An inner join, deliberately: the Python filter this replaces compared
        # the query against "" for a thread whose user row was gone, which
        # never matched either.
        stmt = stmt.join(User, User.id == SupportConversation.user_id).where(
            or_(User.name.ilike(pattern), User.phone.ilike(pattern))
        )

    # Last, after the filters, and opt-in like the thread endpoint's. The panel
    # renders this as one bare array with no paging control and sends neither
    # `limit` nor `search`, so a default ceiling would quietly hide the oldest
    # threads from the only view of the queue there is — with nothing on screen
    # to say a queue of 240 was being shown as 200. It becomes a ceiling the day
    # the panel grows a control that can ask for the rest.
    if limit:
        stmt = stmt.limit(limit)

    out: list[SupportConversationOut] = []
    for conv, unread, last_text, last_at, last_sender in (
        await db.execute(stmt)
    ).all():
        item = SupportConversationOut.model_validate(conv)
        item.unread_count = int(unread or 0)
        if last_text is not None:
            item.last_message = last_text[:160]
            item.last_message_at = last_at
            item.last_message_sender = last_sender
        out.append(item)
    return _ok([item.model_dump(mode="json") for item in out])


@router.get("/support/conversations/{user_id}/messages")
async def admin_get_support_messages(
    user_id: uuid.UUID,
    db: DbSession,
    admin: RequireModerator,
    limit: int | None = Query(default=None, ge=1, le=500),
) -> dict:
    """Get the support conversation thread and mark user messages as read.

    The open thread is re-read every couple of seconds while the operator has
    it on screen, so a caller that only needs the tail can ask for the newest
    `limit` messages instead of the whole history — a thread running for months
    would otherwise be re-serialised in full on every single pass.

    Opt-in, and that matters: the panel sends no `limit` today, and its poll
    reconciles by comparing the ids it already holds against the ids that come
    back. A default cap would have silently handed it a window of the thread,
    so every message older than the window would look to that merge like a
    message the server had dropped. The cap becomes the default the day the
    panel asks for a window and knows what to do with one.
    """
    stmt = (
        select(SupportConversation)
        .options(selectinload(SupportConversation.user))
        .where(SupportConversation.user_id == user_id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise NotFound("conversation_not_found")

    # Mark user messages as read. One UPDATE where a Python loop used to walk
    # the entire loaded thread and commit a write on every poll that found an
    # unread message; `read_at = created_at` is the value that loop wrote, kept
    # so the marks keep meaning the same thing. It runs before the SELECT below
    # so the rows that come back already carry the new marks.
    marked = await db.execute(
        update(SupportMessage)
        .where(
            SupportMessage.conversation_id == conv.id,
            SupportMessage.sender_type == "USER",
            SupportMessage.read_at.is_(None),
        )
        .values(read_at=SupportMessage.created_at)
        .execution_options(synchronize_session=False)
    )
    if marked.rowcount:
        await db.commit()

    # Newest first, so the cap keeps the tail of the thread, then reversed back
    # into the order the panel renders.
    messages = list(
        (
            await db.execute(
                (
                    select(SupportMessage)
                    .where(SupportMessage.conversation_id == conv.id)
                    .order_by(SupportMessage.created_at.desc())
                ).limit(limit)
                if limit
                else (
                    select(SupportMessage)
                    .where(SupportMessage.conversation_id == conv.id)
                    .order_by(SupportMessage.created_at.desc())
                )
            )
        )
        .scalars()
        .all()
    )
    messages.reverse()

    # Built from the list schema and then handed its messages: validating the
    # detail schema straight off the ORM row would read `conv.messages`, and
    # that relationship is no longer loaded — an implicit lazy load inside an
    # async request raises instead of quietly emitting the query.
    out = SupportConversationDetailOut(
        **SupportConversationOut.model_validate(conv).model_dump(),
        messages=[SupportMessageOut.model_validate(msg) for msg in messages],
    )
    if messages:
        last = messages[-1]
        out.last_message = last.text[:160]
        out.last_message_at = last.created_at
        out.last_message_sender = last.sender_type
    out.unread_count = 0
    return _ok(out.model_dump(mode="json"))


@router.post("/support/conversations/{user_id}/messages")
async def admin_send_support_reply(
    user_id: uuid.UUID,
    payload: SupportMessageCreate,
    db: DbSession,
    admin: RequireModerator,
) -> dict:
    """Send an admin reply to a customer."""
    stmt = select(SupportConversation).where(SupportConversation.user_id == user_id)
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        conv = SupportConversation(user_id=user_id, status="OPEN")
        db.add(conv)
        await db.flush()

    msg = SupportMessage(
        conversation_id=conv.id,
        sender_type="ADMIN",
        sender_id=admin.id,
        text=payload.text.strip(),
    )
    db.add(msg)
    await db.flush()

    conv.updated_at = msg.created_at
    await db.commit()
    await db.refresh(msg)
    return _ok(SupportMessageOut.model_validate(msg).model_dump(mode="json"))


class SupportStatusUpdate(BaseModel):
    status: str | None = None


@router.patch("/support/conversations/{user_id}/status")
async def admin_update_support_status(
    user_id: uuid.UUID,
    db: DbSession,
    admin: RequireModerator,
    payload: SupportStatusUpdate | None = None,
    status: str | None = Query(default=None),
) -> dict:
    """Update support conversation status (OPEN or RESOLVED)."""
    stmt = (
        select(SupportConversation)
        .options(selectinload(SupportConversation.user))
        .where(SupportConversation.user_id == user_id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise NotFound("conversation_not_found")

    req_status = None
    if payload and payload.status:
        req_status = payload.status.upper()
    elif status:
        req_status = status.upper()

    if req_status in ("OPEN", "RESOLVED"):
        conv.status = req_status
    else:
        conv.status = "RESOLVED" if conv.status == "OPEN" else "OPEN"

    await db.commit()
    await db.refresh(conv)

    out = SupportConversationOut.model_validate(conv)
    return _ok(out.model_dump(mode="json"))

