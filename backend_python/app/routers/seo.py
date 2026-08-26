"""The listing sitemap, and the facet counts the build uses to prune it.

Listings appear and expire between deploys, so their sitemap cannot be a build
artefact — it is served here and proxied onto ``maklersizuy.uz`` by a rewrite,
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

import unicodedata
from datetime import datetime, timezone

from fastapi import APIRouter, Response
from sqlalchemy import and_, func, or_, select

from app.core.config import settings
from app.core.deps import DbSession
from app.models.enums import ListingStatus
from app.models.listing import Listing

router = APIRouter(tags=["seo"])

#: Sitemaps are capped at 50 000 URLs by the protocol. Well below it, and low
#: enough that the response stays a sensible size.
MAX_URLS = 20_000

LANGUAGES = ("uz", "ru", "en")
#: Uzbek is the default and lives at the bare root.
LANGUAGE_PREFIX = {"uz": "", "ru": "/ru", "en": "/en"}

#: Every apostrophe Uzbek Latin uses for oʻ, gʻ and the glottal stop.
_APOSTROPHES = "'‘’ʻʼ`´"


def _visible_clause():
    now = datetime.now(timezone.utc)
    return and_(
        Listing.deleted_at.is_(None),
        Listing.status == ListingStatus.APPROVED.value,
        or_(Listing.expires_at.is_(None), Listing.expires_at > now),
    )


def slugify(value: str) -> str:
    """The Python half of ``src/seo/slugs.ts``.

    It has to agree with the TypeScript character for character: the sitemap
    publishes the URL, the frontend publishes the canonical tag, and a slug
    that differs by one letter turns every listing into two pages that each
    claim the other is the original.
    """
    text = value.strip()
    if text.endswith(" sh."):
        text = f"{text[:-4]} shahri"
    elif text.endswith(" t."):
        text = f"{text[:-3]} tumani"

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
    prefix = LANGUAGE_PREFIX[language]
    return f"{settings.SITE_URL}{prefix}{path}"


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
            .where(_visible_clause())
            .order_by(Listing.created_at.desc())
            .limit(MAX_URLS)
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


@router.get(
    "/api/v1/meta/seo-facets",
    include_in_schema=False,
    summary="How many public listings each landing page would have",
)
async def seo_facets(db: DbSession) -> dict:
    """Counts per region, per district and per property type.

    The build reads this to leave empty facets out of the sitemap. A landing
    page with nothing on it is thin content: it stays on the site, keeps its
    links, and takes itself out of the index — but there is no reason to
    invite a crawler to it.
    """
    async def counts(column):
        rows = (
            await db.execute(
                select(column, func.count())
                .where(and_(_visible_clause(), column.isnot(None)))
                .group_by(column)
            )
        ).all()
        return {str(key): int(value) for key, value in rows if key}

    roommate = (
        await db.execute(
            select(func.count()).where(
                and_(_visible_clause(), Listing.is_roommate.is_(True))
            )
        )
    ).scalar_one()

    total = (await db.execute(select(func.count()).where(_visible_clause()))).scalar_one()

    return {
        "status": "success",
        "data": {
            "total": int(total),
            "regions": await counts(Listing.region),
            "districts": await counts(Listing.district),
            "propertyTypes": await counts(Listing.property_type),
            "roommate": int(roommate),
        },
    }
