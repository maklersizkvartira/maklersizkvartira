"""Chat endpoints."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import and_, select, or_, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.context import get_context
from app.core.deps import CurrentUser, DbSession, OptionalUser
from app.core.rate_limit import enforce
from app.core.errors import BadRequest, NotFound
from app.models.chat import ChatMessage, Conversation, SupportConversation, SupportMessage
from app.models.listing import Listing
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ConversationDetailOut,
    ConversationOut,
    SupportConversationDetailOut,
    SupportMessageCreate,
    SupportMessageOut,
)
from app.services import ops_alerts
from app.services.support import SUPPORT_WELCOME, name_operators

log = structlog.get_logger(__name__)

#: Detached background work, held so the event loop keeps a strong reference.
#: `asyncio.create_task` alone does not: the loop holds only a weak one, so a
#: push fan-out or an assistant reply could be garbage-collected halfway
#: through. The set also bounds the fan-out — past the cap the work is
#: dropped deliberately rather than by exhausting the connection pool.
_BACKGROUND: set[asyncio.Task] = set()
_BACKGROUND_MAX = 64


def _spawn(coro: Any, *, context: str) -> None:
    if len(_BACKGROUND) >= _BACKGROUND_MAX:
        log.warning("chat.background_saturated", context=context, in_flight=len(_BACKGROUND))
        coro.close()
        return
    task = asyncio.create_task(coro)
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(db: DbSession, user: CurrentUser) -> list[ConversationOut]:
    """Every conversation this user is part of, ready to render as a list.

    The rows carry the listing, the last message and an unread count, because
    the alternative is a list of bare names: an owner with four apartments
    could not tell which one a message was about without opening each thread,
    and had no way to see which threads were waiting on them.

    The two aggregates are one query each for the whole page rather than one
    per row — twenty conversations should not be forty-one round trips.
    """
    conversations = list(
        (
            await db.execute(
                select(Conversation)
                .options(selectinload(Conversation.listing))
                .where(
                    or_(
                        and_(
                            Conversation.user_id == user.id,
                            Conversation.deleted_by_user_at.is_(None),
                        ),
                        and_(
                            Conversation.owner_id == user.id,
                            Conversation.deleted_by_owner_at.is_(None),
                        ),
                    )
                )
                .order_by(Conversation.updated_at.desc())
            )
        )
        .unique()
        .scalars()
        .all()
    )
    if not conversations:
        return []

    ids = [c.id for c in conversations]

    # Unread: messages from the other person that have not been opened.
    unread = dict(
        (
            await db.execute(
                select(ChatMessage.conversation_id, func.count(ChatMessage.id))
                .where(
                    ChatMessage.conversation_id.in_(ids),
                    ChatMessage.sender_id != user.id,
                    ChatMessage.read_at.is_(None),
                )
                .group_by(ChatMessage.conversation_id)
            )
        ).all()
    )

    # The newest message per conversation, via its timestamp. DISTINCT ON is
    # Postgres-specific and this app has no other database.
    latest = {
        row.conversation_id: row
        for row in (
            await db.execute(
                select(ChatMessage)
                .where(ChatMessage.conversation_id.in_(ids))
                .distinct(ChatMessage.conversation_id)
                .order_by(
                    ChatMessage.conversation_id,
                    ChatMessage.created_at.desc(),
                )
            )
        )
        .scalars()
        .all()
    }

    out: list[ConversationOut] = []
    for conversation in conversations:
        item = ConversationOut.model_validate(conversation)
        item.unread_count = int(unread.get(conversation.id, 0))
        message = latest.get(conversation.id)
        if message is not None:
            # Truncated: the list shows one line, and a pasted essay in the
            # preview costs bandwidth nobody reads.
            item.last_message = message.text[:160]
            item.last_message_at = message.created_at
            item.last_message_is_mine = message.sender_id == user.id
        out.append(item)
    return out


@router.post("/conversations/{listing_id}", response_model=ConversationDetailOut)
async def start_or_get_conversation(
    listing_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ConversationDetailOut:
    """Start a new conversation for a listing or get the existing one."""
    listing = (await db.execute(select(Listing).where(Listing.id == listing_id))).scalar_one_or_none()
    if not listing:
        raise BadRequest("listing_not_found")
    
    if listing.owner_id == user.id:
        raise BadRequest("cannot_chat_with_self")

    stmt = (
        select(Conversation)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.listing),
        )
        .where(
            Conversation.listing_id == listing_id,
            Conversation.user_id == user.id,
        )
    )
    conversation = (await db.execute(stmt)).unique().scalar_one_or_none()

    if not conversation:
        db.add(
            Conversation(
                listing_id=listing_id,
                user_id=user.id,
                owner_id=listing.owner_id,
            )
        )
        await db.commit()
        # Re-read through the same eager-loading statement rather than
        # refreshing the instance and assigning to its collections.
        #
        # `conversation.messages = []` was doing the opposite of what its
        # comment claimed. Assigning to a relationship collection makes
        # SQLAlchemy load the *existing* one first, so that it can work out
        # what changed — and on a row that was just refreshed, that collection
        # is unloaded, so the assignment is lazy IO. Under asyncio that is
        # `greenlet_spawn has not been called`, a 500, on the first message
        # anybody ever sends about a listing. The line written to prevent a
        # lazy load was the lazy load.
        conversation = (await db.execute(stmt)).unique().scalar_one_or_none()
        if conversation is None:
            raise NotFound("conversation_not_found")

    return conversation


@router.get("/conversations/{conversation_id}/messages", response_model=ConversationDetailOut)
async def get_messages(
    conversation_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ConversationDetailOut:
    """Get all messages for a specific conversation."""
    conversation = (
        await db.execute(
            select(Conversation)
            .options(
                selectinload(Conversation.messages),
                selectinload(Conversation.listing),
            )
            .where(Conversation.id == conversation_id)
        )
    ).unique().scalar_one_or_none()
    if not conversation:
        raise BadRequest("conversation_not_found")
        
    if conversation.user_id != user.id and conversation.owner_id != user.id:
        raise BadRequest("not_your_conversation")

    # Mark all messages sent by the OTHER person as read
    for msg in conversation.messages:
        if msg.sender_id != user.id and msg.read_at is None:
            msg.read_at = msg.created_at # Or utcnow(), just marking it read for now
            
    await db.commit()
    
    return conversation


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageOut)
async def send_message(
    conversation_id: uuid.UUID,
    payload: ChatMessageCreate,
    db: DbSession,
    user: CurrentUser
) -> ChatMessageOut:
    """Send a new message in a conversation."""
    await enforce("chat_message", str(user.id))

    conversation = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if not conversation:
        raise BadRequest("conversation_not_found")
        
    if conversation.user_id != user.id and conversation.owner_id != user.id:
        raise BadRequest("not_your_conversation")

    msg = ChatMessage(
        conversation_id=conversation.id,
        sender_id=user.id,
        text=payload.text
    )
    db.add(msg)
    await db.flush() # flush to generate msg.created_at
    
    # Touch conversation
    conversation.updated_at = msg.created_at
    
    await db.commit()
    await db.refresh(msg)
    
    # Notify recipient device via Web Push if registered
    recipient_id = str(conversation.owner_id if user.id == conversation.user_id else conversation.user_id)
    sender_name = getattr(user, "name", None) or "Foydalanuvchi"
    push_title = "uyiz.uz"
    push_body = f"{sender_name} sizga xabar yubordi: {payload.text[:80]}"
    
    # Send push in background to all recipient devices
    _spawn(
        _dispatch_web_push(recipient_id, push_title, push_body, f"/?view=CHAT&conversation={conversation_id}"),
        context="chat_push",
    )

    return msg


@router.patch("/messages/{message_id}", response_model=ChatMessageOut)
async def edit_message(
    message_id: uuid.UUID,
    payload: ChatMessageCreate,
    db: DbSession,
    user: CurrentUser,
) -> ChatMessageOut:
    """Edit an existing chat message (only allowed for the original sender)."""
    msg = (await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))).scalar_one_or_none()
    if not msg:
        raise NotFound("message_not_found")
    if msg.sender_id != user.id:
        raise BadRequest("not_your_message")

    new_text = payload.text.strip()
    if not new_text:
        raise BadRequest("message_empty")

    msg.text = new_text
    await db.commit()
    await db.refresh(msg)
    return msg


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> dict[str, str]:
    """Delete a chat message (only allowed for the original sender)."""
    msg = (await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))).scalar_one_or_none()
    if not msg:
        raise NotFound("message_not_found")
    if msg.sender_id != user.id:
        raise BadRequest("not_your_message")

    await db.delete(msg)
    await db.commit()
    return {"status": "deleted", "id": str(message_id)}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> dict[str, str]:
    """Hide a conversation for the caller.

    Not a DELETE: the thread belongs to two people. Removing the row cascaded
    to `chat_messages`, so one party pressing "delete" erased the other
    party's copy of the negotiation as well — including anything they were
    promised in it. The row is removed only once both sides have hidden it.
    """
    conversation = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if not conversation:
        raise NotFound("conversation_not_found")
    if conversation.user_id != user.id and conversation.owner_id != user.id:
        raise BadRequest("not_your_conversation")

    now = datetime.now(timezone.utc)
    if conversation.user_id == user.id:
        conversation.deleted_by_user_at = now
    if conversation.owner_id == user.id:
        conversation.deleted_by_owner_at = now

    if conversation.deleted_by_user_at and conversation.deleted_by_owner_at:
        await db.delete(conversation)

    await db.commit()
    return {"status": "deleted", "id": str(conversation_id)}


class PushSubscriptionIn(BaseModel):
    endpoint: str
    p256dh: str | None = None
    auth: str | None = None
    guest_id: str | None = None
    user_agent: str | None = None


# In-memory storage / registry for active device push subscriptions
_user_push_subscriptions: dict[str, list[dict[str, str | None]]] = {}
_guest_push_registry: dict[str, dict] = {}


@router.post("/push-subscriptions")
async def register_push_subscription(
    payload: PushSubscriptionIn,
    db: DbSession,
    user: OptionalUser = None,
) -> dict[str, str]:
    """Register device web-push subscription for registered users or guest visitors in PostgreSQL."""
    from datetime import datetime, timezone
    from app.models.chat import PushSubscription
    import hashlib

    await enforce("push_subscribe", str(user.id) if user else (get_context().ip or "unknown"))

    user_id = user.id if user else None
    raw_hash = hashlib.md5(payload.endpoint.encode()).hexdigest()[:10]
    guest_id = payload.guest_id or (f"guest_{raw_hash}" if not user_id else None)

    # Upsert by endpoint into PostgreSQL
    stmt = select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    existing = (await db.execute(stmt)).scalar_one_or_none()

    if existing:
        existing.p256dh = payload.p256dh or existing.p256dh
        existing.auth = payload.auth or existing.auth
        existing.user_id = user_id or existing.user_id
        existing.guest_id = guest_id or existing.guest_id
        existing.user_agent = payload.user_agent or existing.user_agent
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
    else:
        new_sub = PushSubscription(
            endpoint=payload.endpoint,
            p256dh=payload.p256dh,
            auth=payload.auth,
            user_id=user_id,
            guest_id=guest_id,
            user_agent=payload.user_agent,
            is_active=True,
        )
        db.add(new_sub)

    await db.commit()
    subscriber_id = str(user_id) if user_id else (guest_id or "guest")
    return {"status": "ok", "subscriber_id": subscriber_id}


# The signing pair comes from the environment. It used to be two literals
# here, so the private half — which is what proves a push is from us — was
# published with the source and could not be rotated without a deploy.
VAPID_CLAIMS = {"sub": settings.VAPID_SUBJECT}


async def _send_single_webpush(
    sub_info_dict: dict,
    title: str,
    body: str,
    url: str,
    image: str | None = None,
) -> str:
    """Send RFC 8291/8292 encrypted web-push notification via pywebpush with VAPID."""
    endpoint = sub_info_dict.get("endpoint")
    p256dh = sub_info_dict.get("p256dh")
    auth = sub_info_dict.get("auth")
    if not endpoint or not p256dh or not auth:
        return "invalid_sub"
    if not settings.VAPID_PRIVATE_KEY:
        # No signing key configured: sending is impossible, and pretending
        # otherwise would raise inside a detached task where nobody sees it.
        log.warning("webpush.no_vapid_key")
        return "not_configured"

    import json
    import asyncio
    import structlog
    from pywebpush import webpush, WebPushException

    logger = structlog.get_logger(__name__)

    payload_dict = {
        "title": title,
        "body": body,
        "url": url,
        "icon": "/logo-org.png",
        "badge": "/favicon.ico",
    }
    if image:
        payload_dict["image"] = image

    payload = json.dumps(payload_dict)
    sub_info = {
        "endpoint": endpoint,
        "keys": {
            "p256dh": p256dh,
            "auth": auth,
        },
    }

    def _send_sync():
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS,
                timeout=10,
            )
            logger.info("webpush_sent_successfully", endpoint=endpoint[:30])
            return "ok"
        except WebPushException as ex:
            status_code = getattr(ex.response, "status_code", None)
            logger.warning("webpush_failed", error=str(ex), status_code=status_code)
            if status_code in (404, 410):
                return "expired"
            return "error"
        except Exception as e:
            logger.warning("webpush_unexpected_error", error=str(e))
            return "error"

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _send_sync)


async def _dispatch_web_push(user_id: str, title: str, body: str, url: str, image: str | None = None) -> None:
    """Send web-push notification to all devices for a given user from database."""
    from app.core.database import session_scope
    from app.models.chat import PushSubscription
    try:
        async with session_scope() as db:
            try:
                target_uuid = uuid.UUID(user_id)
                stmt = select(PushSubscription).where(
                    PushSubscription.user_id == target_uuid,
                    PushSubscription.is_active == True,
                )
            except Exception:
                stmt = select(PushSubscription).where(
                    PushSubscription.guest_id == user_id,
                    PushSubscription.is_active == True,
                )
            subs = (await db.execute(stmt)).scalars().all()
            for s in subs:
                await _send_single_webpush(
                    {"endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth},
                    title,
                    body,
                    url,
                    image,
                )
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).warning("dispatch_push_error", error=str(e))


class UnreadCountOut(BaseModel):
    count: int

@router.get("/unread-count", response_model=UnreadCountOut)
async def get_unread_count(db: DbSession, user: CurrentUser) -> UnreadCountOut:
    """Get total unread messages count for the user (listing chats + support)."""
    stmt = (
        select(func.count(ChatMessage.id))
        .join(Conversation, ChatMessage.conversation_id == Conversation.id)
        .where(
            or_(Conversation.user_id == user.id, Conversation.owner_id == user.id),
            ChatMessage.sender_id != user.id,
            ChatMessage.read_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    count = int(result.scalar_one() or 0)

    # Add unread support messages sent by ADMIN
    support_stmt = (
        select(func.count(SupportMessage.id))
        .join(SupportConversation, SupportMessage.conversation_id == SupportConversation.id)
        .where(
            SupportConversation.user_id == user.id,
            SupportMessage.sender_type == "ADMIN",
            SupportMessage.read_at.is_(None),
        )
    )
    support_result = await db.execute(support_stmt)
    count += int(support_result.scalar_one() or 0)

    return UnreadCountOut(count=count)




@router.get("/support", response_model=SupportConversationDetailOut)
async def get_or_create_support_conversation(
    db: DbSession, user: CurrentUser
) -> SupportConversationDetailOut:
    """Get the user's support conversation, creating one with a welcoming greeting if needed."""
    stmt = (
        select(SupportConversation)
        .options(selectinload(SupportConversation.messages))
        .where(SupportConversation.user_id == user.id)
    )
    conversation = (await db.execute(stmt)).unique().scalar_one_or_none()

    if not conversation:
        conversation = SupportConversation(user_id=user.id, status="OPEN")
        db.add(conversation)
        await db.flush()

        # Seed the welcome, in the customer's own language. `sender_id` is
        # the customer's id only because the column is not nullable; the
        # message is the service's, and the client decides which side a
        # bubble sits on by `sender_type`, never by this id.
        welcome_msg = SupportMessage(
            conversation_id=conversation.id,
            sender_type="ADMIN",
            sender_id=user.id,
            text=SUPPORT_WELCOME.get(user.language, SUPPORT_WELCOME["uz"]),
        )
        db.add(welcome_msg)
        await db.commit()
        await db.refresh(conversation)

        # Refetch with messages
        conversation = (await db.execute(stmt)).unique().scalar_one()
    else:
        # Mark all ADMIN messages as read by the user
        marked = False
        for msg in conversation.messages:
            if msg.sender_type == "ADMIN" and msg.read_at is None:
                msg.read_at = msg.created_at
                marked = True
        if marked:
            await db.commit()

    # Calculate unread & last message
    out = SupportConversationDetailOut.model_validate(conversation)
    await name_operators(db, out.messages)
    unread_count = 0
    if conversation.messages:
        last = conversation.messages[-1]
        out.last_message = last.text[:160]
        out.last_message_at = last.created_at
        out.last_message_sender = last.sender_type
        unread_count = sum(
            1 for m in conversation.messages if m.sender_type == "ADMIN" and m.read_at is None
        )
    out.unread_count = unread_count
    return out


@router.post("/support/messages", response_model=SupportMessageOut)
async def send_support_message(
    payload: SupportMessageCreate,
    db: DbSession,
    user: CurrentUser,
) -> SupportMessageOut:
    """Send a message to support."""
    # Each message may wake the assistant, which is a paid API call made in a
    # detached task — so the request returns in milliseconds and a loop was
    # never slowed by its own cost. The limit is what makes the loop stop.
    await enforce("support_message", str(user.id))

    stmt = select(SupportConversation).where(SupportConversation.user_id == user.id)
    conversation = (await db.execute(stmt)).scalar_one_or_none()

    if not conversation:
        conversation = SupportConversation(user_id=user.id, status="OPEN")
        db.add(conversation)
        await db.flush()

    msg = SupportMessage(
        conversation_id=conversation.id,
        sender_type="USER",
        sender_id=user.id,
        text=payload.text.strip(),
    )
    db.add(msg)
    await db.flush()

    conversation.updated_at = msg.created_at
    conversation.status = "OPEN"

    await db.commit()
    await db.refresh(msg)

    from app.services.support_ai import process_incoming_support_message

    _spawn(
        process_incoming_support_message(
            conversation_id=conversation.id,
            user_id=user.id,
            message_text=payload.text.strip(),
        ),
        context="support_ai",
    )
    await ops_alerts.support_message(db, user_name=user.name, phone=user.phone, text=msg.text)
    return msg

