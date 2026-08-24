"""Refresh-token families, OTP codes, pending registrations, login attempts."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import OtpPurpose


class RefreshToken(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One row per issued refresh token.

    Tokens are opaque 256-bit secrets; only their SHA-256 is stored. Refresh
    rotates the token and marks the old row used. If a token that was already
    used comes back, that is a replay - the whole family is revoked and the
    event is audited.
    """

    __tablename__ = "refresh_tokens"

    token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    #: Shared by every token descended from one login, so a replay can revoke
    #: the entire chain at once.
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)

    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)

    __table_args__ = (Index("ix_refresh_family_active", "family_id", "revoked_at"),)

    @property
    def is_usable(self) -> bool:
        now = datetime.now(self.expires_at.tzinfo) if self.expires_at.tzinfo else datetime.utcnow()
        return self.revoked_at is None and self.used_at is None and self.expires_at > now


class OtpCode(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A one-time SMS code.

    The code itself is never stored - only its SHA-256 - so a database reader
    cannot complete somebody else's verification.
    """

    __tablename__ = "otp_codes"

    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(
        String(20), default=OtpPurpose.REGISTER.value, nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Set when the code is superseded by a resend, so old codes stop working.
    invalidated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)

    __table_args__ = (
        Index("ix_otp_phone_purpose_active", "phone", "purpose", "consumed_at"),
    )


class PendingRegistration(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A signup that has been submitted but not yet SMS-verified.

    Nothing is written to ``users`` until the code is confirmed, so an
    attacker cannot squat on somebody else's phone number by starting a
    registration they never finish.
    """

    __tablename__ = "pending_registrations"

    phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    password_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    language: Mapped[str] = mapped_column(String(2), default="uz", nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)


class LoginAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Every login attempt, successful or not.

    Powers account lockout, the admin security feed and abuse investigation.
    """

    __tablename__ = "login_attempts"

    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    successful: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    #: Machine-readable reason, e.g. "bad_password", "locked", "not_found".
    failure_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_admin_portal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (Index("ix_login_attempts_ip_time", "ip", "created_at"),)
