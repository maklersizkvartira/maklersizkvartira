"""Health, reference data and traffic tracking."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter
from pydantic import Field
from sqlalchemy import text

from app.core.config import settings
from app.core.context import anonymise_ip
from app.core.deps import DbSession, Lang, OptionalUser, RequestCtx
from app.models.analytics import TrafficEvent
from app.schemas.auth import SUPPORTED_LANGUAGE_LIST
from app.schemas.common import CamelModel, MessageResponse

router = APIRouter(tags=["meta"])

_BOT_MARKERS = ("bot", "crawler", "spider", "slurp", "curl", "wget", "headless")


@router.get("/health", summary="Liveness and database probe")
async def health(db: DbSession) -> dict:
    database_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - the probe must never raise
        database_ok = False
    return {
        "status": "ok" if database_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.ENVIRONMENT,
        "database": "up" if database_ok else "down",
        "version": "2.0.0",
    }


@router.get("/meta/languages", summary="Supported interface languages")
async def languages() -> dict:
    return {
        "status": "success",
        "data": [lang.model_dump(by_alias=True) for lang in SUPPORTED_LANGUAGE_LIST],
    }


@router.get("/meta/fx-rate", summary="Current UZS per USD")
async def fx_rate() -> dict:
    return {
        "status": "success",
        "data": {"base": "USD", "quote": "UZS", "rate": settings.USD_TO_UZS_RATE},
    }


class TrackRequest(CamelModel):
    session_id: Annotated[str, Field(min_length=4, max_length=64)]
    page_path: Annotated[str, Field(max_length=255)] = "/"
    referrer: str | None = Field(default=None, max_length=400)


@router.post("/traffic/track", summary="Record a page view")
async def track(
    payload: TrackRequest,
    db: DbSession,
    viewer: OptionalUser,
    ctx: RequestCtx,
    lang: Lang,
) -> MessageResponse:
    user_agent = (ctx.user_agent or "").lower()
    db.add(
        TrafficEvent(
            session_id=payload.session_id,
            user_id=viewer.id if viewer else None,
            path=payload.page_path[:255],
            referrer=payload.referrer,
            language=lang,
            # Anonymous page views keep only a truncated network, not a full
            # address - enough to count visitors, not enough to track one.
            ip=anonymise_ip(ctx.ip) if viewer is None else ctx.ip,
            user_agent=ctx.user_agent,
            is_bot=any(marker in user_agent for marker in _BOT_MARKERS),
        )
    )
    return MessageResponse()
