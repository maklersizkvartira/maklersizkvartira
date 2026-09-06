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


async def _post(*, token: str, chat_id: str, text: str) -> tuple[bool, str]:
    """POST one sendMessage. Returns (ok, diagnostic).

    The diagnostic is Telegram's own ``description`` on failure - "chat not
    found", "Unauthorized", "bot was kicked" - which is the string that names
    the actual cause and which this module used to throw away on every failed
    send. Nothing here raises: a notification is never worth failing the
    request that triggered it.
    """
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
        if response.is_success:
            return True, ""
        try:
            detail = str(response.json().get("description") or "")
        except ValueError:
            detail = ""
        return False, detail or response.text[:200]
    except httpx.HTTPError as exc:
        return False, str(exc)


async def send_message(db, text: str, *, context: str = "notification") -> bool:
    """Send to the operations group. Returns whether Telegram accepted it."""
    if not settings.TELEGRAM_BOT_TOKEN or not settings.telegram_chat_id:
        # Said out loud, once per attempt. This returned a bare False, so a
        # deployment missing either variable looked exactly like one where
        # Telegram was working: the assistant closed, the summary was written
        # to the database, and nothing was ever delivered to the group - with
        # no error anywhere to explain why.
        log.warning(
            "telegram.not_configured",
            context=context,
            has_token=bool(settings.TELEGRAM_BOT_TOKEN),
            has_group=bool(settings.telegram_chat_id),
        )
        return False

    ok, detail = await _post(
        token=settings.TELEGRAM_BOT_TOKEN.strip(),
        chat_id=settings.telegram_chat_id,
        text=text[:4000],
    )
    if not ok:
        # The other half of the same bug: the send failed and the only thing
        # written down was that it failed. Telegram's own "chat not found" is
        # what tells an operator the group id lost its leading minus; without
        # it that is indistinguishable from a network blip.
        log.warning("telegram.failed", context=context, detail=detail)

    if db is not None:
        await audit_log.record(
            db,
            AuditAction.TELEGRAM_NOTIFIED,
            entity_type="telegram",
            summary=context,
            meta={"delivered": ok, "detail": detail or None},
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


async def send_lead_notification(
    db,
    *,
    name: str,
    phone: str,
    language: str,
    session_key: str,
    is_registered: bool,
    note: str = "",
    intent: dict[str, Any] | None = None,
) -> bool:
    """Tell the team a visitor asked to be contacted. Returns delivery.

    This deliberately goes out through :func:`send_message` rather than
    posting for itself. That is what makes it audit as TELEGRAM_NOTIFIED, use
    the configured operations bot and group rather than a second pair of
    credentials, and stay monkeypatchable from the agent-loop tests - which
    patch ``send_message`` and would otherwise watch a real request leave the
    machine.
    """
    status_word = (
        "Ro'yxatdan o'tgan foydalanuvchi ✅"
        if is_registered
        else "Ro'yxatdan o'tmagan mehmon 👤"
    )
    language_word = {
        "uz": "O'zbekcha 🇺🇿",
        "ru": "Ruscha 🇷🇺",
        "en": "Inglizcha 🇬🇧",
    }.get(language, "O'zbekcha 🇺🇿")

    # What they were looking for, when they said. It is the difference between
    # a name on a list and a call that can start with "you wanted two rooms in
    # Chilonzor" - so it goes in the message rather than waiting in a panel.
    need = intent or {}
    parts: list[str] = []
    if need.get("district"):
        parts.append(f"📍 {_esc(need['district'])}")
    if need.get("rooms"):
        parts.append(f"🏠 {_esc(need['rooms'])} xona")
    if need.get("maxPrice"):
        parts.append(f"💰 {int(need['maxPrice']):,}".replace(",", " ") + " so'm")
    criteria_line = ("🔎 <b>Qidiruvi:</b> " + " • ".join(parts) + "\n") if parts else ""
    note_line = f"📝 <i>{_esc(note)}</i>\n" if note else ""
    stamp = datetime.now(TASHKENT).strftime("%d.%m.%Y %H:%M")

    text = (
        "🔔 <b>YANGI MUROJAAT — Uyiz AI</b> 🏠\n\n"
        f"👤 <b>Ism:</b> {_esc(name)}\n"
        f"📞 <b>Telefon:</b> {_esc(format_display(phone))}\n"
        f"🧾 <b>Holat:</b> {status_word}\n"
        f"🌐 <b>Til:</b> {language_word}\n"
        f"{criteria_line}{note_line}"
        f"🕒 <b>Vaqt:</b> {_esc(stamp)}\n"
        f"🔑 <b>Sessiya:</b> <code>{_esc(session_key[:12])}…</code>\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "✅ <i>Mijoz siz bilan bog'lanishni so'radi.</i> "
        "☎️ <b>Iltimos, qo'ng'iroq qiling.</b>"
    )
    return await send_message(db, text, context="ai_lead")


def _compact_text(text: str, max_len: int = 180) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) <= max_len:
        return cleaned
    parts = cleaned[:max_len].rsplit(" ", 1)
    return (parts[0] if len(parts) > 1 else cleaned[:max_len]) + "..."


async def send_ai_chat_to_telegram(
    *,
    user_name: str,
    user_phone: str | None,
    messages: list[Any],
) -> bool:
    """Send compact AI conversation transcript to Telegram channel."""
    if not messages:
        return False

    # This was the only send in the module that ever worked, because its bot
    # token and channel id were written into the source two lines above it -
    # which also meant rotating a leaked token was a code change, and meant
    # every other notification in here failed silently against an unset .env.
    # Both now come from settings, and both fall back to the operations pair.
    token = settings.telegram_ai_bot_token
    chat_id = settings.telegram_ai_chat_id
    if not token or not chat_id:
        log.warning("telegram.not_configured", context="ai_chat")
        return False

    now = datetime.now(TASHKENT).strftime("%d.%m.%Y %H:%M")
    phone = format_display(user_phone) if user_phone else "Kiritilmadi"

    header = (
        "🤖 <b>UYIZ AI — MIJOZ BILAN SUHBAT</b>\n\n"
        f"👤 <b>Mijoz:</b> {_esc(user_name)}\n"
        f"📱 <b>Tel:</b> {_esc(phone)} • ⏰ {_esc(now)}\n"
        f"💬 <b>Xabarlar soni:</b> {len(messages)} ta\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "📝 <b>Qisqa yozishmalar:</b>\n\n"
    )

    transcript = ""
    for m in messages:
        is_user = getattr(m, "role", "") == "user" or (isinstance(m, dict) and m.get("role") == "user")
        raw_content = getattr(m, "content", "") if hasattr(m, "content") else (m.get("content", "") if isinstance(m, dict) else str(m))
        if is_user:
            clean_content = _compact_text(raw_content, max_len=280)
            transcript += f"👤 <b>Mijoz:</b> {_esc(clean_content)}\n"
        else:
            clean_content = _compact_text(raw_content, max_len=180)
            transcript += f"🤖 <b>AI:</b> {_esc(clean_content)}\n\n"

    full_text = header + transcript.rstrip() + "\n━━━━━━━━━━━━━━━━━━━━━\n🏁 <i>Suhbat yakunlandi</i>"

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

    any_ok = False
    for chunk in chunks:
        ok, detail = await _post(token=token, chat_id=chat_id, text=chunk)
        if ok:
            any_ok = True
        else:
            log.warning("telegram.ai_chat_failed", detail=detail, chat_id=chat_id)

    return any_ok
