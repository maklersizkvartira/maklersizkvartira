"""Chat endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select, or_

from app.core.deps import CurrentUser, DbSession
from app.core.errors import BadRequest
from app.models.chat import ChatMessage, Conversation
from app.models.listing import Listing
from app.schemas.chat import ChatMessageCreate, ChatMessageOut, ConversationDetailOut, ConversationOut

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(db: DbSession, user: CurrentUser) -> list[ConversationOut]:
    """List all conversations involving the current user."""
    stmt = (
        select(Conversation)
        .where(or_(Conversation.user_id == user.id, Conversation.owner_id == user.id))
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()
    return list(conversations)


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

    stmt = select(Conversation).where(
        Conversation.listing_id == listing_id,
        Conversation.user_id == user.id
    )
    conversation = (await db.execute(stmt)).scalar_one_or_none()

    if not conversation:
        conversation = Conversation(
            listing_id=listing_id,
            user_id=user.id,
            owner_id=listing.owner_id
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    return conversation


@router.get("/conversations/{conversation_id}/messages", response_model=ConversationDetailOut)
async def get_messages(
    conversation_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ConversationDetailOut:
    """Get all messages for a specific conversation."""
    conversation = (await db.execute(select(Conversation).where(Conversation.id == conversation_id))).scalar_one_or_none()
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
    
    # Touch conversation
    conversation.updated_at = msg.created_at # Will be set on flush, just doing db.commit is fine
    
    await db.commit()
    await db.refresh(msg)
    
    return msg
