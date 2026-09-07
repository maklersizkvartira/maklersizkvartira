"""Uyiz AI conversation storage."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
)
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
    #: Whether the captured lead actually reached the team over Telegram
    #: (L-FIX-1). Three states on purpose:
    #:
    #: ``NULL``   no lead was captured on this session at all.
    #: ``True``   Telegram accepted the send; the team has it.
    #: ``False``  the lead is recorded here and nowhere else — the send
    #:            failed, nobody was paged, and a human has to act on it.
    #:
    #: The distinction is the whole point. Before this column an undelivered
    #: lead was invisible: the visitor was told the team would be in touch, the
    #: send had already failed, and the panel showed a captured lead that looked
    #: exactly like a delivered one.
    lead_delivered: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)

    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        #: ``seq`` and not ``created_at``: see AIMessage.seq. Two rows of one
        #: turn carry the same timestamp, so ordering this collection by
        #: ``created_at`` left the pair in whatever order the heap happened to
        #: return them.
        order_by="AIMessage.seq",
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

    #: The transcript's total order. ``created_at`` is not one: it defaults to
    #: Postgres ``now()``, which is the *transaction* timestamp, so the
    #: visitor's row and the assistant's answer — written by a single request,
    #: in a single transaction — carry byte-identical values. Ordering on it
    #: leaves the pair in heap order, which is an accident and not an order,
    #: and the model-history window (which reads newest-first and reverses)
    #: turned that accident into the assistant answering before it was asked:
    #: 4 turns out of 10 inverted in the reviewer's reproduction. A UUIDv4 id
    #: is random, so it cannot break the tie either.
    #:
    #: An identity column is generated at INSERT time rather than at commit
    #: time, so it separates two rows of one transaction in the order they
    #: were added — which is the order they were said in. ``always=False``
    #: (GENERATED BY DEFAULT) so the migration's backfill and any repair
    #: script can still write the column explicitly.
    #:
    #: Gaps are expected and harmless: a rolled-back turn burns its numbers.
    #: Nothing reads seq as a count — it is only ever compared.
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=False), nullable=False)

    session: Mapped["AISession"] = relationship(back_populates="messages")

    __table_args__ = (
        Index("ix_ai_messages_session_time", "session_id", "created_at"),
        #: Unique so the total order is enforced and not merely intended, and
        #: composite on (session_id, seq) so the newest-N window for one
        #: conversation is an index scan rather than a sort of the session.
        Index("ix_ai_messages_session_seq", "session_id", "seq", unique=True),
    )
