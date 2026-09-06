"""What the assistant actually costs, read from OpenAI itself.

Why this is a separate key and a separate module
------------------------------------------------
"OpenAI balansi kelmayapti" — the balance never arrives — and it never will,
because there is nothing to arrive. OpenAI publishes no credit balance for an
ordinary ``sk-...`` API key: ``/dashboard/billing/credit_grants`` was
withdrawn, and every panel still calling it is reading a 404. That is why
``ai_usage`` has always reported ``costAvailable: False``.

The one route that does answer is the organisation Costs API, and it will not
take the key the assistant runs on. It needs an *admin* key — ``sk-admin-...``,
created at platform.openai.com under Organization -> Admin keys — and returns
401 to anything else. Hence ``OPENAI_ADMIN_KEY``, separate from
``OPENAI_API_KEY``, and hence this module rather than a few lines inside the
agent's provider call.

Nothing here estimates
----------------------
There is no path through this file that turns a token count into a sum of
money. When the call does not answer, the payload carries no figure at all and
a machine-readable ``reason`` the panel translates into a sentence. A wrong
number on a billing screen is worse than an admitted gap: the gap sends
somebody to the OpenAI dashboard, the wrong number does not.

Costs land in UTC day buckets, so "today" here is the UTC day — the same day
boundary the rest of the admin dashboard counts by, five hours behind
Tashkent's. Nothing is gained by shifting it: OpenAI does not bucket by our
timezone, and a spliced figure would be ours rather than theirs.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_URL = "https://api.openai.com/v1/organization/costs"
#: Costs are not on the request path of anything a visitor waits for, but the
#: dashboard is, so this stays well under the panel's own patience.
_TIMEOUT = httpx.Timeout(10.0, connect=4.0)

#: Buckets of one day, which is the only width the endpoint offers, and enough
#: of them to cover the longest month.
_BUCKET_WIDTH = "1d"
_MAX_BUCKETS = 31

#: Where the key is made. Sent in the payload so the panel can link to it
#: without hardcoding a provider URL of its own.
ADMIN_KEY_ENV_VAR = "OPENAI_ADMIN_KEY"
ADMIN_KEY_DOCS_URL = "https://platform.openai.com/settings/organization/admin-keys"

#: This is a paid, rate-limited, cross-network call and the dashboard polls.
#: Five minutes on a good answer; one on a bad one, so a key that was just
#: fixed shows up quickly while a broken one is not retried on every poll.
SUCCESS_TTL_SECONDS = 300.0
FAILURE_TTL_SECONDS = 60.0

_cached: dict[str, Any] | None = None
_cached_until: float = 0.0
#: The UTC day the cached figures were summed over. See `month_to_date`.
_cached_day: int = 0


def _unavailable(reason: str, **extra: Any) -> dict[str, Any]:
    """A cost block with no money in it, and the reason why.

    The keys are always the same whether or not the figure exists, so the panel
    reads one shape and never has to guess which half of a union it holds.
    """
    return {
        "available": False,
        "reason": reason,
        "currency": None,
        "monthToDateUsd": None,
        "todayUsd": None,
        "periodStart": None,
        "asOf": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "envVar": ADMIN_KEY_ENV_VAR,
        "docsUrl": ADMIN_KEY_DOCS_URL,
        **extra,
    }


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _day_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _sum_buckets(body: dict[str, Any]) -> dict[str, Any]:
    """Add up the day buckets: everything, and today's alone.

    A bucket holds a list of results because the endpoint can group by project
    or line item. We ask for neither, so there is normally one — but summing
    the list costs nothing and stops a future ``group_by`` from silently
    reporting a fraction of the spend.

    The shape is checked before any figure is claimed. ``data`` missing, null,
    or anything but a list means this 200 was not the answer we asked for — an
    organisation without the costs entitlement, a proxy's own JSON page, a
    gateway error served with the wrong status — and ``or []`` would have
    turned every one of those into a confident ``$0.00``, which reads as "the
    assistant is free" rather than as "we could not find out". ``has_more``
    means the month came back truncated, and a fraction of a total presented
    as the total is the same lie by a different route. Both answer with no
    figure at all, which is what the panel is built to render.

    An organisation that genuinely spent nothing still answers ``data: []`` —
    a list — and correctly totals zero.
    """
    buckets = body.get("data")
    if not isinstance(buckets, list) or body.get("has_more") is True:
        return _unavailable("provider_error")

    today_from = int(_day_start().timestamp())
    month_total = 0.0
    today_total = 0.0
    currency: str | None = None

    for bucket in buckets:
        if not isinstance(bucket, dict):
            continue
        started = bucket.get("start_time")
        bucket_total = 0.0
        for result in bucket.get("results") or []:
            amount = (result or {}).get("amount") or {}
            try:
                bucket_total += float(amount.get("value") or 0)
            except (TypeError, ValueError):
                continue
            currency = currency or (amount.get("currency") or None)
        month_total += bucket_total
        if isinstance(started, (int, float)) and started >= today_from:
            today_total += bucket_total

    return {
        "available": True,
        "reason": None,
        "currency": (currency or "usd").lower(),
        # Four places, not two: a day of gpt-4o-mini traffic is routinely a
        # fraction of a cent, and rounding it to 0.00 reads as "free".
        "monthToDateUsd": round(month_total, 4),
        "todayUsd": round(today_total, 4),
        "periodStart": _month_start().isoformat(),
        "asOf": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "envVar": ADMIN_KEY_ENV_VAR,
        "docsUrl": ADMIN_KEY_DOCS_URL,
    }


async def _fetch() -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(
                _URL,
                headers={"Authorization": f"Bearer {settings.OPENAI_ADMIN_KEY}"},
                params={
                    "start_time": int(_month_start().timestamp()),
                    "bucket_width": _BUCKET_WIDTH,
                    "limit": _MAX_BUCKETS,
                },
            )
    except httpx.TimeoutException:
        log.warning("openai_costs.timeout")
        return _unavailable("provider_unreachable")
    except httpx.HTTPError as exc:
        log.warning("openai_costs.transport", error=str(exc))
        return _unavailable("provider_unreachable")

    if response.status_code in (401, 403):
        # Almost always an ordinary API key pasted into OPENAI_ADMIN_KEY, which
        # is the mistake this whole feature exists to explain — so it gets its
        # own reason rather than being folded into "provider error".
        log.warning("openai_costs.key_rejected", status=response.status_code)
        return _unavailable("key_rejected", status=response.status_code)

    if not response.is_success:
        log.warning(
            "openai_costs.provider_error",
            status=response.status_code,
            body=response.text[:200],
        )
        return _unavailable("provider_error", status=response.status_code)

    try:
        return _sum_buckets(response.json())
    except (ValueError, TypeError, AttributeError) as exc:
        log.warning("openai_costs.bad_shape", error=str(exc))
        return _unavailable("provider_error")


async def month_to_date() -> dict[str, Any]:
    """Spend this month and today, or the reason there is none to show.

    Never raises. The usage counts this block travels beside are read from our
    own database and are always right; a provider that is having a bad morning
    must not take them off the screen with it.
    """
    global _cached, _cached_until, _cached_day

    if not settings.OPENAI_ADMIN_KEY:
        # No network call to make, and nothing to cache: the answer changes the
        # moment the variable is set, and a restart is what sets it.
        return _unavailable("no_admin_key")

    # The day the cached figures were computed against, not just how long ago.
    #
    # `todayUsd` is a sum over one UTC day, decided when the payload was
    # fetched. Serving it on elapsed time alone means a payload fetched at
    # 23:58 UTC is still answering at 00:03 — so for five minutes after 05:00
    # in Tashkent, "Bugun" is yesterday's spend under today's label, and on the
    # first of a month the dashboard's month-to-date is last month's total.
    # Cheap to check, and it costs one extra call a day.
    today_start = int(_day_start().timestamp())
    if (
        _cached is not None
        and time.monotonic() < _cached_until
        and _cached_day == today_start
    ):
        return {**_cached, "cached": True}

    try:
        payload = await _fetch()
    except Exception:  # noqa: BLE001 - a bug here must not empty the card
        log.exception("openai_costs.unexpected")
        return _unavailable("provider_error")

    _cached = payload
    _cached_day = today_start
    _cached_until = time.monotonic() + (
        SUCCESS_TTL_SECONDS if payload["available"] else FAILURE_TTL_SECONDS
    )
    return payload
