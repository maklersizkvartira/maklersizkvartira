"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core import platform as _platform  # noqa: F401  (event-loop policy)
from app.core import middleware as app_middleware
from app.core.config import settings
from app.core.database import dispose_engine
from app.core.errors import APIError, MESSAGES, translate
from app.routers import admin, ai, auth, chat, listings, meta, seo

ADMIN_DIR = Path(__file__).resolve().parent / "admin"


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

    # -- CORS: explicit allowlist, never "*" alongside credentials -----------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Request-ID",
            "X-Language",
        ],
        expose_headers=["X-Request-ID", "X-Response-Time", "Retry-After"],
        max_age=600,
    )

    # -- Routes --------------------------------------------------------------
    prefix = settings.API_PREFIX
    app.include_router(meta.router, prefix=prefix)
    app.include_router(auth.router, prefix=prefix)
    app.include_router(listings.router, prefix=prefix)
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

    # -- Admin panel (static SPA) -------------------------------------------
    if ADMIN_DIR.is_dir():
        app.mount(
            "/admin/assets",
            StaticFiles(directory=str(ADMIN_DIR / "assets"), check_dir=False),
            name="admin-assets",
        )

        # The panel's asset paths are relative, so it can also be served from
        # its own domain. Relative paths resolve against the *directory* of the
        # current URL, so "/admin" without the trailing slash would look for
        # "/assets/..." at the site root. The redirect is what makes one set of
        # paths work in both places.
        @app.get("/admin", include_in_schema=False)
        async def admin_root() -> RedirectResponse:
            return RedirectResponse("/admin/", status_code=308)

        @app.get("/admin/", include_in_schema=False)
        @app.get("/admin/{path:path}", include_in_schema=False)
        async def admin_panel(path: str = "") -> FileResponse:
            # config.js sits beside index.html rather than under assets/,
            # because it is the one file a deployment is expected to change.
            if path == "config.js":
                return FileResponse(ADMIN_DIR / "config.js")
            return FileResponse(ADMIN_DIR / "index.html")

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
