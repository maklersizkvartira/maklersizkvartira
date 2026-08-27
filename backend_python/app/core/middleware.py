"""HTTP middleware: request context, security headers, body limits, logging."""

from __future__ import annotations

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.context import build_context, reset_context, set_context
from app.core.errors import translate
from app.core.rate_limit import enforce

log = structlog.get_logger(__name__)

#: Paths that must never be rate-limited or noisily logged.
#: Behind the site's proxy every sitemap request arrives from one Vercel
#: egress IP, so the 240/min global ceiling would 429 it for every crawler at
#: once during a busy period. It is safe to exempt because the response
#: carries `s-maxage=3600` and is served from the edge, so the origin sees it
#: about once an hour rather than once per crawler.
#:
#: The facet endpoint is deliberately NOT here. It sits under the API prefix,
#: which means `Cache-Control: no-store`, so nothing absorbs repeat calls —
#: and it runs five full-table aggregations. Exempt, it was an unlogged,
#: unlimited way to make the database work. The build calls it once per
#: deploy; the ordinary ceiling is not in its way.
_EXEMPT_PATHS = {
    "/health",
    "/api/v1/health",
    "/favicon.ico",
    "/sitemap-listings.xml",
}


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Establish the per-request context and echo the request id back."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        ctx = build_context(request)
        token = set_context(ctx)
        request.state.ctx = ctx
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            reset_context(token)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["X-Request-ID"] = ctx.request_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"
        if request.url.path not in _EXEMPT_PATHS:
            log.info(
                "request",
                request_id=ctx.request_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
                ip=ctx.ip,
            )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Defence-in-depth response headers.

    The CSP is deliberately tight for API responses; the admin panel is served
    with its own slightly wider policy so its inline bootstrap can run.
    """

    API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    ADMIN_CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    )

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        is_admin_ui = request.url.path.startswith("/admin")

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        response.headers["Permissions-Policy"] = (
            "geolocation=(self), microphone=(), camera=(), payment=(), usb=()"
        )
        response.headers["Content-Security-Policy"] = (
            self.ADMIN_CSP if is_admin_ui else self.API_CSP
        )
        # Never let a browser or CDN cache an authenticated API response.
        if request.url.path.startswith(settings.API_PREFIX):
            response.headers.setdefault("Cache-Control", "no-store")
            # Error messages and a few payloads are localised from the
            # X-Language header. Without this a shared cache in front of the
            # API could hand a Russian visitor an Uzbek response, or worse,
            # the reverse for an error that names a field.
            response.headers["Vary"] = "Origin, X-Language"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
        if "server" in response.headers:
            del response.headers["server"]
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized bodies before they are buffered into memory.

    A declared Content-Length is the cheap check. A chunked request declares no
    length at all, so the stream itself is metered as it arrives - otherwise
    the limit is bypassed by simply omitting the header.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        limit = settings.MAX_REQUEST_BYTES
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                if int(content_length) > limit:
                    return _error_response(request, 413, "payload_too_large")
            except ValueError:
                return _error_response(request, 400, "validation_error")
        elif request.headers.get("transfer-encoding", "").lower().find("chunked") >= 0:
            # Meter the stream, and cache what we read so the route still sees
            # a complete body.
            received = 0
            chunks: list[bytes] = []
            async for chunk in request.stream():
                received += len(chunk)
                if received > limit:
                    return _error_response(request, 413, "payload_too_large")
                chunks.append(chunk)
            body = b"".join(chunks)

            async def replay() -> dict:
                return {"type": "http.request", "body": body, "more_body": False}

            request._receive = replay  # noqa: SLF001 - the documented way to rewind

        return await call_next(request)


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """Coarse per-IP ceiling. Endpoint-specific limits are applied in routes."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path
        if request.method == "OPTIONS" or path in _EXEMPT_PATHS:
            return await call_next(request)

        ctx = getattr(request.state, "ctx", None)
        identifier = (ctx.ip if ctx else None) or "unknown"
        try:
            await enforce("global_ip", identifier)
        except Exception as exc:  # TooManyRequests
            retry_after = getattr(exc, "params", {}).get("retry_after", 60)
            response = _error_response(
                request, 429, "rate_limited", {"retry_after": retry_after}
            )
            response.headers["Retry-After"] = str(retry_after)
            return response
        return await call_next(request)


def _error_response(
    request: Request, status_code: int, code: str, params: dict | None = None
) -> JSONResponse:
    ctx = getattr(request.state, "ctx", None)
    language = ctx.language if ctx else "uz"
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "code": code,
            "message": translate(code, language, **(params or {})),
        },
    )


def install(app: ASGIApp) -> None:
    """Attach middleware. Order matters: the last added runs first."""
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(GlobalRateLimitMiddleware)
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(RequestContextMiddleware)
