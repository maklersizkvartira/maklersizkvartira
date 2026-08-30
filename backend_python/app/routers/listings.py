"""Public and owner-facing listing endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, Lang, OptionalUser, RequestCtx
from app.core.errors import BadRequest, TooManyRequests
from app.core.rate_limit import enforce
from app.models.enums import STAFF_ROLE_VALUES, UserRole
from app.schemas.common import MessageResponse, PaginationParams, build_page_meta
from app.schemas.listing import (
    ListingCreate,
    ListingFilters,
    ListingOut,
    ListingStatRequest,
    ListingUpdate,
    ReportListingRequest,
    TopRequestCreate,
    TopRequestOut,
)
from app.services import listings as listing_service

router = APIRouter(prefix="/listings", tags=["listings"])

#: DEPRECATED. Publication runs no automated check, so there is no verdict to
#: report - but a browser holding a cached older bundle still reads
#: ``response.moderation.allowed`` after a successful publish, and reads
#: ``aiAnalysis`` from ``POST /listings/scan``. Both keep answering this
#: constant "everything is fine" for one release so those clients do not throw
#: on a listing that was in fact created. Remove once the old bundles age out.
_DEPRECATED_MODERATION_OK = {
    "allowed": True,
    "status": "APPROVED",
    "trustScore": 100,
    "riskScore": 0,
    "reasons": [],
    "message": None,
    "provider": "none",
}


def _serialise(
    listing,
    *,
    viewer,
    favorite_ids: set[uuid.UUID] | None = None,
    conversation_counts: dict[uuid.UUID, int] | None = None,
    top_statuses: dict[uuid.UUID, str] | None = None,
) -> dict:
    """Render a listing, exposing the owner's phone only where appropriate.

    A stranger browsing the catalogue does not need the owner's number; it is
    revealed to the owner themselves, to staff, and to any signed-in user who
    opens the detail page (which is also the moment a contact is counted).
    """
    payload = ListingOut.model_validate(listing)
    is_owner = viewer is not None and listing.owner_id == viewer.id
    is_staff = viewer is not None and viewer.role in STAFF_ROLE_VALUES
    if not (is_owner or is_staff):
        payload.owner.phone = None
        # A moderator's note is written for the publisher, not the catalogue.
        payload.moderation_note = None
    if favorite_ids is not None:
        payload.is_favorite = listing.id in favorite_ids
    if conversation_counts is not None:
        payload.conversation_count = conversation_counts.get(listing.id, 0)
    # A pending Top request is the owner's own business, not the catalogue's.
    if top_statuses is not None and (is_owner or is_staff):
        payload.top_request_status = top_statuses.get(listing.id)
    return payload.model_dump(by_alias=True)


# ---------------------------------------------------------------------------
# Browse
# ---------------------------------------------------------------------------
@router.get("", summary="Browse approved listings")
@router.get("/", include_in_schema=False)
async def list_listings(
    db: DbSession,
    viewer: OptionalUser,
    filters: ListingFilters = Depends(),
    pagination: PaginationParams = Depends(),
) -> dict:
    rows, total = await listing_service.list_public(
        db, filters, offset=pagination.offset, limit=pagination.page_size
    )
    favorite_ids = await listing_service.favorite_ids_for(db, viewer)
    return {
        "status": "success",
        "totalCount": total,
        "data": [_serialise(r, viewer=viewer, favorite_ids=favorite_ids) for r in rows],
        "meta": build_page_meta(pagination.page, pagination.page_size, total).model_dump(
            by_alias=True
        ),
    }


@router.get("/featured", summary="Promoted listings for the advert rail")
async def featured(
    db: DbSession,
    viewer: OptionalUser,
    limit: int = Query(default=8, ge=1, le=24),
) -> dict:
    rows = await listing_service.list_featured(db, limit=limit)
    favorite_ids = await listing_service.favorite_ids_for(db, viewer)
    return {
        "status": "success",
        "data": [_serialise(r, viewer=viewer, favorite_ids=favorite_ids) for r in rows],
    }


@router.get("/my", summary="Listings owned by the signed-in user")
async def my_listings(db: DbSession, user: CurrentUser) -> dict:
    rows = await listing_service.list_for_owner(db, user)
    # The owner's page is the only place these two are shown, so it is the
    # only place worth the extra queries. Both are one query for the whole
    # page, never one per listing.
    listing_ids = [r.id for r in rows]
    chats = await listing_service.conversation_counts(db, listing_ids)
    tops = await listing_service.top_status_for(db, listing_ids)
    return {
        "status": "success",
        "data": [
            _serialise(r, viewer=user, conversation_counts=chats, top_statuses=tops)
            for r in rows
        ],
    }


@router.get("/favorites", summary="The signed-in user's saved listings")
async def favorites(db: DbSession, user: CurrentUser) -> dict:
    rows = await listing_service.list_favorites(db, user)
    favorite_ids = {r.id for r in rows}
    return {
        "status": "success",
        "data": [_serialise(r, viewer=user, favorite_ids=favorite_ids) for r in rows],
    }


@router.get("/{listing_id}", summary="One listing")
async def get_listing(listing_id: uuid.UUID, db: DbSession, viewer: OptionalUser) -> dict:
    listing = await listing_service.get_public_listing(db, listing_id)
    is_owner = viewer is not None and listing.owner_id == viewer.id
    is_staff = viewer is not None and viewer.role in STAFF_ROLE_VALUES
    # A listing an admin took down stays visible to its owner and to staff, so
    # the owner can see what happened to it.
    if not listing.is_public and not (is_owner or is_staff):
        raise BadRequest("listing_not_found", status_code=status.HTTP_404_NOT_FOUND)

    favorite_ids = await listing_service.favorite_ids_for(db, viewer)
    payload = ListingOut.model_validate(listing)
    if not (is_owner or is_staff):
        payload.owner.phone = None
        # A moderator's note is written for the publisher, not the catalogue.
        payload.moderation_note = None
    else:
        # This endpoint builds its payload inline rather than through
        # _serialise, so the owner-or-staff gate on the Top state is repeated
        # here. Both surfaces must agree or the detail page shows no pending
        # state while the owner's list does.
        tops = await listing_service.top_status_for(db, [listing.id])
        payload.top_request_status = tops.get(listing.id)
    payload.is_favorite = listing.id in favorite_ids
    return {"status": "success", "data": payload.model_dump(by_alias=True)}


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED, summary="Publish a listing")
@router.post("/", include_in_schema=False, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreate, db: DbSession, user: CurrentUser, ctx: RequestCtx
) -> dict:
    await enforce("listing_create", str(user.id))
    recent = await listing_service.count_recent_by_owner(db, user, hours=1)
    if recent >= settings.RATE_LIMIT_LISTING_CREATE_PER_HOUR:
        raise TooManyRequests(
            "listing_limit_reached",
            params={"limit": settings.RATE_LIMIT_LISTING_CREATE_PER_HOUR},
        )

    listing = await listing_service.create_listing(
        db, user=user, payload=payload.model_dump()
    )
    return {
        "status": "success",
        "data": _serialise(listing, viewer=user),
        # Deprecated, see _DEPRECATED_MODERATION_OK. The listing is already
        # live by the time this is read.
        "moderation": _DEPRECATED_MODERATION_OK,
    }


@router.put("/{listing_id}", summary="Edit a listing you own")
@router.patch("/{listing_id}", include_in_schema=False)
async def update_listing(
    listing_id: uuid.UUID, payload: ListingUpdate, db: DbSession, user: CurrentUser
) -> dict:
    await enforce("listing_write", str(user.id))
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise BadRequest("validation_error")
    listing = await listing_service.update_listing(
        db, listing=listing, user=user, changes=changes
    )
    return {"status": "success", "data": _serialise(listing, viewer=user)}


@router.delete("/{listing_id}", summary="Delete a listing you own")
async def delete_listing(
    listing_id: uuid.UUID, db: DbSession, user: CurrentUser, lang: Lang
) -> MessageResponse:
    await enforce("listing_write", str(user.id))
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    await listing_service.delete_listing(db, listing=listing, user=user)
    return MessageResponse(
        message={
            "uz": "E’lon o‘chirildi.",
            "ru": "Объявление удалено.",
            "en": "The listing has been deleted.",
        }.get(lang, "E'lon o'chirildi.")
    )


@router.post("/{listing_id}/stats", summary="Record a view, favourite or contact")
async def record_stat(
    listing_id: uuid.UUID,
    payload: ListingStatRequest,
    db: DbSession,
    viewer: OptionalUser,
    ctx: RequestCtx,
) -> dict:
    await enforce("stat_ip", ctx.ip or "unknown")
    listing = await listing_service.record_stat(
        db,
        listing_id=listing_id,
        stat=payload.stat,
        delta=payload.delta,
        user=viewer,
    )
    favorite_ids = await listing_service.favorite_ids_for(db, viewer)
    return {
        "status": "success",
        "data": _serialise(listing, viewer=viewer, favorite_ids=favorite_ids),
    }


@router.post("/{listing_id}/report", summary="Report a listing")
async def report_listing(
    listing_id: uuid.UUID,
    payload: ReportListingRequest,
    db: DbSession,
    user: CurrentUser,
    ctx: RequestCtx,
    lang: Lang,
) -> MessageResponse:
    from app.core import audit as audit_log
    from app.models.enums import AuditAction, ReportPriority
    from app.models.moderation import Report

    await enforce("report_ip", ctx.ip or str(user.id))
    listing = await listing_service.get_public_listing(db, listing_id)

    priority = (
        ReportPriority.CRITICAL.value
        if payload.reason in {"SCAM", "HARASSMENT"}
        else ReportPriority.HIGH.value
        if payload.reason in {"BROKER", "FAKE_LISTING"}
        else ReportPriority.MEDIUM.value
    )
    db.add(
        Report(
            listing_id=listing.id,
            reporter_id=user.id,
            reporter_label=user.name,
            reason=payload.reason,
            description=payload.description,
            priority=priority,
            ai_risk_score=listing.risk_score,
        )
    )
    await audit_log.record(
        db,
        AuditAction.LISTING_REPORTED,
        entity_type="listing",
        entity_id=listing.id,
        entity_label=listing.title,
        summary=f"{user.name} reported '{listing.title}' ({payload.reason})",
        meta={"reason": payload.reason, "priority": priority},
    )
    return MessageResponse(
        message={
            "uz": "Shikoyatingiz qabul qilindi. Tez orada ko‘rib chiqamiz.",
            "ru": "Ваша жалоба принята. Мы рассмотрим её в ближайшее время.",
            "en": "Your report has been received. We will review it shortly.",
        }.get(lang, "Shikoyatingiz qabul qilindi.")
    )


# ---------------------------------------------------------------------------
# Top (promotion) requests
# ---------------------------------------------------------------------------
@router.post(
    "/{listing_id}/top",
    status_code=status.HTTP_201_CREATED,
    summary="Ask for the Top (promoted) rail",
)
async def request_top(
    listing_id: uuid.UUID,
    payload: TopRequestCreate,
    db: DbSession,
    user: CurrentUser,
    lang: Lang,
) -> dict:
    """Send a Top request. It is free, and it promotes nothing on its own.

    The listing only moves up once a moderator approves the request in the
    admin panel, which is what the returned message tells the owner. The
    client should render ``message`` rather than a hardcoded string, so the
    three languages live in one place.
    """
    await enforce("top_request", str(user.id))
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    request = await listing_service.request_top(
        db, listing=listing, user=user, days=payload.days, note=payload.note
    )
    return {
        "status": "success",
        "data": TopRequestOut.model_validate(request).model_dump(by_alias=True),
        "message": {
            "uz": "Top so‘rovingiz yuborildi. Administrator tasdiqlagach, "
                  "e’loningiz eng yuqoriga chiqadi.",
            "ru": "Заявка на Топ отправлена. Объявление поднимется наверх "
                  "после одобрения администратора.",
            "en": "Your Top request has been sent. The listing moves to the "
                  "top once an admin approves it.",
        }.get(lang, "Top so‘rovingiz yuborildi."),
    }


# ---------------------------------------------------------------------------
# Deprecated
# ---------------------------------------------------------------------------
@router.post("/scan", summary="Deprecated: publication runs no check", deprecated=True)
async def scan(user: CurrentUser) -> dict:
    """DEPRECATED, kept for one release only.

    The pre-publish scanner is gone: a listing simply publishes. This route
    survives so a browser holding a cached older bundle gets a constant allow
    instead of a 404 in the middle of the create wizard. It reads no body at
    all, so no shape a stale client sends can 422 here. Delete it once those
    bundles have aged out.
    """
    return {"status": "success", "aiAnalysis": _DEPRECATED_MODERATION_OK}
