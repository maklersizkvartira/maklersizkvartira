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


class ListingBriefOut(BaseModel):
    """Just enough of a listing to say which one a conversation is about.

    Deliberately without photos. Listing images are stored as base64 ``data:``
    URIs, so a cover on twenty conversation rows would be tens of megabytes on
    a page that only needs to say "this is the Chilonzor flat". The thread
    header loads the one listing it is showing and can afford the picture.
    """

    id: uuid.UUID
    title: str
    district: str | None = None
    region: str | None = None
    rooms: int | None = None
    price: float | None = None
    currency: str | None = None
    status: str | None = None

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

    #: Which listing the two of them are talking about. Without it the list is
    #: a row of names, and an owner with several listings cannot tell which
    #: apartment a message is about without opening the thread.
    listing: ListingBriefOut | None = None

    #: Set per-request, per-viewer, so the list can be read at a glance.
    last_message: str | None = None
    last_message_at: datetime | None = None
    last_message_is_mine: bool = False
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailOut(ConversationOut):
    messages: list[ChatMessageOut] = []
