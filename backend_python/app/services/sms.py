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


#: Transport failures that prove the request never reached the provider: the
#: connection was refused, timed out before it opened, could not be taken from
#: the pool, died at the proxy, named a scheme httpx will not speak, or was
#: rejected while still being built. Nothing was sent, nothing was billed and no
#: message exists — which makes these as definitive as an outright refusal, and
#: they are the shape a provider outage or a DNS failure actually takes.
#:
#: Routing the whole ``httpx.HTTPError`` tree to UNKNOWN therefore reported "the
#: provider is down" to the user as "your code is on its way": no raise, no
#: refund of the rate-limit tokens, and a dead code left live for a message that
#: was never composed. Everything NOT listed here happened after the request was
#: on the wire and stays UNKNOWN, because the provider accepts, bills and
#: delivers in the same call, so a request that died on the way back has very
#: often already put an SMS on the handset.
_NEVER_REACHED_PROVIDER = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.PoolTimeout,
    httpx.ProxyError,
    httpx.UnsupportedProtocol,
    httpx.LocalProtocolError,
)

_REDACTED = "[redacted]"

#: A run of 4 to 8 digits standing on its own — the whole range of code lengths
#: the provider will carry, which ``OTP_LENGTH``'s validator pins at boot.
#: Bounded by non-digits on both sides so a phone number or a message id is not
#: chopped in half: mangling those would hide what went wrong without hiding
#: anything that matters.
_CODE_SHAPED = re.compile(r"(?<!\d)\d{4,8}(?!\d)")

#: Keys whose value is free provider prose rather than an identifier. Scrubbed
#: rather than dropped, because they are the only thing that says why a send
#: failed and that is what the ledger is for.
_FREE_TEXT_KEYS = {"error", "reason", "detail", "details", "description"}


def _without_code(text: str, code: str | None = None) -> str:
    """Provider prose with anything code-shaped taken out of it.

    On a failure the provider fills ``error``, and on some rejections what it
    puts there is the message it refused to send — which contains the live code.
    That string is written to ``SmsLog.error`` and to a structlog line, so
    echoing it back would break this module's one promise: the code is never
    stored and never logged. ``_safe_meta`` already drops ``message`` for
    exactly this reason; ``error`` is the same text arriving under another name.

    The code we sent is removed by value, and any remaining isolated digit run
    of code length by shape — the second pass costs at most a balance figure
    inside an error sentence, which is in ``response_meta`` and in the logs
    anyway, and buys cover against a provider wording nobody has seen yet.
    """
    cleaned = text.replace(code, _REDACTED) if code else text
    return _CODE_SHAPED.sub(_REDACTED, cleaned)


#: What the provider has been seen to put in ``success`` when it means yes.
#: JSON booleans, the digit 1 and these words all appear in the wild.
_TRUTHY_SUCCESS = {"1", "true", "yes", "ok", "success"}


def _means_success(value: Any) -> bool:
    """Whether the provider's ``success`` field says the message went out.

    It is not always a JSON boolean: the same endpoint answers ``true``, ``1``
    and ``"true"`` depending on which layer of theirs handled the request. An
    identity test against ``True`` read the other two as a refusal, so the
    handset received a code while we recorded a failure, threw the code away
    and told the user nothing had been sent — the single worst outcome
    available, because the user can see the SMS we are denying we sent.
    """
    if isinstance(value, bool):
        return value
    # bool is a subclass of int, so this only ever sees genuine numbers.
    if isinstance(value, (int, float)):
        return value == 1
    if isinstance(value, str):
        return value.strip().lower() in _TRUTHY_SUCCESS
    return False


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
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        # Which of the two this is decides whether the caller may throw the code
        # away: a request that never reached the provider is a failure like any
        # refusal, while a read timeout means the ANSWER was lost, not the
        # message. Reporting the second as FAILED made the caller destroy a code
        # the user was looking at and tell them none had been sent; reporting
        # the first as UNKNOWN told the user a code was coming during an outage.
        # `InvalidURL` is not an `HTTPError` — a misconfigured DEVSMS_API_URL
        # used to escape this handler entirely, taking the ledger row, both
        # audit rows, the refund and the code deletion down with it through
        # `get_db`'s rollback, and answering the visitor with a bare 500.
        never_sent = isinstance(exc, (_NEVER_REACHED_PROVIDER, httpx.InvalidURL))
        log.warning(
            "sms.transport_error",
            phone=mask_phone(phone),
            purpose=purpose,
            error=str(exc),
            error_type=type(exc).__name__,
            never_sent=never_sent,
        )
        return SmsResult(
            ok=False,
            status=SmsStatus.FAILED.value if never_sent else SmsStatus.UNKNOWN.value,
            error=f"transport: {type(exc).__name__}",
        )

    body: dict[str, Any]
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text[:500]}

    # A 5xx is the same shape of doubt as a read timeout: the request reached
    # something that took responsibility for it, and whether the message was
    # forwarded before it fell over is unknowable from here. Calling that
    # FAILED made the caller delete a code that may well have been delivered
    # and tell the visitor nothing was sent — the exact failure the transport
    # split above exists to prevent, arriving one branch later.
    if response.status_code >= 500:
        error = _without_code(
            str(body.get("error") or body.get("message") or response.status_code), code
        )
        log.warning(
            "sms.indeterminate",
            phone=mask_phone(phone),
            purpose=purpose,
            status=response.status_code,
            error=error,
        )
        return SmsResult(
            ok=False, status=SmsStatus.UNKNOWN.value, error=error, raw=body
        )

    data = body.get("data") if isinstance(body.get("data"), dict) else {}

    # Read before the success branch rather than inside it. The provider returns
    # the remaining balance on rejections too, and running out of credit is the
    # one condition that can never produce a successful send — so warning only
    # on success meant the warning that exists for this could never fire.
    _warn_on_low_balance(data)

    if response.is_success and _means_success(body.get("success")):
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
            provider_message_id=str(
                data.get("sms_id") or data.get("request_id") or ""
            ) or None,
            raw=body,
        )

    # On a failure the provider fills "error"; "message" carries the wording of
    # a *successful* send. Reading "message" first turned a rejection into a
    # ledger row that read like a delivery. Both are the provider's own prose
    # and both have been seen to quote the message being refused, so neither
    # reaches the ledger or a log line before the code is taken back out.
    error = _without_code(
        str(body.get("error") or body.get("message") or response.status_code), code
    )[:500]

    rejection = moderation_rejection(body)
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
        entry.response_meta = _safe_meta(result.raw, code)
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


def moderation_rejection(body: dict[str, Any]) -> dict[str, Any] | None:
    """Describe a company-name rejection, or ``None`` for any other failure.

    Public because ``scripts/check_sms.py`` needs the same answer and used to
    carry its own copy of the rule — the copy that still read ``charged`` and so
    still told whoever was on call, during the incident, to go and re-register a
    brand name that was never the problem.

    ``reject_streak`` is the signal, and the only one: it is the provider's own
    count of consecutive moderation refusals, and twenty of them suspend OTP
    sending for a day. ``charged: false`` used to be accepted as equivalent, but
    it says nothing more than "you were not billed" — which is equally true of
    an exhausted balance, a rejected API token and an unroutable number. Every
    one of those was therefore logged as ``sms.moderation_rejected`` with the
    company name attached, sending whoever was on call to re-register a brand
    name that was never the problem while signup stayed down.

    The counter lives either at the top level or inside ``data`` depending on
    the endpoint, so both places are checked.
    """
    data = body.get("data") if isinstance(body.get("data"), dict) else {}

    def field(name: str) -> Any:
        value = body.get(name)
        return data.get(name) if value is None else value

    streak = field("reject_streak")
    if streak is None:
        return None
    charged = field("charged")
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


def _safe_meta(body: dict[str, Any], code: str | None = None) -> dict[str, Any]:
    """Keep provider metadata but never echo anything code-shaped back.

    Dropping ``message`` is not enough on its own: the same wording comes back
    under ``error`` on a rejection, and that key has to be kept because it is
    the only thing in the row that says what went wrong. It is scrubbed instead.
    """
    drop = {"message", "text", "code", "otp_code"}

    def clean(value: Any, key: str | None = None) -> Any:
        """Walk the whole body, not the top two levels.

        The earlier version dropped and scrubbed at exactly two depths, which
        was fine for the responses this provider sends today and silently
        wrong for any of them that grows a nested request echo or a
        per-message array — the live code would have been copied into
        ``SmsLog.response_meta`` verbatim, in a column the admin panel reads.
        """
        if isinstance(value, dict):
            return {
                k: clean(v, k) for k, v in value.items() if k.lower() not in drop
            }
        if isinstance(value, list):
            return [clean(item, key) for item in value]
        if isinstance(value, str):
            # Every string, not only the five named keys: a provider free to
            # invent a key name is free to invent one this list has not heard
            # of, and the cost of scrubbing a string that never held a code is
            # nothing at all.
            return _without_code(value, code)
        return value

    cleaned = clean(body)
    return cleaned if isinstance(cleaned, dict) else {}
