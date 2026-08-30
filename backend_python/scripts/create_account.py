"""Create a ready-to-use account without the SMS step.

Normal signup requires an SMS code, so while the SMS provider is not
connected nobody can complete registration. This seeds an account directly:
phone already verified, status ACTIVE, password set.

    python -m scripts.create_account --phone "+998 77 785 07 37" \
        --password "Uyiz2026!" --name "Test Akkaunt" --role OWNER

Re-running with the same phone updates that account instead of failing, so it
doubles as a password reset for a seeded user.

Every run writes an audit row (actor SYSTEM, action ADMIN_USER_PASSWORD_RESET
or AUTH_REGISTER_COMPLETED) so a seeded account is not invisible in the admin
activity feed.
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from app.core import platform as _platform

_platform.configure_event_loop()

from app.core import audit as audit_log  # noqa: E402
from app.core.database import session_scope  # noqa: E402
from app.core.phone import InvalidPhoneError, mask_phone, normalise_phone  # noqa: E402
from app.core.security import (  # noqa: E402
    PasswordPolicyError,
    encrypt_secret,
    hash_password,
    validate_password,
)
from app.models.enums import AuditAction, UserRole, UserStatus  # noqa: E402
from app.models.user import User  # noqa: E402


def _referral_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


async def main() -> int:
    parser = argparse.ArgumentParser(description="Seed an account, skipping SMS")
    parser.add_argument("--phone", required=True, help="+998 XX XXX XX XX")
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Test Akkaunt")
    parser.add_argument(
        "--role",
        default=UserRole.OWNER.value,
        # DEVELOPER is offered here and nowhere else: it cannot be reached by
        # signing up, so seeding is the only way to create one.
        choices=[
            UserRole.OWNER.value,
            UserRole.STUDENT.value,
            UserRole.DEVELOPER.value,
        ],
    )
    parser.add_argument("--language", default="uz", choices=["uz", "ru", "en"])
    args = parser.parse_args()

    try:
        phone = normalise_phone(args.phone)
    except InvalidPhoneError as exc:
        print(f"Phone rejected: {exc.code}", file=sys.stderr)
        return 2

    try:
        password = validate_password(args.password, phone=phone, name=args.name)
    except PasswordPolicyError as exc:
        print(f"Password rejected by policy: {exc.code}", file=sys.stderr)
        print(
            "Tip: the password may not contain the account name or the phone number.",
            file=sys.stderr,
        )
        return 2

    now = datetime.now(timezone.utc)

    async with session_scope() as db:
        user = (
            await db.execute(select(User).where(User.phone == phone))
        ).scalar_one_or_none()
        created = user is None

        if user is None:
            user = User(
                name=args.name,
                phone=phone,
                role=args.role,
                referral_code=_referral_code(),
            )
            db.add(user)

        user.name = args.name
        user.role = args.role
        user.language = args.language
        user.password_hash = hash_password(password)
        user.password_secret = encrypt_secret(password)
        user.password_updated_at = now
        user.must_change_password = False

        # The whole point: skip the SMS round-trip but leave the account in
        # exactly the state a verified signup would have produced.
        user.status = UserStatus.ACTIVE.value
        user.phone_verified_at = now
        user.is_verified = True
        user.deleted_at = None
        user.trust_score = max(user.trust_score or 0, 60)
        user.verification_level = max(user.verification_level or 1, 2)
        user.failed_login_count = 0
        user.locked_until = None
        # Retire any token issued to a previous incarnation of this account.
        user.token_version = (user.token_version or 0) + 1
        user.admin_note = "Seeded with scripts/create_account.py (SMS not connected)."

        await db.flush()
        await audit_log.record(
            db,
            AuditAction.AUTH_REGISTER_COMPLETED
            if created
            else AuditAction.ADMIN_USER_PASSWORD_RESET,
            actor_type="SYSTEM",
            entity_type="user",
            entity_id=user.id,
            entity_label=f"{user.name} {mask_phone(user.phone)}",
            summary=(
                f"Account seeded without SMS verification ({user.role})"
                if created
                else f"Seeded account password reset ({user.role})"
            ),
            severity="WARNING",
            meta={"seeded": True, "role": user.role},
        )
        user_id = str(user.id)

    print("=" * 60)
    print("Account created" if created else "Account updated")
    print("=" * 60)
    print(f"  Phone    : {phone}")
    print(f"  Name     : {args.name}")
    print(f"  Role     : {args.role}")
    print(f"  Status   : ACTIVE (phone marked verified, no SMS needed)")
    print(f"  User id  : {user_id}")
    print()
    print("  Sign in with this phone and password. No code is requested,")
    print("  because the account is already verified.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
