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

from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit as audit_log
from app.core.config import settings
from app.core.errors import BadRequest, Conflict, Forbidden, NotFound
from app.models.enums import (
    FULL_ACCESS_ROLE_VALUES,
    PUBLISHER_ROLE_VALUES,
    STAFF_ROLE_VALUES,
    AuditAction,
    DealType,
    ListingStatus,
    RoommateGender,
    SellerType,
    TopRequestStatus,
    UserRole,
)
from app.models.listing import Favorite, Listing, TopRequest
from app.models.user import User
from app.schemas.listing import ListingFilters
from app.services import fx

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


def price_in_uzs(rate: float):
    """The listing's price expressed in so'm, whatever it was quoted in.

    Everything that COMPARES prices has to go through this, because the
    `price` column holds two different units: 500 in it may mean 500 dollars
    or 500 so'm, and the currency lives in a second column. Compared raw, a
    $500 flat is a four-figure number sitting next to seven-figure ones — so
    it fell outside every so'm price filter a searcher could set, and sorted
    to the top of "cheapest first" ahead of every listing that really was
    cheaper.

    Computed in SQL from the current rate rather than stored in a column. A
    stored figure would need a migration, would have to be rewritten for every
    USD listing each time the rate moved, and would be quietly wrong in
    between. This is always today's rate, and at this catalogue's size the
    unindexed expression costs nothing measurable.

    Note what this deliberately does NOT do: it never changes what is shown.
    A price quoted in dollars is displayed in dollars; this exists so the two
    can be ranked against each other.
    """
    return case((Listing.currency == "USD", Listing.price * rate), else_=Listing.price)


def apply_filters(stmt: Select, filters: ListingFilters, rate: float) -> Select:
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
    # The bounds arrive in so'm — that is what the price slider is labelled in
    # — so the listing has to be brought into so'm to be compared with them.
    if filters.min_price is not None:
        stmt = stmt.where(price_in_uzs(rate) >= filters.min_price)
    if filters.max_price is not None:
        stmt = stmt.where(price_in_uzs(rate) <= filters.max_price)
    if filters.min_area is not None:
        stmt = stmt.where(Listing.area >= filters.min_area)
    if filters.property_type:
        stmt = stmt.where(Listing.property_type == filters.property_type.value)
    # Before anything else that touches money: a price range is a range of
    # monthly rents or a range of purchase prices, never both, and every filter
    # below reads differently on the other side of this line.
    if filters.deal_type != "ALL":
        stmt = stmt.where(Listing.deal_type == filters.deal_type)
    if filters.rental_type == "ROOMMATE":
        stmt = stmt.where(Listing.is_roommate.is_(True))
    elif filters.rental_type == "FULL":
        stmt = stmt.where(Listing.is_roommate.is_(False))
    if filters.roommate_gender and filters.roommate_gender != RoommateGender.ANY:
        # An owner who left the field empty meant "anyone", so NULL belongs in
        # the same bucket as ANY. But NULL is also what every listing that is
        # not a roommate offer at all carries, so the NULL arm only makes sense
        # once the row is known to be a roommate offer: without is_roommate the
        # filter excluded BOYS-only rooms and passed the entire rest of the
        # catalogue, which reads as no filter at all.
        stmt = stmt.where(
            Listing.is_roommate.is_(True),
            or_(
                Listing.roommate_gender == filters.roommate_gender.value,
                Listing.roommate_gender == RoommateGender.ANY.value,
                Listing.roommate_gender.is_(None),
            ),
        )
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
    if filters.seller_type:
        stmt = stmt.where(Listing.seller_type == filters.seller_type.value)
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


def apply_sort(stmt: Select, sort_by: str, rate: float) -> Select:
    if sort_by == "PRICE_LOW":
        return stmt.order_by(price_in_uzs(rate).asc(), Listing.created_at.desc())
    if sort_by == "PRICE_HIGH":
        return stmt.order_by(price_in_uzs(rate).desc(), Listing.created_at.desc())
    if sort_by == "TRUST":
        return stmt.order_by(Listing.trust_score.desc(), Listing.created_at.desc())
    if sort_by == "POPULAR":
        return stmt.order_by(
            (Listing.views_count + Listing.favorites_count * 3).desc(),
            Listing.created_at.desc(),
        )
    if sort_by == "NEWEST":
        return stmt.order_by(Listing.created_at.desc())
    # RECOMMENDED: promoted first, then reliability, then freshness.
    #
    # The promotion arm tests the DATE, not just the boolean. Nothing clears
    # `is_featured` when `featured_until` passes, so sorting on the flag alone
    # would let every listing ever promoted outrank the whole catalogue for
    # ever - which is exactly the rule `list_featured` already applies to the
    # rail. Now that owners can ask for Top, the two have to agree.
    live_top = and_(
        Listing.is_featured.is_(True),
        or_(Listing.featured_until.is_(None), Listing.featured_until > _now()),
    )
    return stmt.order_by(
        live_top.desc(),
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
    # Fetched once per query, and cached for an hour inside the service — so
    # this is a dictionary lookup, not a call to the Central Bank per request.
    rate = await fx.usd_to_uzs()
    base = select(Listing).where(_visible_clause())
    base = apply_filters(base, filters, rate)

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(base.with_only_columns(Listing.id).subquery())
            )
        ).scalar_one()
        or 0
    )

    stmt = apply_sort(base, filters.sort_by, rate).offset(offset).limit(limit)
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


def _normalise_seller(
    payload: dict[str, Any], user: User, *, current: str | None = None
) -> None:
    """Settle who a listing says it comes from, in one place.

    The form is trusted for the choice itself — an agent may own a flat, and an
    owner represents nobody — but not for the claim behind it: only an AGENT
    account may publish as an agent, and an agency name is meaningless on a
    listing that is not one. Create and edit both come through here, so an edit
    cannot smuggle in what a create would have refused.

    ``current`` is the listing's existing seller type on an edit. Without it,
    changing only the agency name on an agent's listing would read as "no
    seller type given" and wipe the agency it was just given.
    """
    requested = payload.get("seller_type")
    requested = getattr(requested, "value", requested) or current or SellerType.OWNER.value
    if requested == SellerType.AGENT.value and user.role != UserRole.AGENT.value:
        requested = SellerType.OWNER.value
    if "seller_type" in payload:
        payload["seller_type"] = requested

    # Only rewrite the agency when this call is about the seller at all;
    # otherwise an unrelated edit (a price, a photo) would clear it.
    if "agency_name" in payload or "seller_type" in payload:
        if requested == SellerType.AGENT.value:
            agency = (payload.get("agency_name") or user.agency_name or "").strip()
            payload["agency_name"] = agency[:120] or None
        else:
            payload["agency_name"] = None


def _normalise_deal(payload: dict[str, Any], *, listing: Listing | None = None) -> None:
    """Strip the renting-only fields off a listing that is being sold.

    A deposit, a utilities-included flag and a roommate offer are all answers
    to questions a sale never asks. The form hides them once "for sale" is
    chosen, but a form is not a rule: a listing edited from rent to sale would
    otherwise keep the deposit it had, and the detail page would render "sale
    price 600,000,000 so'm, deposit 3,000,000 so'm" — which is not a thing.

    Cleared here rather than rejected, because none of it is the person's
    mistake. They switched the deal type; the leftovers are ours to tidy.

    ``listing`` is the row being edited, if there is one. It supplies the deal
    type an edit did not mention, and it is also what keeps this from writing
    four fields on every unrelated edit to a sale listing: a field that is
    already empty is left out of the payload entirely, so the audit log records
    what somebody changed rather than what was checked.
    """
    requested = payload.get("deal_type")
    requested = (
        getattr(requested, "value", requested)
        or (listing.deal_type if listing is not None else None)
        or DealType.RENT.value
    )
    if "deal_type" in payload:
        payload["deal_type"] = requested
    if requested != DealType.SALE.value:
        return

    for field, empty in (
        ("deposit_price", None),
        ("utilities_included", False),
        ("is_roommate", False),
        ("roommate_gender", None),
    ):
        already_empty = listing is not None and getattr(listing, field) == empty
        if already_empty and field not in payload:
            continue
        payload[field] = empty


async def create_listing(
    db: AsyncSession, *, user: User, payload: dict[str, Any]
) -> Listing:
    """Publish a listing. There is no automated check on the way in.

    A listing goes live the moment it is posted: APPROVED, published, and at
    full reliability. Nothing judges the wording, and nothing can hold the
    listing back except an admin acting on a confirmed complaint afterwards.
    The volume guards (the hourly limiter in the router and the durable
    per-owner count) are untouched.
    """
    if user.role not in PUBLISHER_ROLE_VALUES:
        raise Forbidden("owner_role_required")

    images = payload.get("images") or []
    if len(images) > settings.MAX_IMAGES_PER_LISTING:
        raise BadRequest(
            "too_many_images", params={"limit": settings.MAX_IMAGES_PER_LISTING}
        )

    _normalise_seller(payload, user)
    payload.setdefault("seller_type", SellerType.OWNER.value)
    payload.setdefault("deal_type", DealType.RENT.value)
    _normalise_deal(payload)

    listing = Listing(
        **payload,
        owner_id=user.id,
        status=ListingStatus.APPROVED.value,
        trust_score=100,
        risk_score=0,
        ai_risk_reasons=[],
        # VERIFIED_OWNER is the only badge with behaviour behind it: it backs
        # the "only verified" catalogue filter in apply_filters.
        safety_badges=["VERIFIED_OWNER"] if user.is_verified else [],
        published_at=_now(),
    )
    db.add(listing)
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.LISTING_CREATED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{user.name} posted '{listing.title}'",
        meta={
            "price": listing.price,
            "district": listing.district,
            "rooms": listing.rooms,
            "images": len(listing.images),
        },
    )
    return listing


async def update_listing(
    db: AsyncSession, *, listing: Listing, user: User, changes: dict[str, Any]
) -> Listing:
    """Apply an owner's edit. Content only.

    An edit must never touch `status` or `trust_score`. Correcting a typo or
    lowering a price used to re-score the listing, which could take a live
    listing off the site without telling anyone - and would now also erase a
    penalty an admin had deliberately applied. The reliability percentage has
    exactly one writer: the confirmed-report recompute.
    """
    # The same rule as on the way in: an edit is not a back door to a claim
    # the account cannot make. `listing.owner`, not `user` — a moderator
    # fixing a typo must not turn an agent's listing into an owner's.
    if "seller_type" in changes or "agency_name" in changes:
        _normalise_seller(changes, listing.owner or user, current=listing.seller_type)
    # Unconditional, unlike the seller rules above: an edit that only raises
    # the deposit on a listing that is already for sale has to be cleaned too,
    # and that edit never mentions the deal type.
    _normalise_deal(changes, listing=listing)

    before = {key: getattr(listing, key) for key in changes}
    for key, value in changes.items():
        setattr(listing, key, value)

    # Badges are derived from who the OWNER is, never from a verdict, so an
    # owner who verified after publishing gains VERIFIED_OWNER (and with it
    # the "only verified" catalogue filter) on their next edit. Read off the
    # listing's owner rather than the editor, because a full-access role may
    # be editing somebody else's listing.
    owner = listing.owner
    listing.safety_badges = (
        ["VERIFIED_OWNER"] if owner is not None and owner.is_verified else []
    )

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


async def conversation_counts(
    db: AsyncSession, listing_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """How many people opened a chat about each listing.

    One grouped query for the whole page. Counting per listing in a loop is
    the same answer and N round trips, which on an owner with twenty listings
    is the difference between a page that loads and one that does not.
    """
    if not listing_ids:
        return {}
    from app.models.chat import Conversation

    rows = (
        await db.execute(
            select(Conversation.listing_id, func.count(Conversation.id))
            .where(Conversation.listing_id.in_(listing_ids))
            .group_by(Conversation.listing_id)
        )
    ).all()
    return {listing_id: int(count) for listing_id, count in rows}


async def request_top(
    db: AsyncSession, *, listing: Listing, user: User, days: int, note: str | None
) -> TopRequest:
    """Queue a Top request. Nothing is promoted until an admin approves it.

    The explicit pending check duplicates what the partial unique index
    enforces, and both are wanted: the index is the race guard between two
    concurrent posts, the check is the readable 409 the owner actually sees.
    Without the check a race surfaces as an IntegrityError 500.
    """
    if not listing.is_public:
        raise BadRequest("top_listing_not_public")

    existing = (
        await db.execute(
            select(TopRequest).where(
                TopRequest.listing_id == listing.id,
                TopRequest.status == TopRequestStatus.PENDING.value,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise Conflict("top_request_pending")

    request = TopRequest(
        listing_id=listing.id,
        requested_by_id=user.id,
        requested_days=days,
        note=note,
    )
    db.add(request)
    await db.flush()

    await audit_log.record(
        db,
        AuditAction.LISTING_TOP_REQUESTED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{user.name} requested Top for '{listing.title}'",
        # The requester is recorded because a full-access role may file a
        # request against a listing they do not own, exactly as they may edit
        # or delete one.
        meta={
            "days": days,
            "request_id": str(request.id),
            "requested_by": str(user.id),
        },
    )
    return request


async def top_status_for(
    db: AsyncSession, listing_ids: list[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """The latest Top-request status per listing, one query for the page.

    Same reasoning as ``conversation_counts``: asking per listing in a loop is
    the same answer and N round trips.
    """
    if not listing_ids:
        return {}
    newest = (
        select(
            TopRequest.listing_id,
            TopRequest.status,
            func.row_number()
            .over(
                partition_by=TopRequest.listing_id,
                order_by=TopRequest.created_at.desc(),
            )
            .label("rn"),
        )
        .where(TopRequest.listing_id.in_(listing_ids))
        .subquery()
    )
    rows = (
        await db.execute(
            select(newest.c.listing_id, newest.c.status).where(newest.c.rn == 1)
        )
    ).all()
    return {listing_id: status for listing_id, status in rows}


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
