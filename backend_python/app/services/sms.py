"""Outbound SMS via DevSMS, with a full delivery ledger.

Every attempt writes an ``SmsLog`` row — the code itself is never stored or
logged, only the template name — so the admin panel can show cost and failure
rates without ever exposing a live OTP.

Why the OTP path uses the provider's own templates
--------------------------------------------------
DevSMS forwards to Eskiz, and Eskiz will not deliver arbitrary text: a message
has to match a template that was submitted and approved in advance. A hand
written "Uyiz ro'yxatdan o'tish kodi: 1234" is refused, which is a
particularly bad failure because it happens per message, silently, and only
for real users — never in a test that stubs the provider out.

So verification codes go through ``type: "universal_otp"``. Those four
templates are approved already; we choose which one by purpose and pass the
code. The wording comes from Eskiz, not from us, so ``TEMPLATES`` below is
only used to estimate the part count for the ledger — the user never sees it.

The company name in an OTP is screened by the provider on every send, and
twenty consecutive rejections suspend the account for a day. That is why it is
a setting rather than a literal: if the screening ever objects to it, it has
to be changeable without a deploy.
"""

from __future__ import annotations

import re
from typing import Any

import httpx
import structlog

from app.core.config import settings
from app.core.context import get_context
from app.core.phone import mask_phone, to_sms_format
from app.models.analytics import SmsLog
from app.models.enums import OtpPurpose, SmsStatus

log = structlog.get_logger(__name__)

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)

#: Sum below which a send logs a warning. Roughly fifty messages at the
#: current per-message price — enough notice to top up before signup stops.
LOW_BALANCE_WARN_SUM = 11_000.0

#: Message text per language. Only used to estimate the part count.
TEMPLATES: dict[str, dict[str, str]] = {
    "otp_register": {
        "uz": "Uyiz ro‘yxatdan o‘tish kodi: {code}. Hech kimga bermang.",
        "ru": "Код регистрации Uyiz: {code}. Никому не сообщайте.",
        "en": "Your Uyiz registration code: {code}. Do not share it.",
    },
    "otp_login": {
        "uz": "Uyiz kirish kodi: {code}. Hech kimga bermang.",
        "ru": "Код входа Uyiz: {code}. Никому не сообщайте.",
        "en": "Your Uyiz sign-in code: {code}. Do not share it.",
    },
    "otp_password_reset": {
        "uz": "Uyiz parolni tiklash kodi: {code}. Hech kimga bermang.",
        "ru": "Код сброса пароля Uyiz: {code}. Никому не сообщайте.",
        "en": "Your Uyiz password reset code: {code}. Do not share it.",
    },
    "otp_phone_change": {
        "uz": "Uyiz raqam tasdiqlash kodi: {code}.",
        "ru": "Код подтверждения номера Uyiz: {code}.",
        "en": "Your Uyiz phone verification code: {code}.",
    },
}

_TEMPLATE_FOR_PURPOSE = {
    OtpPurpose.REGISTER.value: "otp_register",
    OtpPurpose.LOGIN.value: "otp_login",
    OtpPurpose.PASSWORD_RESET.value: "otp_password_reset",
    OtpPurpose.PHONE_CHANGE.value: "otp_phone_change",
}

#: DevSMS universal-OTP template ids.
#:   1 = an operation, 2 = password reset, 3 = signing up, 4 = signing in.
#: PHONE_CHANGE maps to 1 because confirming a new number is an operation on an
#: account that already exists, not a registration.
_OTP_TEMPLATE_TYPE = {
    OtpPurpose.REGISTER.value: 3,
    OtpPurpose.LOGIN.value: 4,
    OtpPurpose.PASSWORD_RESET.value: 2,
    OtpPurpose.PHONE_CHANGE.value: 1,
}


def render(template: str, language: str, **params: Any) -> str:
    entry = TEMPLATES.get(template) or TEMPLATES["otp_register"]
    text = entry.get(language) or entry["uz"]
    return text.format(**params)


class SmsResult:
    __slots__ = ("ok", "status", "provider_message_id", "error", "raw")

    def __init__(
        self,
        ok: bool,
        status: str,
        provider_message_id: str | None = None,
        error: str | None = None,
        raw: dict[str, Any] | None = None,
    ) -> None:
        self.ok = ok
        self.status = status
        self.provider_message_id = provider_message_id
        self.error = error
        self.raw = raw or {}


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.DEVSMS_API_TOKEN.strip()}",
    }


def _endpoint(path: str) -> str:
    return f"{settings.DEVSMS_API_URL.rstrip('/')}/{path}"


#: What the provider accepts as a company name: 2-50 characters, and only
#: letters, digits, space, dot or dash — anything else is refused before
#: the message is composed. Latin and Cyrillic both count as letters: the
#: brand may yet be registered in either alphabet.
_SERVICE_NAME_ALLOWED = re.compile(r"[^0-9A-Za-z\u0400-\u04FF .-]+")
_FALLBACK_SERVICE_NAME = "Uyiz"


def service_name() -> str:
    """The company name to put in an OTP, scrubbed to the provider's charset.

    A name carrying a character the provider does not accept is refused per
    message, and twenty consecutive refusals suspend OTP sending for a day.
    Scrubbing here means a stray apostrophe or emoji in the dashboard variable
    costs nothing instead of costing the account.
    """
    raw = (settings.DEVSMS_SERVICE_NAME or "").strip()
    cleaned = _SERVICE_NAME_ALLOWED.sub("", raw)
    # The provider counts characters, not bytes, and refuses anything outside
    # 2..50 outright.
    cleaned = " ".join(cleaned.split())[:50].strip(" .-")
    if len(cleaned) < 2:
        log.warning(
            "sms.service_name_unusable", configured=raw, fallback=_FALLBACK_SERVICE_NAME
        )
        return _FALLBACK_SERVICE_NAME
    if cleaned != raw:
        log.warning("sms.service_name_adjusted", configured=raw, used=cleaned)
    return cleaned


async def deliver_otp(*, phone: str, code: str, purpose: str) -> SmsResult:
    """POST one verification code to the provider. No database, no ledger.

    Split out from :func:`send_otp_sms` so the delivery path can be exercised
    on its own — ``scripts/check_sms.py`` proves a token works without needing
    a database, and the ledger writing stays in one place.
    """
    payload = {
        "phone": to_sms_format(phone),
        "type": "universal_otp",
        "template_type": _OTP_TEMPLATE_TYPE.get(purpose, 1),
        "service_name": service_name(),
        "otp_code": code,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                _endpoint("send_sms.php"), json=payload, headers=_headers()
            )
    except httpx.HTTPError as exc:
        log.warning("sms.transport_error", phone=mask_phone(phone), error=str(exc))
        return SmsResult(
            ok=False,
            status=SmsStatus.FAILED.value,
            error=f"transport: {type(exc).__name__}",
        )

    body: dict[str, Any]
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text[:500]}

    data = body.get("data") if isinstance(body.get("data"), dict) else {}

    if response.is_success and body.get("success") is True:
        log.info(
            "sms.sent",
            phone=mask_phone(phone),
            purpose=purpose,
            cost=data.get("total_cost"),
            balance=data.get("balance"),
        )
        _warn_on_low_balance(data)
        return SmsResult(
            ok=True,
            status=SmsStatus.SENT.value,
            provider_message_id=str(
                data.get("sms_id") or data.get("request_id") or ""
            ) or None,
            raw=body,
        )

    # On a failure the provider fills "error"; "message" carries the wording of
    # a *successful* send. Reading "message" first turned a rejection into a
    # ledger row that read like a delivery.
    error = str(body.get("error") or body.get("message") or response.status_code)[:500]

    rejection = _moderation_rejection(body)
    if rejection is not None:
        # A company name moderation refuses is not a transient failure: every
        # later send fails identically, and twenty in a row suspend OTP for 24
        # hours. Nothing else in the app would show why signup stopped, so it
        # gets its own event, with the strike count.
        log.error(
            "sms.moderation_rejected",
            phone=mask_phone(phone),
            purpose=purpose,
            service_name=payload["service_name"],
            reject_streak=rejection["reject_streak"],
            remaining_attempts=rejection["remaining_attempts"],
            charged=rejection["charged"],
            error=error,
        )
    else:
        log.warning("sms.failed", phone=mask_phone(phone), purpose=purpose, error=error)

    return SmsResult(ok=False, status=SmsStatus.FAILED.value, error=error, raw=body)


async def send_otp_sms(
    db,
    *,
    phone: str,
    code: str,
    purpose: str,
    language: str = "uz",
) -> SmsResult:
    """Send a verification code and record the attempt.

    Returns a result rather than raising: the caller decides whether a failed
    send should surface to the user (registration) or be swallowed (resend of
    an already-valid code).
    """
    template = _TEMPLATE_FOR_PURPOSE.get(purpose, "otp_register")
    ctx = get_context()

    entry = SmsLog(
        phone=phone,
        purpose=purpose,
        provider="devsms",
        template=template,
        status=SmsStatus.QUEUED.value,
        # The delivered wording is the provider's, so this is an estimate for
        # the ledger — near enough to spot a message that split in two.
        parts=1 + (len(render(template, language, code=code)) // 70),
        ip=ctx.ip,
    )
    db.add(entry)

    if not settings.SMS_ENABLED or not settings.DEVSMS_API_TOKEN:
        entry.status = SmsStatus.SKIPPED.value
        entry.error = "sms_disabled_or_unconfigured"
        await db.flush()
        log.warning("sms.skipped", phone=mask_phone(phone), purpose=purpose)
        return SmsResult(ok=False, status=SmsStatus.SKIPPED.value, error="sms_disabled")

    result = await deliver_otp(phone=phone, code=code, purpose=purpose)

    entry.status = result.status
    entry.error = result.error
    entry.provider_message_id = result.provider_message_id
    if result.raw:
        entry.response_meta = _safe_meta(result.raw)
    data = result.raw.get("data") if isinstance(result.raw.get("data"), dict) else {}
    if data.get("parts_count"):
        entry.parts = int(data["parts_count"])
    await db.flush()

    return result


async def check_balance() -> dict[str, Any] | None:
    """Current credit, or ``None`` when the provider cannot be reached.

    Used by ``scripts/preflight`` at boot and by ``scripts/check_sms``.
    Running out of credit stops signup dead, and there is nothing in the app
    itself that would show why.
    """
    if not settings.DEVSMS_API_TOKEN:
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(_endpoint("get_balance.php"), headers=_headers())
        if not response.is_success:
            return None
        body = response.json()
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        balance = float(data.get("balance") or 0)
        price = float(data.get("sms_price") or 0)
        return {
            "balance": balance,
            "sms_price": price,
            # The figure that actually matters: how many more people can sign
            # up before registration silently stops working.
            "remaining_sms": int(balance // price) if price else None,
            "statistics": data.get("statistics") or {},
        }
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        log.warning("sms.balance_failed", error=str(exc))
        return None


def _moderation_rejection(body: dict[str, Any]) -> dict[str, Any] | None:
    """Describe a company-name rejection, or ``None`` for any other failure.

    The provider signals one two ways: ``charged: false`` (the send never
    reached Eskiz, so nothing was billed) and a ``reject_streak`` counter. Both
    live either at the top level or inside ``data`` depending on the endpoint,
    so both places are checked.
    """
    data = body.get("data") if isinstance(body.get("data"), dict) else {}

    def field(name: str) -> Any:
        value = body.get(name)
        return data.get(name) if value is None else value

    charged = field("charged")
    streak = field("reject_streak")
    if charged is not False and streak is None:
        return None
    return {
        "charged": charged,
        "reject_streak": streak,
        "remaining_attempts": field("remaining_attempts"),
    }


def _warn_on_low_balance(data: dict[str, Any]) -> None:
    """Say so while there is still credit to act on.

    The provider returns the remaining balance with every send. Running out
    stops registration, code sign-in and password reset dead, and the app
    itself shows nothing but a generic error — so the only warning anyone gets
    is this one.
    """
    try:
        balance = float(data.get("balance"))
    except (TypeError, ValueError):
        return
    if balance <= 0:
        log.error("sms.balance_exhausted", balance=balance)
    elif balance < LOW_BALANCE_WARN_SUM:
        log.warning("sms.balance_low", balance=balance)


def _safe_meta(body: dict[str, Any]) -> dict[str, Any]:
    """Keep provider metadata but never echo anything code-shaped back."""
    drop = {"message", "text", "code", "otp_code"}
    data = body.get("data")
    cleaned = {
        key: value
        for key, value in body.items()
        if key.lower() not in drop and key != "data"
    }
    if isinstance(data, dict):
        cleaned["data"] = {
            key: value for key, value in data.items() if key.lower() not in drop
        }
    return cleaned
