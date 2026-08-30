"""Admin panel schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import Field

from app.models.enums import (
    AdminRole,
    Language,
    ListingStatus,
    ReportStatus,
    UserRole,
    UserStatus,
    VerificationStatus,
)
from app.schemas.common import CamelModel, IPStr, ORMCamelModel


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class AdminUserRow(ORMCamelModel):
    id: uuid.UUID
    name: str
    phone: str
    email: str | None = None
    avatar: str | None = None
    role: str
    status: str
    auth_type: str = "phone"
    trust_score: int
    verification_level: int
    is_verified: bool
    language: str
    theme: str
    xp_points: int
    listings_count: int = 0
    approved_listings: int = 0
    favorites_count: int = 0
    #: Whether a password exists at all - never the password itself.
    has_password: bool = False
    #: Whether an admin could reveal it (reveal is a separate, audited call).
    password_revealable: bool = False
    password_updated_at: datetime | None = None
    must_change_password: bool = False
    failed_login_count: int = 0
    locked_until: datetime | None = None
    last_login_at: datetime | None = None
    last_login_ip: IPStr = None
    phone_verified_at: datetime | None = None
    suspended_reason: str | None = None
    admin_note: str | None = None
    created_at: datetime
    updated_at: datetime


class RevealPasswordResponse(CamelModel):
    status: str = "success"
    user_id: uuid.UUID
    password: str
    #: Every reveal is written to the audit log; this echoes that entry's id.
    audit_id: uuid.UUID
    warning: str


class AdminUpdateUserRequest(CamelModel):
    name: Annotated[str, Field(min_length=2, max_length=120)] | None = None
    role: UserRole | None = None
    status: UserStatus | None = None
    trust_score: int | None = Field(default=None, ge=0, le=100)
    verification_level: int | None = Field(default=None, ge=1, le=5)
    is_verified: bool | None = None
    language: Language | None = None
    admin_note: str | None = Field(default=None, max_length=2000)
    suspended_reason: str | None = Field(default=None, max_length=500)


class AdminSetPasswordRequest(CamelModel):
    new_password: Annotated[str, Field(min_length=8, max_length=128)]
    must_change: bool = True
    revoke_sessions: bool = True


class AdminUserFilters(CamelModel):
    search: str | None = Field(default=None, max_length=120)
    role: UserRole | None = None
    status: UserStatus | None = None
    has_listings: bool | None = None
    sort_by: Literal["NEWEST", "OLDEST", "NAME", "TRUST", "LAST_LOGIN"] = "NEWEST"


# ---------------------------------------------------------------------------
# Listings
# ---------------------------------------------------------------------------
class AdminListingRow(ORMCamelModel):
    id: uuid.UUID
    title: str
    description: str
    price: float
    currency: str
    rooms: int
    area: float | None = None
    region: str | None = None
    district: str | None = None
    address: str | None = None
    images: list[str]
    status: str
    trust_score: int
    risk_score: int
    ai_risk_reasons: list[str]
    safety_badges: list[str]
    is_featured: bool
    featured_until: datetime | None = None
    promotion_weight: int
    views_count: int
    favorites_count: int
    contact_count: int
    moderation_note: str | None = None
    moderated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    owner_id: uuid.UUID
    owner_name: str | None = None
    owner_phone: str | None = None
    owner_role: str | None = None
    owner_trust_score: int | None = None
    report_count: int = 0


class AdminListingFilters(CamelModel):
    search: str | None = Field(default=None, max_length=120)
    status: ListingStatus | None = None
    district: str | None = Field(default=None, max_length=80)
    is_featured: bool | None = None
    min_risk_score: int | None = Field(default=None, ge=0, le=100)
    sort_by: Literal["NEWEST", "OLDEST", "RISK", "VIEWS", "PRICE_HIGH", "PRICE_LOW"] = "NEWEST"


# ---------------------------------------------------------------------------
# Audit log - the "all activity" feed
# ---------------------------------------------------------------------------
class AuditLogRow(ORMCamelModel):
    id: uuid.UUID
    created_at: datetime
    actor_type: str
    actor_id: uuid.UUID | None = None
    actor_label: str | None = None
    action: str
    severity: str
    entity_type: str | None = None
    entity_id: str | None = None
    entity_label: str | None = None
    summary: str | None = None
    changes: dict[str, Any] | None = None
    meta: dict[str, Any] | None = None
    ip: IPStr = None
    user_agent: str | None = None
    request_id: str | None = None
    method: str | None = None
    path: str | None = None
    status_code: int | None = None


class AuditFilters(CamelModel):
    search: str | None = Field(default=None, max_length=120)
    action: str | None = Field(default=None, max_length=48)
    action_group: str | None = Field(default=None, max_length=24)
    actor_type: str | None = Field(default=None, max_length=16)
    actor_id: uuid.UUID | None = None
    entity_type: str | None = Field(default=None, max_length=32)
    entity_id: str | None = Field(default=None, max_length=64)
    severity: str | None = Field(default=None, max_length=10)
    ip: str | None = Field(default=None, max_length=64)
    date_from: datetime | None = None
    date_to: datetime | None = None


# ---------------------------------------------------------------------------
# Reports / verifications
# ---------------------------------------------------------------------------
class AdminReportRow(ORMCamelModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    listing_title: str | None = None
    reporter_label: str | None = None
    reason: str
    description: str
    status: str
    priority: str
    ai_risk_score: int
    resolution_note: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime


class ResolveReportRequest(CamelModel):
    status: ReportStatus
    note: str | None = Field(default=None, max_length=1000)
    #: Optionally act on the listing in the same step.
    listing_action: Literal["NONE", "REJECT", "DELETE", "APPROVE"] = "NONE"


class AdminVerificationRow(ORMCamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    user_phone: str | None = None
    target_level: int
    document_type: str
    document_url: str | None = None
    selfie_url: str | None = None
    status: str
    rejection_reason: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class ReviewVerificationRequest(CamelModel):
    status: VerificationStatus
    rejection_reason: str | None = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# AI / SMS / security
# ---------------------------------------------------------------------------
class AdminAiSessionRow(ORMCamelModel):
    id: uuid.UUID
    session_key: str
    user_id: uuid.UUID | None = None
    user_name: str | None = None
    guest_label: str | None = None
    language: str
    message_count: int
    summary: str | None = None
    last_intent: dict[str, Any] | None = None
    closed_at: datetime | None = None
    ip: IPStr = None
    created_at: datetime


class AdminSmsRow(ORMCamelModel):
    id: uuid.UUID
    phone: str
    purpose: str
    provider: str
    status: str
    template: str | None = None
    error: str | None = None
    parts: int
    created_at: datetime


class AdminLoginAttemptRow(ORMCamelModel):
    id: uuid.UUID
    phone: str | None = None
    username: str | None = None
    successful: bool
    failure_reason: str | None = None
    is_admin_portal: bool
    ip: IPStr = None
    user_agent: str | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Staff accounts
# ---------------------------------------------------------------------------
class CreateAdminRequest(CamelModel):
    username: Annotated[str, Field(min_length=3, max_length=64, pattern=r"^[a-z0-9._-]+$")]
    full_name: Annotated[str, Field(min_length=2, max_length=120)]
    password: Annotated[str, Field(min_length=12, max_length=128)]
    email: str | None = Field(default=None, max_length=255)
    role: AdminRole = AdminRole.MODERATOR
    ip_allowlist: str | None = Field(default=None, max_length=500)


class AdminStaffRow(ORMCamelModel):
    id: uuid.UUID
    username: str
    full_name: str
    email: str | None = None
    role: str
    is_active: bool
    last_login_at: datetime | None = None
    last_login_ip: IPStr = None
    failed_login_count: int
    locked_until: datetime | None = None
    ip_allowlist: str | None = None
    created_at: datetime


class DashboardResponse(CamelModel):
    status: str = "success"
    data: dict[str, Any]


# ---------------------------------------------------------------------------
# Biometric Face Authentication
# ---------------------------------------------------------------------------
class FaceLoginRequest(CamelModel):
    image: str


class FaceRegisterRequest(CamelModel):
    image: str
    username: str | None = None
    password: str | None = None


class FaceStatusResponse(CamelModel):
    enrolled: bool
    count: int = 0
    username: str | None = None
    full_name: str | None = None
    face_image: str | None = None
