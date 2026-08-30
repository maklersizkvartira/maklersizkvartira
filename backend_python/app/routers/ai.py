"""Uyiz AI assistant endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter
from pydantic import Field as PField
from sqlalchemy import func, or_, select

from app.core import audit as audit_log
from app.core.config import settings
from app.core.deps import DbSession, Lang, OptionalUser, RequestCtx
from app.core.errors import Forbidden, translate
from app.core.rate_limit import enforce
from app.core.security import generate_token
from app.models.ai import AIMessage, AISession
from app.models.enums import AuditAction, UserRole
from app.schemas.common import CamelModel
from app.schemas.listing import ListingOut
from app.services import ai_agent
from app.services import listings as listing_service
from app.services import uyiz_ai
from app.services.telegram import send_chat_summary

router = APIRouter(prefix="/smart", tags=["uyiz-ai"])

DAILY_LIMIT = settings.RATE_LIMIT_AI_PER_DAY


def _is_unlimited(viewer) -> bool:
    """Whether this caller has no AI ceiling at all.

    Both ceilings exist to stop an anonymous visitor running up an OpenAI
    bill; neither has anything to say to a DEVELOPER account, which has to be
    able to exercise the assistant freely. A limit of 0 is the wire signal for
    "no ceiling" — the client hides the counter rather than showing 0 left.
    """
    return viewer is not None and viewer.role == UserRole.DEVELOPER.value

#: Session keys are server-issued secrets. The old client-generated
#: ``guest_123456`` keys were six digits - anyone could enumerate them and
#: read other visitors' conversations.
MIN_SESSION_KEY_LENGTH = 24


class AssistantRequest(CamelModel):
    message: Annotated[str, PField(min_length=1, max_length=2000)]
    session_key: Annotated[str, PField(min_length=MIN_SESSION_KEY_LENGTH, max_length=64)]
    user_name: str | None = PField(default=None, max_length=120)


class CloseRequest(CamelModel):
    session_key: Annotated[str, PField(min_length=MIN_SESSION_KEY_LENGTH, max_length=64)]


class SessionResponse(CamelModel):
    status: str = "success"
    session_key: str
    limit: int
    remaining: int


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_day() -> datetime:
    return _now().replace(hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# Session handling
# ---------------------------------------------------------------------------
@router.post("/assistant/session", response_model=SessionResponse)
async def create_session(
    db: DbSession, viewer: OptionalUser, ctx: RequestCtx
) -> SessionResponse:
    """Issue a high-entropy session key.

    Clients must call this instead of inventing their own key, so a session
    identifier cannot be guessed by a third party.
    """
    session = AISession(
        session_key=generate_token(24),
        user_id=viewer.id if viewer else None,
        guest_label=None if viewer else "guest",
        language=(viewer.language if viewer else ctx.language),
        ip=ctx.ip,
        user_agent=ctx.user_agent,
    )
    db.add(session)
    await db.flush()
    used = await _used_today(db, viewer=viewer, ctx=ctx)
    unlimited = _is_unlimited(viewer)
    return SessionResponse(
        session_key=session.session_key,
        limit=0 if unlimited else DAILY_LIMIT,
        remaining=0 if unlimited else max(0, DAILY_LIMIT - used),
    )


async def _load_session(db, session_key: str, *, viewer, ctx) -> AISession:
    """Fetch a session and verify the caller is entitled to it."""
    session = (
        await db.execute(select(AISession).where(AISession.session_key == session_key))
    ).scalar_one_or_none()

    if session is None:
        session = AISession(
            session_key=session_key,
            user_id=viewer.id if viewer else None,
            guest_label=None if viewer else "guest",
            language=(viewer.language if viewer else ctx.language),
            ip=ctx.ip,
            user_agent=ctx.user_agent,
        )
        db.add(session)
        await db.flush()
        return session

    # A session that belongs to an account may only be used by that account.
    if session.user_id is not None:
        if viewer is None or viewer.id != session.user_id:
            raise Forbidden("forbidden")
    elif viewer is not None:
        # The visitor signed in mid-conversation: attach the history to them.
        session.user_id = viewer.id
    return session


async def _used_today(db, *, viewer, ctx) -> int:
    """Count today's questions per identity, not per session key.

    Counting per session made the quota meaningless: a new key reset it.
    """
    since = _start_of_day()
    stmt = (
        select(func.count())
        .select_from(AIMessage)
        .join(AISession, AISession.id == AIMessage.session_id)
        .where(AIMessage.role == "user", AIMessage.created_at >= since)
    )
    if viewer is not None:
        stmt = stmt.where(AISession.user_id == viewer.id)
    elif ctx.ip:
        stmt = stmt.where(AISession.ip == ctx.ip, AISession.user_id.is_(None))
    else:
        return 0
    return int((await db.execute(stmt)).scalar_one() or 0)


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------
@router.post("/assistant", summary="Send a message to Uyiz AI")
async def assistant(
    payload: AssistantRequest,
    db: DbSession,
    viewer: OptionalUser,
    ctx: RequestCtx,
    lang: Lang,
) -> dict:
    # Both ceilings — the hourly limiter and the daily quota below — exist to
    # keep an anonymous visitor from running up an OpenAI bill. Neither has
    # anything to say to a DEVELOPER account, which has to be able to exercise
    # the assistant freely.
    unlimited = _is_unlimited(viewer)
    if not unlimited:
        await enforce(
            "ai_chat", str(viewer.id) if viewer else (ctx.ip or payload.session_key)
        )

    language = (viewer.language if viewer else None) or lang
    session = await _load_session(db, payload.session_key, viewer=viewer, ctx=ctx)

    used = await _used_today(db, viewer=viewer, ctx=ctx)
    if not unlimited and used >= DAILY_LIMIT:
        await audit_log.record(
            db,
            AuditAction.AI_LIMIT_REACHED,
            entity_type="ai_session",
            entity_id=session.id,
            meta={"used": used, "limit": DAILY_LIMIT},
        )
        return {
            "status": "limit_reached",
            "reply": translate("ai_daily_limit", language, limit=DAILY_LIMIT),
            "used": used,
            "limit": DAILY_LIMIT,
            "remaining": 0,
            "sessionKey": payload.session_key,
            "listings": [],
        }

    history_rows = (
        await db.execute(
            select(AIMessage)
            .where(AIMessage.session_id == session.id)
            .order_by(AIMessage.created_at.asc())
            .limit(20)
        )
    ).scalars().all()
    is_first_turn = len(history_rows) == 0
    history = [{"role": row.role, "content": row.content} for row in history_rows]

    db.add(AIMessage(session_id=session.id, role="user", content=payload.message))
    session.message_count += 1
    await db.flush()

    # ---------------------------------------------------------------
    # Preferred path: the agent loop, which can act and not only answer.
    # ---------------------------------------------------------------
    state = dict(session.agent_state or {})
    shown_ids = [str(i) for i in (state.get("shownIds") or [])]
    pending = state.get("pendingAction")

    # A pending action is a question we asked. Read the answer before doing
    # anything else with the message, because "ha" means nothing on its own.
    approved: dict | None = None
    declined: dict | None = None
    if pending:
        verdict = ai_agent.read_confirmation(payload.message)
        if verdict is True:
            approved = pending
        elif verdict is False:
            declined = pending
        # However it was answered — yes, no, or by changing the subject — the
        # question is now spent. A pending action left lying around would fire
        # on an unrelated "ok" ten turns later.
        state.pop("pendingAction", None)
        session.agent_state = state or None

    agent = await ai_agent.run_turn(
        db=db,
        viewer=viewer,
        session=session,
        message=payload.message,
        history=history,
        language=language,
        user_name=(viewer.name if viewer else payload.user_name),
        is_first_turn=is_first_turn,
        shown_ids=shown_ids,
        approved=approved,
        declined=declined,
    )

    if agent.reply:
        return await _finish(
            db,
            session=session,
            viewer=viewer,
            payload=payload,
            language=language,
            reply=agent.reply,
            rows=agent.rows,
            relaxation="AGENT",
            # A turn that searched replaces the remembered criteria; one that
            # only answered a question leaves them alone, so the listings page
            # does not lose its filters to a "rahmat".
            intent_dict=agent.last_search or session.last_intent or {},
            used=used,
            unlimited=unlimited,
            shown_ids=agent.shown_ids,
            pending=agent.pending,
            steps=agent.steps,
            actions=agent.actions,
        )

    # ---------------------------------------------------------------
    # Fallback: no API key, a provider failure, or a model that returned
    # nothing usable. The deterministic two-pass path below always answers.
    # ---------------------------------------------------------------
    # Two passes with the search in between: the model cannot describe rows it
    # has not seen, and the rows depend on what the first pass understood.
    parsed = uyiz_ai.parse_intent(payload.message)
    llm = await uyiz_ai.understand(
        message=payload.message,
        history=history,
        language=language,
        user_name=(viewer.name if viewer else payload.user_name),
        is_first_turn=is_first_turn,
    )
    intent = uyiz_ai.merge_intents(parsed, llm)
    display_name = intent.user_name or (viewer.name if viewer else payload.user_name)

    # Asking for details is right once. Asking again after they have already
    # been asked and still said nothing concrete is stonewalling, so the
    # second time we show what exists and let them narrow it from there.
    if intent.kind == "CLARIFY" and (session.last_intent or {}).get("kind") == "CLARIFY":
        intent.kind = "SEARCH"

    # Only turns that are actually about finding somewhere to live touch the
    # catalogue. A company question, a request for a person, or an off-topic
    # message gets an answer, not a wall of apartments it never asked for.
    # CONTACT in particular must never come back with listings alongside the
    # support number: someone asking for an operator is asking for one thing.
    if intent.kind in {"SEARCH", "DOMAIN"}:
        rows, relaxation, searched_district, total = await uyiz_ai.search_for_intent(
            db, intent, limit=5
        )
    else:
        rows, relaxation, searched_district, total = [], "NONE", None, 0

    # The composing pass exists to describe rows. With no rows and no search,
    # the first pass already wrote the whole answer, so a second round trip
    # would only add latency to a turn that is finished.
    reply = None
    if rows or intent.kind == "SEARCH":
        # The reply always reflects what the database actually returned, so the
        # assistant can never promise listings that do not exist.
        reply = await uyiz_ai.compose_reply(
            message=payload.message,
            history=history,
            language=language,
            user_name=display_name,
            is_first_turn=is_first_turn,
            intent=intent,
            rows=rows,
            relaxation=relaxation,
            searched_district=searched_district,
        )
    if not reply:
        reply = uyiz_ai.build_fallback_reply(
            intent=intent,
            count=len(rows),
            language=language,
            user_name=display_name,
            is_first_turn=is_first_turn,
            relaxation=relaxation,
            searched_district=searched_district,
        )

    return await _finish(
        db,
        session=session,
        viewer=viewer,
        payload=payload,
        language=language,
        reply=reply,
        rows=rows,
        relaxation=relaxation,
        intent_dict=intent.as_dict(),
        used=used,
        unlimited=unlimited,
        shown_ids=[str(r.id) for r in rows],
        pending=None,
        steps=[],
        actions=[],
        searched_district=searched_district,
        total=total,
    )


async def _finish(
    db,
    *,
    session,
    viewer,
    payload: AssistantRequest,
    language: str,
    reply: str,
    rows: list,
    relaxation: str,
    intent_dict: dict,
    used: int,
    unlimited: bool,
    shown_ids: list[str],
    pending: dict | None,
    steps: list[dict],
    actions: list[str],
    searched_district: str | None = None,
    total: int | None = None,
) -> dict:
    """Persist one assistant turn and shape the response.

    Both paths end here so that whichever one produced the words, the turn is
    stored, audited and serialised identically. The owner's phone is stripped
    from every row on the way out: seeing a number is a deliberate act on the
    listing page that increments a counter, not a side effect of chatting.
    """
    favorite_ids = await listing_service.favorite_ids_for(db, viewer)
    serialised = []
    for row in rows:
        item = ListingOut.model_validate(row)
        item.owner.phone = None
        item.is_favorite = row.id in favorite_ids
        serialised.append(item.model_dump(by_alias=True))

    db.add(
        AIMessage(
            session_id=session.id,
            role="assistant",
            content=reply,
            listing_ids={"ids": [str(r.id) for r in rows]},
        )
    )
    session.last_intent = intent_dict
    # Only a search-shaped turn rewrites what "the second one" points at. A
    # turn that answered a question leaves the previous results addressable.
    state = dict(session.agent_state or {})
    if shown_ids:
        state["shownIds"] = shown_ids[:20]
    if pending:
        state["pendingAction"] = pending
    else:
        state.pop("pendingAction", None)
    session.agent_state = state or None
    session.message_count += 1
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.AI_CHAT_MESSAGE,
        entity_type="ai_session",
        entity_id=session.id,
        entity_label=(viewer.name if viewer else "Guest"),
        summary=payload.message[:200],
        meta={
            "intent": intent_dict,
            "results": len(rows),
            "total_matches": total if total is not None else len(rows),
            "language": language,
            # How far the search had to loosen to find these rows. Reviewing
            # the feed later, this is what explains a surprising suggestion.
            "relaxation": relaxation,
            "searched_district": searched_district,
            # Which tools ran, so an action taken on someone's behalf is
            # reconstructable from the audit trail alone.
            "tools": [step.get("tool") for step in steps if step.get("tool")],
            "actions": actions,
            "awaiting_confirmation": bool(pending),
        },
    )

    return {
        "status": "success",
        "reply": reply,
        "need": intent_dict,
        # The client shows the result rail only when the rows really answer
        # the question; "NONE" means the turn was conversational.
        "matchQuality": relaxation,
        "listings": serialised,
        # What the assistant did on the visitor's behalf, so the interface can
        # say "saved to favourites" rather than leaving it in the prose.
        "actions": actions,
        "steps": [
            {"tool": step["tool"], "label": step["label"]}
            for step in steps
            if step.get("label")
        ],
        "awaitingConfirmation": bool(pending),
        "sessionKey": session.session_key,
        "used": used + 1,
        "limit": 0 if unlimited else DAILY_LIMIT,
        "remaining": 0 if unlimited else max(0, DAILY_LIMIT - (used + 1)),
        "unlimited": unlimited,
    }


@router.get("/assistant/history", summary="Replay a conversation")
async def history(
    session_key: str,
    db: DbSession,
    viewer: OptionalUser,
    ctx: RequestCtx,
) -> dict:
    if len(session_key) < MIN_SESSION_KEY_LENGTH:
        raise Forbidden("forbidden")

    session = (
        await db.execute(select(AISession).where(AISession.session_key == session_key))
    ).scalar_one_or_none()
    if session is None:
        return {"status": "success", "messages": [], "sessionKey": session_key}

    if session.user_id is not None and (viewer is None or viewer.id != session.user_id):
        raise Forbidden("forbidden")

    rows = (
        await db.execute(
            select(AIMessage)
            .where(AIMessage.session_id == session.id)
            .order_by(AIMessage.created_at.asc())
            .limit(100)
        )
    ).scalars().all()

    used = await _used_today(db, viewer=viewer, ctx=ctx)
    unlimited = _is_unlimited(viewer)
    return {
        "status": "success",
        "sessionKey": session_key,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "createdAt": m.created_at.isoformat(),
            }
            for m in rows
        ],
        "limit": 0 if unlimited else DAILY_LIMIT,
        "remaining": 0 if unlimited else max(0, DAILY_LIMIT - used),
    }


@router.post("/assistant/close", summary="End a Uyiz AI conversation")
async def close_assistant(
    payload: CloseRequest, db: DbSession, viewer: OptionalUser, ctx: RequestCtx
) -> dict:
    session = (
        await db.execute(
            select(AISession).where(AISession.session_key == payload.session_key)
        )
    ).scalar_one_or_none()
    if session is None or session.closed_at is not None:
        return {"status": "success"}

    if session.user_id is not None and (viewer is None or viewer.id != session.user_id):
        raise Forbidden("forbidden")

    messages = (
        await db.execute(
            select(AIMessage)
            .where(AIMessage.session_id == session.id)
            .order_by(AIMessage.created_at.asc())
            .limit(60)
        )
    ).scalars().all()

    if not any(m.role == "user" for m in messages):
        session.closed_at = _now()
        return {"status": "success"}

    intent = session.last_intent or {}
    summary = " / ".join(m.content for m in messages if m.role == "user")[:600]

    session.closed_at = _now()
    session.summary = summary
    await db.flush()

    # The conversation is retained, not deleted: the admin panel needs the
    # history, and destroying it on an unauthenticated request was a way to
    # erase evidence of abuse.
    await send_chat_summary(
        db,
        user_name=(viewer.name if viewer else "Noma'lum mijoz"),
        user_phone=(viewer.phone if viewer else None),
        intent=intent,
        summary=summary,
        message_count=len(messages),
    )
    await audit_log.record(
        db,
        AuditAction.AI_CHAT_CLOSED,
        entity_type="ai_session",
        entity_id=session.id,
        summary=summary[:200],
        meta={"messages": len(messages), "intent": intent},
    )
    return {"status": "success"}
