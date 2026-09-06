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
        # Said out loud, once per attempt. This returned a bare False, so a
        # deployment missing either variable looked exactly like one where
        # Telegram was working: the assistant closed, the summary was written
        # to the database, and nothing was ever delivered to the group — with
        # no error anywhere to explain why.
        log.warning(
            "telegram.not_configured",
            context=context,
            has_token=bool(settings.TELEGRAM_BOT_TOKEN),
            has_group=bool(settings.TELEGRAM_GROUP_ID),
        )
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


AI_CHAT_BOT_TOKEN = "8760567987:AAF5Qg1jVk7xClHJuTkxOSWvgDs9WEptL_M"
AI_ADMIN_CHAT_IDS = ["5744542264", "8687089988"]


async def send_ai_chat_to_telegram(
    *,
    user_name: str,
    user_phone: str | None,
    messages: list[Any],
) -> bool:
    """Send full AI conversation transcript to admin Telegram chat IDs."""
    if not messages:
        return False

    now = datetime.now(TASHKENT).strftime("%d.%m.%Y %H:%M")
    phone = format_display(user_phone) if user_phone else "Kiritilmadi"

    header = (
        "🤖 <b>Uyiz AI Chat — Suhbat yakunlandi</b>\n\n"
        f"👤 <b>Mijoz:</b> {_esc(user_name)}\n"
        f"📱 <b>Telefon:</b> {_esc(phone)}\n"
        f"⏰ <b>Vaqt:</b> {_esc(now)}\n"
        f"💬 <b>Jami xabarlar:</b> {len(messages)} ta\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "📝 <b>Yozishmalar:</b>\n\n"
    )

    transcript = ""
    for m in messages:
        is_user = getattr(m, "role", "") == "user" or (isinstance(m, dict) and m.get("role") == "user")
        content = getattr(m, "content", "") if hasattr(m, "content") else (m.get("content", "") if isinstance(m, dict) else str(m))
        sender = "👤 <b>Foydalanuvchi:</b>" if is_user else "🤖 <b>Uyiz AI:</b>"
        transcript += f"{sender}\n{_esc(content.strip())}\n\n"

    full_text = header + transcript + "━━━━━━━━━━━━━━━━━━━━━"

    chunks = []
    lines = full_text.split("\n")
    curr = ""
    for line in lines:
        if len(curr + "\n" + line) > 3800:
            if curr:
                chunks.append(curr)
            curr = line
        else:
            curr = (curr + "\n" + line) if curr else line
    if curr:
        chunks.append(curr)

    url = f"https://api.telegram.org/bot{AI_CHAT_BOT_TOKEN}/sendMessage"
    any_ok = False
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for chat_id in AI_ADMIN_CHAT_IDS:
            for chunk in chunks:
                try:
                    res = await client.post(
                        url,
                        json={
                            "chat_id": chat_id,
                            "text": chunk,
                            "parse_mode": "HTML",
                            "disable_web_page_preview": True,
                        },
                    )
                    if res.is_success:
                        any_ok = True
                except Exception as e:
                    log.warning("telegram.ai_chat_failed", error=str(e), chat_id=chat_id)

    return any_ok

