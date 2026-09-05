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
from app.models.enums import (
    DealType,
    ListingStatus,
    PropertyType,
    RoommateGender,
    SellerType,
)
from app.schemas.common import CamelModel, ORMCamelModel

TitleStr = Annotated[str, Field(min_length=8, max_length=160)]
DescriptionStr = Annotated[str, Field(min_length=20, max_length=5000)]

#: Values a user may never reach through the public API. Everything here is
#: decided by an admin or counted by the server. The enforcement is
#: ``extra="forbid"`` on CamelModel; this set documents the intent.
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
    "topRequestStatus",
    "ownerId",
    "owner",
    "moderatedById",
    "moderationNote",
}

_CONTACT_LEAK = re.compile(
    r"(\+?998[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})|(\b\d{9}\b)"
)
_URL = re.compile(r"https?://|www\.", re.IGNORECASE)


def _validate_images(images: list[str], *, required: bool = False) -> list[str]:
    """Clean an image list, and optionally insist it is not empty.

    The minimum is applied to the CLEANED list, not the submitted one:
    ``["", "   "]`` collapses to nothing here, and a naive length check on the
    raw input would let a listing through with no usable photo.
    """
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
    if required and not cleaned:
        raise ValueError("image_required")
    return cleaned


#: The most a listing may ask, in so'm, by what is being offered.
#:
#: One number used to serve both, and it was the renting one: a billion so'm,
#: which is a monthly rent nobody will ever charge and about $79,000 — under
#: the price of an ordinary Tashkent flat. So the sale side shipped unable to
#: publish most of the properties it exists for, rejected at the schema with a
#: generic validation error.
#:
#: The renting cap stays where it was, because a rent above it is a typo, and
#: catching that is the only thing the cap is for. The sale cap is set high
#: enough not to be an opinion about the market — it is there to stop a
#: fat-fingered extra digit, not to decide what a property is worth.
MAX_RENT_UZS = 1_000_000_000
MAX_SALE_UZS = 100_000_000_000

class ListingBase(CamelModel):
    title: TitleStr
    description: DescriptionStr

    #: Let or sold. Defaulted rather than required so that a client written
    #: before selling existed keeps publishing rentals, which is what it meant.
    deal_type: DealType = DealType.RENT
    #: A month's rent, or the whole price of the property — `deal_type` says
    #: which, and `_cross_field` below applies the cap that goes with it. The
    #: bound here is the looser of the two, because a field constraint cannot
    #: see another field.
    price: float = Field(gt=0, le=MAX_SALE_UZS)
    currency: Literal["UZS", "USD"] = "UZS"
    deposit_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    utilities_included: bool = False

    rooms: int = Field(default=1, ge=0, le=30)
    area: float | None = Field(default=None, gt=0, le=10_000)
    #: Sotix, not m². The cap is generous on purpose — this is a rental
    #: platform, and a plot larger than a few hundred sotix is a typo rather
    #: than an estate somebody is letting by the month.
    land_area: float | None = Field(default=None, gt=0, le=1_000)
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

    #: At least one photo is mandatory. No default, so an omitted key is a 422
    #: rather than a silently empty listing.
    images: list[str] = Field(min_length=1)
    has_virtual_tour: bool = False

    is_roommate: bool = False
    roommate_gender: RoommateGender | None = None
    roommate_spots_available: int | None = Field(default=None, ge=1, le=20)

    #: Who is publishing THIS listing. Defaults to OWNER, which is what every
    #: listing filed before the field existed meant.
    seller_type: SellerType = SellerType.OWNER
    #: Shown only on an AGENT listing; ignored otherwise (see the service).
    agency_name: str | None = Field(default=None, max_length=120)

    contact_telegram: str | None = Field(default=None, max_length=64)
    preferred_contact_time: str | None = Field(default=None, max_length=64)

    @field_validator("images", mode="before")
    @classmethod
    def _images(cls, v: Any) -> Any:
        """Clean the list and insist it carries a photo.

        Runs BEFORE the ``min_length=1`` constraint on purpose. Pydantic's own
        length message is not one of the translated codes, so an empty list
        came back as the generic "validation_error" while a list of blanks got
        the photo-specific one - the same mistake answered two different ways,
        and the wrong answer for the shape a client actually sends when the
        owner removed every photo. Anything that is not a list of strings is
        handed straight on for the core validator to reject in its own words.
        """
        if not isinstance(v, list) or any(not isinstance(item, str) for item in v):
            return v
        return _validate_images(v, required=True)

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
        # The cap that matches what is being offered. Only in so'm: a price in
        # dollars is three or four orders of magnitude smaller and any bound
        # loose enough for one currency is meaningless for the other.
        if self.currency == "UZS" and self.deal_type != DealType.SALE:
            if self.price > MAX_RENT_UZS:
                raise ValueError("price_too_high_for_rent")
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
    deal_type: DealType | None = None
    price: float | None = Field(default=None, gt=0, le=MAX_SALE_UZS)
    currency: Literal["UZS", "USD"] | None = None
    deposit_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    utilities_included: bool | None = None
    rooms: int | None = Field(default=None, ge=1, le=30)
    area: float | None = Field(default=None, gt=0, le=10_000)
    #: Sotix, not m². The cap is generous on purpose — this is a rental
    #: platform, and a plot larger than a few hundred sotix is a typo rather
    #: than an estate somebody is letting by the month.
    land_area: float | None = Field(default=None, gt=0, le=1_000)
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
    has_virtual_tour: bool | None = None
    is_roommate: bool | None = None
    roommate_gender: RoommateGender | None = None
    roommate_spots_available: int | None = Field(default=None, ge=1, le=20)
    seller_type: SellerType | None = None
    agency_name: str | None = Field(default=None, max_length=120)
    contact_telegram: str | None = Field(default=None, max_length=64)
    preferred_contact_time: str | None = Field(default=None, max_length=64)

    @field_validator("images")
    @classmethod
    def _images(cls, v: list[str] | None) -> list[str] | None:
        # None means "the field was not sent". A sent value still has to carry
        # a photo, or an edit would be a way around the one-photo rule.
        return None if v is None else _validate_images(v, required=True)


class OwnerOut(ORMCamelModel):
    id: uuid.UUID
    name: str
    avatar: str | None = None
    role: str
    agency_name: str | None = None
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
    deal_type: str = DealType.RENT.value
    price: float
    currency: str
    deposit_price: float | None = None
    utilities_included: bool
    rooms: int
    area: float | None = None
    land_area: float | None = None
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
    has_virtual_tour: bool
    is_roommate: bool
    roommate_gender: str | None = None
    roommate_spots_available: int | None = None
    seller_type: str = SellerType.OWNER.value
    agency_name: str | None = None
    contact_telegram: str | None = None
    preferred_contact_time: str | None = None

    status: str
    trust_score: int
    risk_score: int
    ai_risk_reasons: list[str]
    safety_badges: list[str]
    is_featured: bool
    #: When the current promotion runs out. Read this rather than
    #: ``is_featured``: the boolean is never cleared when the date passes.
    featured_until: datetime | None = None
    promotion_weight: int
    #: The owner's own view of their latest Top request: "PENDING",
    #: "APPROVED", "REJECTED" or None. Filled per-request and only for the
    #: owner or staff - a stranger browsing has no business knowing that
    #: someone else's promotion is waiting for review.
    top_request_status: str | None = None
    #: Why an administrator actioned this listing, in their own words. With the
    #: publish-time scanner gone this is the owner's ONLY explanation of a
    #: warning or a takedown, so it has to travel on the row - but it is a
    #: moderator's note, and ``_serialise`` strips it for anyone who is not the
    #: owner or staff.
    moderation_note: str | None = None

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
        """Deprecated alias of ``status``, kept because the client still reads
        ``aiCheckStatus``. It never carried a verdict of its own, and there is
        no automated check behind the name any more."""
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
    #: Defaults to RENT, and that default is load-bearing. Rentals and sales
    #: cannot share a result list — a monthly rent and a purchase price differ
    #: by three orders of magnitude, so one of them is always either invisible
    #: or the only thing visible under any price filter. Every page that
    #: existed before selling did, every prerendered SEO page and every stale
    #: bundle still in somebody's browser asks for rentals without saying so,
    #: and this keeps all of them right. ALL exists for callers that genuinely
    #: want both and know what that means.
    deal_type: Literal["RENT", "SALE", "ALL"] = "RENT"
    rental_type: Literal["ALL", "FULL", "ROOMMATE"] = "ALL"
    # A listing that says "girls only" is useless to a woman searching if she
    # cannot ask for it. GIRLS also matches ANY, because a room open to
    # everyone is open to her too — only BOYS-only rooms are excluded.
    roommate_gender: RoommateGender | None = None
    audience: Literal["ALL", "STUDENT", "FAMILY"] = "ALL"
    #: "Direct from the owner", the thing the platform was built on, is only a
    #: promise it can keep if a searcher can ask for it — now that agents may
    #: publish here too.
    seller_type: SellerType | None = None
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


class TopRequestCreate(CamelModel):
    """What the owner sends when they press "Top".

    The bounds match ``ListingFeatureRequest.days`` exactly, so a request can
    never ask for something the approval path is unable to grant.
    """

    days: int = Field(default=7, ge=1, le=365)
    note: str | None = Field(default=None, max_length=500)


class TopRequestOut(ORMCamelModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    status: str
    requested_days: int
    note: str | None = None
    rejection_reason: str | None = None
    granted_until: datetime | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class ReportListingRequest(CamelModel):
    #: "BROKER" is no longer offered in the complaint picker - agents are
    #: welcome now - but it is still accepted so a cached older bundle does
    #: not get a 422 on a complaint someone actually meant to file.
    reason: Literal[
        "SCAM", "BROKER", "FAKE_LISTING", "FAKE_PHOTOS", "WRONG_PRICE", "SPAM",
        "HARASSMENT", "OTHER",
    ]
    description: str = Field(default="", max_length=2000)


def listing_public_dict(listing: Any, *, viewer_can_see_phone: bool) -> dict[str, Any]:
    """Serialise a Listing ORM row, hiding the owner's phone from strangers."""
    payload = ListingOut.model_validate(listing)
    if not viewer_can_see_phone:
        payload.owner.phone = None
    return payload.model_dump(by_alias=True)
