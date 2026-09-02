"""Check the SMS provider without touching the database.

Answers the two questions that matter when signup stops working — is the
token accepted, and is there credit left — and, with ``--send``, proves the
whole path end to end by putting a real code on a real handset.

    python -m scripts.check_sms
    python -m scripts.check_sms --send --phone "+998 90 123 45 67"

``--send`` bills the account for one message and is deliberately not the
default: a message costs money and the balance is the thing that stops public
registration when it reaches zero.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core import platform as _platform

_platform.configure_event_loop()

from app.core.config import settings  # noqa: E402
from app.core.phone import InvalidPhoneError, normalise_phone  # noqa: E402
from app.models.enums import OtpPurpose  # noqa: E402
from app.services.sms import (  # noqa: E402
    check_balance,
    deliver_otp,
    service_name,
)

LINE = "=" * 68


def fail(message_uz: str, message_en: str) -> None:
    print(LINE, flush=True)
    print(f"  {message_uz}", flush=True)
    print(f"  {message_en}", flush=True)
    print(LINE, flush=True)


async def show_config() -> bool:
    token = settings.DEVSMS_API_TOKEN.strip()
    print(f"url          : {settings.DEVSMS_API_URL}")
    print(f"sms_enabled  : {settings.SMS_ENABLED}")
    # Never the whole token: this output ends up pasted into chats and issues.
    print(f"token        : {(token[:6] + '...' + token[-4:]) if token else '(yo‘q / unset)'}")
    print(f"service_name : {service_name()!r}  (config: {settings.DEVSMS_SERVICE_NAME!r})")
    print(f"otp_length   : {settings.OTP_LENGTH}")

    if not token:
        fail(
            "DEVSMS_API_TOKEN o'rnatilmagan — SMS yuborilmaydi.",
            "DEVSMS_API_TOKEN is unset: no message can be sent.",
        )
        return False
    if not settings.SMS_ENABLED:
        fail(
            "SMS_ENABLED=false — kod yaratiladi, lekin yuborilmaydi.",
            "SMS_ENABLED is false: codes are generated but never sent.",
        )
    return True


async def show_balance() -> bool:
    credit = await check_balance()
    if credit is None:
        fail(
            "Balansni olib bo'lmadi — token noto'g'ri yoki provayder javob bermayapti.",
            "Balance request failed: the token is wrong or the provider is down.",
        )
        return False

    remaining = credit["remaining_sms"]
    stats = credit["statistics"]
    print(
        f"balance      : {credit['balance']:.0f} so'm  "
        f"(1 SMS = {credit['sms_price']:.0f} so'm)"
    )
    print(f"remaining    : {remaining} ta SMS")
    if stats:
        print(
            f"statistics   : jami {stats.get('total_sms')} ta, "
            f"bugun {stats.get('today_sms')} ta"
        )
    if remaining is not None and remaining < 50:
        fail(
            f"DIQQAT: atigi {remaining} ta SMS qoldi — tugagach ro'yxatdan "
            "o'tish ishlamay qoladi.",
            f"WARNING: only {remaining} messages of credit left. Signup stops "
            "when it runs out.",
        )
    return True


async def send_test(raw_phone: str) -> bool:
    """Send one real verification code, exactly the way registration does."""
    try:
        phone = normalise_phone(raw_phone)
    except InvalidPhoneError as exc:
        fail(f"Raqam noto'g'ri: {exc.code}", f"Invalid phone number: {exc.code}")
        return False

    # A fixed, obviously-not-secret code: this proves delivery, and a real
    # random code printed in a terminal is a code printed in a terminal.
    print()
    print(f"yuborilmoqda / sending -> {phone}")
    result = await deliver_otp(
        phone=phone, code="0" * settings.OTP_LENGTH, purpose=OtpPurpose.REGISTER.value
    )

    if result.ok:
        data = result.raw.get("data") or {}
        print(
            f"OK: sms_id={data.get('sms_id')} narx={data.get('total_cost')} "
            f"balans={data.get('balance')}"
        )
        return True

    rejection = _rejection_note(result.raw)
    if rejection:
        fail(
            f"Korxona nomi ({service_name()!r}) moderatsiyadan o'tmadi. {rejection} "
            "20 marta ketma-ket rad etilsa OTP 24 soatga to'xtaydi.",
            f"The company name was rejected by moderation: {result.error}",
        )
    else:
        fail(f"Yuborilmadi: {result.error}", f"Send failed: {result.error}")
    return False


def _rejection_note(body: dict) -> str:
    """Strike counters, when the provider returned any."""
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    streak = body.get("reject_streak", data.get("reject_streak"))
    left = body.get("remaining_attempts", data.get("remaining_attempts"))
    if streak is None and body.get("charged") is not False:
        return ""
    return f"Ketma-ket rad: {streak}, qolgan urinish: {left}."


async def main() -> int:
    parser = argparse.ArgumentParser(description="DevSMS connectivity check")
    parser.add_argument(
        "--send",
        action="store_true",
        help="haqiqiy SMS yuborish (pullik) / send one real message (billed)",
    )
    parser.add_argument("--phone", help="--send uchun raqam / recipient for --send")
    args = parser.parse_args()

    print(LINE)
    print("  DevSMS tekshiruvi / DevSMS check")
    print(LINE)

    ok = await show_config()
    if ok:
        ok = await show_balance()
    if ok and args.send:
        if not args.phone:
            fail("--send uchun --phone kerak", "--send requires --phone")
            return 2
        ok = await send_test(args.phone)
    elif ok and not args.send:
        print("\n(haqiqiy SMS uchun: --send --phone \"+998 ...\")")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
