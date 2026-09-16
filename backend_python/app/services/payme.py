"""Payme Merchant API (JSON-RPC 2.0) helper service and protocol handler.

Implements all 6 required Payme methods:
- CheckPerformTransaction
- CreateTransaction
- PerformTransaction
- CancelTransaction
- CheckTransaction
- GetStatement
"""

from __future__ import annotations

import base64
import hmac
import time
from typing import Any

from app.core.config import settings

# Payme Error Codes (as specified in developer.help.paycom.uz)
PAYME_ERROR_INTERNAL = -32400
PAYME_ERROR_INSUFFICIENT_PRIVILEGE = -32504
PAYME_ERROR_INVALID_JSON_RPC = -32600
PAYME_ERROR_METHOD_NOT_FOUND = -32601
PAYME_ERROR_PARSE = -32700
PAYME_ERROR_INVALID_ACCOUNT = -31050
PAYME_ERROR_ORDER_NOT_FOUND = -31050
PAYME_ERROR_INCORRECT_AMOUNT = -31001
PAYME_ERROR_TRANSACTION_NOT_FOUND = -31003
PAYME_ERROR_ALREADY_PAID = -31007
PAYME_ERROR_COULD_NOT_PERFORM = -31008
PAYME_ERROR_COULD_NOT_CANCEL = -31007

# Payme Transaction States
STATE_IN_PROGRESS = 1
STATE_DONE = 2
STATE_CANCELED = -1
STATE_POST_CANCELED = -2

# Payme Cancellation Reasons
REASON_RECEIVERS_NOT_FOUND = 1
REASON_PROCESSING_EXECUTION_FAILED = 2
REASON_EXECUTION_FAILED = 3
REASON_CANCELLED_BY_TIMEOUT = 4
REASON_FUND_RETURNED = 5
REASON_UNKNOWN = 10

#: Payme's own limit: a transaction created but not performed within this is
#: cancelled by timeout (reason 4).
TRANSACTION_TIMEOUT_MS = 12 * 3600 * 1000


def current_time_ms() -> int:
    """Returns current timestamp in milliseconds as expected by Payme."""
    return int(time.time() * 1000)


def is_configured() -> bool:
    return bool(settings.PAYME_MERCHANT_ID and settings.PAYME_SECRET_KEY)


def _accepted_keys() -> list[str]:
    """The keys a Payme request may authenticate with.

    The production key, and the sandbox key only while test mode is on. Both
    used to be literals in this file next to the settings lookup, so rotating
    the variable in Railway changed nothing — the old strings still opened
    the door.
    """
    keys = [settings.PAYME_SECRET_KEY]
    if settings.PAYME_TEST_MODE:
        keys.append(settings.PAYME_TEST_SECRET_KEY)
    return [k for k in keys if k]


def verify_payme_auth(auth_header: str | None) -> bool:
    """Verify HTTP Basic Authentication header: 'Basic base64(Paycom:SECRET_KEY)'."""
    if not auth_header or not auth_header.startswith("Basic "):
        return False

    encoded = auth_header[6:].strip()
    try:
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
        login, key = decoded.split(":", 1)
    except Exception:  # noqa: BLE001 - any malformed header is simply invalid
        return False
    if login != "Paycom":
        return False

    return any(hmac.compare_digest(key, valid) for valid in _accepted_keys())


def get_payme_fiscal_detail(amount_in_tiyin: int, title: str = "Hisob to‘ldirish (Uyiz.uz)") -> dict[str, Any]:
    """Generate fiscal detail object for Soliq integration as required by Payme."""
    return {
        "receipt_type": 0,
        "items": [
            {
                "title": title,
                "price": amount_in_tiyin,
                "count": 1,
                "code": settings.PAYME_MXIK_CODE,
                "package_code": settings.PAYME_PACKAGE_CODE,
                "vat_percent": settings.PAYME_VAT_PERCENT,
            }
        ],
    }


def generate_payme_checkout_url(
    *,
    amount_uzs: float,
    transaction_id: str,
    return_url: str | None = None,
) -> str:
    """Generate official Payme Checkout redirect URL.

    1 sum = 100 tiyin.
    URL Format: https://checkout.paycom.uz/{base64(m=...;ac.order_id=...;a=...;c=...)}

    The parameter string is `;`-separated, so a return URL containing `;`
    would start a new parameter — `c=https://x/?a=1;a=100` rewrites the
    amount. The caller only passes URLs on our own origin, and the `;` is
    stripped here as well so this function is safe on its own.
    """
    tiyin = int(round(amount_uzs * 100))
    params = f"m={settings.PAYME_MERCHANT_ID};ac.order_id={transaction_id};a={tiyin}"
    if return_url:
        params += f";c={return_url.replace(';', '%3B')}"

    encoded = base64.b64encode(params.encode("utf-8")).decode("utf-8")
    return f"{settings.PAYME_CHECKOUT_URL}/{encoded}"


def payme_error_response(req_id: Any, code: int, message_uz: str, message_ru: str = "", data: Any = None) -> dict[str, Any]:
    """Format standard JSON-RPC error response for Payme as specified by developer.help.paycom.uz."""
    err: dict[str, Any] = {
        "code": code,
        "message": {
            "ru": message_ru or message_uz,
            "uz": message_uz,
            "en": message_uz,
        },
    }
    if data is not None:
        err["data"] = data
    return {
        "error": err,
        "id": req_id,
    }


def payme_success_response(req_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    """Format standard JSON-RPC success response for Payme as specified by developer.help.paycom.uz."""
    return {
        "result": result,
        "id": req_id,
    }
