"""Click payment gateway helper service.

Implements MD5 signature verification, Click API error codes,
and URL generators for Click Up and Click Card Pay buttons.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any
from urllib.parse import urlencode

from app.core.config import settings

# Click Error Codes (as specified in docs.click.uz)
CLICK_SUCCESS = 0
CLICK_SIGN_CHECK_FAILED = -1
CLICK_INCORRECT_AMOUNT = -2
CLICK_ACTION_NOT_FOUND = -3
CLICK_ALREADY_PAID = -4
CLICK_USER_NOT_FOUND = -5
CLICK_TRANSACTION_NOT_FOUND = -6
CLICK_UPDATE_FAILED = -7
CLICK_REQUEST_ERROR = -8
CLICK_TRANSACTION_CANCELLED = -9


def is_configured() -> bool:
    """Whether the merchant credentials are present.

    Without them a checkout link would send the customer to a page that
    cannot know who to pay, and the webhook would be verifying signatures
    against an empty secret — which is to say, not verifying them.
    """
    return bool(settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID and settings.CLICK_SECRET_KEY)


def generate_click_url(
    *,
    amount: float,
    transaction_param: str,
    return_url: str | None = None,
) -> str:
    """Generate official checkout payment link for Click.

    Standard Click payment link structure (as in docs.click.uz):
    https://my.click.uz/services/pay?service_id=...&merchant_id=...&amount=...&transaction_param=...&return_url=...
    """
    params: dict[str, Any] = {
        "service_id": settings.CLICK_SERVICE_ID,
        "merchant_id": settings.CLICK_MERCHANT_ID,
        "amount": f"{amount:.2f}",
        "transaction_param": transaction_param,
    }
    if return_url:
        params["return_url"] = return_url

    return f"https://my.click.uz/services/pay?{urlencode(params)}"


def verify_click_signature(
    *,
    click_trans_id: str,
    service_id: str,
    secret_key: str,
    merchant_trans_id: str,
    merchant_prepare_id: str | None,
    amount: str | float,
    action: int,
    sign_time: str,
    sign_string: str,
) -> bool:
    """Verify MD5 sign_string sent by Click server.

    Prepare (action = 0):
        md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)

    Complete (action = 1):
        md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)

    An empty secret fails every signature: md5 over a known string is not a
    signature, and a deployment that forgot the variable must refuse money
    rather than accept anyone's.
    """
    if not secret_key or not sign_string:
        return False
    if action not in (0, 1):
        return False

    # Click may format amount as "10000", "10000.0", or "10000.00"
    # Testing all representations prevents false-negative sign mismatches
    candidates: list[str] = [str(amount)]
    try:
        f_val = float(amount)
        candidates.append(f"{f_val:.2f}")
        if f_val.is_integer():
            candidates.append(str(int(f_val)))
        candidates.append(f"{f_val:.1f}")
    except (ValueError, TypeError):
        pass

    # `compare_digest` on two str objects raises TypeError the moment either
    # side is not ASCII, and this one is whatever the caller posted — a single
    # Cyrillic character in `sign_string` turned a forged webhook into a 500
    # instead of a SIGN CHECK FAILED. A non-ASCII signature is wrong by
    # definition: an MD5 hex digest is [0-9a-f].
    provided = sign_string.strip().lower()
    if not provided.isascii():
        return False
    prep_id = merchant_prepare_id or ""
    for amt in dict.fromkeys(candidates):
        if action == 0:
            raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{amt}{action}{sign_time}"
        else:
            raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{prep_id}{amt}{action}{sign_time}"

        expected = hashlib.md5(raw.encode("utf-8")).hexdigest()  # noqa: S324 - Click's protocol
        # Constant-time: a byte-by-byte `==` leaks how many leading characters
        # matched, which is how a signature gets guessed one hex digit at a time.
        if hmac.compare_digest(expected, provided):
            return True

    return False
