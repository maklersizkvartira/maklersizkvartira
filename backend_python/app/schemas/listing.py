"""Listing schemas.

Field names on the wire match what the React client already consumes
(``depositPrice``, ``viewsCount``, ``aiCheckStatus``), so the frontend's
``Listing`` type needs no rewrite.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import Field, computed_field, field_validator, model_validator

from app.core.config import settings
from app.models.enums import ListingStatus, PropertyType, RoommateGender
from app.schemas.common import CamelModel, ORMCamelModel

TitleStr = Annotated[str, Field(min_length=8, max_length=160)]
DescriptionStr = Annotated[str, Field(min_length=20, max_length=5000)]

#: Values a user may never reach through the public API. Everything here is
#: decided by moderation or counted by the server.
SERVER_CONTROLLED_FIELDS = {
    "status",
    "aiCheckStatus",
    "trustScore",
    "riskScore",
    "aiRiskReasons",
    "safetyBadges",
    "viewsCount",
    "favoritesCount",
    "contactCount",
    "isFeatured",
    "featuredUntil",
    "promotionWeight",
    "ownerId",
    "owner",
    "moderatedById",
    "moderationNote",
}

_CONTACT_LEAK = re.compile(
    r"(\+?998[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})|(\b\d{9}\b)"
)
_URL = re.compile(r"https?://|www\.", re.IGNORECASE)


def _validate_images(images: list[str]) -> list[str]:
    if len(images) > settings.MAX_IMAGES_PER_LISTING:
        raise ValueError("too_many_images")
    cleaned: list[str] = []
    for image in images:
        image = image.strip()
        if not image:
            continue
        if image.startswith("https://") or (
            image.startswith("data:image/") and ";base64," in image[:64]
        ):
            cleaned.append(image)
        else:
            raise ValueError("validation_error")
    return cleaned


class ListingBase(CamelModel):
    title: TitleStr
    description: DescriptionStr

    price: float = Field(gt=0, le=1_000_000_000)
    currency: Literal["UZS", "USD"] = "UZS"
    deposit_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    utilities_included: bool = False

    rooms: int = Field(ge=1, le=30)
    area: float | None = Field(default=None, gt=0, le=10_000)
    floor: int | None = Field(default=None, ge=-3, le=200)
    total_floors: int | None = Field(default=None, ge=1, le=200)
    property_type: PropertyType = PropertyType.APARTMENT

    region: str | None = Field(default=None, max_length=80)
    district: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    metro_station: str | None = Field(default=None, max_length=80)
    metro_distance_minutes: int | None = Field(default=None, ge=0, le=600)
    university_name: str | None = Field(default=None, max_length=120)
    university_distance_minutes: int | None = Field(default=None, ge=0, le=600)

    furnished: bool = False
    pets_allowed: bool = False
    parking: bool = False
    internet: bool = False
    air_conditioning: bool = False
    washing_machine: bool = False

    images: list[str] = Field(default_factory=list)
    video_url: str | None = Field(default=None, max_length=500)
    has_virtual_tour: bool = False

    is_roommate: bool = False
    roommate_gender: RoommateGender | None = None
    roommate_spots_available: int | None = Field(default=None, ge=1, le=20)

    contact_telegram: str | None = Field(default=None, max_length=64)
    preferred_contact_time: str | None = Field(default=None, max_length=64)

    @field_validator("images")
    @classmethod
    def _images(cls, v: list[str]) -> list[str]:
        return _validate_images(v)

    @field_validator("video_url")
    @classmethod
    def _video(cls, v: str | None) -> str | None:
        if not v:
            return None
        if not v.startswith("https://"):
            raise ValueError("validation_error")
        return v

    @field_validator("contact_telegram")
    @classmethod
    def _telegram(cls, v: str | None) -> str | None:
        if not v:
            return None
        handle = v.strip().lstrip("@").replace("https://t.me/", "")
        if not re.fullmatch(r"[A-Za-z0-9_]{4,32}", handle):
            raise ValueError("validation_error")
        return handle

    @field_validator("title", "description", "address")
    @classmethod
    def _no_control_chars(cls, v: str | None) -> str | None:
        if v is None:
            return None
        # Strip control characters that would break rendering or logs.
        return "".join(ch for ch in v if ch == "\n" or ch == "\t" or ch.isprintable())

    @model_validator(mode="after")
    def _cross_field(self) -> "ListingBase":
        if self.total_floors and self.floor and self.floor > self.total_floors:
            raise ValueError("validation_error")
        if self.is_roommate and self.roommate_spots_available is None:
            self.roommate_spots_available = 1
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("validation_error")
        return self


class ListingCreate(ListingBase):
    pass


class ListingUpdate(CamelModel):
    """Every field optional; only what is sent gets written."""

    title: TitleStr | None = None
    description: DescriptionStr | None = None
    price: float | None = Field(default=None, gt=0, le=1_000_000_000)
    currency: Literal["UZS", "USD"] | None = None
    deposit_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    utilities_included: bool | None = None
    rooms: int | None = Field(default=None, ge=1, le=30)
    area: float | None = Field(default=None, gt=0, le=10_000)
    floor: int | None = Field(default=None, ge=-3, le=200)
    total_floors: int | None = Field(default=None, ge=1, le=200)
    property_type: PropertyType | None = None
    region: str | None = Field(default=None, max_length=80)
    district: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    metro_station: str | None = Field(default=None, max_length=80)
    metro_distance_minutes: int | None = Field(default=None, ge=0, le=600)
    university_name: str | None = Field(default=None, max_length=120)
    university_distance_minutes: int | None = Field(default=None, ge=0, le=600)
    furnished: bool | None = None
    pets_allowed: bool | None = None
    parking: bool | None = None
    internet: bool | None = None
    air_conditioning: bool | None = None
    washing_machine: bool | None = None
    images: list[str] | None = None
    video_url: str | None = Field(default=None, max_length=500)
    has_virtual_tour: bool | None = None
    is_roommate: bool | None = None
    roommate_gender: RoommateGender | None = None
    roommate_spots_available: int | None = Field(default=None, ge=1, le=20)
    contact_telegram: str | None = Field(default=None, max_length=64)
    preferred_contact_time: str | None = Field(default=None, max_length=64)

    @field_validator("images")
    @classmethod
    def _images(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else _validate_images(v)


class OwnerOut(ORMCamelModel):
    id: uuid.UUID
    name: str
    avatar: str | None = None
    role: str
    trust_score: int
    is_verified: bool
    verification_level: int
    created_at: datetime

    #: Only ever populated for viewers allowed to see it (see listings router).
    phone: str | None = None


class ListingOut(ORMCamelModel):
    id: uuid.UUID
    title: str
    description: str
    price: float
    currency: str
    deposit_price: float | None = None
    utilities_included: bool
    rooms: int
    area: float | None = None
    floor: int | None = None
    total_floors: int | None = None
    property_type: str
    region: str | None = None
    district: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    metro_station: str | None = None
    metro_distance_minutes: int | None = None
    university_name: str | None = None
    university_distance_minutes: int | None = None
    furnished: bool
    pets_allowed: bool
    parking: bool
    internet: bool
    air_conditioning: bool
    washing_machine: bool
    images: list[str]
    video_url: str | None = None
    has_virtual_tour: bool
    is_roommate: bool
    roommate_gender: str | None = None
    roommate_spots_available: int | None = None
    contact_telegram: str | None = None
    preferred_contact_time: str | None = None

    status: str
    trust_score: int
    risk_score: int
    ai_risk_reasons: list[str]
    safety_badges: list[str]
    is_featured: bool
    promotion_weight: int

    views_count: int
    favorites_count: int
    contact_count: int
    #: How many different people opened a chat about this listing. Derived
    #: from the conversations table rather than stored on the row, so it can
    #: never drift from the threads that actually exist. Only populated on
    #: the owner's own listings; it stays 0 everywhere else.
    conversation_count: int = 0

    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None

    owner: OwnerOut

    #: Set per-request for the signed-in viewer.
    is_favorite: bool = False

    @computed_field  # type: ignore[prop-decorator]
    @property
    def ai_check_status(self) -> str:
        """Legacy alias: the client still reads ``aiCheckStatus``."""
        return self.status


class ListingFilters(CamelModel):
    search: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=80)
    district: str | None = Field(default=None, max_length=80)
    metro_station: str | None = Field(default=None, max_length=80)
    university_name: str | None = Field(default=None, max_length=120)
    rooms: int | None = Field(default=None, ge=0, le=30)
    min_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    max_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    min_area: float | None = Field(default=None, ge=0, le=10_000)
    property_type: PropertyType | None = None
    rental_type: Literal["ALL", "FULL", "ROOMMATE"] = "ALL"
    # A listing that says "girls only" is useless to a woman searching if she
    # cannot ask for it. GIRLS also matches ANY, because a room open to
    # everyone is open to her too — only BOYS-only rooms are excluded.
    roommate_gender: RoommateGender | None = None
    audience: Literal["ALL", "STUDENT", "FAMILY"] = "ALL"
    only_verified: bool = False
    min_trust_score: int = Field(default=0, ge=0, le=100)
    furnished: bool | None = None
    parking: bool | None = None
    internet: bool | None = None
    air_conditioning: bool | None = None
    washing_machine: bool | None = None
    pets_allowed: bool | None = None
    sort_by: Literal[
        "RECOMMENDED", "NEWEST", "PRICE_LOW", "PRICE_HIGH", "TRUST", "POPULAR"
    ] = "RECOMMENDED"

    @field_validator("search")
    @classmethod
    def _search(cls, v: str | None) -> str | None:
        if not v:
            return None
        cleaned = v.strip()
        # Neutralise LIKE wildcards; the query uses parameter binding, so this
        # is about predictable results rather than injection.
        return cleaned.replace("%", "").replace("_", " ") or None

    @model_validator(mode="after")
    def _price_range(self) -> "ListingFilters":
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            self.min_price, self.max_price = self.max_price, self.min_price
        return self


class ListingStatRequest(CamelModel):
    stat: Literal["views", "favorites", "contacts"]
    delta: int = Field(default=1, ge=-1, le=1)


class ListingModerationRequest(CamelModel):
    status: ListingStatus
    note: str | None = Field(default=None, max_length=1000)


class ListingFeatureRequest(CamelModel):
    is_featured: bool
    days: int = Field(default=7, ge=1, le=365)
    promotion_weight: int = Field(default=0, ge=0, le=1000)


class ReportListingRequest(CamelModel):
    reason: Literal[
        "SCAM", "BROKER", "FAKE_LISTING", "FAKE_PHOTOS", "WRONG_PRICE", "SPAM",
        "HARASSMENT", "OTHER",
    ]
    description: str = Field(default="", max_length=2000)


class ModerationResult(CamelModel):
    allowed: bool
    status: str
    trust_score: int
    risk_score: int
    reasons: list[str] = Field(default_factory=list)
    message: str | None = None
    provider: str = "rules"


class ScanListingRequest(CamelModel):
    title: str = Field(max_length=200)
    description: str = Field(default="", max_length=5000)
    price: float | None = None
    rooms: int | None = None


def listing_public_dict(listing: Any, *, viewer_can_see_phone: bool) -> dict[str, Any]:
    """Serialise a Listing ORM row, hiding the owner's phone from strangers."""
    payload = ListingOut.model_validate(listing)
    if not viewer_can_see_phone:
        payload.owner.phone = None
    return payload.model_dump(by_alias=True)
