"""Uyiz AI conversation storage."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AISession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One Uyiz AI conversation, keyed by a server-issued session key.

    Unlike the old implementation the session is retained after the chat is
    closed (with a generated summary) so the admin panel keeps a history
    instead of deleting the evidence.
    """

    __tablename__ = "ai_sessions"

    session_key: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    guest_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    language: Mapped[str] = mapped_column(String(2), default="uz", nullable=False)

    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Last extracted search intent, camelCased: district, metroStation,
    #: rooms, minArea, maxPrice, audience, the amenity flags and sortBy — the
    #: same shape the listings page mirrors into its own filters.
    last_intent: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    #: Working state the agent loop needs to survive between turns:
    #:
    #: ``shownIds``      the listing ids currently on screen, in order. This is
    #:                   what makes "save the second one" resolve to a row the
    #:                   server chose rather than one the model invented.
    #: ``pendingAction`` a tool call waiting on a yes. Held here rather than in
    #:                   the client so a confirmation cannot be forged by
    #:                   editing a request body.
    agent_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    #: The moderator who took this conversation over, or NULL while the model
    #: is still answering. It is the whole handover switch: the assistant
    #: endpoint stops calling the agent the moment this is set, so a visitor is
    #: never talking to a person and a machine at the same time.
    taken_over_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    #: When the takeover happened. Deliberately *not* cleared on release, so a
    #: closed thread still shows that a human was on it at some point.
    taken_over_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: How far the operator has read. Every visitor turn after this stamp is
    #: what the panel counts as unread; NULL means nothing has been read yet.
    admin_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    #: The four ``lead_*`` columns are what ``capture_lead`` writes. They live
    #: on the session rather than in the transcript because the admin list has
    #: to filter and sort on them, and re-reading every message to find a phone
    #: number is not a list query.
    lead_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lead_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    lead_note: Mapped[str | None] = mapped_column(String(400), nullable=True)
    lead_captured_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)

    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AIMessage.created_at",
    )


class AIMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ai_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | admin
    content: Mapped[str] = mapped_column(Text, nullable=False)
    #: Listing ids returned alongside an assistant turn.
    listing_ids: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    session: Mapped["AISession"] = relationship(back_populates="messages")

    __table_args__ = (Index("ix_ai_messages_session_time", "session_id", "created_at"),)
