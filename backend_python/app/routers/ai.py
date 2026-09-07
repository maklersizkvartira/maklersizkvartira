"""Uyiz AI assistant endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter
from pydantic import Field as PField
from sqlalchemy import func, select

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
from app.services.telegram import send_chat_summary, send_ai_chat_to_telegram

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
    user_name: str | None = PField(default=None, max_length=120)
    user_phone: str | None = PField(default=None, max_length=64)


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

    # An operator has taken this conversation over: the machine stops talking
    # for as long as they hold it.
    handled_by_human = session.taken_over_by is not None

    used = await _used_today(db, viewer=viewer, ctx=ctx)
    # The daily quota exists to cap an OpenAI bill, and a turn answered by a
    # person costs nothing. Cutting a visitor off mid-conversation with a
    # colleague would strand both of them, so the quota is skipped here; the
    # hourly ``enforce("ai_chat", ...)`` limiter above remains the abuse guard.
    if not unlimited and not handled_by_human and used >= DAILY_LIMIT:
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

    if handled_by_human:
        # Store the visitor's turn and stop. The model is not called at all:
        # two voices answering the same person is worse than a pause, and the
        # operator reads this row in the admin chat desk within seconds. The
        # empty ``reply`` is the wire signal for "no bubble" — the widget
        # renders the handover banner instead of an empty AI message.
        #
        # H-FIX-3: the operator's name is deliberately NOT sent. A staff
        # member's legal name has no business reaching an anonymous visitor,
        # and the widget already labels the bubble with the generic
        # ``assistant.chat.operator`` ("Uyiz jamoasi"). The field is gone from
        # this response and from ``_finish`` rather than nulled, so nobody can
        # start reading it again by accident.
        db.add(AIMessage(session_id=session.id, role="user", content=payload.message))
        session.message_count += 1
        await db.flush()
        return {
            "status": "success",
            "reply": "",
            "need": session.last_intent or {},
            "matchQuality": "NONE",
            "listings": [],
            "actions": [],
            "steps": [],
            "awaitingConfirmation": False,
            "handledByHuman": True,
            "sessionKey": session.session_key,
            "used": used + 1,
            "limit": 0 if unlimited else DAILY_LIMIT,
            "remaining": 0 if unlimited else max(0, DAILY_LIMIT - (used + 1)),
            "unlimited": unlimited,
        }

    # The newest twenty rows, not the oldest twenty (H-FIX-8). This read used
    # to be ``asc().limit(20)``, which kept rows 1-20 of a long conversation
    # and threw away everything recent: a thread an operator joined at message
    # 24 resumed with a window containing no operator turn at all, so the model
    # cheerfully contradicted what the person had just promised. Ordered
    # descending in SQL and reversed here, so ``history`` is still oldest-first
    # for the API.
    #
    # Ordered by ``seq`` and not by ``created_at``. ``created_at`` defaults to
    # Postgres ``now()``, which is the transaction timestamp, so the visitor
    # row written below and the assistant row written in ``_finish`` — one
    # transaction — carry identical values. DESC returned each tied pair in
    # heap order and the ``reversed()`` flipped it, handing the model its own
    # reply BEFORE the question it answered: 4 of 10 turns inverted in the
    # reproduction that found this. ``seq`` is an identity column, assigned at
    # INSERT and not at COMMIT, so it is a real total order and reversing it
    # is both correct and stable.
    history_rows = list(
        reversed(
            (
                await db.execute(
                    select(AIMessage)
                    .where(AIMessage.session_id == session.id)
                    .order_by(AIMessage.seq.desc())
                    .limit(20)
                )
            ).scalars().all()
        )
    )
    is_first_turn = len(history_rows) == 0
    # An operator's turn is a real part of the conversation and the model must
    # see it — but "admin" is not a role the Chat Completions API accepts, and
    # sending one 400s the whole turn. It goes in as an assistant message,
    # labelled, so the model neither contradicts the operator nor impersonates
    # a system it does not have.
    history = [
        {"role": "assistant", "content": f"[Uyiz operator]: {row.content}"}
        if row.role == "admin"
        else {"role": row.role, "content": row.content}
        for row in history_rows
    ]

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
        # Every turn that reaches here was written by the model, so this is a
        # constant — but it is sent on every reply all the same. The widget
        # reads it to decide whether the handover banner stays up, and a key
        # that appears only sometimes leaves it stuck on the banner for the
        # rest of the conversation after an operator hands back. There is no
        # ``operatorName`` beside it any more (H-FIX-3): the widget labels an
        # operator's bubble "Uyiz jamoasi" and never learns who wrote it.
        "handledByHuman": False,
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
        # ``handledByHuman`` is spelled out even here. The widget decides the
        # banner from this key on every poll, and one that is present on some
        # responses and absent on others is how a banner gets stuck.
        return {
            "status": "success",
            "messages": [],
            "sessionKey": session_key,
            "handledByHuman": False,
        }

    if session.user_id is not None and (viewer is None or viewer.id != session.user_id):
        raise Forbidden("forbidden")

    # The newest hundred rows, oldest-first — the same shape as the model's
    # window above, and for the same reason. This was ``asc().limit(100)``,
    # the oldest hundred, which froze the visitor's own transcript: the
    # widget's poll decides what is new purely from this array, so once a
    # session reached 100 rows the array stopped changing and nothing an
    # operator wrote ever reached the visitor again — while the handover
    # banner kept telling them a person was answering. That is reachable
    # exactly when it hurts most, because a thread an operator holds skips the
    # daily quota and only the 30/hour limiter is left, so an afternoon of
    # live support crosses a hundred rows. Ordered by ``seq`` so the two rows
    # of one turn cannot come back reversed.
    rows = list(
        reversed(
            (
                await db.execute(
                    select(AIMessage)
                    .where(AIMessage.session_id == session.id)
                    .order_by(AIMessage.seq.desc())
                    .limit(100)
                )
            ).scalars().all()
        )
    )

    used = await _used_today(db, viewer=viewer, ctx=ctx)
    unlimited = _is_unlimited(viewer)
    return {
        "status": "success",
        "sessionKey": session_key,
        "messages": [
            {
                # A stable key for the widget's poll (H-FIX-1). It used to
                # reconcile the transcript by counting rows, which an operator
                # writing between two polls desynchronised for good; it now
                # de-duplicates on identity, and a real id is a stronger key
                # than createdAt+role, which two rows of one turn can share.
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "createdAt": m.created_at.isoformat(),
            }
            for m in rows
        ],
        # H-FIX-3: the poll is the only thing that runs while a visitor is
        # reading, so the handover banner has to come from here. Without it the
        # banner appeared only after the visitor happened to send a message —
        # they were never told the machine had stopped and a person had taken
        # over, which is the entire point of the banner. The operator's name is
        # deliberately absent: an anonymous visitor gets the generic "Uyiz
        # jamoasi" label, not a staff member's legal name.
        "handledByHuman": session.taken_over_by is not None,
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

    # The visitor closing the widget must not close a thread an operator is
    # still working. Closing it here would stamp ``closed_at``, summarise the
    # conversation and post the transcript out from under them — and the
    # widget sends this on every unmount, so a reopened tab would do it again.
    if session.taken_over_by is not None:
        return {"status": "success"}

    # ``seq`` rather than ``created_at``: the summary below joins the visitor's
    # turns in the order they were said, and ``created_at`` cannot tell two
    # rows of one transaction apart.
    messages = (
        await db.execute(
            select(AIMessage)
            .where(AIMessage.session_id == session.id)
            .order_by(AIMessage.seq.asc())
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
    client_name = (viewer.name if viewer else payload.user_name) or "Mehmon (Noma’lum foydalanuvchi)"
    client_phone = viewer.phone if viewer else payload.user_phone

    # Send full chat transcript to Telegram bot for the admins
    delivered = await send_ai_chat_to_telegram(
        user_name=client_name,
        user_phone=client_phone,
        messages=messages,
        intent=intent,
    )

    # If transcript was not delivered, send summary as fallback so the lead is never lost
    if not delivered:
        await send_chat_summary(
            db,
            user_name=client_name,
            user_phone=client_phone,
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
