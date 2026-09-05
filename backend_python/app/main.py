"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core import platform as _platform  # noqa: F401  (event-loop policy)
from app.core import middleware as app_middleware
from app.core.config import settings
from app.core.database import dispose_engine
from app.core.errors import APIError, MESSAGES, translate
from app.routers import admin, ai, auth, chat, listings, meta, seo, uploads


def configure_logging() -> None:
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
            if settings.is_production
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info(
        "startup",
        environment=settings.ENVIRONMENT,
        cors=settings.cors_origin_list,
        reveal_enabled=settings.PASSWORD_REVEAL_ENABLED,
        sms_enabled=settings.SMS_ENABLED and bool(settings.DEVSMS_API_TOKEN),
    )

    # Auto-heal database schema & bootstrap default admin if missing
    try:
        from sqlalchemy import text, select
        from app.core.database import session_scope
        from app.models.user import AdminUser
        from app.core.security import hash_password
        from app.models.enums import AdminRole

        async with session_scope() as db:
            await db.execute(text("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS face_image TEXT;"))
            await db.execute(text("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS face_encoding TEXT;"))

            # Ensure support chat tables exist
            try:
                await db.execute(text("""
                    CREATE TABLE IF NOT EXISTS support_conversations (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                    CREATE INDEX IF NOT EXISTS ix_support_conversations_user_id ON support_conversations(user_id);
                    CREATE INDEX IF NOT EXISTS ix_support_conversations_status ON support_conversations(status);

                    CREATE TABLE IF NOT EXISTS support_messages (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
                        sender_type VARCHAR(10) NOT NULL,
                        sender_id UUID NOT NULL,
                        text TEXT NOT NULL,
                        read_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                    CREATE INDEX IF NOT EXISTS ix_support_messages_conversation_id ON support_messages(conversation_id);
                    CREATE INDEX IF NOT EXISTS ix_support_messages_sender_id ON support_messages(sender_id);
                """))
            except Exception as tbl_err:
                log.warning("support_tables_autoheal_note", error=str(tbl_err))

            # Nothing is deleted here. This block used to run
            #
            #     delete(AdminUser).where(username.not_in(["admin", "maklersizuy@admin.dev"]))
            #
            # on every single startup, so every staff account created through
            # POST /admin/staff was hard-deleted by the next deploy or restart,
            # silently and with no audit line. The panel offers to add
            # colleagues; the server was removing them again behind its back.
            #
            # Nor is a password written here any more. There was one in the
            # source — a SUPERADMIN account seeded with a literal string — in a
            # repository that is public, so the credential was readable by
            # anyone who opened this file, on an account that can do anything
            # in the panel. The other account fell back to "admin123" whenever
            # BOOTSTRAP_ADMIN_PASSWORD happened to be unset, and both were
            # created with must_change_password=False, so neither was ever
            # prompted to become something private.
            #
            # Removing it from the source does not remove it from the history,
            # so that password has to be treated as burned and rotated, not
            # merely deleted.
            #
            # The one account that may still be seeded is gated on the
            # environment giving a password, and it is asked to change it on
            # first use. `scripts/create_admin.py` remains the ordinary way to
            # make staff accounts, and it needs none of this.
            bootstrap_pass = (settings.BOOTSTRAP_ADMIN_PASSWORD or "").strip()
            if bootstrap_pass:
                username = settings.BOOTSTRAP_ADMIN_USERNAME or "admin"
                existing = (
                    await db.execute(
                        select(AdminUser).where(AdminUser.username == username)
                    )
                ).scalar_one_or_none()
                if not existing:
                    db.add(
                        AdminUser(
                            username=username,
                            full_name="Bosh administrator",
                            password_hash=hash_password(bootstrap_pass),
                            role=AdminRole.SUPERADMIN.value,
                            is_active=True,
                            must_change_password=True,
                        )
                    )
                    log.info("admin_bootstrapped", username=username)
    except Exception as e:
        log.warning("schema_autoheal_failed", error=str(e))

    yield
    await dispose_engine()
    log.info("shutdown")


def _language_of(request: Request) -> str:
    ctx = getattr(request.state, "ctx", None)
    return ctx.language if ctx else "uz"


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="2.0.0",
        lifespan=lifespan,
        # The interactive docs expose the whole attack surface in one page.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # Middleware added later runs earlier. Installing the app middleware first
    # and CORS second puts CORS on the OUTSIDE, so a 429 or 413 produced by
    # those middlewares still carries CORS headers and the browser can read the
    # real status instead of reporting an opaque network failure.
    app_middleware.install(app)

    # -- CORS: explicit allowlist with regex for Vercel preview & production origins
    #
    # The regex carries all three brand domains on purpose. uyiz.uz is the brand
    # now; maklersiz.uz and maklersizuy.uz are the previous ones and stay until
    # they stop being served, because they 301 to uyiz.uz and a redirect the
    # browser follows still needs the destination's CORS headers on the XHR that
    # comes after it. Drop the two old alternations once neither domain resolves.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=(
            r"https://.*\.vercel\.app"
            r"|https://(.*\.)?uyiz\.uz"
            r"|https://(.*\.)?maklersiz\.uz"
            r"|https://(.*\.)?maklersizuy\.uz"
            r"|http://localhost:\d+|http://127\.0\.0\.1:\d+"
        ),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Request-ID",
            "X-Language",
            "X-Bootstrap-Token",
        ],
        expose_headers=["X-Request-ID", "X-Response-Time", "Retry-After"],
        max_age=600,
    )

    # -- Routes --------------------------------------------------------------
    prefix = settings.API_PREFIX
    app.include_router(meta.router, prefix=prefix)
    app.include_router(auth.router, prefix=prefix)
    app.include_router(listings.router, prefix=prefix)
    app.include_router(uploads.router, prefix=prefix)
    app.include_router(chat.router, prefix=prefix)
    app.include_router(ai.router, prefix=prefix)
    app.include_router(admin.router, prefix=prefix)

    # Served at the app root, not under the API prefix: the security
    # middleware puts `Cache-Control: no-store` on everything under the prefix,
    # and a sitemap no crawler may cache is refetched in full on every pass.
    app.include_router(seo.router)

    # Unprefixed liveness probe for the platform's health check.
    @app.get("/health", include_in_schema=False)
    async def root_health() -> dict:
        return {"status": "ok"}

    # The admin panel is no longer served from here. It is a Next.js app in
    # `admin/`, deployed as its own Vercel project, and reaches this service
    # over CORS like any other browser client — so its origin has to be in
    # CORS_ORIGINS, and nothing under /admin belongs to the API but the
    # /api/v1/admin routes above.

    _install_exception_handlers(app)
    return app


def _install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def handle_api_error(request: Request, exc: APIError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_payload(_language_of(request)),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        language = _language_of(request)
        first = exc.errors()[0] if exc.errors() else {}
        location = [str(p) for p in first.get("loc", []) if p not in ("body", "query")]
        raw = str(first.get("msg", "")).replace("Value error, ", "").strip()

        # Validators raise message codes ("password_too_short"), so a field
        # error still comes back translated rather than as Pydantic English.
        code = raw if raw in MESSAGES else "validation_error"
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "code": code,
                "message": translate(
                    code, language, min=settings.PASSWORD_MIN_LENGTH, limit=0, remaining=0
                ),
                "field": location[-1] if location else None,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found"}.get(
            exc.status_code, "validation_error"
        )
        if exc.status_code >= 500:
            code = "internal_error"
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "code": code,
                "message": translate(code, _language_of(request)),
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_db(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        # Log the detail; return none of it. Database errors routinely contain
        # table names, column names and sometimes user data.
        log.error("database_error", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "code": "internal_error",
                "message": translate("internal_error", _language_of(request)),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "code": "internal_error",
                "message": translate("internal_error", _language_of(request)),
            },
        )


app = create_app()
