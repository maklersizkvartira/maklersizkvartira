"""Shield AI conversation storage."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AISession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One Shield AI conversation, keyed by a client-generated session key.

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
    #: Last extracted search intent: district, rooms, maxPrice, audience...
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
    role: Mapped[str] = mapped_column(String(12), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    #: Listing ids returned alongside an assistant turn.
    listing_ids: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    session: Mapped["AISession"] = relationship(back_populates="messages")

    __table_args__ = (Index("ix_ai_messages_session_time", "session_id", "created_at"),)
