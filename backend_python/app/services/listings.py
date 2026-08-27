"""Listing queries and mutations.

All filtering happens in SQL with bound parameters. Ownership is checked on
every write, so a user can only ever touch their own listings - the previous
backend had no such check on update or delete (and in fact never implemented
those routes at all).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import audit as audit_log
from app.core.config import settings
from app.core.errors import BadRequest, Forbidden, NotFound
from app.models.enums import (
    FULL_ACCESS_ROLE_VALUES,
    PUBLISHER_ROLE_VALUES,
    STAFF_ROLE_VALUES,
    AuditAction,
    ListingStatus,
    UserRole,
)
from app.models.listing import Favorite, Listing
from app.models.user import User
from app.schemas.listing import ListingFilters
from app.services.moderation import safety_badges_for, scan_listing

#: Districts whose listings students are usually looking for.
_STUDENT_DISTRICTS = {"Chilonzor", "Olmazor", "Yunusobod", "Shayxontohur", "Mirzo Ulug'bek"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def visible_clause():
    """What "publicly visible" means, for the whole application.

    Exported rather than private because the sitemap has to publish exactly
    the set of listings the site serves. When the two had their own copies of
    this, they drifted: the sitemap also excluded expired listings, which the
    catalogue and the detail page do not, so a listing a visitor could open
    was silently missing from the sitemap.

    Note that `expires_at` is deliberately NOT tested here. Nothing else in
    the product enforces it either — `Listing.is_public` does not — so adding
    it in one place only would hide live pages rather than retire them. If
    expiry is ever enforced, it belongs here, and both callers get it at once.
    """
    return and_(
        Listing.deleted_at.is_(None),
        Listing.status == ListingStatus.APPROVED.value,
    )


#: Kept for the call sites inside this module.
_visible_clause = visible_clause


def apply_filters(stmt: Select, filters: ListingFilters) -> Select:
    if filters.search:
        pattern = f"%{filters.search}%"
        stmt = stmt.where(
            or_(
                Listing.title.ilike(pattern),
                Listing.description.ilike(pattern),
                Listing.district.ilike(pattern),
                Listing.region.ilike(pattern),
                Listing.address.ilike(pattern),
                Listing.metro_station.ilike(pattern),
            )
        )
    if filters.region and filters.region != "Barchasi":
        stmt = stmt.where(Listing.region.ilike(f"%{filters.region}%"))
    if filters.district and filters.district != "Barchasi":
        stmt = stmt.where(Listing.district.ilike(f"%{filters.district}%"))
    if filters.metro_station and filters.metro_station != "Barchasi":
        stmt = stmt.where(Listing.metro_station.ilike(f"%{filters.metro_station}%"))
    if filters.university_name and filters.university_name != "Barchasi":
        stmt = stmt.where(Listing.university_name.ilike(f"%{filters.university_name}%"))
    if filters.rooms:
        stmt = stmt.where(Listing.rooms == filters.rooms)
    if filters.min_price is not None:
        stmt = stmt.where(Listing.price >= filters.min_price)
    if filters.max_price is not None:
        stmt = stmt.where(Listing.price <= filters.max_price)
    if filters.min_area is not None:
        stmt = stmt.where(Listing.area >= filters.min_area)
    if filters.property_type:
        stmt = stmt.where(Listing.property_type == filters.property_type.value)
    if filters.rental_type == "ROOMMATE":
        stmt = stmt.where(Listing.is_roommate.is_(True))
    elif filters.rental_type == "FULL":
        stmt = stmt.where(Listing.is_roommate.is_(False))
    if filters.audience == "STUDENT":
        stmt = stmt.where(
            or_(
                Listing.university_name.isnot(None),
                Listing.is_roommate.is_(True),
                Listing.district.in_(_STUDENT_DISTRICTS),
            )
        )
    elif filters.audience == "FAMILY":
        stmt = stmt.where(and_(Listing.rooms >= 2, Listing.is_roommate.is_(False)))
    if filters.only_verified:
        stmt = stmt.where(Listing.safety_badges.any("VERIFIED_OWNER"))
    if filters.min_trust_score:
        stmt = stmt.where(Listing.trust_score >= filters.min_trust_score)

    for field_name in (
        "furnished", "parking", "internet", "air_conditioning",
        "washing_machine", "pets_allowed",
    ):
        value = getattr(filters, field_name)
        if value is True:
            stmt = stmt.where(getattr(Listing, field_name).is_(True))
    return stmt


def apply_sort(stmt: Select, sort_by: str) -> Select:
    if sort_by == "PRICE_LOW":
        return stmt.order_by(Listing.price.asc(), Listing.created_at.desc())
    if sort_by == "PRICE_HIGH":
        return stmt.order_by(Listing.price.desc(), Listing.created_at.desc())
    if sort_by == "TRUST":
        return stmt.order_by(Listing.trust_score.desc(), Listing.created_at.desc())
    if sort_by == "POPULAR":
        return stmt.order_by(
            (Listing.views_count + Listing.favorites_count * 3).desc(),
            Listing.created_at.desc(),
        )
    if sort_by == "NEWEST":
        return stmt.order_by(Listing.created_at.desc())
    # RECOMMENDED: promoted first, then trust, then freshness.
    return stmt.order_by(
        Listing.is_featured.desc(),
        Listing.promotion_weight.desc(),
        Listing.trust_score.desc(),
        Listing.created_at.desc(),
    )


async def list_public(
    db: AsyncSession,
    filters: ListingFilters,
    *,
    offset: int,
    limit: int,
) -> tuple[list[Listing], int]:
    base = select(Listing).where(_visible_clause())
    base = apply_filters(base, filters)

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(base.with_only_columns(Listing.id).subquery())
            )
        ).scalar_one()
        or 0
    )

    stmt = apply_sort(base, filters.sort_by).offset(offset).limit(limit)
    rows = (await db.execute(stmt)).unique().scalars().all()
    return list(rows), total


async def list_featured(db: AsyncSession, limit: int = 8) -> list[Listing]:
    """The promoted rail on the listings page."""
    stmt = (
        select(Listing)
        .where(
            _visible_clause(),
            Listing.is_featured.is_(True),
            or_(Listing.featured_until.is_(None), Listing.featured_until > _now()),
        )
        .order_by(Listing.promotion_weight.desc(), Listing.created_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).unique().scalars().all())


async def get_public_listing(db: AsyncSession, listing_id: uuid.UUID) -> Listing:
    listing = (
        await db.execute(select(Listing).where(Listing.id == listing_id))
    ).unique().scalar_one_or_none()
    if listing is None or listing.deleted_at is not None:
        raise NotFound("listing_not_found")
    return listing


async def get_owned_listing(
    db: AsyncSession, listing_id: uuid.UUID, user: User
) -> Listing:
    listing = (
        await db.execute(select(Listing).where(Listing.id == listing_id))
    ).unique().scalar_one_or_none()
    if listing is None or listing.deleted_at is not None:
        raise NotFound("listing_not_found")
    if listing.owner_id != user.id and user.role not in FULL_ACCESS_ROLE_VALUES:
        # Same error either way, so probing ids cannot map out who owns what.
        raise Forbidden("listing_forbidden")
    return listing


async def list_for_owner(db: AsyncSession, user: User) -> list[Listing]:
    stmt = (
        select(Listing)
        .where(Listing.owner_id == user.id, Listing.deleted_at.is_(None))
        .order_by(Listing.created_at.desc())
    )
    return list((await db.execute(stmt)).unique().scalars().all())


async def create_listing(
    db: AsyncSession, *, user: User, payload: dict[str, Any]
) -> tuple[Listing, Any]:
    if user.role not in PUBLISHER_ROLE_VALUES:
        raise Forbidden("owner_role_required")

    images = payload.get("images") or []
    if len(images) > settings.MAX_IMAGES_PER_LISTING:
        raise BadRequest(
            "too_many_images", params={"limit": settings.MAX_IMAGES_PER_LISTING}
        )

    verdict = await scan_listing(
        payload.get("title", ""),
        payload.get("description", ""),
        payload.get("price"),
        payload.get("rooms"),
    )

    listing = Listing(
        **payload,
        owner_id=user.id,
        status=verdict.status
        if verdict.status in {s.value for s in ListingStatus}
        else ListingStatus.PENDING.value,
        trust_score=verdict.trust_score,
        risk_score=verdict.risk_score,
        ai_risk_reasons=verdict.reasons,
        safety_badges=safety_badges_for(verdict, user.is_verified),
        published_at=_now() if verdict.allowed else None,
    )
    db.add(listing)
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.LISTING_CREATED
        if verdict.allowed
        else AuditAction.LISTING_AI_REJECTED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{user.name} posted '{listing.title}' ({verdict.status})",
        meta={
            "status": verdict.status,
            "risk_score": verdict.risk_score,
            "provider": verdict.provider,
            "reasons": verdict.reasons[:4],
            "price": listing.price,
            "district": listing.district,
        },
    )
    return listing, verdict


async def update_listing(
    db: AsyncSession, *, listing: Listing, user: User, changes: dict[str, Any]
) -> Listing:
    before = {key: getattr(listing, key) for key in changes}
    for key, value in changes.items():
        setattr(listing, key, value)

    # Re-moderate whenever the words or the price change.
    if {"title", "description", "price"} & set(changes):
        verdict = await scan_listing(
            listing.title, listing.description, listing.price, listing.rooms
        )
        listing.status = verdict.status
        listing.trust_score = verdict.trust_score
        listing.risk_score = verdict.risk_score
        listing.ai_risk_reasons = verdict.reasons
        listing.safety_badges = safety_badges_for(verdict, user.is_verified)

    await db.flush()
    await audit_log.record(
        db,
        AuditAction.LISTING_UPDATED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{user.name} edited '{listing.title}'",
        changes=audit_log.diff(before, changes),
    )
    return listing


async def delete_listing(db: AsyncSession, *, listing: Listing, user: User) -> None:
    """Soft delete: the row survives for the audit trail and admin history."""
    listing.deleted_at = _now()
    listing.status = ListingStatus.ARCHIVED.value
    await db.flush()
    await audit_log.record(
        db,
        AuditAction.LISTING_DELETED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{user.name} deleted '{listing.title}'",
    )


async def record_stat(
    db: AsyncSession,
    *,
    listing_id: uuid.UUID,
    stat: str,
    delta: int,
    user: User | None,
) -> Listing:
    listing = await get_public_listing(db, listing_id)

    # The detail endpoint hides non-public listings from strangers; this one
    # returns the same object, so it has to apply the same rule or it becomes
    # a way to read a rejected listing by id.
    if not listing.is_public:
        is_owner = user is not None and listing.owner_id == user.id
        is_staff = user is not None and user.role in STAFF_ROLE_VALUES
        if not (is_owner or is_staff):
            raise NotFound("listing_not_found")

    if stat == "favorites":
        if user is None:
            # Anonymous favourites are not persisted; the client keeps them
            # locally until sign-in.
            raise Forbidden("unauthorized")
        await _toggle_favorite(db, listing=listing, user=user, add=delta > 0)
    elif stat == "views":
        listing.views_count += 1
        await audit_log.record(
            db,
            AuditAction.LISTING_VIEWED,
            entity_type="listing",
            entity_id=listing.id,
            entity_label=listing.title,
            severity="INFO",
        )
    elif stat == "contacts":
        listing.contact_count += 1
        await audit_log.record(
            db,
            AuditAction.LISTING_CONTACTED,
            entity_type="listing",
            entity_id=listing.id,
            entity_label=listing.title,
            summary=f"Contact revealed for '{listing.title}'",
        )
    else:
        raise BadRequest("validation_error")

    await db.flush()
    return listing


async def _toggle_favorite(
    db: AsyncSession, *, listing: Listing, user: User, add: bool
) -> None:
    existing = (
        await db.execute(
            select(Favorite).where(
                Favorite.user_id == user.id, Favorite.listing_id == listing.id
            )
        )
    ).scalar_one_or_none()

    if add and existing is None:
        db.add(Favorite(user_id=user.id, listing_id=listing.id))
        listing.favorites_count += 1
        action = AuditAction.LISTING_FAVORITED
    elif not add and existing is not None:
        await db.delete(existing)
        listing.favorites_count = max(0, listing.favorites_count - 1)
        action = AuditAction.LISTING_UNFAVORITED
    else:
        return

    await audit_log.record(
        db,
        action,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
    )


async def favorite_ids_for(db: AsyncSession, user: User | None) -> set[uuid.UUID]:
    if user is None:
        return set()
    rows = (
        await db.execute(select(Favorite.listing_id).where(Favorite.user_id == user.id))
    ).scalars().all()
    return set(rows)


async def list_favorites(db: AsyncSession, user: User) -> list[Listing]:
    stmt = (
        select(Listing)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .where(Favorite.user_id == user.id, Listing.deleted_at.is_(None))
        .order_by(Favorite.created_at.desc())
    )
    return list((await db.execute(stmt)).unique().scalars().all())


async def count_recent_by_owner(db: AsyncSession, user: User, hours: int = 1) -> int:
    since = _now() - timedelta(hours=hours)
    return int(
        (
            await db.execute(
                select(func.count())
                .select_from(Listing)
                .where(Listing.owner_id == user.id, Listing.created_at >= since)
            )
        ).scalar_one()
        or 0
    )
