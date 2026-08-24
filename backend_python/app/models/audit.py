"""System-wide audit trail.

Every state-changing action in the platform writes one row here: who did it,
what they did, to which entity, from where, and what changed. This table is
what the admin panel's "Barcha harakatlar" (all activity) feed reads.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ActorType, AuditSeverity


class AuditLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    # -- Who -----------------------------------------------------------------
    actor_type: Mapped[str] = mapped_column(
        String(16), default=ActorType.SYSTEM.value, nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    #: Denormalised display label ("Dilshod Karimov +998 90 *** ** 67"), kept
    #: so the feed still reads correctly after the actor is deleted.
    actor_label: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # -- What ----------------------------------------------------------------
    action: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(
        String(10), default=AuditSeverity.INFO.value, nullable=False, index=True
    )
    entity_type: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    entity_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: {"field": {"from": ..., "to": ...}} - secrets are redacted before write.
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # -- Where ---------------------------------------------------------------
    ip: Mapped[str | None] = mapped_column(INET, nullable=True, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    method: Mapped[str | None] = mapped_column(String(8), nullable=True)
    path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status_code: Mapped[int | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_audit_created_action", "created_at", "action"),
        Index("ix_audit_actor", "actor_type", "actor_id", "created_at"),
        Index("ix_audit_entity", "entity_type", "entity_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AuditLog {self.action} by {self.actor_type}:{self.actor_id}>"
