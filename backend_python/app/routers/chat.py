"""Chat endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession
from app.core.errors import BadRequest
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
        conversation = Conversation(
            listing_id=listing_id,
            user_id=user.id,
            owner_id=listing.owner_id
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        # For a new conversation, messages is implicitly empty, but SQLAlchemy might not know that
        # unless we populate it or re-fetch it. Let's just set it to [] to prevent lazy load errors.
        conversation.messages = []

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
    
    return msg

from pydantic import BaseModel

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
