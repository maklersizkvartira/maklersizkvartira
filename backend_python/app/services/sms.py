"""Outbound SMS via DevSMS, with a full delivery ledger.

Every attempt writes an ``SmsLog`` row - the code itself is never stored or
logged, only the template name - so the admin panel can show cost and failure
rates without ever exposing a live OTP.
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

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

#: Message text per language. The code is the only interpolated value.
TEMPLATES: dict[str, dict[str, str]] = {
    "otp_register": {
        "uz": "Maklersiz.uz ro'yxatdan o'tish kodi: {code}. Hech kimga bermang.",
        "ru": "Код регистрации Maklersiz.uz: {code}. Никому не сообщайте.",
        "en": "Your Maklersiz.uz registration code: {code}. Do not share it.",
    },
    "otp_login": {
        "uz": "Maklersiz.uz kirish kodi: {code}. Hech kimga bermang.",
        "ru": "Код входа Maklersiz.uz: {code}. Никому не сообщайте.",
        "en": "Your Maklersiz.uz sign-in code: {code}. Do not share it.",
    },
    "otp_password_reset": {
        "uz": "Maklersiz.uz parolni tiklash kodi: {code}. Hech kimga bermang.",
        "ru": "Код сброса пароля Maklersiz.uz: {code}. Никому не сообщайте.",
        "en": "Your Maklersiz.uz password reset code: {code}. Do not share it.",
    },
    "otp_phone_change": {
        "uz": "Maklersiz.uz raqam tasdiqlash kodi: {code}.",
        "ru": "Код подтверждения номера Maklersiz.uz: {code}.",
        "en": "Your Maklersiz.uz phone verification code: {code}.",
    },
}

_TEMPLATE_FOR_PURPOSE = {
    OtpPurpose.REGISTER.value: "otp_register",
    OtpPurpose.LOGIN.value: "otp_login",
    OtpPurpose.PASSWORD_RESET.value: "otp_password_reset",
    OtpPurpose.PHONE_CHANGE.value: "otp_phone_change",
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
    message = render(template, language, code=code)
    ctx = get_context()

    entry = SmsLog(
        phone=phone,
        purpose=purpose,
        provider="devsms",
        template=template,
        status=SmsStatus.QUEUED.value,
        parts=1 + (len(message) // 70),
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
        "message": message,
        "from": settings.DEVSMS_SENDER,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                settings.DEVSMS_API_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.DEVSMS_API_TOKEN.strip()}",
                },
            )
        body: dict[str, Any]
        try:
            body = response.json()
        except ValueError:
            body = {"raw": response.text[:500]}

        provider_ok = response.is_success and body.get("success") is not False
        entry.response_meta = _safe_meta(body)
        entry.provider_message_id = str(
            body.get("id") or body.get("message_id") or ""
        ) or None

        if provider_ok:
            entry.status = SmsStatus.SENT.value
            await db.flush()
            log.info("sms.sent", phone=mask_phone(phone), purpose=purpose)
            return SmsResult(
                ok=True,
                status=SmsStatus.SENT.value,
                provider_message_id=entry.provider_message_id,
                raw=body,
            )

        entry.status = SmsStatus.FAILED.value
        entry.error = str(body.get("message") or body.get("error") or response.status_code)[:500]
        await db.flush()
        log.warning("sms.failed", phone=mask_phone(phone), purpose=purpose, error=entry.error)
        return SmsResult(ok=False, status=SmsStatus.FAILED.value, error=entry.error, raw=body)

    except httpx.HTTPError as exc:
        entry.status = SmsStatus.FAILED.value
        entry.error = f"transport: {type(exc).__name__}"
        await db.flush()
        log.warning("sms.transport_error", phone=mask_phone(phone), error=str(exc))
        return SmsResult(ok=False, status=SmsStatus.FAILED.value, error=entry.error)


def _safe_meta(body: dict[str, Any]) -> dict[str, Any]:
    """Keep provider metadata but never echo anything code-shaped back."""
    return {
        key: value
        for key, value in body.items()
        if key.lower() not in {"message", "text", "code"}
    }
