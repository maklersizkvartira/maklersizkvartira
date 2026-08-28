"""The actions Shield AI is allowed to take, and the rules around them.

This module is the boundary between a language model and the database. Its
whole job is to make that boundary safe, which comes down to four rules that
every tool here obeys without exception:

1. **The model never names a row.** It refers to a listing by the position it
   was shown in — ``1``, ``2``, ``3`` — and :func:`_resolve_listing` turns
   that into a real id using what the *server* recorded as shown. A model that
   hallucinates a UUID gets an error, not somebody else's apartment.

2. **Permission is checked here, not in the prompt.** ``requires_auth`` and
   ``allowed_roles`` are enforced in :func:`execute` before the handler runs,
   and the handlers then call the same service functions the HTTP routers
   call — which check ownership again. Telling the model it may not do
   something is guidance; this is the guarantee.

3. **Facts are computed, never generated.** :func:`_advice_for` returns a list
   of specific, measured shortcomings of a listing. The model turns that list
   into sentences. It does not decide what is wrong with a listing, because
   it cannot see one.

4. **Anything irreversible stops and asks.** Tools marked
   ``needs_confirmation`` return a pending action instead of doing the thing.
   The router replays it only after the visitor has agreed in words.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import structlog

from app.core.config import settings
from app.core.phone import format_display, is_valid_phone, normalise_phone
from app.models.enums import ListingStatus, PUBLISHER_ROLE_VALUES, UserRole
from app.services import listings as listing_service
from app.services import shield_ai

log = structlog.get_logger(__name__)

#: How many rows any single tool call may return. The model pays for every one
#: of them in tokens and a visitor cannot read more than a handful anyway.
MAX_ROWS = 5

#: Listing positions the model may refer to. Matches MAX_ROWS.
MAX_REF = 20


class ToolError(Exception):
    """A tool refused to run. The message goes back to the model, not the user.

    Errors here are part of the conversation: the model reads "you must be
    signed in for this" and says so in the visitor's own language, instead of
    the request failing with a stack trace.
    """


@dataclass(slots=True)
class ToolContext:
    """Everything a handler may look at. Nothing here comes from the model."""

    db: Any
    viewer: Any | None
    language: str
    session: Any
    #: Listing ids the assistant has actually shown, oldest first. The index
    #: the model uses is a position in this list.
    shown_ids: list[str] = field(default_factory=list)
    #: Rows a tool wants rendered as cards under the reply.
    rows_out: list[Any] = field(default_factory=list)
    #: Human-readable trace of what ran, shown in the chat as it happens.
    steps: list[dict[str, Any]] = field(default_factory=list)
    #: The parameters of the most recent search. The listings page mirrors
    #: these into its own filters, so asking the assistant for Chilonzor and
    #: then closing the chat leaves you on a Chilonzor page rather than back
    #: at the unfiltered catalogue.
    last_search: dict[str, Any] | None = None

    @property
    def is_owner_account(self) -> bool:
        return self.viewer is not None and self.viewer.role in PUBLISHER_ROLE_VALUES


@dataclass(slots=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[[ToolContext, dict[str, Any]], Awaitable[dict[str, Any]]]
    requires_auth: bool = False
    #: Empty means "any signed-in role". Checked after requires_auth.
    allowed_roles: frozenset[str] = frozenset()
    #: The visitor must say yes before this runs.
    needs_confirmation: bool = False
    #: What the chat shows while this is running, per language.
    progress: dict[str, str] = field(default_factory=dict)

    def schema(self) -> dict[str, Any]:
        """The OpenAI function-calling declaration for this tool."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _listing_public(row: Any, *, position: int | None = None) -> dict[str, Any]:
    """What the model is allowed to know about a listing it did not create.

    The owner's phone is deliberately absent. Revealing a number is a
    deliberate act on the listing page that increments a counter and writes an
    audit row; it is not something a chat turn does in passing.
    """
    brief = shield_ai._listing_brief(row, position or 0)
    brief.pop("n", None)
    if position is not None:
        brief["ref"] = position
    brief["status"] = row.status
    brief["images"] = len(row.images or [])
    return brief


def _listing_owner_view(row: Any, position: int) -> dict[str, Any]:
    """The extra numbers an owner may see about their own listing."""
    view = _listing_public(row, position=position)
    view.update(
        {
            "views": row.views_count,
            "favorites": row.favorites_count,
            "contactsRevealed": row.contact_count,
            "trustScore": row.trust_score,
            "riskScore": row.risk_score,
            "riskReasons": list(row.ai_risk_reasons or [])[:6],
            "safetyBadges": list(row.safety_badges or []),
            "isFeatured": row.is_featured,
            "moderationNote": (row.moderation_note or "")[:200] or None,
            "publishedAt": row.published_at.date().isoformat() if row.published_at else None,
        }
    )
    return view


def _ref_of(args: dict[str, Any]) -> int:
    """Read the listing position the model passed, or fail loudly."""
    raw = args.get("listing_ref", args.get("listingRef"))
    try:
        ref = int(raw)
    except (TypeError, ValueError):
        raise ToolError(
            "listing_ref must be the number of a listing you have already "
            "shown the visitor, for example 1 for the first one."
        ) from None
    if not 1 <= ref <= MAX_REF:
        raise ToolError(f"listing_ref must be between 1 and {MAX_REF}.")
    return ref


async def _resolve_listing(ctx: ToolContext, ref: int) -> Any:
    """Turn a position into a row, using only ids the server recorded."""
    if not ctx.shown_ids:
        raise ToolError(
            "No listings have been shown yet in this conversation. Call "
            "search_listings first, then refer to a result by its number."
        )
    if ref > len(ctx.shown_ids):
        raise ToolError(
            f"Only {len(ctx.shown_ids)} listings have been shown. "
            f"There is no number {ref}."
        )
    listing_id = ctx.shown_ids[ref - 1]
    try:
        parsed = uuid.UUID(str(listing_id))
    except (TypeError, ValueError):
        raise ToolError("That listing is no longer available.") from None
    return await listing_service.get_public_listing(ctx.db, parsed)


def _remember(ctx: ToolContext, rows: list[Any]) -> None:
    """Replace what "the second one" refers to.

    Every tool that shows a *set* of listings resets this, so a position
    always means a position in the list on screen right now. Carrying old
    results forward would make "save the second one" ambiguous the moment a
    second search ran, and ambiguity here saves the wrong apartment.
    """
    ctx.shown_ids[:] = [str(row.id) for row in rows][:MAX_REF]


# ---------------------------------------------------------------------------
# Tenant-side tools
# ---------------------------------------------------------------------------
async def _search_listings(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Search the live catalogue.

    Reuses :func:`shield_ai.search_for_intent` rather than querying directly,
    so the loosening ladder — budget first, then rooms, then neighbouring
    districts — behaves identically whether the agent or the older two-pass
    path asked for it.
    """
    intent = shield_ai.SearchIntent(
        district=shield_ai.normalise_district(args.get("district")),
        region=shield_ai.normalise_region(args.get("region")),
        rooms=shield_ai._safe_int(args.get("rooms")),
        max_price=shield_ai._safe_float(args.get("max_price")),
        audience=str(args.get("audience") or "ALL").upper(),
        rental_type=str(args.get("rental_type") or "ALL").upper(),
    )
    intent.region = shield_ai.region_of(intent.district) or intent.region
    if intent.audience not in {"ALL", "STUDENT", "FAMILY"}:
        intent.audience = "ALL"
    if intent.rental_type not in {"ALL", "FULL", "ROOMMATE"}:
        intent.rental_type = "ALL"

    rows, relaxation, searched_district, total = await shield_ai.search_for_intent(
        ctx.db, intent, limit=MAX_ROWS
    )
    _remember(ctx, rows)
    ctx.rows_out = list(rows)
    ctx.last_search = intent.as_dict()

    return {
        "count": len(rows),
        "totalMatching": total,
        # How far the search had to loosen. The model must say this out loud
        # rather than presenting a widened result as an exact one.
        "matchQuality": relaxation,
        "searchedDistrict": searched_district,
        "requestedDistrict": intent.district,
        "listings": [
            _listing_public(row, position=i + 1) for i, row in enumerate(rows)
        ],
        "note": (
            "These are the only rows that exist for this search. Do not "
            "mention any apartment that is not in this list."
        ),
    }


async def _get_listing_details(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    row = await _resolve_listing(ctx, _ref_of(args))
    ctx.rows_out = [row]
    detail = _listing_public(row, position=_ref_of(args))
    detail.update(
        {
            "description": (row.description or "")[:600],
            "address": row.district,  # street level is not disclosed in chat
            "deposit": row.deposit_price,
            "utilitiesIncluded": row.utilities_included,
            "petsAllowed": row.pets_allowed,
            "propertyType": row.property_type,
            "university": row.university_name,
            "universityMinutes": row.university_distance_minutes,
            "roommateGender": row.roommate_gender,
            "safetyBadges": list(row.safety_badges or []),
            "contactHint": (
                "The owner's phone number is on the listing page. Tell the "
                "visitor to open the listing to see it; never state a phone "
                "number yourself."
            ),
        }
    )
    return detail


async def _add_favorite(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    row = await _resolve_listing(ctx, _ref_of(args))
    await listing_service.record_stat(
        ctx.db, listing_id=row.id, stat="favorites", delta=1, user=ctx.viewer
    )
    ctx.rows_out = [row]
    return {"saved": True, "title": row.title, "district": row.district}


async def _remove_favorite(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    row = await _resolve_listing(ctx, _ref_of(args))
    await listing_service.record_stat(
        ctx.db, listing_id=row.id, stat="favorites", delta=-1, user=ctx.viewer
    )
    return {"removed": True, "title": row.title}


async def _list_favorites(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    rows = (await listing_service.list_favorites(ctx.db, ctx.viewer))[:MAX_ROWS]
    _remember(ctx, rows)
    ctx.rows_out = list(rows)
    return {
        "count": len(rows),
        "listings": [
            _listing_public(row, position=i + 1) for i, row in enumerate(rows)
        ],
    }


# ---------------------------------------------------------------------------
# Owner-side tools
# ---------------------------------------------------------------------------
#: What each listing status means, in terms an owner can act on. The model is
#: given this rather than being left to guess what "WARNING" implies.
_STATUS_MEANING: dict[str, str] = {
    ListingStatus.DRAFT.value: "not submitted yet — nobody can see it",
    ListingStatus.PENDING.value: "waiting for moderation, usually within a day",
    ListingStatus.APPROVED.value: "live and visible in search",
    ListingStatus.WARNING.value: "live, but flagged — fixing the reasons raises its ranking",
    ListingStatus.REJECTED.value: "not published; the moderation note says why",
    ListingStatus.UNDER_REVIEW.value: "being re-checked by a moderator",
    ListingStatus.ARCHIVED.value: "taken down by the owner",
}


def _advice_for(row: Any) -> list[dict[str, Any]]:
    """Measured shortcomings of one listing, strongest effect first.

    Every entry is a fact about the row in front of us. The model phrases
    them; it does not decide them, and it cannot add a sixth one.
    """
    items: list[dict[str, Any]] = []
    photos = len(row.images or [])
    if photos == 0:
        items.append({"issue": "no photos at all", "impact": "high",
                      "fix": "add at least four photos: every room, the kitchen, the bathroom, the entrance"})
    elif photos < 4:
        items.append({"issue": f"only {photos} photo(s)", "impact": "high",
                      "fix": "listings with four or more photos get noticeably more contacts"})

    words = len((row.description or "").split())
    if words < 25:
        items.append({"issue": f"description is {words} words", "impact": "high",
                      "fix": "describe the neighbourhood, the transport, the furniture and who the place suits, in 60-100 words"})

    if not row.district:
        items.append({"issue": "no district set", "impact": "high",
                      "fix": "the district is how most people filter; without it the listing is nearly unfindable"})
    if not row.metro_station and (row.region or "").startswith("Toshkent"):
        items.append({"issue": "no metro station named", "impact": "medium",
                      "fix": "naming the nearest metro puts the listing on that station's search page"})
    if row.area is None:
        items.append({"issue": "floor area missing", "impact": "medium",
                      "fix": "add the area in m2 — it is a filter people use"})
    if row.latitude is None or row.longitude is None:
        items.append({"issue": "not placed on the map", "impact": "medium",
                      "fix": "pin the location so the listing appears on the map view"})

    amenities = {
        "furnished": row.furnished, "internet": row.internet,
        "air conditioning": row.air_conditioning, "washing machine": row.washing_machine,
        "parking": row.parking,
    }
    missing = [name for name, present in amenities.items() if not present]
    if len(missing) >= 4:
        items.append({"issue": f"almost no amenities ticked ({', '.join(missing[:4])})", "impact": "medium",
                      "fix": "tick everything the place actually has — each one is a filter someone searches by"})

    if row.trust_score < 70:
        reasons = list(row.ai_risk_reasons or [])[:3]
        items.append({"issue": f"trust score is {row.trust_score} of 100", "impact": "high",
                      "fix": "the automatic check flagged: " + (", ".join(reasons) if reasons else "broker-like wording or an unusual price"),
                      "detail": "trust score decides ranking order among similar listings"})

    if row.views_count >= 30 and row.contact_count == 0:
        items.append({"issue": f"{row.views_count} views but nobody asked for the number", "impact": "high",
                      "fix": "people are looking and leaving — usually the price is above the district norm, or the photos do not match the description"})

    return items[:6]


async def _my_listings(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    rows = await listing_service.list_for_owner(ctx.db, ctx.viewer)
    visible = rows[:MAX_ROWS]
    _remember(ctx, visible)
    ctx.rows_out = [r for r in visible if r.is_public]
    return {
        "count": len(rows),
        "shown": len(visible),
        "listings": [
            {
                **_listing_owner_view(row, i + 1),
                "statusMeaning": _STATUS_MEANING.get(row.status, row.status),
            }
            for i, row in enumerate(visible)
        ],
    }


async def _listing_performance(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """One listing's numbers, next to what similar listings do.

    A view count on its own tells an owner nothing. The comparison against the
    same district and room count is what turns it into a decision.
    """
    ref = _ref_of(args)
    row = await _resolve_listing(ctx, ref)
    if row.owner_id != ctx.viewer.id and ctx.viewer.role not in {
        UserRole.ADMIN.value, UserRole.DEVELOPER.value
    }:
        raise ToolError("That listing belongs to someone else.")

    from app.schemas.listing import ListingFilters

    peers, peer_total = await listing_service.list_public(
        ctx.db,
        ListingFilters(district=row.district, rooms=row.rooms, sort_by="RECOMMENDED"),
        offset=0,
        limit=20,
    )
    others = [p for p in peers if p.id != row.id]
    prices = sorted(p.price for p in others if p.price)
    median = prices[len(prices) // 2] if prices else None
    avg_views = round(sum(p.views_count for p in others) / len(others), 1) if others else None

    ctx.rows_out = [row] if row.is_public else []
    return {
        "listing": _listing_owner_view(row, ref),
        "statusMeaning": _STATUS_MEANING.get(row.status, row.status),
        "comparison": {
            "similarListings": len(others),
            "district": row.district,
            "rooms": row.rooms,
            "medianPriceOfSimilar": median,
            "yourPrice": row.price,
            "pricePosition": (
                None if not median else
                "above" if row.price > median * 1.1 else
                "below" if row.price < median * 0.9 else "in line"
            ),
            "averageViewsOfSimilar": avg_views,
            "yourViews": row.views_count,
        },
        "advice": _advice_for(row),
        "note": (
            "Every number here is measured. Use them; do not add figures of "
            "your own and do not promise a ranking outcome."
        ),
    }


async def _how_tenants_search(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """The filters that actually exist, so advice matches the real product."""
    return {
        "filtersTenantsUse": [
            "district", "number of rooms", "maximum price", "metro station",
            "nearest university", "furnished", "internet", "air conditioning",
            "washing machine", "parking", "pets allowed", "minimum area",
            "verified owners only", "minimum trust score",
            "whole place or roommate", "students / families",
        ],
        "sortOrders": [
            "RECOMMENDED (default — trust score and freshness together)",
            "NEWEST", "PRICE_LOW", "PRICE_HIGH", "TRUST", "POPULAR",
        ],
        "whatRankingRewards": [
            "a high trust score",
            "recent publication or a recent update",
            "complete fields, because an empty field fails the filter that asks for it",
            "photos, which decide whether a result gets clicked at all",
        ],
        "note": (
            "This is the real filter list from the product. Advise only on "
            "these; do not invent a filter or a ranking factor."
        ),
    }


# ---------------------------------------------------------------------------
# Support handoff
# ---------------------------------------------------------------------------
async def _support_contacts(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Our own numbers. These are published on the site, so they are public."""
    return {
        "phones": [format_display(p) for p in settings.support_phones],
        "hint": (
            "Give these to the visitor and offer the alternative: you can "
            "take their number instead and have support call them."
        ),
    }


async def _request_callback(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Take the visitor's number and hand the conversation to a human.

    The number is validated here, not by the model: a mistyped digit means a
    call that never arrives, and the model has no way to check one.
    """
    raw = str(args.get("phone") or "").strip()
    if not raw and ctx.viewer is not None:
        raw = ctx.viewer.phone or ""
    if not raw:
        raise ToolError(
            "No phone number was given. Ask the visitor for their number "
            "first, then call this again with it."
        )
    if not is_valid_phone(raw):
        raise ToolError(
            "That is not a valid Uzbek phone number. Ask the visitor to "
            "repeat it in the form +998 90 123 45 67."
        )

    phone = normalise_phone(raw)
    note = str(args.get("note") or "")[:400]

    from app.services.telegram import send_message

    intent = ctx.session.last_intent or {}
    details = []
    if intent.get("district"):
        details.append(f"📍 {intent['district']}")
    if intent.get("rooms"):
        details.append(f"🏠 {intent['rooms']} xona")
    if intent.get("maxPrice"):
        details.append(f"💰 {int(intent['maxPrice']):,}".replace(",", " ") + " so'm")

    who = ctx.viewer.name if ctx.viewer else "Mehmon"
    body = (
        "☎️ <b>Qo'ng'iroq so'raldi — Shield AI</b>\n\n"
        f"👤 <b>Mijoz:</b> {who}\n"
        f"📱 <b>Telefon:</b> {format_display(phone)}\n"
        + (("\n" + " • ".join(details) + "\n") if details else "")
        + (f"\n📝 <i>{note}</i>\n" if note else "")
        + f"\n🔑 Sessiya: <code>{ctx.session.session_key[:12]}…</code>"
    )
    delivered = await send_message(ctx.db, body, context="ai_callback_request")

    return {
        "recorded": True,
        "phone": format_display(phone),
        # Whether Telegram accepted it changes nothing for the visitor: the
        # request is in the audit log either way and support works from both.
        "deliveredToTeam": delivered,
        "sayToVisitor": (
            "Confirm warmly that the number is saved and that support will "
            "call shortly, and thank them. One sentence."
        ),
    }


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
_REF_PARAM = {
    "type": "integer",
    "description": (
        "The number of a listing as it was shown to the visitor: 1 for the "
        "first result, 2 for the second, and so on. Never a UUID."
    ),
    "minimum": 1,
    "maximum": MAX_REF,
}


def _params(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


TOOLS: dict[str, Tool] = {}


def _register(tool: Tool) -> None:
    TOOLS[tool.name] = tool


_register(Tool(
    name="search_listings",
    description=(
        "Search MaklersizUy's live listing database. Call this whenever the "
        "visitor is looking for somewhere to live and has given at least one "
        "criterion. Returns only listings that really exist right now."
    ),
    parameters=_params({
        "district": {"type": "string", "description": "District or city, as the visitor said it (Chilonzor, Yunusobod, Samarqand...)."},
        "region": {"type": "string", "description": "Province, when they named one instead of a district."},
        "rooms": {"type": "integer", "minimum": 1, "maximum": 20},
        "max_price": {"type": "number", "description": "Budget ceiling in Uzbek so'm. Convert dollars before passing."},
        "audience": {"type": "string", "enum": ["ALL", "STUDENT", "FAMILY"]},
        "rental_type": {"type": "string", "enum": ["ALL", "FULL", "ROOMMATE"]},
    }),
    handler=_search_listings,
    progress={"uz": "Kvartiralarni qidiryapman", "ru": "Ищу квартиры", "en": "Searching listings"},
))

_register(Tool(
    name="get_listing_details",
    description=(
        "Full details of one listing the visitor has already been shown. Use "
        "it when they ask about a specific result."
    ),
    parameters=_params({"listing_ref": _REF_PARAM}, ["listing_ref"]),
    handler=_get_listing_details,
    progress={"uz": "E'lon ma'lumotlarini ochyapman", "ru": "Открываю объявление", "en": "Opening the listing"},
))

_register(Tool(
    name="add_favorite",
    description=(
        "Save a listing to the visitor's favourites. Requires them to be "
        "signed in."
    ),
    parameters=_params({"listing_ref": _REF_PARAM}, ["listing_ref"]),
    handler=_add_favorite,
    requires_auth=True,
    progress={"uz": "Sevimlilarga qo'shyapman", "ru": "Добавляю в избранное", "en": "Saving to favourites"},
))

_register(Tool(
    name="remove_favorite",
    description="Remove a listing from the visitor's favourites.",
    parameters=_params({"listing_ref": _REF_PARAM}, ["listing_ref"]),
    handler=_remove_favorite,
    requires_auth=True,
    needs_confirmation=True,
    progress={"uz": "Sevimlilardan olyapman", "ru": "Убираю из избранного", "en": "Removing from favourites"},
))

_register(Tool(
    name="list_favorites",
    description="The listings the visitor has already saved.",
    parameters=_params({}),
    handler=_list_favorites,
    requires_auth=True,
    progress={"uz": "Sevimlilarni ochyapman", "ru": "Открываю избранное", "en": "Opening favourites"},
))

_register(Tool(
    name="my_listings",
    description=(
        "The listings this owner has published, with their status, trust "
        "score, views, favourites and how many people asked for their number. "
        "Only for owner accounts."
    ),
    parameters=_params({}),
    handler=_my_listings,
    requires_auth=True,
    allowed_roles=frozenset(PUBLISHER_ROLE_VALUES),
    progress={"uz": "E'lonlaringizni ochyapman", "ru": "Открываю ваши объявления", "en": "Opening your listings"},
))

_register(Tool(
    name="listing_performance",
    description=(
        "How one of the owner's own listings is doing, measured against "
        "similar listings in the same district, plus a computed list of what "
        "is holding it back. Use this for 'why is nobody calling', 'how is my "
        "listing doing', 'how do I raise my trust score'."
    ),
    parameters=_params({"listing_ref": _REF_PARAM}, ["listing_ref"]),
    handler=_listing_performance,
    requires_auth=True,
    allowed_roles=frozenset(PUBLISHER_ROLE_VALUES),
    progress={"uz": "E'lon statistikasini hisoblayapman", "ru": "Считаю статистику", "en": "Measuring the listing"},
))

_register(Tool(
    name="how_tenants_search",
    description=(
        "The filters and sort orders tenants really have, and what the "
        "ranking rewards. Use it before advising an owner how to be found."
    ),
    parameters=_params({}),
    handler=_how_tenants_search,
    progress={"uz": "Qidiruv qoidalarini tekshiryapman", "ru": "Проверяю правила поиска", "en": "Checking search rules"},
))

_register(Tool(
    name="get_support_contacts",
    description=(
        "MaklersizUy's own support phone numbers. Use when the visitor asks "
        "to speak to a person or asks for our number."
    ),
    parameters=_params({}),
    handler=_support_contacts,
    progress={"uz": "Aloqa ma'lumotlarini olyapman", "ru": "Беру контакты", "en": "Fetching contacts"},
))

_register(Tool(
    name="request_support_callback",
    description=(
        "Record the visitor's phone number so support calls them back. Ask "
        "for the number first and pass it exactly as they said it. Use this "
        "when they would rather be called than call us."
    ),
    parameters=_params({
        "phone": {"type": "string", "description": "The visitor's number, e.g. +998901234567. Omit only if they are signed in and asked you to use their account number."},
        "note": {"type": "string", "description": "One short line on what they need, for the support team."},
    }),
    handler=_request_callback,
    needs_confirmation=True,
    progress={"uz": "So'rovingizni yuboryapman", "ru": "Передаю заявку", "en": "Passing it to support"},
))


def schemas_for(ctx: ToolContext) -> list[dict[str, Any]]:
    """The tools this particular caller may see.

    Hiding a tool is not the security boundary — :func:`execute` is — but a
    model that is never shown ``my_listings`` does not offer owner features to
    a visitor who has no listings, which is a better conversation.
    """
    out: list[dict[str, Any]] = []
    for tool in TOOLS.values():
        if tool.allowed_roles and (
            ctx.viewer is None or ctx.viewer.role not in tool.allowed_roles
        ):
            continue
        out.append(tool.schema())
    return out


def progress_label(name: str, language: str) -> str | None:
    tool = TOOLS.get(name)
    if tool is None:
        return None
    return tool.progress.get(language) or tool.progress.get("uz")


async def execute(ctx: ToolContext, name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Run one tool with every guard applied, whatever the model asked for."""
    tool = TOOLS.get(name)
    if tool is None:
        raise ToolError(f"There is no tool called {name}.")

    if tool.requires_auth and ctx.viewer is None:
        raise ToolError(
            "The visitor is not signed in, so this cannot be done. Tell them "
            "to sign in first — do not claim it was done."
        )
    if tool.allowed_roles and (
        ctx.viewer is None or ctx.viewer.role not in tool.allowed_roles
    ):
        raise ToolError(
            "This account is not an owner account, so it has no listings to "
            "manage. Offer to help them find somewhere to live instead."
        )

    result = await tool.handler(ctx, args or {})
    log.info("ai_tool.ran", tool=name, user=str(ctx.viewer.id) if ctx.viewer else None)
    return result
