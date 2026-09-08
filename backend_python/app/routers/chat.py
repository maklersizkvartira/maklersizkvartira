"""Chat endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, OptionalUser
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
                        Conversation.user_id == user.id,
                        Conversation.owner_id == user.id,
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
    import asyncio
    asyncio.create_task(_dispatch_web_push(recipient_id, push_title, push_body, f"/?view=CHAT&conversation={conversation_id}"))

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
    """Delete an entire conversation and all its messages."""
    conversation = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if not conversation:
        raise NotFound("conversation_not_found")
    if conversation.user_id != user.id and conversation.owner_id != user.id:
        raise BadRequest("not_your_conversation")

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
    user: OptionalUser = None,
) -> dict[str, str]:
    """Register device web-push subscription for registered users or guest visitors."""
    from datetime import datetime, timezone
    import hashlib

    now_iso = datetime.now(timezone.utc).isoformat()

    if user is not None:
        uid = str(user.id)
        is_guest = False
    else:
        raw_hash = hashlib.md5(payload.endpoint.encode()).hexdigest()[:10]
        uid = payload.guest_id or f"guest_{raw_hash}"
        if not uid.startswith("guest_"):
            uid = f"guest_{uid}"
        is_guest = True
        _guest_push_registry[uid] = {
            "guest_id": uid,
            "user_agent": payload.user_agent,
            "created_at": _guest_push_registry.get(uid, {}).get("created_at") or now_iso,
            "last_active": now_iso,
        }

    if uid not in _user_push_subscriptions:
        _user_push_subscriptions[uid] = []

    # Avoid duplicates
    existing = [s for s in _user_push_subscriptions[uid] if s["endpoint"] == payload.endpoint]
    if not existing:
        _user_push_subscriptions[uid].append({
            "endpoint": payload.endpoint,
            "p256dh": payload.p256dh,
            "auth": payload.auth,
            "is_guest": is_guest,
            "user_agent": payload.user_agent,
            "updated_at": now_iso,
        })
    else:
        existing[0]["updated_at"] = now_iso

    return {"status": "ok", "subscriber_id": uid}


VAPID_PUBLIC_KEY = "BCZzmQm2-JRxUQrL_PWOHJh66m7va4mYFTTH17F5whUz9M72di00zBs0tPDRfQC4wr24LbeEAc8hQkC4W31KAcU"
VAPID_PRIVATE_KEY = "28-uBeeXVqCXVWqPreG_fWzISh4q6uij_rl5YuB4Oxk"
VAPID_CLAIMS = {"sub": "mailto:support@uyiz.uz"}


async def _dispatch_web_push(user_id: str, title: str, body: str, url: str, image: str | None = None) -> None:
    """Send RFC 8291/8292 encrypted web-push notification via pywebpush with VAPID."""
    subscriptions = _user_push_subscriptions.get(user_id, [])
    if not subscriptions:
        return
    import json
    import asyncio
    import structlog

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

    from pywebpush import webpush, WebPushException

    def _send_sync(sub: dict):
        endpoint = sub.get("endpoint")
        p256dh = sub.get("p256dh")
        auth = sub.get("auth")
        if not endpoint or not p256dh or not auth:
            return
        sub_info = {
            "endpoint": endpoint,
            "keys": {
                "p256dh": p256dh,
                "auth": auth,
            }
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS,
                timeout=10,
            )
            logger.info("webpush_sent_successfully", user_id=user_id, endpoint=endpoint[:30])
        except WebPushException as ex:
            logger.warning("webpush_failed", error=str(ex), status_code=getattr(ex.response, "status_code", None))
            if ex.response is not None and ex.response.status_code in (404, 410):
                if sub in subscriptions:
                    subscriptions.remove(sub)
        except Exception as e:
            logger.warning("webpush_unexpected_error", error=str(e))

    loop = asyncio.get_running_loop()
    for sub in list(subscriptions):
        await loop.run_in_executor(None, _send_sync, sub)


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

        # Seed initial friendly welcome message from support
        welcome_msg = SupportMessage(
            conversation_id=conversation.id,
            sender_type="ADMIN",
            sender_id=user.id,  # Valid user reference
            text="Assalomu alaykum! Uyiz qo'llab-quvvatlash xizmatiga xush kelibsiz. Qanday yordam bera olamiz?",
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
    return msg
