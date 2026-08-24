"""Audit-trail writer.

One call - ``await record(db, AuditAction.X, ...)`` - captures who did what,
to which entity, from where. Request metadata comes from the context var, so
callers only supply the parts that are specific to the action.

Anything that looks like a secret is redacted before it reaches the database.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import get_context
from app.models.audit import AuditLog
from app.models.enums import ActorType, AuditAction, AuditSeverity

#: Field names whose values are never written to the audit log.
REDACTED_FIELDS = {
    "password",
    "password_hash",
    "password_secret",
    "new_password",
    "current_password",
    "confirm_password",
    "token",
    "access_token",
    "refresh_token",
    "code",
    "code_hash",
    "otp",
    "api_key",
    "secret",
    "authorization",
}

REDACTED_PLACEHOLDER = "[redacted]"

#: Actions serious enough to stand out in the admin feed.
_SEVERITY_OVERRIDES: dict[str, str] = {
    AuditAction.AUTH_TOKEN_REUSE_DETECTED.value: AuditSeverity.CRITICAL.value,
    AuditAction.AUTH_LOGIN_LOCKED.value: AuditSeverity.WARNING.value,
    AuditAction.AUTH_LOGIN_FAILED.value: AuditSeverity.NOTICE.value,
    AuditAction.ADMIN_LOGIN_FAILED.value: AuditSeverity.WARNING.value,
    AuditAction.ADMIN_USER_PASSWORD_REVEALED.value: AuditSeverity.CRITICAL.value,
    AuditAction.ADMIN_USER_DELETED.value: AuditSeverity.CRITICAL.value,
    AuditAction.ADMIN_USER_SUSPENDED.value: AuditSeverity.WARNING.value,
    AuditAction.ADMIN_LISTING_DELETED.value: AuditSeverity.WARNING.value,
    AuditAction.SECURITY_RATE_LIMITED.value: AuditSeverity.NOTICE.value,
    AuditAction.SECURITY_FORBIDDEN.value: AuditSeverity.WARNING.value,
    AuditAction.SECURITY_SUSPICIOUS_INPUT.value: AuditSeverity.WARNING.value,
    AuditAction.SMS_FAILED.value: AuditSeverity.WARNING.value,
}


def redact(data: dict[str, Any] | None) -> dict[str, Any] | None:
    if not data:
        return None
    cleaned: dict[str, Any] = {}
    for key, value in data.items():
        if key.lower() in REDACTED_FIELDS:
            cleaned[key] = REDACTED_PLACEHOLDER
        elif isinstance(value, dict):
            cleaned[key] = redact(value)
        elif isinstance(value, str) and len(value) > 2000:
            cleaned[key] = value[:2000] + "..."
        else:
            cleaned[key] = value
    return cleaned


def diff(
    before: dict[str, Any] | None, after: dict[str, Any] | None
) -> dict[str, Any] | None:
    """Build a ``{field: {from, to}}`` map of what actually changed."""
    if not before and not after:
        return None
    before = before or {}
    after = after or {}
    changes: dict[str, Any] = {}
    for key in set(before) | set(after):
        old, new = before.get(key), after.get(key)
        if old == new:
            continue
        if key.lower() in REDACTED_FIELDS:
            changes[key] = {"from": REDACTED_PLACEHOLDER, "to": REDACTED_PLACEHOLDER}
        else:
            changes[key] = {"from": _shorten(old), "to": _shorten(new)}
    return changes or None


def _shorten(value: Any) -> Any:
    if isinstance(value, str) and len(value) > 500:
        return value[:500] + "..."
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


async def record(
    db: AsyncSession,
    action: AuditAction | str,
    *,
    entity_type: str | None = None,
    entity_id: Any | None = None,
    entity_label: str | None = None,
    summary: str | None = None,
    changes: dict[str, Any] | None = None,
    meta: dict[str, Any] | None = None,
    severity: str | None = None,
    actor_type: str | None = None,
    actor_id: uuid.UUID | None = None,
    actor_label: str | None = None,
    status_code: int | None = None,
) -> AuditLog:
    """Write one audit row. Never raises into the caller's happy path."""
    ctx = get_context()
    action_value = action.value if isinstance(action, AuditAction) else str(action)

    entry = AuditLog(
        actor_type=actor_type or ctx.actor_type or ActorType.ANONYMOUS.value,
        actor_id=actor_id if actor_id is not None else ctx.actor_id,
        actor_label=(actor_label or ctx.actor_label or None),
        action=action_value,
        severity=severity
        or _SEVERITY_OVERRIDES.get(action_value, AuditSeverity.INFO.value),
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        entity_label=(entity_label or None),
        summary=summary,
        changes=redact(changes),
        meta=redact(meta),
        ip=ctx.ip,
        user_agent=ctx.user_agent,
        request_id=ctx.request_id,
        method=ctx.method,
        path=ctx.path,
        status_code=status_code,
    )
    db.add(entry)
    # Flush (not commit) so the row participates in the caller's transaction:
    # if the action is rolled back, its audit entry goes with it.
    await db.flush()
    return entry
