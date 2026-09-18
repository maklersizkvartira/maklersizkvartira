"""One line to the operations group when something lands in the admin queue.

Until this existed, a verification request, a complaint, a Top request, a
support message or a payment reached the database and nothing else: the
only way to learn of it was to open the panel and look. The AI assistant
already reported its leads to the Telegram group, so the group is where
operators watch — these join it.

Every alert is best-effort. The request that produced the event has
already succeeded by the time this runs, and a Telegram outage must not
turn a filed complaint into a 500, so failures are logged (by the
transport) and swallowed here.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.core.config import settings
from app.services.telegram import _esc, send_message

log = structlog.get_logger(__name__)

ADMIN_URL = "https://maklersizkvartirauz-admin-seo.vercel.app/uz"


def _link(path: str, label: str) -> str:
    return f'<a href="{ADMIN_URL}{path}">{_esc(label)}</a>'


#: Tasks in flight, held so the event loop does not collect one mid-send.
_IN_FLIGHT: set[asyncio.Task[Any]] = set()


async def _deliver(text: str, *, context: str) -> None:
    try:
        # No session: the request that raised the alert has finished with
        # its own, and this runs after it. The audit row the transport would
        # write is skipped for these; the structured log still records them.
        await send_message(None, text, context=context)
    except Exception as exc:  # noqa: BLE001 - a notification never fails anything
        log.warning("ops_alert.failed", context=context, error=str(exc))


async def _alert(db: Any, text: str, *, context: str) -> None:
    """Queue the message and return at once.

    Awaiting the send would hold the caller for as long as Telegram takes —
    up to the transport's 8s timeout — and two of the callers are the Click
    and Payme webhooks, which the gateways time out and retry.
    """
    del db  # accepted for symmetry with the transport; see _deliver
    if not settings.OPS_ALERTS_ENABLED or settings.ENVIRONMENT == "test":
        return
    task = asyncio.get_running_loop().create_task(_deliver(text, context=context))
    _IN_FLIGHT.add(task)
    task.add_done_callback(_IN_FLIGHT.discard)


async def verification_submitted(db: Any, *, user_name: str, phone: str, document_type: str, target_level: int) -> None:
    await _alert(
        db,
        "🪪 <b>Yangi tasdiqlash so‘rovi</b>\n"
        f"👤 {_esc(user_name)} · <code>{_esc(phone)}</code>\n"
        f"📄 {_esc(document_type)} → {target_level}-daraja\n"
        f"➡️ {_link('/verifications', 'Tasdiqlashlar')}",
        context="verification_submitted",
    )


async def report_filed(db: Any, *, listing_title: str, reason: str, reporter: str, priority: str) -> None:
    await _alert(
        db,
        "🚩 <b>Yangi shikoyat</b>\n"
        f"🏠 {_esc(listing_title[:80])}\n"
        f"⚠️ {_esc(reason)} · {_esc(priority)}\n"
        f"👤 {_esc(reporter)}\n"
        f"➡️ {_link('/reports', 'Shikoyatlar')}",
        context="report_filed",
    )


async def top_requested(db: Any, *, listing_title: str, owner_name: str, days: int) -> None:
    await _alert(
        db,
        "⭐ <b>Top so‘rovi</b>\n"
        f"🏠 {_esc(listing_title[:80])}\n"
        f"👤 {_esc(owner_name)} · {days} kun\n"
        f"➡️ {_link('/top-requests', 'Top so‘rovlari')}",
        context="top_requested",
    )


async def support_message(db: Any, *, user_name: str, phone: str, text: str) -> None:
    await _alert(
        db,
        "💬 <b>Support: yangi xabar</b>\n"
        f"👤 {_esc(user_name)} · <code>{_esc(phone)}</code>\n"
        f"«{_esc(text[:200])}»\n"
        f"➡️ {_link('/support', 'Javob berish')}",
        context="support_message",
    )


async def payment_received(db: Any, *, user_name: str, phone: str, amount: float, provider: str) -> None:
    await _alert(
        db,
        "💳 <b>To‘lov tushdi</b>\n"
        f"👤 {_esc(user_name)} · <code>{_esc(phone)}</code>\n"
        f"💰 {int(amount):,} so‘m · {_esc(provider)}\n"
        f"➡️ {_link('/payments', 'To‘lovlar')}",
        context="payment_received",
    )


async def service_purchased(db: Any, *, user_name: str, phone: str, service: str, cost: float) -> None:
    await _alert(
        db,
        "🛒 <b>Xizmat sotib olindi</b>\n"
        f"👤 {_esc(user_name)} · <code>{_esc(phone)}</code>\n"
        f"📦 {_esc(service)} · {int(cost):,} so‘m\n"
        f"➡️ {_link('/payments', 'To‘lovlar')}",
        context="service_purchased",
    )


__all__ = [
    "payment_received",
    "report_filed",
    "service_purchased",
    "support_message",
    "top_requested",
    "verification_submitted",
]

