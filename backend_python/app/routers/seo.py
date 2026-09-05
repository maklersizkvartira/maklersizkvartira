"""The listing sitemap, and the facet counts the build uses to prune it.

Listings appear and expire between deploys, so their sitemap cannot be a build
artefact — it is served here and proxied onto ``uyiz.uz`` by a rewrite,
which keeps every URL it publishes on the same host that serves them.

Two rules this module exists to enforce:

* Nothing enters the sitemap that a visitor could not open. Only approved,
  undeleted, unexpired listings are listed, in exactly the same shape the
  frontend's canonical URL takes.
* The query stays cheap. ``GET /listings`` returns whole listing objects,
  base64 photos included; enumerating the catalogue through it would move
  hundreds of megabytes per crawl. The statements here select four columns.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Query, Response
from sqlalchemy import ColumnElement, and_, func, select, true

from app.core.config import settings
from app.core.deps import DbSession
from app.models.enums import DealType
from app.models.listing import Listing
from app.schemas.listing import ListingFilters
from app.services.listings import apply_filters, visible_clause

router = APIRouter(tags=["seo"])

LANGUAGES = ("uz", "ru", "en")

#: The sitemap protocol's hard ceiling.
MAX_URLS = 50_000
#: Every listing is published once per language, so the listing cap is the URL
#: cap divided by the language count — not the URL cap itself. Emitting 20 000
#: listings produced 60 000 <url> entries and Google rejected the whole file.
MAX_LISTINGS = MAX_URLS // len(LANGUAGES)
#: Uzbek is the default and lives at the bare root.
LANGUAGE_PREFIX = {"uz": "", "ru": "/ru", "en": "/en"}

#: Every apostrophe Uzbek Latin uses for oʻ, gʻ and the glottal stop.
_APOSTROPHES = "'‘’ʻʼ`´"

#: The administrative abbreviations, matched exactly as the TypeScript does.
#: Plain `endswith(" sh.")` diverged from it on "SH.", on a double space, and
#: on "tum." entirely — and a slug that differs by one letter turns a listing
#: into two pages that each name the other as the original.
_ADMIN_SUFFIXES = (
    (re.compile(r"\s+sh\.$", re.IGNORECASE), " shahri"),
    (re.compile(r"\s+t\.$", re.IGNORECASE), " tumani"),
    (re.compile(r"\s+tum\.$", re.IGNORECASE), " tumani"),
)


def slugify(value: str) -> str:
    """The Python half of ``src/seo/slugs.ts``.

    It has to agree with the TypeScript character for character: the sitemap
    publishes the URL, the frontend publishes the canonical tag, and a slug
    that differs by one letter turns every listing into two pages that each
    claim the other is the original.
    """
    text = value.strip()
    for pattern, replacement in _ADMIN_SUFFIXES:
        text = pattern.sub(replacement, text)

    # NFD, then drop the combining marks, so an accented letter collapses onto
    # its base rather than disappearing.
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = "".join(ch for ch in text if ch not in _APOSTROPHES)
    text = text.lower()

    out: list[str] = []
    for ch in text:
        out.append(ch if ("a" <= ch <= "z" or "0" <= ch <= "9") else "-")
    return "-".join(part for part in "".join(out).split("-") if part)


def listing_slug(title: str | None, district: str | None) -> str:
    """``chilonzorda-2-xonali-kvartira`` — capped at eight words, like the client."""
    parts = " ".join(filter(None, [district or "", title or ""]))
    words = [word for word in slugify(parts).split("-") if word][:8]
    return "-".join(words) or "elon"


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _url_for(path: str, language: str) -> str:
    # The trailing slash is stripped here rather than trusted from config: the
    # build-time generator strips it too, and one of the two keeping it would
    # publish `https://uyiz.uz//e/...` for every listing.
    origin = settings.SITE_URL.rstrip("/")
    prefix = LANGUAGE_PREFIX[language]
    return f"{origin}{prefix}{path}"


@router.get(
    "/sitemap-listings.xml",
    include_in_schema=False,
    response_class=Response,
    summary="Every publicly visible listing, for search engines",
)
async def sitemap_listings(db: DbSession) -> Response:
    rows = (
        await db.execute(
            select(
                Listing.id,
                Listing.title,
                Listing.district,
                Listing.updated_at,
            )
            .where(visible_clause())
            .order_by(Listing.created_at.desc())
            .limit(MAX_LISTINGS)
        )
    ).all()

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]

    for listing_id, title, district, updated_at in rows:
        path = f"/e/{listing_slug(title, district)}-{listing_id}"
        lastmod = (updated_at or datetime.now(timezone.utc)).date().isoformat()
        alternates = [
            f'    <xhtml:link rel="alternate" hreflang="{lang}" '
            f'href="{_escape(_url_for(path, lang))}"/>'
            for lang in LANGUAGES
        ]
        alternates.append(
            '    <xhtml:link rel="alternate" hreflang="x-default" '
            f'href="{_escape(_url_for(path, "uz"))}"/>'
        )
        for lang in LANGUAGES:
            lines.append("  <url>")
            lines.append(f"    <loc>{_escape(_url_for(path, lang))}</loc>")
            lines.extend(alternates)
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
            lines.append("    <changefreq>weekly</changefreq>")
            lines.append("  </url>")

    lines.append("</urlset>")

    return Response(
        content="\n".join(lines),
        media_type="application/xml",
        headers={
            # This route is outside the API prefix precisely so it escapes the
            # blanket `no-store`: a sitemap that cannot be cached is refetched
            # in full by every crawler on every pass.
            "Cache-Control": "public, max-age=1800, s-maxage=3600",
        },
    )


#: The whole set of ceilings is answered by one aggregate pass, so this cap is
#: only here to stop an unbounded query string from growing the SELECT list.
MAX_BUDGET_CEILINGS = 8


def _facet_clause(**filters: Any) -> ColumnElement[bool]:
    """The catalogue's own predicate for a landing page's filters.

    Read off ``apply_filters`` rather than restated here. STUDENT and FAMILY
    are not columns — they are derived from the university field, the roommate
    flag, a district list and the room count — and a count built from a second,
    almost-identical definition would prune pages the site still fills, which
    is a worse outcome than never pruning at all. Going through the real filter
    also means the count and the grid the visitor lands on cannot disagree.
    """
    # The static rate, deliberately, and it is never used: the rate reaches
    # `apply_filters` only through the price bounds, and a landing page's
    # facets are geography, category and audience — never a price. Fetching
    # the live one would mean making this helper and its callers async for a
    # value that cannot affect the result.
    clause = apply_filters(
        select(Listing.id), ListingFilters(**filters), settings.USD_TO_UZS_RATE
    ).whereclause
    return true() if clause is None else clause


def _tally(clause: ColumnElement[bool]) -> ColumnElement[int]:
    """One conditional count, so every derived axis rides on a single pass."""
    return func.count().filter(clause)


@router.get(
    "/api/v1/meta/seo-facets",
    include_in_schema=False,
    summary="How many public listings each landing page would have",
)
async def seo_facets(
    db: DbSession,
    budget: Annotated[list[int] | None, Query()] = None,
) -> dict:
    """Counts per place, per property type, per place × property type, and per
    derived audience.

    The build reads this to leave empty facets out of the sitemap. A landing
    page with nothing on it is thin content: it stays on the site, keeps its
    links, and takes itself out of the index — but there is no reason to
    invite a crawler to it.

    The composite counts exist because testing the axes independently is not
    the same question. ``/toshkent/bektemir/uy-ijaraga`` was submitted whenever
    Bektemir held any listing at all and a house existed anywhere in the
    country, then rendered `noindex` because that intersection was empty —
    which Search Console files as "Submitted URL marked noindex", an error
    rather than a warning.

    Place × property type is composited, and so are the two derived axes that
    now have geography of their own: ``sheriklikka-ijara`` gained region and
    district pages and ``arzon-ijara`` gained region pages. A national scalar
    would there say "some roommate listing exists somewhere in the country"
    while the page it guards shows one district — submitting a page that then
    renders ``noindex``, the exact failure the composites were added to kill.

    ``talabalar-uchun-ijara`` and ``oilalar-uchun-ijara`` stay scalar-only
    because they still have no place pages. If either gains one, its composite
    is one more FILTER expression in ``place_derived_counts`` — and until it is
    added the pruning silently stops working for those pages, so check this
    against ``src/seo/taxonomy.ts`` whenever that file's page flags change.

    ``budget`` is asked for by value — ``?budget=3000000`` — and answered keyed
    by the same value. The ceiling belongs to the frontend taxonomy; naming a
    bucket here instead would put a second copy of that constant in the API,
    where nobody would remember to change it.
    """
    ceilings = sorted({value for value in (budget or []) if value > 0})[
        :MAX_BUDGET_CEILINGS
    ]

    # Rentals only, in every count on this endpoint. Each landing page these
    # numbers gate is a rental page — `_landing_clause` builds its predicate
    # from `ListingFilters`, which defaults to RENT — so counting sales here
    # keeps a page in the sitemap on the strength of listings that page will
    # never show. It then renders empty and marks itself `noindex`, which is
    # the one outcome the pruning exists to avoid.
    rent_only = Listing.deal_type == DealType.RENT.value

    async def counts(column):
        rows = (
            await db.execute(
                select(column, func.count())
                .where(and_(visible_clause(), rent_only, column.isnot(None)))
                .group_by(column)
            )
        ).all()
        return {str(key): int(value) for key, value in rows if key}

    async def place_counts(column) -> tuple[dict[str, int], dict[str, int]]:
        """A place's own total and its per-property-type breakdown, in one pass.

        The total is summed from the breakdown rather than counted separately
        so the two cannot disagree under a concurrent write: a district that
        reported listings while every one of its type pairs reported none would
        prune all its children and keep the parent, which is the exact
        inconsistency the pruning reads as truth.
        """
        rows = (
            await db.execute(
                select(column, Listing.property_type, func.count())
                .where(and_(visible_clause(), rent_only, column.isnot(None)))
                .group_by(column, Listing.property_type)
            )
        ).all()

        totals: dict[str, int] = {}
        composite: dict[str, int] = {}
        for place, property_type, value in rows:
            if not place:
                continue
            place = str(place)
            totals[place] = totals.get(place, 0) + int(value)
            if property_type:
                composite[f"{place}|{property_type}"] = int(value)
        return totals, composite

    async def place_derived_counts(column) -> tuple[dict[str, int], dict[str, int]]:
        """A place's roommate and per-ceiling budget tallies, in one pass.

        Separate from ``place_counts`` because property type is in that
        GROUP BY: asking there would split every roommate tally across five
        property types and answer a question nobody asks. Grouping by place
        alone and counting with FILTER keeps it to one extra query per place
        column, whatever the number of ceilings.
        """
        rows = (
            await db.execute(
                select(
                    column,
                    _tally(_facet_clause(rental_type="ROOMMATE")),
                    *(_tally(_facet_clause(max_price=ceiling)) for ceiling in ceilings),
                )
                .where(and_(visible_clause(), column.isnot(None)))
                .group_by(column)
            )
        ).all()

        roommate_by_place: dict[str, int] = {}
        budget_by_place: dict[str, int] = {}
        for place, roommate_count, *ceiling_counts in rows:
            if not place:
                continue
            place = str(place)
            if roommate_count:
                roommate_by_place[place] = int(roommate_count)
            for ceiling, value in zip(ceilings, ceiling_counts, strict=True):
                if value:
                    budget_by_place[f"{place}|{ceiling}"] = int(value)
        return roommate_by_place, budget_by_place

    regions, region_property_types = await place_counts(Listing.region)
    districts, district_property_types = await place_counts(Listing.district)
    region_roommate, region_budget = await place_derived_counts(Listing.region)
    district_roommate, district_budget = await place_derived_counts(Listing.district)

    total, roommate, student, family, *budgets = (
        await db.execute(
            select(
                func.count(),
                _tally(_facet_clause(rental_type="ROOMMATE")),
                _tally(_facet_clause(audience="STUDENT")),
                # Both halves of the category's filters, not just the audience:
                # the page shows the intersection, so the count has to as well.
                _tally(_facet_clause(audience="FAMILY", rental_type="FULL")),
                *(_tally(_facet_clause(max_price=ceiling)) for ceiling in ceilings),
            )
            .select_from(Listing)
            .where(visible_clause())
        )
    ).one()

    return {
        "status": "success",
        "data": {
            "total": int(total),
            "regions": regions,
            "districts": districts,
            "propertyTypes": await counts(Listing.property_type),
            "regionPropertyTypes": region_property_types,
            "districtPropertyTypes": district_property_types,
            "regionRoommate": region_roommate,
            "districtRoommate": district_roommate,
            "regionBudget": region_budget,
            "districtBudget": district_budget,
            "roommate": int(roommate),
            "student": int(student),
            "family": int(family),
            # strict, because a ceiling silently paired with another ceiling's
            # count prunes the wrong page and looks like a correct answer.
            "budget": {
                str(ceiling): int(value)
                for ceiling, value in zip(ceilings, budgets, strict=True)
            },
        },
    }
