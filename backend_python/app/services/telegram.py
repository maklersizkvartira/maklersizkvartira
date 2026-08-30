"""Telegram notifications for the operations group."""

from __future__ import annotations

import html
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import structlog

from app.core import audit as audit_log
from app.core.config import settings
from app.core.phone import format_display
from app.models.enums import AuditAction

log = structlog.get_logger(__name__)

_TIMEOUT = httpx.Timeout(8.0, connect=4.0)
TASHKENT = ZoneInfo("Asia/Tashkent")


def _esc(value: Any) -> str:
    """Escape for Telegram's HTML parse mode.

    Without this, a listing title containing ``<`` breaks the message - or
    worse, lets a user inject markup into the operations feed.
    """
    return html.escape(str(value if value is not None else ""), quote=False)


async def send_message(db, text: str, *, context: str = "notification") -> bool:
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_GROUP_ID:
        return False
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN.strip()}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": settings.TELEGRAM_GROUP_ID.strip(),
                    "text": text[:4000],
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
        ok = response.is_success
    except httpx.HTTPError as exc:
        log.warning("telegram.failed", error=str(exc))
        ok = False

    if db is not None:
        await audit_log.record(
            db,
            AuditAction.TELEGRAM_NOTIFIED,
            entity_type="telegram",
            summary=context,
            meta={"delivered": ok},
        )
    return ok


async def send_chat_summary(
    db,
    *,
    user_name: str,
    user_phone: str | None,
    intent: dict[str, Any],
    summary: str,
    message_count: int,
) -> bool:
    now = datetime.now(TASHKENT).strftime("%d.%m.%Y %H:%M")
    details: list[str] = []
    if intent.get("district"):
        details.append(f"📍 <b>Tuman:</b> {_esc(intent['district'])}")
    if intent.get("rooms"):
        details.append(f"🏠 <b>Xonalar:</b> {_esc(intent['rooms'])}")
    if intent.get("maxPrice"):
        details.append(f"💰 <b>Maks narx:</b> {int(intent['maxPrice']):,} so'm".replace(",", " "))

    block = ("\n".join(details) + "\n\n") if details else ""
    phone = format_display(user_phone) if user_phone else "Kiritilmadi"

    text = (
        "📋 <b>Uyiz AI — suhbat xulosasi</b> 🛡️\n\n"
        f"👤 <b>Mijoz:</b> {_esc(user_name)}\n"
        f"📱 <b>Telefon:</b> {_esc(phone)}\n\n"
        f"{block}"
        f"📝 <b>Xulosa:</b>\n<i>{_esc(summary or 'Suhbat yakunlandi.')}</i>\n\n"
        f"📊 <b>Jami xabarlar:</b> {message_count} ta\n"
        f"⏰ <i>{_esc(now)}</i>"
    )
    return await send_message(db, text, context="uyiz_ai_summary")


async def notify_new_listing(db, *, listing, owner_name: str) -> bool:
    # No status/risk line any more. A new listing is published straight away,
    # so its status is always APPROVED here, and the reliability score only
    # moves later, when an admin confirms a complaint about it. Printing two
    # constants on every notification taught the ops group to stop reading the
    # last line.
    price = f"{int(listing.price):,}".replace(",", " ")
    text = (
        "🏠 <b>Yangi e'lon joylandi</b>\n\n"
        f"<b>{_esc(listing.title)}</b>\n"
        f"📍 {_esc(listing.district or '—')} • {_esc(listing.rooms)} xona\n"
        f"💰 {price} so'm/oy\n"
        f"👤 {_esc(owner_name)}"
    )
    return await send_message(db, text, context="new_listing")


async def notify_security_event(db, *, title: str, detail: str) -> bool:
    text = f"🚨 <b>{_esc(title)}</b>\n\n{_esc(detail)}"
    return await send_message(db, text, context="security_event")
