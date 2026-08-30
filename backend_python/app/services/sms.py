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
only used to estimate the part count for the ledger and as the text of the
plain-SMS path used for anything that is not an OTP.

The company name in an OTP is screened by the provider on every send, and
twenty consecutive rejections suspend the account for a day. That is why it is
a setting rather than a literal: if the screening ever objects to it, it has
to be changeable without a deploy.
"""

from __future__ import annotations

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

#: Message text per language, for non-OTP sends and for part estimation.
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

    payload = {
        "phone": to_sms_format(phone),
        "type": "universal_otp",
        "template_type": _OTP_TEMPLATE_TYPE.get(purpose, 1),
        "service_name": settings.DEVSMS_SERVICE_NAME,
        "otp_code": code,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                _endpoint("send_sms.php"), json=payload, headers=_headers()
            )
        body: dict[str, Any]
        try:
            body = response.json()
        except ValueError:
            body = {"raw": response.text[:500]}

        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        provider_ok = response.is_success and body.get("success") is True

        entry.response_meta = _safe_meta(body)
        entry.provider_message_id = (
            str(data.get("sms_id") or data.get("request_id") or "") or None
        )
        if data.get("parts_count"):
            entry.parts = int(data["parts_count"])

        if provider_ok:
            entry.status = SmsStatus.SENT.value
            await db.flush()
            log.info(
                "sms.sent",
                phone=mask_phone(phone),
                purpose=purpose,
                cost=data.get("total_cost"),
                balance=data.get("balance"),
            )
            return SmsResult(
                ok=True,
                status=SmsStatus.SENT.value,
                provider_message_id=entry.provider_message_id,
                raw=body,
            )

        entry.status = SmsStatus.FAILED.value
        entry.error = str(
            body.get("message") or body.get("error") or response.status_code
        )[:500]
        await db.flush()
        log.warning(
            "sms.failed", phone=mask_phone(phone), purpose=purpose, error=entry.error
        )
        return SmsResult(ok=False, status=SmsStatus.FAILED.value, error=entry.error, raw=body)

    except httpx.HTTPError as exc:
        entry.status = SmsStatus.FAILED.value
        entry.error = f"transport: {type(exc).__name__}"
        await db.flush()
        log.warning("sms.transport_error", phone=mask_phone(phone), error=str(exc))
        return SmsResult(ok=False, status=SmsStatus.FAILED.value, error=entry.error)


async def check_balance() -> dict[str, Any] | None:
    """Current credit, or ``None`` when the provider cannot be reached.

    Used by preflight and the admin panel. Running out of credit stops signup
    dead, and there is nothing in the app itself that would show why.
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
