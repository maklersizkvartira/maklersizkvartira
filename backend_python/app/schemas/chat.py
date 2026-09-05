"""Chat schemas."""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict


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


class ChatParticipantOut(BaseModel):
    """The other person in a thread, as much of them as a thread needs.

    This used to be ``UserOut``, which carries ``phone`` and ``email`` — so
    ``GET /chat/conversations`` handed both parties each other's phone number
    and email address, in the list, before a word had been said. The catalogue
    is careful about exactly this: ``_serialise`` in the listings router strips
    ``owner.phone`` for anybody who is not the owner or staff, on purpose and
    with a docstring explaining why. Starting a conversation walked around it,
    and symmetrically — the enquirer's number went to the owner too.

    A thread needs a name, a face, and whether the account is verified. It has
    never needed a phone number: the contact details live on the listing page,
    behind the gate that exists to meter them.
    """

    id: uuid.UUID
    name: str
    avatar: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ConversationOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    user_id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # We can include user/owner objects for UI convenience
    user: ChatParticipantOut | None = None
    owner: ChatParticipantOut | None = None

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


class SupportMessageCreate(BaseModel):
    text: str


class SupportMessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: str  # "USER" or "ADMIN"
    sender_id: uuid.UUID
    text: str
    read_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportUserOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    avatar: str | None = None
    role: str = "STUDENT"

    model_config = ConfigDict(from_attributes=True)


class SupportConversationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: str = "OPEN"
    created_at: datetime
    updated_at: datetime

    user: SupportUserOut | None = None
    last_message: str | None = None
    last_message_at: datetime | None = None
    last_message_sender: str | None = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class SupportConversationDetailOut(SupportConversationOut):
    messages: list[SupportMessageOut] = []

