"""Traffic events and the outbound SMS ledger."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import OtpPurpose, SmsStatus


class TrafficEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A page view. Powers the visitor charts in the admin panel."""

    __tablename__ = "traffic_events"

    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    referrer: Mapped[str | None] = mapped_column(String(400), nullable=True)
    language: Mapped[str | None] = mapped_column(String(2), nullable=True)
    #: Truncated /24 (or /48) so visitors can be counted without retaining a
    #: full address for every anonymous page view.
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (Index("ix_traffic_created_path", "created_at", "path"),)


class SmsLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Every outbound SMS, so cost and delivery failures are visible."""

    __tablename__ = "sms_logs"

    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(
        String(20), default=OtpPurpose.REGISTER.value, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), default="devsms", nullable=False)
    status: Mapped[str] = mapped_column(
        String(12), default=SmsStatus.QUEUED.value, nullable=False, index=True
    )
    provider_message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    #: The message template name - never the code itself.
    template: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    parts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    response_meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)

    __table_args__ = (Index("ix_sms_phone_created", "phone", "created_at"),)
