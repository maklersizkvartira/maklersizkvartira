"""Shield AI - the multilingual search assistant.

Two independent parts:

  * A deterministic intent parser that reads district / rooms / budget out of
    the message in Uzbek, Russian and English. It always runs, so the
    assistant still finds listings when no LLM key is configured.
  * An optional LLM turn that writes the conversational reply.

The listings shown are always the result of a real database query built from
the parsed intent - the model never invents inventory.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)

TASHKENT_DISTRICTS = [
    "Chilonzor", "Yunusobod", "Mirobod", "Yakkasaroy", "Sergeli", "Uchtepa",
    "Olmazor", "Yashnobod", "Shayxontohur", "Mirzo Ulug'bek", "Bektemir",
    "Yangihayot",
]

#: Alternative spellings and Russian forms, mapped to the canonical name.
_DISTRICT_ALIASES: dict[str, str] = {
    "chilanzar": "Chilonzor", "чиланзар": "Chilonzor", "chilonzor": "Chilonzor",
    "yunusabad": "Yunusobod", "юнусабад": "Yunusobod", "yunusobod": "Yunusobod",
    "mirabad": "Mirobod", "мирабад": "Mirobod", "mirobod": "Mirobod",
    "yakkasaray": "Yakkasaroy", "яккасарай": "Yakkasaroy", "yakkasaroy": "Yakkasaroy",
    "sergeli": "Sergeli", "сергели": "Sergeli",
    "uchtepa": "Uchtepa", "учтепа": "Uchtepa",
    "olmazor": "Olmazor", "алмазар": "Olmazor", "almazar": "Olmazor",
    "yashnabad": "Yashnobod", "яшнабад": "Yashnobod", "yashnobod": "Yashnobod",
    "shayxontohur": "Shayxontohur", "шайхантахур": "Shayxontohur",
    "sheyhantaur": "Shayxontohur", "shaykhantakhur": "Shayxontohur",
    "mirzo ulugbek": "Mirzo Ulug'bek", "мирзо улугбек": "Mirzo Ulug'bek",
    "ulugbek": "Mirzo Ulug'bek",
    "bektemir": "Bektemir", "бектемир": "Bektemir",
    "yangihayot": "Yangihayot", "янгихаёт": "Yangihayot",
}

_ROOMS = re.compile(
    r"(\d+)\s*(?:\+\s*)?(?:xona|xonali|honali|комнат\w*|комн|room|rooms|bedroom)",
    re.IGNORECASE,
)
_MILLION = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(?:mln|млн|million|миллион|m\b)", re.IGNORECASE
)
_THOUSAND_USD = re.compile(r"\$\s*(\d{2,5})|(\d{2,5})\s*(?:usd|dollar|доллар)", re.IGNORECASE)
_BARE_PRICE = re.compile(r"(\d[\d\s.,]{5,})")

USD_TO_UZS = 12_700

_STUDENT_HINT = re.compile(r"talaba|student|yotoqxona|студент|общежит", re.IGNORECASE)
_FAMILY_HINT = re.compile(r"oila|oilaviy|bolali|семь|семей|family", re.IGNORECASE)
_ROOMMATE_HINT = re.compile(r"sherik|xonadosh|roommate|сосед|подселен", re.IGNORECASE)


@dataclass(slots=True)
class SearchIntent:
    region: str | None = None
    district: str | None = None
    rooms: int | None = None
    max_price: float | None = None
    audience: str = "ALL"
    rental_type: str = "ALL"
    user_name: str | None = None
    reply_text: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "region": self.region,
            "district": self.district,
            "rooms": self.rooms,
            "maxPrice": self.max_price,
            "audience": self.audience,
            "rentalType": self.rental_type,
            "userName": self.user_name,
        }


def normalise_district(value: str | None) -> str | None:
    if not value:
        return None
    text = value.lower().replace("'", "").replace("ʻ", "").replace("`", "").strip()
    for alias, canonical in _DISTRICT_ALIASES.items():
        normalised_alias = alias.replace("'", "").replace("ʻ", "")
        if normalised_alias in text:
            return canonical
    return None


def parse_intent(message: str) -> SearchIntent:
    """Extract search parameters from free text in uz/ru/en."""
    text = (message or "").lower()
    intent = SearchIntent()

    intent.district = normalise_district(text)
    if intent.district:
        intent.region = "Toshkent shahri"

    rooms_match = _ROOMS.search(text)
    if rooms_match:
        try:
            rooms = int(rooms_match.group(1))
            if 1 <= rooms <= 20:
                intent.rooms = rooms
        except ValueError:
            pass

    million = _MILLION.search(text)
    usd = _THOUSAND_USD.search(text)
    if million:
        try:
            amount = float(million.group(1).replace(",", "."))
            # Treat a stated budget as an upper bound with a little headroom.
            intent.max_price = round(amount * 1_000_000 * 1.25)
        except ValueError:
            pass
    elif usd:
        raw = usd.group(1) or usd.group(2)
        try:
            intent.max_price = round(float(raw) * USD_TO_UZS * 1.25)
        except (TypeError, ValueError):
            pass
    else:
        bare = _BARE_PRICE.search(text)
        if bare:
            digits = re.sub(r"\D", "", bare.group(1))
            if len(digits) >= 6:
                intent.max_price = round(int(digits) * 1.25)

    if _STUDENT_HINT.search(text):
        intent.audience = "STUDENT"
    elif _FAMILY_HINT.search(text):
        intent.audience = "FAMILY"

    if _ROOMMATE_HINT.search(text):
        intent.rental_type = "ROOMMATE"

    return intent


# ---------------------------------------------------------------------------
# Replies
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = {
    "uz": (
        "Siz MaklersizUy.uz platformasining rasmiy yordamchisi Shield AI siz. "
        "Platforma 0% komissiyali, maklersiz kvartira ijara xizmati. "
        "Mijoz tuman, xona soni yoki byudjetni aytishi bilan tizim bazadan avtomatik qidiradi. "
        "Faqat birinchi xabarda salomlashing. Mijoz ismidan keyin undov (!) qo'ymang. "
        "Qisqa, aniq va to'g'ri o'zbek imlosida yozing. "
        "Javobni FAQAT JSON formatida bering: "
        '{"district": null, "rooms": null, "maxPrice": null, "audience": "ALL", '
        '"rentalType": "ALL", "userName": null, "replyText": "..."}'
    ),
    "ru": (
        "Вы — Shield AI, официальный помощник платформы MaklersizUy.uz. "
        "Платформа сдаёт квартиры напрямую от владельцев, без посредников и комиссии. "
        "Как только клиент называет район, число комнат или бюджет, система ищет по базе. "
        "Здоровайтесь только в первом сообщении. Пишите кратко и грамотно по-русски. "
        "Ответ строго в формате JSON: "
        '{"district": null, "rooms": null, "maxPrice": null, "audience": "ALL", '
        '"rentalType": "ALL", "userName": null, "replyText": "..."}'
    ),
    "en": (
        "You are Shield AI, the official assistant of MaklersizUy.uz, "
        "a 0%-commission, broker-free apartment rental platform in Uzbekistan. "
        "As soon as the client mentions a district, room count or budget, the system "
        "searches the database. Greet only in the first message. Be concise. "
        "Reply strictly as JSON: "
        '{"district": null, "rooms": null, "maxPrice": null, "audience": "ALL", '
        '"rentalType": "ALL", "userName": null, "replyText": "..."}'
    ),
}

FALLBACK_REPLIES = {
    "found": {
        "uz": "{greeting}Siz so'ragan shartlar bo'yicha bazamizdan {count} ta mos e'lon topdim. Ular bilan tanishib chiqing:",
        "ru": "{greeting}По вашим условиям я нашёл {count} подходящих объявлений. Посмотрите:",
        "en": "{greeting}I found {count} listings matching your criteria. Take a look:",
    },
    "empty": {
        "uz": "{greeting}Siz so'ragan parametrlar bo'yicha hozircha mos e'lon topilmadi. Boshqa tuman yoki byudjetni ko'rib chiqaylikmi?",
        "ru": "{greeting}По этим параметрам пока ничего не нашлось. Попробуем другой район или бюджет?",
        "en": "{greeting}Nothing matches those parameters yet. Shall we try another district or budget?",
    },
    "greeting": {
        "uz": "Assalomu alaykum{name}. ",
        "ru": "Здравствуйте{name}. ",
        "en": "Hello{name}. ",
    },
}


def build_fallback_reply(
    *, count: int, language: str, user_name: str | None, is_first_turn: bool
) -> str:
    greeting = ""
    if is_first_turn:
        name_part = f", {user_name}" if user_name else ""
        greeting = FALLBACK_REPLIES["greeting"].get(
            language, FALLBACK_REPLIES["greeting"]["uz"]
        ).format(name=name_part)
    key = "found" if count else "empty"
    template = FALLBACK_REPLIES[key].get(language, FALLBACK_REPLIES[key]["uz"])
    return template.format(greeting=greeting, count=count)


async def generate_reply(
    *,
    message: str,
    history: list[dict[str, str]],
    language: str,
    user_name: str | None,
    is_first_turn: bool,
) -> SearchIntent | None:
    """Ask the LLM for a reply. Returns ``None`` if unavailable."""
    if not settings.OPENAI_API_KEY:
        return None

    system = _SYSTEM_PROMPT.get(language, _SYSTEM_PROMPT["uz"])
    turn_note = (
        f"\n[Client name: {user_name or 'unknown'}. This is the FIRST message - greet once.]"
        if is_first_turn
        else f"\n[Client name: {user_name or 'unknown'}. CONTINUATION - do not greet again.]"
    )
    messages = [
        {"role": "system", "content": system + turn_note},
        *history[-16:],
        {"role": "user", "content": message[:2000]},
    ]

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.4,
                    "messages": messages,
                },
            )
        if not response.is_success:
            log.warning("shield_ai.provider_error", status=response.status_code)
            return None
        raw = response.json()["choices"][0]["message"]["content"]
        data = json.loads(
            raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
        )
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        log.warning("shield_ai.failed", error=str(exc))
        return None

    intent = SearchIntent(
        district=normalise_district(data.get("district")),
        rooms=_safe_int(data.get("rooms")),
        max_price=_safe_float(data.get("maxPrice")),
        audience=str(data.get("audience") or "ALL").upper(),
        rental_type=str(data.get("rentalType") or "ALL").upper(),
        user_name=(data.get("userName") or None),
        reply_text=str(data.get("replyText") or "")[:1200],
    )
    if intent.district:
        intent.region = "Toshkent shahri"
    return intent


def _safe_int(value: Any) -> int | None:
    try:
        result = int(value)
        return result if 1 <= result <= 20 else None
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> float | None:
    try:
        result = float(value)
        return result if 0 < result <= 1_000_000_000 else None
    except (TypeError, ValueError):
        return None


def merge_intents(parsed: SearchIntent, llm: SearchIntent | None) -> SearchIntent:
    """Local parsing wins on facts; the model only supplies the prose."""
    if llm is None:
        return parsed
    return SearchIntent(
        region=parsed.region or llm.region,
        district=parsed.district or llm.district,
        rooms=parsed.rooms or llm.rooms,
        max_price=parsed.max_price or llm.max_price,
        audience=parsed.audience if parsed.audience != "ALL" else llm.audience,
        rental_type=parsed.rental_type if parsed.rental_type != "ALL" else llm.rental_type,
        user_name=llm.user_name,
        reply_text=llm.reply_text,
    )
