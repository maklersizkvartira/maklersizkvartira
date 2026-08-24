"""Public and owner-facing listing endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, Lang, OptionalUser, RequestCtx
from app.core.errors import BadRequest, TooManyRequests
from app.core.rate_limit import enforce
from app.models.enums import UserRole
from app.schemas.common import MessageResponse, PaginationParams, build_page_meta
from app.schemas.listing import (
    ListingCreate,
    ListingFilters,
    ListingOut,
    ListingStatRequest,
    ListingUpdate,
    ModerationResult,
    ReportListingRequest,
    ScanListingRequest,
)
from app.services import listings as listing_service
from app.services.moderation import scan_listing

router = APIRouter(prefix="/listings", tags=["listings"])


def _serialise(listing, *, viewer, favorite_ids: set[uuid.UUID] | None = None) -> dict:
    """Render a listing, exposing the owner's phone only where appropriate.

    A stranger browsing the catalogue does not need the owner's number; it is
    revealed to the owner themselves, to staff, and to any signed-in user who
    opens the detail page (which is also the moment a contact is counted).
    """
    payload = ListingOut.model_validate(listing)
    is_owner = viewer is not None and listing.owner_id == viewer.id
    is_staff = viewer is not None and viewer.role in {
        UserRole.ADMIN.value,
        UserRole.MODERATOR.value,
    }
    if not (is_owner or is_staff):
        payload.owner.phone = None
    if favorite_ids is not None:
        payload.is_favorite = listing.id in favorite_ids
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
    return {
        "status": "success",
        "data": [_serialise(r, viewer=user) for r in rows],
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
    is_staff = viewer is not None and viewer.role in {
        UserRole.ADMIN.value,
        UserRole.MODERATOR.value,
    }
    # A listing removed by moderation stays visible to its owner and to staff,
    # so the owner can see why it was rejected and fix it.
    if not listing.is_public and not (is_owner or is_staff):
        raise BadRequest("listing_not_found", status_code=status.HTTP_404_NOT_FOUND)

    favorite_ids = await listing_service.favorite_ids_for(db, viewer)
    payload = ListingOut.model_validate(listing)
    if not (is_owner or is_staff) and viewer is None:
        payload.owner.phone = None
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

    listing, verdict = await listing_service.create_listing(
        db, user=user, payload=payload.model_dump()
    )
    return {
        "status": "success",
        "data": _serialise(listing, viewer=user),
        "moderation": ModerationResult(**verdict.as_dict()).model_dump(by_alias=True),
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
            "uz": "E'lon o'chirildi.",
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
            "uz": "Shikoyatingiz qabul qilindi. Tez orada ko'rib chiqamiz.",
            "ru": "Ваша жалоба принята. Мы рассмотрим её в ближайшее время.",
            "en": "Your report has been received. We will review it shortly.",
        }.get(lang, "Shikoyatingiz qabul qilindi.")
    )


# ---------------------------------------------------------------------------
# Moderation preview
# ---------------------------------------------------------------------------
@router.post("/scan", summary="Preview moderation before publishing")
async def scan(
    payload: ScanListingRequest, user: CurrentUser, ctx: RequestCtx
) -> dict:
    await enforce("listing_write", str(user.id))
    verdict = await scan_listing(
        payload.title, payload.description, payload.price, payload.rooms
    )
    return {
        "status": "success",
        "aiAnalysis": ModerationResult(**verdict.as_dict()).model_dump(by_alias=True),
    }
