"""Chat schemas."""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserOut


class ChatMessageCreate(BaseModel):
    text: str


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    text: str
    read_at: datetime | None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ConversationOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    user_id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    # We can include user/owner objects for UI convenience
    user: UserOut | None = None
    owner: UserOut | None = None
    
    model_config = ConfigDict(from_attributes=True)


class ConversationDetailOut(ConversationOut):
    messages: list[ChatMessageOut] = []
