"""Listing moderation: broker/fraud detection.

A deterministic rule pass always runs and is authoritative for the obvious
cases. An LLM pass refines the verdict when a provider key is configured, but
it can only ever be advisory: if the provider is slow, down, or returns
nonsense, the rules decide. Moderation never blocks on a third party.

The hard part in Uzbek is negation. ``maklersiz``, ``vositachisiz`` and
``komissiyasiz`` are the privative ("-siz" = without) forms of the very words
that signal a broker - they mean the opposite. Plain substring matching reads
them as broker signals and rejects exactly the honest owner listings the
platform exists to carry. Matching here is therefore negation-aware.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_TIMEOUT = httpx.Timeout(8.0, connect=4.0)

# ---------------------------------------------------------------------------
# Signal vocabularies
# ---------------------------------------------------------------------------
#: Explicit broker/agency self-identification.
BROKER_TERMS = [
    "makler", "rieltor", "riyeltor", "vositachi", "agentlik", "agentstvo",
    "posrednik", "риелтор", "риэлтор", "маклер", "посредник", "агентство",
    "broker", "realtor",
]
#: Commission / service-fee language.
COMMISSION_TERMS = [
    "komissiya", "kamissiya", "xizmat haqi", "usluga", "услуга", "комисси",
    "процент", "predoplata", "предоплат",
]
#: Signs the text was lifted from another marketplace.
COPIED_TERMS = ["olx", "uybor", "avito", "ko'chirma", "kochirma", "скопирован"]
#: Classic advance-payment scam phrasing.
SCAM_TERMS = [
    "zaklad", "oldindan to'lov", "oldindan pul", "karta raqam", "plastik karta",
    "перевод на карту", "залог вперед", "western union",
]
#: Phrases that indicate a genuine owner listing.
SAFE_TERMS = [
    "maklersiz", "vositachisiz", "komissiyasiz", "egasidan", "uy egasi",
    "от хозяина", "от собственника", "owner direct",
]

#: Multi-word phrases that invert a signal. Stripped from the text BEFORE any
#: negative term is looked for, so "без посредников" cannot register as
#: "посредник".
NEGATING_PHRASES = [
    "без посредников", "без посредника", "без комиссии", "без предоплаты",
    "от хозяина", "от собственника", "хозяин напрямую",
    "komissiya yo'q", "komissiya yoq", "0% komissiya", "0 % komissiya",
    "vositachi yo'q", "vositachi yoq", "makler yo'q", "makler yoq",
    "no commission", "no broker", "owner direct", "direct from owner",
]

#: The Uzbek privative suffix. A term immediately followed by it is negated.
_PRIVATIVE_SUFFIX = "siz"

_PHONE_IN_TEXT = re.compile(r"(?:\+?998[\s\-]?)?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}")
_EXCESS_CAPS = re.compile(r"[A-ZА-ЯЎҚҒҲ]{8,}")
_REPEATED_PUNCT = re.compile(r"([!?.])\1{3,}")


#: Uzbek softens a final voiceless consonant before a vowel-initial suffix:
#: "agentlik" -> "agentligimiz", "agentligi". Matching the literal stem alone
#: misses every possessive form, so the final consonant is made alternable.
_SOFTENING = {"k": "[kg]", "q": "[qgʻ]", "p": "[pb]", "t": "[td]"}


def _stem_regex(term: str) -> str:
    """Escape a term, allowing its final consonant to soften."""
    if not term:
        return ""
    head, last = term[:-1], term[-1]
    alternation = _SOFTENING.get(last.lower())
    return re.escape(head) + (alternation if alternation else re.escape(last))


def _term_pattern(term: str) -> re.Pattern[str]:
    r"""Word-start match that allows suffixes but rejects the privative form.

    ``makler``   matches  "maklerlar", "maklerdan", "maklerman"
    ``makler``   does NOT match  "maklersiz"
    ``agentlik`` matches  "agentligimiz", "agentligi" (k -> g softening)
    """
    return re.compile(
        r"(?<!\w)" + _stem_regex(term) + r"(?!" + _PRIVATIVE_SUFFIX + r")\w*",
        re.IGNORECASE | re.UNICODE,
    )


def _privative_pattern(term: str) -> re.Pattern[str]:
    return re.compile(
        r"(?<!\w)" + _stem_regex(term) + _PRIVATIVE_SUFFIX,
        re.IGNORECASE | re.UNICODE,
    )


_BROKER_RE = [(t, _term_pattern(t)) for t in BROKER_TERMS]
_COMMISSION_RE = [(t, _term_pattern(t)) for t in COMMISSION_TERMS]
_COPIED_RE = [(t, _term_pattern(t)) for t in COPIED_TERMS]
_SCAM_RE = [(t, _term_pattern(t)) for t in SCAM_TERMS]
_PRIVATIVE_RE = [_privative_pattern(t) for t in (*BROKER_TERMS, *COMMISSION_TERMS)]


@dataclass(slots=True)
class ModerationVerdict:
    allowed: bool
    status: str
    trust_score: int
    risk_score: int
    reasons: list[str] = field(default_factory=list)
    provider: str = "rules"

    def as_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "status": self.status,
            "trustScore": self.trust_score,
            "riskScore": self.risk_score,
            "reasons": self.reasons,
            "provider": self.provider,
        }


def _strip_negations(text: str) -> tuple[str, int]:
    """Remove negating phrases; return the cleaned text and how many matched."""
    hits = 0
    for phrase in NEGATING_PHRASES:
        if phrase in text:
            hits += 1
            text = text.replace(phrase, " ")
    return text, hits


def _privative_hits(text: str) -> int:
    """Count "-siz" forms: maklersiz, vositachisiz, komissiyasiz..."""
    return sum(1 for pattern in _PRIVATIVE_RE if pattern.search(text))


def _matches(text: str, patterns: list[tuple[str, re.Pattern[str]]]) -> list[str]:
    return [term for term, pattern in patterns if pattern.search(text)]


def scan_with_rules(
    title: str, description: str, price: float | None = None, rooms: int | None = None
) -> ModerationVerdict:
    """Deterministic scan. Fast, offline, and always the safety net."""
    raw = f"{title} {description}".lower()
    reasons: list[str] = []
    risk = 0

    # Order matters: neutralise negations first, then look for signals.
    text, negation_hits = _strip_negations(raw)
    positive_signals = (
        negation_hits
        + _privative_hits(raw)
        + sum(1 for term in SAFE_TERMS if term in raw)
    )

    broker_hits = _matches(text, _BROKER_RE)
    if broker_hits:
        reasons.append(f"Maklerlik belgisi topildi: {', '.join(broker_hits[:3])}")
        risk += 70

    commission_hits = _matches(text, _COMMISSION_RE)
    if commission_hits:
        reasons.append(f"Komissiya haqida eslatma: {', '.join(commission_hits[:3])}")
        # Charging commission is the one thing the platform exists to exclude,
        # so a clear mention has to clear the WARNING threshold on its own -
        # at 35 it scored APPROVED and was even stamped "0% commission".
        risk += 45

    copied_hits = _matches(text, _COPIED_RE)
    if copied_hits:
        reasons.append(
            f"Boshqa saytdan ko'chirilgan bo'lishi mumkin: {', '.join(copied_hits[:2])}"
        )
        risk += 30

    scam_hits = _matches(text, _SCAM_RE)
    if scam_hits:
        reasons.append(f"Firibgarlik belgisi: {', '.join(scam_hits[:3])}")
        # Advance-payment fraud is the most damaging pattern on the platform,
        # so a single clear signal is enough to reject, and each additional
        # one hardens the verdict past any negation credit.
        risk += 75 + 10 * (len(scam_hits) - 1)

    if price is not None and price > 0:
        if price < 300_000:
            reasons.append("Shubhali darajada arzon narx")
            risk += 30
        elif rooms and price > rooms * 40_000_000:
            reasons.append("Hududiy me'yordan g'ayritabiiy qimmat narx")
            risk += 15

    if _PHONE_IN_TEXT.search(description or ""):
        reasons.append("Matn ichida telefon raqami ko'rsatilgan")
        risk += 10

    if len((description or "").strip()) < 40:
        reasons.append("E'lon tavsifi juda qisqa")
        risk += 10

    if _EXCESS_CAPS.search(title or ""):
        reasons.append("Sarlavhada haddan ortiq bosh harflar")
        risk += 5
    if _REPEATED_PUNCT.search(raw):
        reasons.append("Haddan ortiq takroriy tinish belgilari")
        risk += 5

    # "Maklersiz", "komissiyasiz", "egasidan" are the signature of a genuine
    # owner listing; each one lowers the score.
    risk = max(0, risk - min(30, positive_signals * 12))
    risk = max(0, min(100, risk))

    if risk >= 70:
        status, allowed = "REJECTED", False
    elif risk >= 40:
        status, allowed = "WARNING", True
    else:
        status, allowed = "APPROVED", True

    if not reasons:
        reasons.append("Maklerlik yoki firibgarlik belgilari topilmadi.")

    return ModerationVerdict(
        allowed=allowed,
        status=status,
        trust_score=max(5, 100 - risk),
        risk_score=risk,
        reasons=reasons,
        provider="rules",
    )


# ---------------------------------------------------------------------------
# LLM refinement (advisory only)
# ---------------------------------------------------------------------------
_LLM_PROMPT = """Siz O'zbekistondagi uy-joy ijara platformasining moderatorisiz.
Vazifa: e'lon uy egasining o'zi tomonidan joylanganmi yoki makler/vositachi/firibgar tomonidanmi - shuni aniqlash.

REJECTED deb belgilang, agar: makler/rieltor/agentlik ekani sezilsa, komissiya yoki xizmat haqi so'ralsa,
boshqa saytdan (OLX, Avito) ko'chirilgan bo'lsa, yoki oldindan to'lov / kartaga pul so'ralsa.
WARNING deb belgilang, agar shubha bor, lekin aniq dalil yo'q bo'lsa.
APPROVED deb belgilang, agar oddiy uy egasining haqiqiy e'loni bo'lsa.

DIQQAT: "maklersiz", "vositachisiz", "komissiyasiz", "egasidan" - bular MIJOZ FOYDASIGA ishlaydigan
ijobiy belgilar, ular maklerlik belgisi EMAS.

Sarlavha: {title}
Matn: {description}
Narx: {price}
Xonalar: {rooms}

Javob FAQAT quyidagi JSON bo'lsin:
{{"allowed": true, "status": "APPROVED", "trustScore": 85, "riskScore": 10, "reasons": ["sabab"]}}"""


async def _scan_with_openai(
    title: str, description: str, price: float | None, rooms: int | None
) -> ModerationVerdict | None:
    if not settings.OPENAI_API_KEY:
        return None
    prompt = _LLM_PROMPT.format(
        title=title[:400], description=description[:2500], price=price, rooms=rooms
    )
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "response_format": {"type": "json_object"},
                    "temperature": 0,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        if not response.is_success:
            return None
        content = response.json()["choices"][0]["message"]["content"]
        return _parse_llm_verdict(content, provider="openai")
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        log.warning("moderation.openai_failed", error=str(exc))
        return None


def _parse_llm_verdict(raw: str, *, provider: str) -> ModerationVerdict | None:
    try:
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
        data = json.loads(cleaned)
    except (ValueError, AttributeError):
        return None

    status = str(data.get("status", "APPROVED")).upper()
    if status not in {"APPROVED", "WARNING", "REJECTED", "UNDER_REVIEW"}:
        status = "APPROVED"
    reasons = data.get("reasons") or []
    if not isinstance(reasons, list):
        reasons = [str(reasons)]

    return ModerationVerdict(
        allowed=bool(data.get("allowed", status == "APPROVED")),
        status=status,
        trust_score=_clamp(data.get("trustScore"), 85),
        risk_score=_clamp(data.get("riskScore"), 10),
        reasons=[str(r)[:300] for r in reasons][:6],
        provider=provider,
    )


def _clamp(value, fallback: int) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return fallback


async def scan_listing(
    title: str,
    description: str,
    price: float | None = None,
    rooms: int | None = None,
) -> ModerationVerdict:
    """Combine the rule pass with an optional LLM opinion.

    The stricter of the two verdicts wins: the model may escalate a listing
    the rules missed, but it can never clear one the rules rejected.
    """
    rules_verdict = scan_with_rules(title, description, price, rooms)

    if rules_verdict.risk_score >= 85 or not settings.OPENAI_API_KEY:
        return rules_verdict

    try:
        llm_verdict = await asyncio.wait_for(
            _scan_with_openai(title, description, price, rooms), timeout=9.0
        )
    except (TimeoutError, asyncio.TimeoutError):
        log.warning("moderation.llm_timeout")
        llm_verdict = None

    if llm_verdict is None:
        return rules_verdict

    severity = {"APPROVED": 0, "WARNING": 1, "UNDER_REVIEW": 2, "REJECTED": 3}
    if severity.get(llm_verdict.status, 0) > severity.get(rules_verdict.status, 0):
        merged_reasons = llm_verdict.reasons + [
            r for r in rules_verdict.reasons if r not in llm_verdict.reasons
        ]
        return ModerationVerdict(
            allowed=llm_verdict.allowed,
            status=llm_verdict.status,
            trust_score=min(rules_verdict.trust_score, llm_verdict.trust_score),
            risk_score=max(rules_verdict.risk_score, llm_verdict.risk_score),
            reasons=merged_reasons[:8],
            provider=f"rules+{llm_verdict.provider}",
        )
    return rules_verdict


def safety_badges_for(verdict: ModerationVerdict, owner_verified: bool) -> list[str]:
    # The badge is a promise to the renter, so it is only awarded when nothing
    # in the text suggested a fee.
    charges_fee = any("Komissiya" in reason for reason in verdict.reasons)
    badges = [] if charges_fee else ["NO_COMMISSION"]
    if verdict.status == "APPROVED":
        badges.append("AI_CHECKED")
    if owner_verified:
        badges.append("VERIFIED_OWNER")
    if verdict.trust_score >= 80:
        badges.append("STUDENT_FRIENDLY")
    return badges
