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
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ListingStatus, PropertyType

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
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_virtual_tour: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # -- Roommate ------------------------------------------------------------
    is_roommate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    roommate_gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    roommate_spots_available: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # -- Contact -------------------------------------------------------------
    contact_telegram: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preferred_contact_time: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # -- Moderation ----------------------------------------------------------
    status: Mapped[str] = mapped_column(
        String(20), default=ListingStatus.PENDING.value, nullable=False, index=True
    )
    trust_score: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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
