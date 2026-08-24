"""User accounts and the admin staff accounts."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    AdminRole,
    Language,
    ThemePreference,
    UserRole,
    UserStatus,
)

if TYPE_CHECKING:
    from app.models.listing import Favorite, Listing
    from app.models.moderation import Report, VerificationRequest


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    # -- Identity ------------------------------------------------------------
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    #: Canonical E.164, always +998XXXXXXXXX. Unique across live accounts.
    phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    google_uid: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    avatar: Mapped[str | None] = mapped_column(Text, nullable=True)

    # -- Credentials ---------------------------------------------------------
    #: Argon2id. The only thing authentication ever reads.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: AES-256-GCM copy for the admin reveal feature. Never read by auth.
    password_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # -- Authorisation & state ----------------------------------------------
    role: Mapped[str] = mapped_column(
        String(20), default=UserRole.STUDENT.value, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default=UserStatus.PENDING_VERIFICATION.value, nullable=False, index=True
    )
    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # -- Trust ---------------------------------------------------------------
    trust_score: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    verification_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    xp_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    referral_code: Mapped[str | None] = mapped_column(String(16), nullable=True, unique=True)
    referred_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # -- Preferences (drive i18n + theme on every device) --------------------
    language: Mapped[str] = mapped_column(
        String(2), default=Language.UZ.value, nullable=False
    )
    theme: Mapped[str] = mapped_column(
        String(10), default=ThemePreference.SYSTEM.value, nullable=False
    )

    # -- Login protection ----------------------------------------------------
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    #: Bumped to invalidate every outstanding access token for this user.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # -- Admin bookkeeping ---------------------------------------------------
    suspended_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # -- Relationships -------------------------------------------------------
    listings: Mapped[list["Listing"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )
    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    verification_requests: Mapped[list["VerificationRequest"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    reports_filed: Mapped[list["Report"]] = relationship(
        back_populates="reporter",
        foreign_keys="Report.reporter_id",
        passive_deletes=True,
    )

    __table_args__ = (Index("ix_users_status_role", "status", "role"),)

    # -- Convenience ---------------------------------------------------------
    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE.value and self.deleted_at is None

    @property
    def can_login(self) -> bool:
        return self.is_active and bool(self.password_hash)

    @property
    def is_staff(self) -> bool:
        return self.role in (UserRole.MODERATOR.value, UserRole.ADMIN.value)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.phone} {self.role} {self.status}>"


class AdminUser(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Staff account for the CRM.

    Deliberately separate from ``User``: an admin signs in with a username and
    password on a different endpoint, gets short-lived tokens, and is never
    reachable through the public phone-based login.
    """

    __tablename__ = "admin_users"

    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)

    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    password_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(20), default=AdminRole.ADMIN.value, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    language: Mapped[str] = mapped_column(
        String(2), default=Language.UZ.value, nullable=False
    )
    theme: Mapped[str] = mapped_column(
        String(10), default=ThemePreference.DARK.value, nullable=False
    )

    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Optional comma-separated CIDR allowlist. Empty means "any address".
    ip_allowlist: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def is_superadmin(self) -> bool:
        return self.role == AdminRole.SUPERADMIN.value

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AdminUser {self.username} {self.role}>"
