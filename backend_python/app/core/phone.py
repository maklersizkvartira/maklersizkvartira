"""Uzbek phone-number normalisation.

Everything in the database is stored in one canonical form: ``+998XXXXXXXXX``.
The old backend matched numbers with ``endsWith(last 9 digits)`` queries,
which meant two different numbers could resolve to the same account. Storing
a single canonical form removes that whole class of bug.
"""

from __future__ import annotations

import re

UZ_COUNTRY_CODE = "998"
UZ_NSN_LENGTH = 9  # national significant number, e.g. 901234567

# Operator prefixes issued in Uzbekistan. Used only for a soft plausibility
# check, so a newly issued prefix cannot lock anyone out.
KNOWN_UZ_PREFIXES = {
    "20", "33", "50", "55", "61", "62", "63", "65", "66", "67", "69",
    "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
    "88", "90", "91", "93", "94", "95", "97", "98", "99",
}


class InvalidPhoneError(ValueError):
    def __init__(self, code: str = "phone_invalid") -> None:
        super().__init__(code)
        self.code = code


def normalise_phone(raw: str | None) -> str:
    """Return the canonical ``+998XXXXXXXXX`` form or raise InvalidPhoneError.

    Accepts every shape users actually type: ``+998 90 123 45 67``,
    ``998901234567``, ``901234567``, ``8 90 123 45 67``, ``(90) 123-45-67``.
    """
    if not raw:
        raise InvalidPhoneError("phone_required")

    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        raise InvalidPhoneError("phone_required")

    if digits.startswith("00" + UZ_COUNTRY_CODE):
        digits = digits[2:]
    if digits.startswith(UZ_COUNTRY_CODE) and len(digits) == len(UZ_COUNTRY_CODE) + UZ_NSN_LENGTH:
        nsn = digits[len(UZ_COUNTRY_CODE):]
    elif len(digits) == UZ_NSN_LENGTH:
        nsn = digits
    elif len(digits) == UZ_NSN_LENGTH + 1 and digits.startswith("8"):
        # Legacy domestic trunk prefix.
        nsn = digits[1:]
    else:
        raise InvalidPhoneError("phone_invalid_length")

    if not nsn.isdigit() or len(nsn) != UZ_NSN_LENGTH:
        raise InvalidPhoneError("phone_invalid_length")
    if nsn[:2] not in KNOWN_UZ_PREFIXES:
        raise InvalidPhoneError("phone_unknown_operator")

    return f"+{UZ_COUNTRY_CODE}{nsn}"


def is_valid_phone(raw: str | None) -> bool:
    try:
        normalise_phone(raw)
        return True
    except InvalidPhoneError:
        return False


def to_sms_format(phone: str) -> str:
    """DevSMS expects bare digits without the leading ``+``."""
    return re.sub(r"\D", "", phone)


def mask_phone(phone: str | None) -> str:
    """``+998901234567`` -> ``+998 90 *** ** 67`` for logs and non-admin views."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 6:
        return "***"
    return f"+{digits[:3]} {digits[3:5]} *** ** {digits[-2:]}"


def format_display(phone: str | None) -> str:
    """``+998901234567`` -> ``+998 90 123 45 67``."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) != len(UZ_COUNTRY_CODE) + UZ_NSN_LENGTH:
        return phone
    return f"+{digits[:3]} {digits[3:5]} {digits[5:8]} {digits[8:10]} {digits[10:12]}"
