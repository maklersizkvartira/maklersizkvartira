"""Click payment gateway helper service.

Implements MD5 signature verification, Click API error codes,
and URL generators for Click Up and Click Card Pay buttons.
"""

from __future__ import annotations

import hashlib
import uuid
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


def generate_click_url(
    *,
    amount: float,
    transaction_param: str,
    return_url: str | None = None,
    card_type: str | None = None,
) -> str:
    """Generate payment link for Click.
    
    1. Click button (Click Up app / web):
       https://my.click.uz/services/pay?service_id=...&merchant_id=...&amount=...&transaction_param=...
    2. Click pay by card:
       Adding card_type or redirecting to Click's card payment interface.
    """
    params: dict[str, Any] = {
        "service_id": settings.CLICK_SERVICE_ID,
        "merchant_id": settings.CLICK_MERCHANT_ID,
        "amount": f"{amount:.2f}",
        "transaction_param": transaction_param,
    }
    if return_url:
        params["return_url"] = return_url
    if card_type:
        params["card_type"] = card_type

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
    """
    # Amount format from Click is usually formatted with two decimal places or as passed
    formatted_amount = f"{float(amount):.2f}" if isinstance(amount, (int, float)) else str(amount)
    
    if action == 0:
        raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{formatted_amount}{action}{sign_time}"
    elif action == 1:
        prep_id = merchant_prepare_id or ""
        raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{prep_id}{formatted_amount}{action}{sign_time}"
    else:
        return False

    expected_hash = hashlib.md5(raw.encode("utf-8")).hexdigest()
    return expected_hash.lower() == (sign_string or "").lower()
