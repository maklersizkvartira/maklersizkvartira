"""Listings and user favorites."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ListingStatus, PropertyType, SellerType, TopRequestStatus

if TYPE_CHECKING:
    from app.models.moderation import Report
    from app.models.user import User


class Listing(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "listings"

    # -- Content -------------------------------------------------------------
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # -- Pricing -------------------------------------------------------------
    price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="UZS", nullable=False)
    deposit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    utilities_included: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # -- Property ------------------------------------------------------------
    rooms: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    area: Mapped[float | None] = mapped_column(Float, nullable=True)
    #: Plot size in sotix (1 sotix = 100 m²), for houses, land and commercial
    #: property. Separate from `area`, which is the building: a cottage has
    #: both, and a bare plot has only this one.
    land_area: Mapped[float | None] = mapped_column(Float, nullable=True)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    property_type: Mapped[str] = mapped_column(
        String(20), default=PropertyType.APARTMENT.value, nullable=False
    )

    # -- Location ------------------------------------------------------------
    region: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    metro_station: Mapped[str | None] = mapped_column(String(80), nullable=True)
    metro_distance_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    university_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    university_distance_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # -- Amenities -----------------------------------------------------------
    furnished: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pets_allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    parking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    internet: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    air_conditioning: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    washing_machine: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # -- Media ---------------------------------------------------------------
    images: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default="{}", nullable=False
    )
    #: Retired. Video was removed from the product: no schema accepts it, no
    #: endpoint serves it and nothing writes it any more. The column is kept
    #: dormant on purpose - dropping it in the same release as the API change
    #: would make an application rollback impossible, because rolled-back code
    #: still names the column in every listing SELECT.
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_virtual_tour: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # -- Roommate ------------------------------------------------------------
    is_roommate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    roommate_gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    roommate_spots_available: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # -- Who is publishing ----------------------------------------------------
    #: OWNER or AGENT, chosen per listing rather than read off the account —
    #: see :class:`app.models.enums.SellerType`. Indexed because it is a facet
    #: a searcher filters on ("only from owners"), not merely a badge.
    seller_type: Mapped[str] = mapped_column(
        String(10), default=SellerType.OWNER.value, nullable=False, index=True
    )
    #: Snapshot of the agency at the moment of publishing. Denormalised on
    #: purpose: an agent who later changes agencies must not silently rewrite
    #: who every flat they ever listed was represented by.
    agency_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # -- Contact -------------------------------------------------------------
    contact_telegram: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preferred_contact_time: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # -- Reliability and moderation ------------------------------------------
    #: The default stays PENDING even though ``create_listing`` publishes at
    #: APPROVED: a column default that publishes would be a footgun for any
    #: future code path that inserts a Listing without going through the
    #: service.
    status: Mapped[str] = mapped_column(
        String(20), default=ListingStatus.PENDING.value, nullable=False, index=True
    )
    #: The public "ishonchlilik foizi". A listing starts at full reliability
    #: and is only ever recomputed downwards from the reports an admin has
    #: CONFIRMED - see ``admin_service.recompute_trust_score``.
    trust_score: Mapped[int] = mapped_column(
        Integer, default=100, server_default="100", nullable=False
    )
    #: Derived, never independent: always maintained as ``100 - trust_score``.
    #: Kept because the admin queue's filter and its "most complained about
    #: first" sort are built on it.
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    #: The confirmed-complaint ledger. Written only by the report-confirmation
    #: helper; nothing automated puts anything here any more. The column name
    #: is historical and kept so the wire shape does not move.
    ai_risk_reasons: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default="{}", nullable=False
    )
    safety_badges: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default="{}", nullable=False
    )
    moderated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    moderated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # -- Promotion (the "reklama" surface on the listings page) --------------
    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    featured_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Higher sorts first inside the promoted rail.
    promotion_weight: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # -- Counters ------------------------------------------------------------
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    favorites_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    contact_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # -- Ownership -----------------------------------------------------------
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner: Mapped["User"] = relationship(back_populates="listings", lazy="joined")

    favorited_by: Mapped[list["Favorite"]] = relationship(
        back_populates="listing", cascade="all, delete-orphan", passive_deletes=True
    )
    reports: Mapped[list["Report"]] = relationship(
        back_populates="listing", cascade="all, delete-orphan", passive_deletes=True
    )
    # Deliberately lazy. The catalogue loads pages of listings, and a joined
    # promotion table would multiply every row of every /listings response.
    top_requests: Mapped[list["TopRequest"]] = relationship(
        back_populates="listing", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint("price >= 0", name="price_non_negative"),
        CheckConstraint("rooms >= 0 AND rooms <= 30", name="rooms_sane"),
        CheckConstraint(
            "trust_score >= 0 AND trust_score <= 100", name="trust_score_range"
        ),
        CheckConstraint("risk_score >= 0 AND risk_score <= 100", name="risk_score_range"),
        CheckConstraint("views_count >= 0", name="views_non_negative"),
        CheckConstraint("favorites_count >= 0", name="favorites_non_negative"),
        CheckConstraint("contact_count >= 0", name="contacts_non_negative"),
        Index("ix_listings_status_created", "status", "created_at"),
        Index("ix_listings_district_price", "district", "price"),
        Index("ix_listings_featured_weight", "is_featured", "promotion_weight"),
    )

    @property
    def is_public(self) -> bool:
        return (
            self.status == ListingStatus.APPROVED.value
            and self.deleted_at is None
        )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Listing {self.id} {self.title[:24]!r} {self.status}>"


class Favorite(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Server-side favorites.

    Previously kept only in browser memory, so they vanished on reload and
    were invisible to the admin panel.
    """

    __tablename__ = "favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="favorites")
    listing: Mapped["Listing"] = relationship(back_populates="favorited_by")

    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_favorites_user_listing"),
        Index("ix_favorites_user", "user_id"),
    )


class TopRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An owner asking for the promoted ("Top") rail.

    The request is the CAUSE; ``Listing.is_featured`` / ``featured_until`` /
    ``promotion_weight`` are the EFFECT an admin approval writes. Nothing is
    promoted the moment the owner presses the button - that is the whole point
    of the feature.

    Kept as its own table rather than columns on ``listings`` because a
    rejection has to keep its reason, its reviewer and its timestamp, and a
    re-request after a rejection would overwrite all three if they lived on
    the listing row. It also leaves ``PATCH /admin/listings/{id}/feature``
    free to promote a listing with no request behind it.
    """

    __tablename__ = "top_requests"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Days of promotion asked for; the admin may override it on approval.
    requested_days: Mapped[int] = mapped_column(
        Integer, default=7, server_default="7", nullable=False
    )
    #: Free text from the owner.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(12),
        default=TopRequestStatus.PENDING.value,
        server_default=TopRequestStatus.PENDING.value,
        nullable=False,
        index=True,
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: What the approval actually granted, so the decision stays auditable
    #: after the listing's own promotion columns have moved on.
    granted_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    granted_weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    granted_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    listing: Mapped["Listing"] = relationship(back_populates="top_requests")
    requested_by: Mapped["User | None"] = relationship(foreign_keys=[requested_by_id])

    __table_args__ = (
        CheckConstraint(
            "requested_days >= 1 AND requested_days <= 365", name="top_days_sane"
        ),
        Index("ix_top_requests_status_created", "status", "created_at"),
        # One live request per listing: the owner cannot queue five, and two
        # moderators cannot grant two pending rows for the same listing with
        # the second silently overwriting the first.
        Index(
            "uq_top_requests_listing_pending",
            "listing_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<TopRequest {self.id} listing={self.listing_id} {self.status}>"
