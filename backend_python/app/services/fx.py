"""What a dollar is worth in so'm today.

An agent prices a flat at $500 and a visitor browsing in so'm has to be shown
a number that means the same thing. That conversion is only honest if the rate
is close to real: the hardcoded 12 700 this replaces was 7.5% away from the
Central Bank's own figure, which on a $500 listing is a difference of about
443 000 so'm — larger than the gap between two listings a searcher is choosing
between.

The rate comes from the Central Bank of Uzbekistan, is fetched at most once an
hour, and falls back to ``settings.USD_TO_UZS_RATE`` if the bank cannot be
reached. A slightly stale rate is fine; a missing one is not, because every
price on the site would have to stop rendering.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/"

#: How long a fetched rate is reused. The bank publishes once a working day,
#: so anything under a day is already fresher than the source — an hour just
#: means a restart or a rate change is picked up the same morning.
TTL_SECONDS = 3600

#: Bounds a plausible rate. The point is not precision but catching a response
#: that parsed without erroring and is nonsense anyway — a "0", a "1", an HTML
#: error page that happened to contain a number. Publishing one of those would
#: silently multiply or erase every converted price on the site.
MIN_RATE = 5_000.0
MAX_RATE = 100_000.0

#: (rate, fetched_at). Module-level rather than a cache library because it is
#: one number per process and the fallback makes a cold start harmless.
_cached: tuple[float, float] | None = None


def _parse(payload: Any) -> float | None:
    """Pull the rate out of the bank's response, or ``None``.

    The response is a one-element list of objects with the rate as a *string*.
    Everything here is defensive on purpose: this is a third-party endpoint
    with no contract with us, and the failure it must never produce is a
    plausible-looking wrong number.
    """
    if isinstance(payload, list):
        payload = payload[0] if payload else None
    if not isinstance(payload, dict):
        return None
    try:
        rate = float(str(payload.get("Rate", "")).replace(",", "."))
    except (TypeError, ValueError):
        return None
    if not (MIN_RATE <= rate <= MAX_RATE):
        return None
    return rate


async def usd_to_uzs() -> float:
    """UZS per 1 USD. Never raises, never returns zero."""
    global _cached
    now = time.monotonic()
    if _cached and now - _cached[1] < TTL_SECONDS:
        return _cached[0]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(CBU_URL)
        rate = _parse(response.json()) if response.is_success else None
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("fx.fetch_failed", error=str(exc), error_type=type(exc).__name__)
        rate = None

    if rate is None:
        # The previous value outlives its TTL rather than being dropped. A
        # rate from an hour ago is far better than the static default, and the
        # bank being briefly unreachable should not move every price on the
        # site.
        if _cached:
            log.warning("fx.using_stale", rate=_cached[0])
            return _cached[0]
        log.warning("fx.using_default", rate=settings.USD_TO_UZS_RATE)
        return settings.USD_TO_UZS_RATE

    _cached = (rate, now)
    log.info("fx.updated", rate=rate)
    return rate
