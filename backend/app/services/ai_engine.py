import re
from typing import List, Optional, Dict, Any

BROKER_RE = re.compile(
    r"\b(maklerman|men makler|vositachi|agentlik|rieltor|komissiya ol|foiz ol|vositachilik|bir nechta kvartira|kvartiralarim bor|10 ta kvartira|ko['’`]p kvartira)\b",
    re.IGNORECASE
)

SCAM_RE = re.compile(
    r"\b(kartaga o['’`]tkaz|plastik karta|oldindan to['’`]lov|oldindan pul|zaklad|sms kod|karta parol|telegramga pul|ko['’`]rmasdan to['’`]la)\b",
    re.IGNORECASE
)

SAFE_RE = re.compile(
    r"\b(maklersiz|komissiya yo['’`]q|0%\s*komissiya|egasidan|to['’`]g['’`]ridan[\s-]*to['’`]g['’`]ri)\b",
    re.IGNORECASE
)

def scan_listing_ai(
    title: str,
    description: str,
    price: Optional[float] = None,
    rooms: Optional[int] = None,
    phone: Optional[str] = None,
    images: Optional[List[str]] = None
) -> Dict[str, Any]:
    text = f"{title or ''} {description or ''}".strip()
    reasons: List[str] = []
    broker_prob = 4
    risk_score = 6

    looks_safe = bool(SAFE_RE.search(text))
    broker_hit = bool(BROKER_RE.search(text))
    scam_hit = bool(SCAM_RE.search(text))

    if broker_hit and not looks_safe:
        reasons.append("Matnda makler yoki vositachi ekanligi seziladi.")
        broker_prob = 88
        risk_score = 80

    if scam_hit:
        reasons.append("Oldindan kartaga pul o'tkazish yoki firibgarlik belgisi bor.")
        risk_score = max(risk_score, 90)
        broker_prob = max(broker_prob, 70)

    if price is not None and rooms is not None and rooms >= 2 and price > 0 and price < 1500000:
        reasons.append("Narx xonalar soniga nisbatan g'ayritabiiy arzon — firibgarlik riski bor.")
        risk_score = max(risk_score, 75)

    if phone:
        clean_phone = re.sub(r"\D", "", phone)
        if len(clean_phone) < 9 or clean_phone.endswith("0000000"):
            reasons.append("Telefon raqam shubhali ko'rinadi.")
            risk_score = max(risk_score, 78)

    is_rejected = (risk_score >= 70 or broker_prob >= 70)

    if is_rejected:
        return {
            "allowed": False,
            "status": "REJECTED",
            "trustScore": 20,
            "riskScore": risk_score,
            "brokerProbability": broker_prob,
            "reasons": reasons,
            "message": "Bu e'lon makler yoki firibgar e'loniga o'xshaydi. Maklersiz.uz faqat uyning o'z egasidan e'lon qabul qiladi. E'lon joylashtirilmadi. Agarda xatolik yuz bergan bo'lsa, Telegram orqali admin bilan bog'laning: @MaklersizUy_Support"
        }

    return {
        "allowed": True,
        "status": "APPROVED",
        "trustScore": 94,
        "riskScore": risk_score,
        "brokerProbability": broker_prob,
        "reasons": reasons if reasons else ["Maklerlik belgisi topilmadi", "Oddiy egasidan e'lon"],
        "message": "E'lon tekshiruvdan o'tdi. Endi odamlar ko'ra oladi."
    }

def estimate_listing_price(rooms: int = 2, district: str = "Chilonzor") -> Dict[str, Any]:
    per_room = 2200000
    suggested = per_room * max(1, rooms)
    return {
        "status": "success",
        "suggested": suggested,
        "low": round(suggested * 0.85),
        "high": round(suggested * 1.15),
        "currency": "UZS"
    }

def generate_listing_copy(district: str, rooms: int, furnished: bool = True, metro: str = None) -> str:
    furn_str = "jihozlangan" if furnished else "jihozlanmagan"
    metro_str = f" {metro} metrosiga yaqin." if metro and metro != "Yo'q" else ""
    return f"{district or 'Toshkent'} tumanida joylashgan, {rooms or 2} xonali, {furn_str} kvartira ijaraga beriladi.{metro_str} Maklersiz, to'g'ridan-to'g'ri egasidan. 0% komissiya!"
