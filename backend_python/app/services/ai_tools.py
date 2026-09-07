"""The actions Uyiz AI is allowed to take, and the rules around them.

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

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

import structlog

from app.core import audit as audit_log
from app.core.phone import format_display, is_valid_phone, normalise_phone
from app.models.enums import AuditAction, ListingStatus, PUBLISHER_ROLE_VALUES, UserRole
from app.services import fx
from app.services import listings as listing_service
from app.services import uyiz_ai

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
    #: Everything the *visitor* has typed this session, oldest first, and
    #: nothing the model or a listing wrote. Two guards read it and nothing
    #: else may: :func:`_is_the_visitors_own_number` (L-FIX-3), which refuses
    #: a phone number lifted out of a listing description rather than given
    #: by the person in the chat, and :func:`_currency_the_visitor_used`
    #: (D5), which re-reads the raw sentence when the model passed a price
    #: without saying which currency it was in.
    #:
    #: An empty tuple is not "unknown, so allow": ``run_turn`` populates this
    #: on every turn, so empty means the caller supplied nothing to check
    #: against and :func:`_is_the_visitors_own_number` refuses. The default
    #: exists for the tools that never read the field, and a caller that
    #: wants to capture a lead has to pass the transcript.
    visitor_messages: tuple[str, ...] = ()

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
    brief = uyiz_ai._listing_brief(row, position or 0)
    brief.pop("n", None)
    if position is not None:
        brief["ref"] = position
    brief["status"] = row.status
    return brief


def _listing_owner_view(row: Any, position: int) -> dict[str, Any]:
    """The extra numbers a publisher may see about their own listing."""
    view = _listing_public(row, position=position)
    # ``riskScore`` and ``aiRiskReasons`` are deliberately absent. They hold
    # verdicts from a publish-time automatic check that no longer exists, and
    # reading them back would have the assistant telling a publisher, in
    # production, that a machine flagged their listing — from stale rows.
    view.update(
        {
            "views": row.views_count,
            "favorites": row.favorites_count,
            "contactsRevealed": row.contact_count,
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


def _digits(text: Any) -> str:
    """Every digit in a string, in order, and nothing else.

    Phone numbers are written a dozen ways — ``+998 90 123 45 67``,
    ``(90) 123-45-67``, ``998901234567`` — and all of them have to compare
    equal, so the separators go and the digits stay.
    """
    return re.sub(r"\D", "", str(text or ""))


def _stated_currency(args: dict[str, Any]) -> str | None:
    """The currency the model passed, or ``None`` when it passed none.

    Anything that is neither UZS nor USD is refused out loud rather than
    quietly read as so'm (D5). ``"EUR"`` used to fall straight through the
    ``currency == "USD"`` test and become a euro budget searched as so'm —
    a silent factor-of-13,000 error, with no log and no rejection.
    """
    raw = args.get("price_currency")
    if raw is None:
        return None
    currency = str(raw).strip().upper()
    if not currency:
        return None
    if currency not in {"UZS", "USD"}:
        raise ToolError(
            "price_currency must be UZS or USD. Ask the visitor which they "
            "meant, then call this again."
        )
    return currency


def _currency_the_visitor_used(ctx: ToolContext) -> bool | None:
    """Was the budget stated in dollars? Read from the visitor, not the model.

    The tiebreak for D5: ``price_currency`` cannot be made required in JSON
    Schema against a sibling, so a model that follows ``max_price``'s "pass
    1500 for 1500$" and forgets the currency is a real case. Rather than
    assume, re-read what the visitor actually typed — ``1500$`` says which
    currency it is no matter what the model chose to forward.

    Returns True for USD, False for so'm, and ``None`` when their own words
    settle nothing — which is also what an empty ``visitor_messages`` gives.
    Unlike the phone guard below this one may safely stay open on missing
    input: it is a tiebreak, and having no opinion means the currency the
    model passed stands rather than a lead being sent to a stranger.
    """
    for text in reversed(ctx.visitor_messages):
        reading = uyiz_ai.parse_money(str(text))
        if reading.rejected:
            continue
        if reading.max_uzs is not None or reading.min_uzs is not None:
            return reading.was_usd
    return None


#: Words that make a number in a sentence a *price* rather than a room count,
#: a floor or a date: the currency marks and the scale words
#: :data:`uyiz_ai._MONEY` knows, searched over the whole message rather than
#: token by token. Written out here because the parser's own pattern only
#: sees a mark that touches its number, and the shape this exists for —
#: "1500 dan 2000 gacha dollar", the currency written once after the whole
#: range — puts the word two tokens away from either figure.
#:
#: Every alternative is anchored at its start, and the two-letter "у.е." is
#: anchored at both ends: unanchored, "ye" matched the front of "yer" and
#: "yetti" and the flag fired on a sentence about a basement. A trailing
#: anchor is deliberately absent everywhere else, because Uzbek suffixes the
#: currency — "so'mgacha", "dollarga" — and a word boundary after the "m"
#: would refuse the commonest spelling of a budget on the site.
_NAMES_MONEY = re.compile(
    r"\$|\busd\b|\bdollar|\bдоллар|\bу\.?\s?е\b|\by\.?\s?e\b|\bue\b"
    r"|\bso['‘’ʻ`]?m|\bsum\b|\bсум|\bсўм|\buzs\b"
    r"|\bming\b|\bминг\b|\bmln\b|\bmillion|\bмлн\b|\bмиллион"
    r"|\bmlrd\b|\bmilliard|\bмлрд\b|\bмиллиард|\bтыс|\bthousand\b",
    re.IGNORECASE,
)


def _budget_the_parser_refused(ctx: ToolContext) -> bool:
    """Did the visitor state a budget this turn that could not be read?

    ``MoneyReading.rejected`` is the parser saying "I found a number and
    deliberately did not believe it" — a phone number, a date, an area, a
    figure outside the plausible window — and it is a different answer from
    "no number was mentioned". Until this it had no reader outside
    :func:`_currency_the_visitor_used`, so the two arrived at the search
    identically: with no budget. The assistant then searched on nothing and
    narrated the result as though the visitor's budget had been honoured.

    Only this turn's message is read. An older refusal has already been asked
    about, and re-raising it every turn turns one clarifying question into a
    loop the visitor cannot leave.

    ``rejected`` alone is far too broad to key on, and that is the trap here:
    ``parse_money("Chilonzorda 2 xonali kvartira")`` is rejected, because the
    room count is a number it found and refused. Keyed on that, the commonest
    sentence on the site would have the assistant asking every visitor to
    repeat a budget they never stated. So the message must also *name* money
    — a currency or a scale word — for the refusal to mean a budget was
    lost rather than an ordinary number correctly ignored.
    """
    if not ctx.visitor_messages:
        return False
    text = str(ctx.visitor_messages[-1])
    if not uyiz_ai.parse_money(text).rejected:
        return False
    return bool(_NAMES_MONEY.search(text))


def _plausible_budget(uzs: float | None) -> float | None:
    """Drop a converted budget the search could not honestly have meant.

    The window :func:`uyiz_ai.parse_money` applies, applied here too so the
    deterministic path and the tool path cannot give one visitor two
    different answers (D5). Below the floor is a number that was never a
    budget — 1500 read as so'm because the currency went missing. Above the
    ceiling is a number ``ListingFilters`` would 422 on, so a search that
    accepted it could never be mirrored into the listings page behind the
    chat.
    """
    if uzs is None:
        return None
    if uyiz_ai.MIN_PLAUSIBLE_BUDGET <= uzs <= uyiz_ai.MAX_PLAUSIBLE_BUDGET:
        return uzs
    return None


# ---------------------------------------------------------------------------
# Tenant-side tools
# ---------------------------------------------------------------------------
async def _search_listings(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Search the live catalogue.

    Reuses :func:`uyiz_ai.search_for_intent` rather than querying directly,
    so the loosening ladder — budget first, then rooms, then neighbouring
    districts — behaves identically whether the agent or the older two-pass
    path asked for it.
    """
    # The model is not asked to do exchange arithmetic. It reports what it
    # heard and the server converts at the live rate, because a model that
    # converts at a rate it invented produces a budget nobody stated — which
    # is how a $1500 search came back with the whole catalogue in it.
    # ``_safe_money`` and not ``_safe_float``: the latter caps at 1e9, which
    # silently discarded every purchase budget of a billion so'm or more on
    # the very path that added SALE searching (D6). ListingFilters was
    # widened to MAX_SALE_UZS precisely because a billion so'm is under the
    # price of an ordinary Tashkent flat.
    max_price = uyiz_ai._safe_money(args.get("max_price"))
    min_price = uyiz_ai._safe_money(args.get("min_price"))

    #: Things the model has to be told about the budget it just passed. They
    #: are appended to the payload's ``note`` at the end, after the
    #: no-criteria branch has had its say, so neither can erase the other.
    budget_notes: list[str] = []

    currency = _stated_currency(args)
    has_price = max_price is not None or min_price is not None
    if has_price and currency is None:
        # D5. A price with no currency is not assumed. The visitor's own
        # sentence is re-read first, and only when that says nothing does
        # this fall back to so'm — out loud, so the reply confirms it rather
        # than searching a thirteen-thousandth of the stated budget in
        # silence.
        heard_usd = _currency_the_visitor_used(ctx)
        if heard_usd is None:
            currency = "UZS"
            budget_notes.append(
                "The currency of this budget was NOT stated and the visitor's "
                "own words did not settle it, so it was read as so'm. Confirm "
                "the currency with them in your reply before treating the "
                "budget as agreed."
            )
        else:
            currency = "USD" if heard_usd else "UZS"

    # Fetched at most once per turn, and only when there is a dollar figure to
    # convert — ``usd_to_uzs`` goes to the Central Bank on a cold cache and a
    # so'm-only search has no business paying for that.
    rate: float | None = None
    if has_price and currency == "USD":
        rate = await fx.usd_to_uzs()
        if max_price is not None:
            max_price = round(max_price * rate)
        if min_price is not None:
            min_price = round(min_price * rate)

    # The same plausibility window ``parse_money`` applies, applied to the
    # converted number (D5). Without it the two halves of one fix disagreed:
    # the parser refused a 1500-so'm ceiling and the tool path searched on it.
    kept_max, kept_min = _plausible_budget(max_price), _plausible_budget(min_price)
    # Measured against what the *model passed*, not against what survived
    # ``_safe_money``. A figure above MAX_SALE_UZS, or one that is not a
    # number at all, never reaches ``_plausible_budget`` — it was already
    # None — and a budget dropped without a word is how a search on nothing
    # gets narrated back as a search on the visitor's budget.
    if (args.get("max_price") is not None and kept_max is None) or (
        args.get("min_price") is not None and kept_min is None
    ):
        budget_notes.append(
            "A price was passed that is not a believable housing budget once "
            "converted to so'm, so it was DROPPED and not searched on. Ask the "
            "visitor to state their budget and its currency again, and do not "
            "describe these results as fitting a budget."
        )
    max_price, min_price = kept_max, kept_min

    # The reply says the budget back in the currency it was heard in:
    # answering "1500$ ga uy kere" with a figure in so'm reads as a different
    # question being answered. Computed after the drop above, so a budget
    # nothing survived of cannot still claim to have been stated in dollars.
    price_was_usd = currency == "USD" and (
        max_price is not None or min_price is not None
    )
    # The conversion has to land before the constructor, not on the finished
    # intent: as_dict() is mirrored into the SPA's filter store and has to
    # carry the so'm number the search actually ran on.
    intent = uyiz_ai.SearchIntent(
        district=uyiz_ai.normalise_district(args.get("district")),
        region=uyiz_ai.normalise_region(args.get("region")),
        metro_station=uyiz_ai.normalise_metro(
            args.get("metro_station"), require_keyword=False
        ),
        university_name=uyiz_ai._safe_text(args.get("university_name"), 120),
        property_type=uyiz_ai._safe_choice(
            args.get("property_type"), uyiz_ai.PROPERTY_TYPES
        ),
        rooms=uyiz_ai._safe_int(args.get("rooms")),
        min_area=uyiz_ai._safe_area(args.get("min_area")),
        min_price=min_price,
        max_price=max_price,
        price_was_usd=price_was_usd,
        # A hard partition, not a criterion: a rental is not a worse match
        # for somebody buying, it is the wrong question answered.
        deal_type=uyiz_ai._safe_choice(args.get("deal_type"), uyiz_ai.DEAL_TYPES)
        or "RENT",
        audience=str(args.get("audience") or "ALL").upper(),
        rental_type=str(args.get("rental_type") or "ALL").upper(),
        roommate_gender=uyiz_ai._safe_choice(
            args.get("roommate_gender"), uyiz_ai.ROOMMATE_GENDERS
        ),
        # Only a true is a filter. A false would mean "must not have a
        # washing machine", which nobody asks for and the catalogue cannot
        # express, so it is folded into "did not ask".
        furnished=uyiz_ai._safe_wanted(args.get("furnished")),
        parking=uyiz_ai._safe_wanted(args.get("parking")),
        internet=uyiz_ai._safe_wanted(args.get("internet")),
        air_conditioning=uyiz_ai._safe_wanted(args.get("air_conditioning")),
        washing_machine=uyiz_ai._safe_wanted(args.get("washing_machine")),
        pets_allowed=uyiz_ai._safe_wanted(args.get("pets_allowed")),
        only_verified=args.get("only_verified") is True,
        sort_by=uyiz_ai._safe_choice(args.get("sort_by"), uyiz_ai.SORT_ORDERS)
        or "RECOMMENDED",
    )
    intent.region = uyiz_ai.region_of(intent.district) or intent.region
    if intent.audience not in {"ALL", "STUDENT", "FAMILY"}:
        intent.audience = "ALL"
    if intent.rental_type not in {"ALL", "FULL", "ROOMMATE"}:
        intent.rental_type = "ALL"

    rows, relaxation, searched_district, total = await uyiz_ai.search_for_intent(
        ctx.db, intent, limit=MAX_ROWS
    )
    _remember(ctx, rows)
    ctx.rows_out = list(rows)
    ctx.last_search = intent.as_dict()

    # Every row that came back is a *partial* answer now — the search no
    # longer filters rows away, it scores them — so each one carries what it
    # meets and what it misses. Without this the model can see that a listing
    # was returned but not why, and it either presents a one-criterion match
    # as an exact one or hides it out of caution. Both are worse than saying
    # plainly "this is in Chilonzor but it is 3 rooms, not 2".
    listings: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        brief = _listing_public(row, position=index)
        report = intent.matches.get(str(row.id))
        if report:
            brief["match"] = {
                **report,
                "matchedLabels": [
                    intent.label_for(k, ctx.language) for k in report["matched"]
                ],
                "missedLabels": [
                    intent.label_for(k, ctx.language) for k in report["missed"]
                ],
            }
        listings.append(brief)

    # R-FIX-3. ``totalMatching`` counts every row that scored at all, not
    # every row that matched everything, and the payload used to give the
    # model no way to tell those apart — so "12 apartments matching your
    # criteria" was written about twelve rows whose best score was 3 out of
    # 12. These two numbers are what make the count readable.
    reports = [intent.matches.get(str(row.id)) or {} for row in rows]
    max_score = max((report.get("maxScore") or 0 for report in reports), default=0)
    best_percent = max(
        (report.get("matchPercent") or 0 for report in reports), default=0
    )

    payload: dict[str, Any] = {
        "count": len(rows),
        "totalMatching": total,
        # The weight of everything the visitor stated, and how close the best
        # returned row came to it. See the comment above.
        "maxScore": max_score,
        "bestMatchPercent": best_percent,
        # How far the search had to loosen. The model must say this out loud
        # rather than presenting a widened result as an exact one.
        "matchQuality": relaxation,
        "searchedDistrict": searched_district,
        "requestedDistrict": intent.district,
        # The criteria this search stopped filtering on in order to find
        # anything. Empty on an exact match.
        "droppedCriteria": intent.dropped_labels(ctx.language),
        "listings": listings,
        "note": (
            "These are the only rows that exist for this search. Do not "
            "mention any apartment that is not in this list. If "
            "droppedCriteria is not empty, tell the visitor which of their "
            "conditions was relaxed. totalMatching counts rows that matched "
            "AT LEAST ONE criterion, not rows that matched all of them — "
            "never call it 'N apartments matching what you asked for' unless "
            "bestMatchPercent is 100."
        ),
    }

    # A search with nothing to search on is not a recommendation. This is the
    # exact turn that went wrong in production: a budget written "1500$" was
    # dropped by the parser, no criterion survived, and the model presented
    # the recent-listings fallback as apartments picked for the visitor.
    if not intent.has_criteria:
        payload["note"] = (
            "The visitor gave NO criterion this search could use, so these are "
            "simply recent listings, not recommendations and not an answer to "
            "anything they said. Say that plainly in one clause, then ask ONE "
            "short question covering district, rooms and budget together. Never "
            "describe these rows as matching what they asked for."
        )

    # M3/D7. ``price_was_usd`` was write-only until this block: nothing
    # anywhere read it, so the prompt rule "say the number back to them in
    # the currency they used" had no data behind it and the model had to
    # re-derive the currency from the raw message — which is exactly the
    # model-does-arithmetic failure the price_currency parameter exists to
    # remove. label_for() renders so'm unconditionally, so without this the
    # visitor who wrote "1500$" reads "19.1 mln so'm gacha" back.
    if intent.max_price is not None:
        # Set above whenever a dollar figure was converted; the fallback is
        # the same cached number that conversion would have used.
        rate = rate or fx.cached_rate()
        payload["budget"] = {
            "statedCurrency": "USD" if intent.price_was_usd else "UZS",
            "maxUzs": intent.max_price,
            "maxAsStated": round(intent.max_price / rate) if intent.price_was_usd and intent.max_price else intent.max_price,
            "note": "Say the budget back in statedCurrency, using maxAsStated. Never quote so'm to someone who said dollars.",
        }

    # The other half of ``MoneyReading.rejected``. A budget the parser refused
    # reaches the search looking exactly like a budget nobody mentioned, and
    # the model cannot tell those apart from the payload alone — so it
    # answers a visitor who did state a price with rows chosen without one,
    # and says nothing about the number it lost. Gated on the search having
    # ended up with no budget at all: if the model read the sentence better
    # than the parser did and passed a real ceiling, there is nothing to ask
    # about.
    if (
        intent.max_price is None
        and intent.min_price is None
        and _budget_the_parser_refused(ctx)
    ):
        payload["budgetUnreadable"] = True
        budget_notes.append(
            "The visitor's last message names money, but the figure in it "
            "could not be read as a budget, so this search ran with NO budget "
            "at all. Ask them to repeat the amount and its currency in digits. Do "
            "not search on nothing, and do not describe these rows as "
            "fitting their budget."
        )

    # Appended rather than assigned, so neither the no-criteria note above nor
    # a currency warning can silently replace the other.
    if budget_notes:
        payload["note"] = " ".join([payload["note"], *budget_notes])

    return payload


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
#: What each listing status means, in terms a publisher can act on. The model is
#: given this rather than being left to guess what "WARNING" implies.
_STATUS_MEANING: dict[str, str] = {
    ListingStatus.DRAFT.value: "not submitted yet — nobody can see it",
    ListingStatus.PENDING.value: "waiting for an administrator to look at it",
    ListingStatus.APPROVED.value: "live and visible in search",
    ListingStatus.WARNING.value: (
        "live, but a confirmed report has lowered its reliability percentage "
        "— the moderation note says what the report was about"
    ),
    ListingStatus.REJECTED.value: (
        "taken down by an administrator; the moderation note says why"
    ),
    ListingStatus.UNDER_REVIEW.value: "being re-checked by a moderator",
    ListingStatus.ARCHIVED.value: "taken down by its publisher",
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

    if row.trust_score < 100:
        # The score only moves when an administrator confirms a report, so
        # this is never a machine's opinion of the listing and must not be
        # phrased as one. The old wording read the retired publish-time check
        # back to publishers out of stale rows.
        items.append({"issue": f"reliability percentage is {row.trust_score} of 100", "impact": "high",
                      "fix": "a report about this listing was confirmed by an administrator — read the moderation note, fix what was reported, and contact support if you believe the decision was wrong",
                      "detail": "the reliability percentage falls only on a confirmed report, and it decides ranking order among similar listings"})

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

    # The listing's own deal type, not the default. The comparison below takes
    # a median price, and without this a flat for sale is measured against the
    # monthly rents of its neighbours — which would tell the seller of a
    # 600-million-so'm property that the going rate is six million.
    peers, peer_total = await listing_service.list_public(
        ctx.db,
        ListingFilters(
            district=row.district,
            rooms=row.rooms,
            deal_type=row.deal_type,
            sort_by="RECOMMENDED",
        ),
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
            "district", "region", "number of rooms", "minimum and maximum price",
            "metro station", "nearest university", "property type",
            "minimum floor area", "furnished", "internet", "air conditioning",
            "washing machine", "parking", "pets allowed",
            "verified publishers only", "whole place or roommate",
            "roommate gender", "students / families",
        ],
        "sortOrders": [
            "RECOMMENDED (default — approved Top placements first, then "
            "reliability and freshness)",
            "NEWEST", "PRICE_LOW", "PRICE_HIGH", "POPULAR",
        ],
        "whatRankingRewards": [
            "an approved Top placement, which an administrator grants after "
            "the publisher requests it",
            "a listing with no confirmed reports against it",
            "recent publication or a recent update",
            "complete fields, because an empty field fails the filter that asks for it",
            "photos, which decide whether a result gets clicked at all",
        ],
        "note": (
            "This is the real filter list from the product. Advise only on "
            "these; do not invent a filter or a ranking factor. The "
            "reliability percentage is not a lever a publisher can pull — it "
            "starts full and only falls on a confirmed report — so never "
            "coach anyone on 'raising' it."
        ),
    }


# ---------------------------------------------------------------------------
# Support handoff
# ---------------------------------------------------------------------------
async def _support_contacts(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Our own contact routes. These are published on the site, so they are
    public.

    They come from configuration rather than literals here: they change, they
    appear in several places, and settings is the one place that gets to decide
    them. A route that is not configured is left OUT of the payload entirely
    rather than sent as an empty string, so the model cannot read a blank as
    something it may offer.
    """
    phones = uyiz_ai.support_phone_list()
    telegram = uyiz_ai.support_telegram()
    hours = uyiz_ai.support_hours()

    routes: list[str] = []
    if phones:
        routes.append("call one of these numbers")
    if telegram:
        routes.append("write to us on Telegram")
    routes.append(
        "leave their own number and have support call them back via "
        "request_support_callback"
    )

    contacts: dict[str, Any] = {"phones": phones}
    if telegram:
        contacts["telegram"] = telegram
    if hours:
        contacts["hours"] = hours
        contacts["hoursNote"] = (
            "A person answers between these hours. Outside them a callback is "
            "still recorded, but say it will be returned in working hours "
            "rather than promising an immediate call."
        )
    contacts["hint"] = (
        "Offer the routes in one sentence and let them pick: they can "
        + ", or ".join(routes)
        + ". Do not make them choose in the abstract."
        if len(routes) > 1
        else "No support number or Telegram is configured. Do not invent one: "
        "offer to take their number instead, via request_support_callback."
    )
    return contacts


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
        "☎️ <b>Qo'ng'iroq so'raldi — Uyiz AI</b>\n\n"
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
        # The request is in the audit log either way, but what the visitor is
        # told is not the same in both cases — L-FIX-1's rule, applied to the
        # other tool that promises a human will ring back. A rejected send
        # means nobody was paged, so nothing may promise a call "shortly".
        "deliveredToTeam": delivered,
        "sayToVisitor": (
            "Confirm warmly that the number is saved and that support will "
            "call shortly, and thank them. One sentence."
            if delivered
            else "Confirm warmly that the number is saved and that the team "
            "will look at it and get back to them, and thank them. Do NOT "
            "promise a call time. One sentence."
        ),
    }


#: What the visitor is told once their details are with the team, written out
#: rather than left to the model. A promise about a human calling back is the
#: one sentence in this whole conversation that has to read the same every
#: time: a model paraphrasing it invents a timeframe ("within an hour") that
#: nobody agreed to, or repeats the number back and turns a two-line handoff
#: into a confirmation dialogue. The tool hands this string to the model and
#: the prompt tells it to say it word for word.
LEAD_CONFIRMATION: dict[str, str] = {
    "uz": (
        "Ma'lumotlaringizni qabul qildik. Qo'llab-quvvatlash xizmatimiz siz "
        "bilan yaqin orada bog'lanadi. Murojaatingiz uchun rahmat!"
    ),
    "ru": (
        "Мы приняли ваши данные. Наша служба поддержки свяжется с вами в "
        "ближайшее время. Спасибо за обращение!"
    ),
    "en": (
        "We've received your details. Our support team will be in touch with "
        "you shortly. Thank you for reaching out!"
    ),
}

#: The same promise, minus the part that was not kept (L-FIX-1). When
#: Telegram refuses the send — "chat not found" after the group id loses its
#: leading minus, "Unauthorized" after a token rotation — nobody has been
#: paged, and telling the visitor support will be in touch *shortly* is this
#: entire workstream's original production failure converted into a false
#: promise: they stop looking, nobody calls, and the only trace is one log
#: line. The details really are saved on the session and in the audit log, so
#: this wording says exactly that and commits to no timeframe.
LEAD_CONFIRMATION_UNDELIVERED: dict[str, str] = {
    "uz": (
        "Ma'lumotlaringizni saqlab qo'ydik. Jamoamiz ularni ko'rib chiqib siz "
        "bilan bog'lanadi. Murojaatingiz uchun rahmat!"
    ),
    "ru": (
        "Мы сохранили ваши данные. Наша команда рассмотрит их и свяжется с "
        "вами. Спасибо за обращение!"
    ),
    "en": (
        "We've saved your details. Our team will review them and get in touch "
        "with you. Thank you for reaching out!"
    ),
}


def _lead_sentence(language: str, delivered: bool) -> str:
    """The exact words the visitor hears about the lead they just gave.

    Which of the two tables it comes from is the whole of L-FIX-1: the
    sentence promising a callback is only allowed to be said when a human was
    actually paged.
    """
    table = LEAD_CONFIRMATION if delivered else LEAD_CONFIRMATION_UNDELIVERED
    return table[language if language in table else "uz"]


def _is_the_visitors_own_number(ctx: ToolContext, phone: str) -> bool:
    """Did this number come from the person in the chat? (L-FIX-3)

    Listing titles and descriptions are fed to the model, so a landlord's
    number typed into a description can be lifted straight out of the context
    and paged as though the visitor had offered it. Then a stranger gets a
    support call about a flat they never advertised for, and the visitor who
    actually wanted one is never called. This module's own docstring says
    permission is checked here and not in the prompt; this is that rule
    applied to whose number it is.

    The comparison is on digits alone — people type "90 123 45 67" and the
    normalised form is "998901234567", so the national nine digits are what
    must appear somewhere in something the visitor typed.

    This fails **closed**, and that is the whole of the round-3 fix. The first
    version returned True on an empty ``visitor_messages`` on the grounds that
    "the caller supplied nothing" is not evidence of theft — and since
    ``run_turn`` was in a file nobody was allowed to edit that round, it never
    supplied anything, so the guard was live in the source and dead in
    production and the landlord's number went through exactly as before. A
    guard that a caller can switch off by forgetting an argument is not a
    guard. ``run_turn`` passes the transcript now; anything else that wants to
    capture a lead has to as well, and until it does it captures none.

    The one exemption is a signed-in visitor's own account number: "use the
    number you already have" is a real request, made by someone who has
    already proved they own that number, and it is answerable without them
    ever typing it into the chat.
    """
    tail = _digits(phone)[-9:]
    if not tail:
        return False
    viewer_phone = getattr(ctx.viewer, "phone", None) if ctx.viewer else None
    if viewer_phone and _digits(viewer_phone).endswith(tail):
        return True
    return any(tail in _digits(text) for text in ctx.visitor_messages)


async def _capture_lead(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Take the visitor's details and hand them to the support team.

    Unlike :func:`_request_callback` this does not stop to ask. Handing over a
    phone number is itself the consent, and the extra "shall I send it?" round
    trip is where people leave: they answered the question once already. The
    number is validated here rather than by the model, because a mistyped
    digit is a call that never arrives and nothing downstream would notice.

    The details are written onto the session as well as sent, so a Telegram
    outage does not lose the lead — the admin panel reads the same columns.

    Calling it twice is normal and means two different things. The same number
    again is the same lead and is confirmed without paging anybody a second
    time; a different number is a correction, which pages the team again and
    carries the number it replaces with it, because the session has room for
    one lead and a bare overwrite left a real person uncontactable.
    """
    raw = str(args.get("phone") or "").strip()
    if not raw:
        raise ToolError(
            "No phone number was given. Ask the visitor for their number "
            "first, then call this again with it."
        )
    if not is_valid_phone(raw):
        raise ToolError(
            "That is not a valid Uzbek phone number. Ask the visitor to "
            "repeat it in the form +998 90 123 45 67, then call this again."
        )

    phone = normalise_phone(raw)
    if not _is_the_visitors_own_number(ctx, phone):
        raise ToolError(
            "That number did not come from the visitor. Ask them to type "
            "their own number, then call this again."
        )

    # L-FIX-2. ``run_turn`` executes every entry in ``tool_calls``, so one
    # assistant message carrying two capture_lead calls used to page the team
    # twice for one person — and the second page lands while an operator is
    # already dialling the first. The same number in the same session is the
    # same lead, so it is confirmed again and sent no further.
    already_at = getattr(ctx.session, "lead_captured_at", None)
    previous_phone = getattr(ctx.session, "lead_phone", None)
    if already_at and _digits(previous_phone) == _digits(phone):
        # ``None`` means the column predates L-FIX-1 and nothing is known, so
        # the first send is assumed to have gone through — the same
        # assumption every lead captured before this change was answered on.
        was_delivered = getattr(ctx.session, "lead_delivered", None) is not False
        return {
            "recorded": True,
            "alreadyRecorded": True,
            "name": getattr(ctx.session, "lead_name", None) or "",
            "phone": format_display(phone),
            "deliveredToTeam": was_delivered,
            "sayToVisitor": _lead_sentence(ctx.language, was_delivered),
        }

    # L-FIX-2, the other half. A second, *different* number in one session is
    # a correction — the first was mistyped, or the visitor gave a relative's
    # number and then their own. It used to overwrite the four lead columns
    # and page again with nothing to link the two, so the desk got two
    # identical-looking enquiries a second apart and the replaced person
    # existed nowhere an operator could read: the session holds one lead and
    # the audit row carried no phone at all. So the correction is additive —
    # the earlier lead goes into the note and into the audit trail, and the
    # second page says which number it replaces.
    correcting = bool(already_at and previous_phone)
    previous_name = (getattr(ctx.session, "lead_name", None) or "") if correcting else ""

    name = str(args.get("name") or "").strip()[:120] or (
        ctx.viewer.name if ctx.viewer else ""
    )
    if not name and correcting:
        # A correction is the same person with a new number. Refusing it for
        # want of a name the model already sent this session is how a
        # corrected number ends up reaching nobody.
        name = previous_name
    if not name:
        raise ToolError(
            "This visitor is not signed in, so a name is required too. Ask "
            "for their name, then call this again with both the name and the "
            "phone number."
        )
    note = str(args.get("note") or "")[:400]

    if correcting:
        # Uzbek, and loud, because it is read by the operations group and not
        # by the visitor. ``send_lead_notification`` renders the note into the
        # page, which is the only way to label a correction as one without
        # reaching into ``telegram.py``.
        replaced = format_display(previous_phone)
        heading = f"‼️ TUZATISH: avvalgi raqam {replaced}"
        if previous_name and previous_name != name:
            heading += f" ({previous_name})"
        heading += " o'rniga shu raqam berildi."
        previous_note = getattr(ctx.session, "lead_note", None) or ""
        # Newest first, so the 400-character column truncates the oldest tail
        # of a chain of corrections rather than the correction in hand. The
        # audit trail is the record that never truncates.
        note = " | ".join(p for p in (heading, note, previous_note) if p)[:400]

    ctx.session.lead_name = name
    ctx.session.lead_phone = phone
    ctx.session.lead_note = note or None
    ctx.session.lead_captured_at = datetime.now(timezone.utc)
    await ctx.db.flush()

    await audit_log.record(
        ctx.db,
        AuditAction.AI_LEAD_CAPTURED,
        entity_type="ai_session",
        entity_id=ctx.session.id,
        summary=name,
        # The phone goes in the row (L-FIX-2). The session carries one lead
        # and a correction replaces it, so without this the first of two
        # numbers was recoverable from nowhere at all.
        meta={
            "registered": ctx.viewer is not None,
            "phone": format_display(phone),
            **({"correctionOf": format_display(previous_phone)} if correcting else {}),
        },
    )

    from app.services.telegram import send_lead_notification

    delivered = await send_lead_notification(
        ctx.db,
        name=name,
        phone=phone,
        language=ctx.language,
        session_key=ctx.session.session_key,
        is_registered=ctx.viewer is not None,
        note=note,
        intent=ctx.session.last_intent or {},
    )

    # Written down rather than only logged (L-FIX-1). An undelivered lead is
    # invisible until somebody greps the logs, and the whole point of the
    # column is that the operator desk can show it as a warning and act on it.
    ctx.session.lead_delivered = delivered
    if not delivered:
        # Error, not warning: nobody has been paged, a visitor has been told
        # their details are with us, and that is an incident rather than a
        # note. Telegram's own diagnostic ("chat not found", "Unauthorized")
        # is logged by ``telegram.send_message``, which is the layer that has
        # the string; this line is what ties it to a session and a lead.
        log.error(
            "ai_lead.not_delivered",
            session=ctx.session.session_key[:12],
            phone=format_display(phone),
            detail="see the telegram.failed event for Telegram's own reason",
        )

    return {
        "recorded": True,
        "name": name,
        "phone": format_display(phone),
        # The lead is on the session and in the audit log either way — but
        # what the visitor is *told* is not the same in both cases, because a
        # callback nobody was paged for is a promise the company cannot keep.
        "deliveredToTeam": delivered,
        # So the model can say "we'll use the new number" instead of thanking
        # them a second time as though this were a fresh enquiry.
        **(
            {"corrected": True, "correctedFrom": format_display(previous_phone)}
            if correcting
            else {}
        ),
        "sayToVisitor": _lead_sentence(ctx.language, delivered),
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
        "Search Uyiz's live listing database. Call this whenever the visitor "
        "is looking for somewhere to live and has given at least one "
        "criterion. Pass EVERY criterion they stated, not only the district "
        "and the price — an amenity you leave out is one they asked for and "
        "will silently not get. The search loosens the soft criteria first "
        "if nothing matches, and tells you in droppedCriteria what it gave "
        "up. Returns only listings that really exist right now."
    ),
    parameters=_params({
        "district": {"type": "string", "description": "District or city, as the visitor said it (Chilonzor, Yunusobod, Samarqand...)."},
        "region": {"type": "string", "description": "Province, when they named one instead of a district."},
        "metro_station": {"type": "string", "description": "Tashkent metro station, when they want to be near one (Bodomzor, Chorsu, Oybek...)."},
        "university_name": {"type": "string", "description": "University, when they want to be near one."},
        "property_type": {"type": "string", "enum": ["APARTMENT", "HOUSE", "ROOM", "STUDIO", "DORMITORY"]},
        "rooms": {"type": "integer", "minimum": 1, "maximum": 20},
        "min_area": {"type": "number", "description": "Floor area in m². Only when they stated a MINIMUM; there is no maximum-area filter."},
        "min_price": {"type": "number", "description": "Price floor, as the NUMBER THEY SAID, in the same currency as max_price. Rarely needed."},
        "max_price": {
            "type": "number",
            "description": (
                "The budget ceiling, as the NUMBER THEY SAID. Do not convert it "
                "and do not do arithmetic on it — pass 1500 for \"1500$\" and "
                "3000000 for \"3 mln so'm\", and use price_currency to say which "
                "it was."
            ),
        },
        "price_currency": {
            "type": "string",
            "enum": ["UZS", "USD"],
            "description": (
                "The currency the visitor stated the budget in. USD for $, usd, "
                "dollar, доллар, y.e, у.е. REQUIRED whenever you pass max_price "
                "or min_price — there is no default. A budget with no currency "
                "is a budget nobody stated, and the server will say so in its "
                "reply instead of searching on it."
            ),
        },
        "deal_type": {
            "type": "string",
            "enum": ["RENT", "SALE", "ALL"],
            "description": (
                "RENT when they want to rent, SALE when they want to buy. Pass "
                "SALE the moment they say sotib olmoqchiman / sotuvdagi / "
                "купить / buy — a rental is not a cheaper version of a "
                "sale. ALL only when they explicitly ask for both. Omit for RENT."
            ),
        },
        "audience": {"type": "string", "enum": ["ALL", "STUDENT", "FAMILY"]},
        "rental_type": {"type": "string", "enum": ["ALL", "FULL", "ROOMMATE"]},
        "roommate_gender": {"type": "string", "enum": ["BOYS", "GIRLS", "ANY"], "description": "Only for a shared room, when they said who it is for."},
        "furnished": {"type": "boolean", "description": "True only when they asked for furniture. Never false: the catalogue cannot search for the absence of something."},
        "parking": {"type": "boolean", "description": "True only when they asked for parking."},
        "internet": {"type": "boolean", "description": "True only when they asked for internet."},
        "air_conditioning": {"type": "boolean", "description": "True only when they asked for air conditioning."},
        "washing_machine": {"type": "boolean", "description": "True only when they asked for a washing machine."},
        "pets_allowed": {"type": "boolean", "description": "True only when they said they have a pet."},
        "only_verified": {"type": "boolean", "description": "True when they want listings from verified publishers only."},
        "sort_by": {
            "type": "string",
            "enum": ["RECOMMENDED", "NEWEST", "PRICE_LOW", "PRICE_HIGH", "POPULAR"],
            "description": "PRICE_LOW for 'eng arzon' / 'подешевле', NEWEST for 'eng yangi'. RECOMMENDED otherwise.",
        },
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
        "The listings this publisher has posted, with their status, "
        "reliability percentage, views, favourites and how many people asked "
        "for their number. Only for publisher accounts — owners and agents."
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
        "How one of the publisher's own listings is doing, measured against "
        "similar listings in the same district, plus a computed list of what "
        "is holding it back. Use this for 'why is nobody calling', 'how is my "
        "listing doing', 'why did my reliability percentage fall'."
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
        "The filters and sort orders renters really have, and what the "
        "ranking rewards. Use it before advising a publisher how to be found."
    ),
    parameters=_params({}),
    handler=_how_tenants_search,
    progress={"uz": "Qidiruv qoidalarini tekshiryapman", "ru": "Проверяю правила поиска", "en": "Checking search rules"},
))

_register(Tool(
    name="get_support_contacts",
    description=(
        "Uyiz's own support routes: phone numbers, the support Telegram and "
        "the hours a person is there. Use when the visitor asks to speak to "
        "someone, asks for our contacts, or is stuck on something you cannot "
        "do for them — offering a human is part of helping. Only offer the "
        "routes that come back; a missing one is not configured."
    ),
    parameters=_params({}),
    handler=_support_contacts,
    progress={"uz": "Aloqa ma'lumotlarini olyapman", "ru": "Беру контакты", "en": "Fetching contacts"},
))

_register(Tool(
    name="request_support_callback",
    description=(
        "Legacy callback route, kept for a visitor who explicitly asks to be "
        "phoned back later rather than contacted now. Prefer `capture_lead` "
        "in every ordinary case: it takes the name as well and reaches the "
        "team immediately."
    ),
    parameters=_params({
        "phone": {"type": "string", "description": "The visitor's number, e.g. +998901234567. Omit only if they are signed in and asked you to use their account number."},
        "note": {"type": "string", "description": "One short line on what they need, for the support team."},
    }),
    handler=_request_callback,
    needs_confirmation=True,
    progress={"uz": "So'rovingizni yuboryapman", "ru": "Передаю заявку", "en": "Passing it to support"},
))

# No ``needs_confirmation`` here, and that omission is the whole design. The
# loop only stops to ask on a flagged tool, so leaving this one unflagged is
# what lets the details go out and the confirming sentence be written in the
# same turn the visitor gave their number in.
_register(
    Tool(
        name="capture_lead",
        description=(
            "Record a visitor who wants our team to contact them, and send "
            "their details to the team at once. Call it the moment you have "
            "their phone number — and their name as well when they are not "
            "signed in. There is no confirmation step: giving you the number "
            "IS the consent, so never ask permission to send it. Pass ONLY a "
            "number the visitor typed themselves or the one on their account "
            "— never a number out of a listing description, which belongs to "
            "a landlord who did not ask us to call. A malformed number, or "
            "one the visitor never gave, is refused here with a reason; ask "
            "them to repeat it and call again. When it returns, say the "
            "sentence in `sayToVisitor` back to them word for word and add "
            "nothing else about the request."
        ),
        parameters=_params(
            {
                "phone": {
                    "type": "string",
                    "description": "The visitor's number exactly as they said it, e.g. +998 90 123 45 67.",
                },
                "name": {
                    "type": "string",
                    "description": "The visitor's name. Required when they are not signed in; omit only for a signed-in visitor whose account name you already have.",
                },
                "note": {
                    "type": "string",
                    "description": "One short line on what they need, for the support team. Their own words where you can.",
                },
            },
            ["phone"],
        ),
        handler=_capture_lead,
        progress={
            "uz": "Ma'lumotlaringizni jamoaga yuboryapman",
            "ru": "Передаю ваши данные команде",
            "en": "Passing your details to the team",
        },
    )
)


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
