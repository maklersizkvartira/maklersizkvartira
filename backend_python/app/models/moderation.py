"""Abuse reports and identity/property verification requests."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    ReportPriority,
    ReportReason,
    ReportStatus,
    VerificationDocumentType,
    VerificationStatus,
)

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.user import User


class Report(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "reports"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Kept for anonymous reports where there is no account to point at.
    reporter_label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    reason: Mapped[str] = mapped_column(
        String(20), default=ReportReason.OTHER.value, nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ReportStatus.OPEN.value, nullable=False, index=True
    )
    priority: Mapped[str] = mapped_column(
        String(10), default=ReportPriority.MEDIUM.value, nullable=False
    )
    ai_risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    listing: Mapped["Listing"] = relationship(back_populates="reports")
    reporter: Mapped["User | None"] = relationship(
        back_populates="reports_filed", foreign_keys=[reporter_id]
    )

    __table_args__ = (Index("ix_reports_status_created", "status", "created_at"),)


class VerificationRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "verification_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_level: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    document_type: Mapped[str] = mapped_column(
        String(24), default=VerificationDocumentType.PASSPORT.value, nullable=False
    )
    document_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    selfie_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(12), default=VerificationStatus.PENDING.value, nullable=False, index=True
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="verification_requests")

    __table_args__ = (Index("ix_verifications_status_created", "status", "created_at"),)
