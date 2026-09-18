"""AI-powered Uyiz Support Assistant with automated replies and specialist escalation."""

from __future__ import annotations

import asyncio
import uuid

import httpx
import structlog
from sqlalchemy import select

from app.core.config import settings
from app.core.database import session_scope
from app.models.chat import SupportConversation, SupportMessage
from app.models.settings import SystemSetting
from app.models.user import User
from app.services import ai_settings
from app.services.telegram import send_support_escalation_alert

log = structlog.get_logger(__name__)

_TIMEOUT = httpx.Timeout(20.0, connect=4.0)
_OPENAI_URL = "https://api.openai.com/v1/chat/completions"

ESCALATION_REPLIES = {
    "uz": "Sizni bosh mutaxassislarimizga ulab beraman, iltimos biroz kutib turing.",
    "ru": "Я соединяю вас с нашим главным специалистом, пожалуйста, подождите немного.",
    "en": "Connecting you with our senior specialist, please hold on for a moment.",
}

# Keywords that immediately trigger human escalation
ESCALATION_KEYWORDS = {
    "uz": [
        "mutaxassis", "bosh mutaxassis", "operator", "admin", "odam", "jonli",
        "pulim tushmadi", "pul yechildi", "to'lov o'tmadi", "tolov otmadi",
        "aldashdi", "firibgar", "shikoyat", "sud", "bloklandi", "qaytarib bering",
        "bog'laning", "telefon qiling", "menejer",
    ],
    "ru": [
        "специалист", "главный специалист", "оператор", "админ", "человек", "живой",
        "деньги не пришли", "списали деньги", "платеж не прошел", "оплата не прошла",
        "мошенник", "обман", "жалоба", "заблокировали", "верните деньги",
        "свяжитесь", "позвоните", "менеджер",
    ],
    "en": [
        "specialist", "operator", "admin", "human", "live agent", "manager",
        "payment failed", "money not received", "scam", "fraud", "complaint",
        "refund", "blocked", "call me",
    ],
}

SUPPORT_SYSTEM_PROMPT = """Siz — "Uyiz.uz" (Maklersiz.uz) platformasining rasmiy qo'llab-quvvatlash xizmati (Uyiz Support) aqlli assistentisiz.

Platforma haqida ma'lumotlar:
- "Uyiz.uz" — O'zbekistonda uylarni vositachisiz (maklersiz), to'g'ridan-to'g'ri egasidan ijaraga olish va sotib olish platformasi.
- E'lon berish: 100% bepul. Uy egasi yoki talaba/sherik qidiruvchi bemalol e'lon qo'sha oladi. E'lonlar darhol yoki qisqa moderatsiyadan so'ng tasdiqlanadi.
- VIP va TOP xizmatlari:
  * VIP e'lonlar — qidiruv natijalari va katalogda eng yuqorida, tepadagi alohida oltin VIP bo'limida birinchi bo'lib turadi.
  * TOP e'lonlar — VIP e'lonlardan keyin, ammo oddiy bepul e'lonlardan yuqorida turadi.
  * VIP va TOP xizmatlarini sotib olish uchun profilning Hamyon (Wallet) bo'limida balansni Click yoki Payme orqali to'ldirish kerak.
- Hamyon: Balansni Click yoki Payme orqali to'ldirish mumkin.
- Ishonch darajasi (Trust score) va Verifikatsiya: Telefon tasdiqlash, pasport/ID yoki kadastr hujjatlarini yuklash orqali tasdiqlangan ko'k nishon (Verified) olish mumkin.
- Aloqa: E'lon sahifasida egasining telefon raqamini ko'rish yoki chat orqali yozish mumkin.

Sizning vazifangiz:
Foydalanuvchining savoliga qisqa, aniq, muloyim va professional javob bering (ko'pi bilan 2-3 ta gap).
Agar foydalanuvchining savoli murakkab, to'lov/hisob xatosi, firibgarlik/shikoyat, yoki jonli mutaxassis talab etiladigan bo'lsa, javobingizni aniq "ESCALATE" so'zi bilan boshlang yoki mutaxassisga yo'naltiring.

Muhim:
- Foydalanuvchi qaysi tilda yozsa (o'zbek, rus yoki ingliz), shu tilda javob bering.
- Hech qachon yolg'on ma'lumot to'qimang.
"""


def _detect_escalation_intent(text: str, language: str) -> bool:
    """Check if message contains obvious escalation trigger phrases."""
    text_lower = text.lower()
    keywords = ESCALATION_KEYWORDS.get(language, ESCALATION_KEYWORDS["uz"])
    for kw in keywords:
        if kw in text_lower:
            return True
    for lang_kws in ESCALATION_KEYWORDS.values():
        for kw in lang_kws:
            if kw in text_lower:
                return True
    return False


async def generate_ai_reply(
    message_text: str,
    language: str,
    recent_messages: list[dict[str, str]] | None = None,
) -> tuple[str, bool]:
    """Generate support response using OpenAI or fallback.

    Returns (reply_text, is_escalated).
    """
    lang = language if language in ("uz", "ru", "en") else "uz"

    # Fast heuristic escalation check
    if _detect_escalation_intent(message_text, lang):
        return ESCALATION_REPLIES.get(lang, ESCALATION_REPLIES["uz"]), True

    api_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    if not api_key:
        # Fallback intelligent responder without external API
        return _heuristic_reply(message_text, lang)

    try:
        model = ai_settings.cached().chat_model or getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
    except Exception:
        model = getattr(settings, "OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"

    messages_payload: list[dict[str, str]] = [
        {"role": "system", "content": SUPPORT_SYSTEM_PROMPT},
    ]

    if recent_messages:
        for m in recent_messages[-6:]:
            messages_payload.append({
                "role": "user" if m.get("sender_type") == "USER" else "assistant",
                "content": str(m.get("text", ""))[:400],
            })

    messages_payload.append({"role": "user", "content": message_text})

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                _OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages_payload,
                    "temperature": 0.4,
                    "max_tokens": 250,
                },
            )
            if response.is_success:
                data = response.json()
                reply = data["choices"][0]["message"]["content"].strip()
                if reply.startswith("ESCALATE"):
                    clean_reply = reply.replace("ESCALATE", "").strip(": ").strip()
                    return clean_reply or ESCALATION_REPLIES.get(lang, ESCALATION_REPLIES["uz"]), True
                return reply, False
            else:
                log.warning("support_ai.openai_error", status=response.status_code)
    except Exception as exc:
        log.warning("support_ai.request_exception", error=str(exc))

    return _heuristic_reply(message_text, lang)


def _heuristic_reply(text: str, lang: str) -> tuple[str, bool]:
    """Heuristic offline support replies for common inquiries."""
    t_lower = text.lower()

    if any(k in t_lower for k in ("assalom", "salom", "qalesiz", "privet", "hello", "hi", "salom alaykum")):
        if lang == "ru":
            return "Здравствуйте! Чем служба поддержки Uyiz может вам помочь?", False
        elif lang == "en":
            return "Hello! How can Uyiz Support assist you today?", False
        return "Assalomu alaykum! Uyiz qo‘llab-quvvatlash xizmati sizga qanday yordam bera oladi?", False

    if any(k in t_lower for k in ("elon", "e'lon", "joylash", "qoyish", "qo'yish", "bepul", "объявление", "подать")):
        if lang == "ru":
            return "Размещение объявлений на Uyiz абсолютно бесплатное. Нажмите кнопку «E'lon berish» вверху сайта и заполните форму.", False
        return "Uyiz platformasida e'lon berish mutlaqo bepul. Sayt yuqorisidagi «E'lon joylash» tugmasini bosing va ma'lumotlarni kiriting.", False

    if any(k in t_lower for k in ("vip", "top", "tarif", "narx", "ko'tarish", "kotarish", "reklama")):
        if lang == "ru":
            return "VIP объявления всегда отображаются на самом верху каталога, а TOP — сразу после них. Подключить их можно через Профиль -> Кошелек.", False
        return "VIP e'lonlar katalogning eng yuqori bo'limida birinchi bo'lib turadi, TOP esa ulardan keyin joylashadi. Profil -> Hamyon orqali balansingizni to'ldirib xizmatni yoqishingiz mumkin.", False

    if any(k in t_lower for k in ("hamyon", "balans", "payme", "click", "pul", "oplata", "to'lov", "tolov")):
        if lang == "ru":
            return "Пополнить баланс можно в Профиль -> Кошелек через Payme или Click. Если возникли трудности с платежом, напишите подробнее.", False
        return "Balansni Profil -> Hamyon bo'limida Click yoki Payme orqali to'ldirishingiz mumkin. Agar to'lovda qiyinchilik bo'lsa, xabar bering.", False

    if any(k in t_lower for k in ("makler", "komissiya", "vositachi", "foiz")):
        if lang == "ru":
            return "Uyiz.uz — платформа без посредников. Все объявления размещаются напрямую от собственников без маклерской комиссии.", False
        return "Uyiz.uz — vositachisiz platforma bo‘lib, e'lonlar bevosita egalaridan joylashtiriladi va maklerlik komissiyasi yo‘q.", False

    if any(k in t_lower for k in ("raqam", "telefon", "bog'lanish", "aloqa")):
        if lang == "ru":
            return "На странице любого объявления нажмите кнопку «Показать номер», чтобы напрямую связаться с владельцем жилья.", False
        return "Har qanday e'lon sahifasida «Telefon raqamni ko‘rish» tugmasini bosib uy egasi bilan to‘g‘ridan-to‘g‘ri bog‘lanishingiz mumkin.", False

    # Default fallback to human specialist
    return ESCALATION_REPLIES.get(lang, ESCALATION_REPLIES["uz"]), True


async def process_incoming_support_message(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    message_text: str,
) -> SupportMessage | None:
    """Handle incoming user message to Uyiz Support: generate AI reply, escalate to Telegram if needed."""
    try:
        async with session_scope() as db:
            # Load user and conversation
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            conversation = (
                await db.execute(select(SupportConversation).where(SupportConversation.id == conversation_id))
            ).scalar_one_or_none()

            if not user or not conversation:
                return None

            # Check if admin has enabled or disabled AI assistant
            status_row = (
                await db.execute(
                    select(SystemSetting.value).where(SystemSetting.key == "is_support_ai_enabled")
                )
            ).scalar_one_or_none()
            ai_enabled = (status_row == "true") if status_row is not None else True

            if not ai_enabled:
                # AI auto-reply is disabled by admin. Send Telegram alert so operators handle manually!
                try:
                    await send_support_escalation_alert(
                        user_name=user.name or "Mijoz",
                        user_phone=getattr(user, "phone", None),
                        user_id=str(user.id),
                        message_text=message_text,
                        ai_reply=None,
                    )
                except Exception as e:
                    log.warning("support_ai.manual_alert_failed", error=str(e))
                return None


            # Fetch recent messages for context
            recent_rows = (
                await db.execute(
                    select(SupportMessage)
                    .where(SupportMessage.conversation_id == conversation_id)
                    .order_by(SupportMessage.created_at.desc())
                    .limit(6)
                )
            ).scalars().all()

            history = [
                {"sender_type": r.sender_type, "text": r.text}
                for r in reversed(recent_rows)
            ]

            user_lang = getattr(user, "language", None) or "uz"
            reply_text, is_escalated = await generate_ai_reply(
                message_text=message_text,
                language=user_lang,
                recent_messages=history,
            )

            # Save AI reply as SupportMessage (sender_type ADMIN)
            ai_msg = SupportMessage(
                conversation_id=conversation_id,
                sender_type="ADMIN",
                sender_id=user.id,
                text=reply_text,
            )
            db.add(ai_msg)
            await db.flush()

            conversation.updated_at = ai_msg.created_at
            conversation.status = "OPEN"
            await db.commit()
            await db.refresh(ai_msg)

            # If escalated: send Telegram alert to @Uyiz_ai_chat_bot
            if is_escalated:
                try:
                    await send_support_escalation_alert(
                        user_name=user.name or "Mijoz",
                        user_phone=getattr(user, "phone", None),
                        user_id=str(user.id),
                        message_text=message_text,
                        ai_reply=reply_text,
                    )
                except Exception as e:
                    log.warning("support_ai.telegram_alert_failed", error=str(e))

            # Also dispatch Web Push so user receives notification if backgrounded
            try:
                from app.routers.chat import _dispatch_web_push
                push_title = "Uyiz Support"
                push_body = reply_text[:100]
                asyncio.create_task(
                    _dispatch_web_push(str(user.id), push_title, push_body, "/?view=CHAT&conversation=support")
                )
            except Exception:
                pass

            return ai_msg
    except Exception as exc:
        log.exception("support_ai.process_error", error=str(exc))
        return None

