"""Per-request context.

Kept in a ``ContextVar`` so audit calls deep in the service layer can record
the caller's IP, user agent, language and request id without every function
signature having to carry a ``Request``.
"""

from __future__ import annotations

import ipaddress
import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from starlette.requests import Request

from app.core.config import settings
from app.core.errors import DEFAULT_LANGUAGE, parse_accept_language, resolve_language


@dataclass(slots=True)
class RequestContext:
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ip: str | None = None
    user_agent: str | None = None
    language: str = DEFAULT_LANGUAGE
    method: str | None = None
    path: str | None = None
    actor_id: uuid.UUID | None = None
    actor_type: str = "ANONYMOUS"
    actor_label: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


_ctx: ContextVar[RequestContext] = ContextVar("request_context", default=RequestContext())


def get_context() -> RequestContext:
    return _ctx.get()


def set_context(ctx: RequestContext):
    return _ctx.set(ctx)


def reset_context(token) -> None:
    _ctx.reset(token)


def client_ip(request: Request) -> str | None:
    """Resolve the real client IP behind ``TRUSTED_PROXY_COUNT`` proxies.

    Reads from the right-hand side of ``X-Forwarded-For``, because only the
    entries appended by our own trusted proxies can be believed; anything the
    client itself prepended is attacker-controlled and must be ignored.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and settings.TRUSTED_PROXY_COUNT > 0:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            index = max(0, len(parts) - settings.TRUSTED_PROXY_COUNT)
            candidate = parts[index]
            if _is_ip(candidate):
                return candidate
    real_ip = request.headers.get("x-real-ip")
    if real_ip and _is_ip(real_ip.strip()):
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return None


def _is_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def anonymise_ip(value: str | None) -> str | None:
    """Truncate to /24 (IPv4) or /48 (IPv6) for anonymous analytics rows."""
    if not value:
        return None
    try:
        addr = ipaddress.ip_address(value)
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv4Address):
        return str(ipaddress.ip_network(f"{addr}/24", strict=False).network_address)
    return str(ipaddress.ip_network(f"{addr}/48", strict=False).network_address)


#: `audit_logs.request_id` is VARCHAR(36); anything longer would fail the
#: INSERT and turn an audited action into a 500.
_MAX_REQUEST_ID = 36


def _safe_request_id(raw: str | None) -> str:
    """Accept a caller-supplied correlation id only if it is plausible.

    The value is attacker-controlled and ends up in a fixed-width column and in
    log lines, so anything oversized or containing control characters is
    replaced with a fresh UUID rather than propagated.
    """
    if not raw:
        return str(uuid.uuid4())
    candidate = raw.strip()
    if len(candidate) > _MAX_REQUEST_ID or not candidate.isprintable():
        return str(uuid.uuid4())
    return candidate


def build_context(request: Request) -> RequestContext:
    header_lang = request.headers.get("x-language") or request.query_params.get("lang")
    language = (
        resolve_language(header_lang)
        if header_lang
        else parse_accept_language(request.headers.get("accept-language"))
    )
    return RequestContext(
        request_id=_safe_request_id(request.headers.get("x-request-id")),
        ip=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:400] or None,
        language=language,
        method=request.method,
        path=request.url.path,
    )
