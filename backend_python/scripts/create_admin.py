"""Create or reset an admin account.

    python -m scripts.create_admin --username admin --name "Bosh admin"

The password is read from ``BOOTSTRAP_ADMIN_PASSWORD`` or generated. It is
printed once and never stored in recoverable form - admin passwords have no
AES copy, only the Argon2id hash.
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
import string
import sys

from sqlalchemy import select

from app.core import platform as _platform

_platform.configure_event_loop()

from app.core.config import settings  # noqa: E402
from app.core.database import session_scope  # noqa: E402
from app.core.security import (  # noqa: E402
    PasswordPolicyError,
    hash_password,
    validate_password,
)
from app.models.enums import AdminRole  # noqa: E402
from app.models.user import AdminUser  # noqa: E402


def generate_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        try:
            validate_password(candidate)
            return candidate
        except PasswordPolicyError:
            continue


async def main() -> int:
    parser = argparse.ArgumentParser(description="Create or reset an admin account")
    parser.add_argument("--username", default=settings.BOOTSTRAP_ADMIN_USERNAME or "admin")
    parser.add_argument("--name", default="Bosh administrator")
    parser.add_argument("--email", default=None)
    parser.add_argument(
        "--role",
        default=AdminRole.SUPERADMIN.value,
        choices=[r.value for r in AdminRole],
    )
    parser.add_argument("--password", default=settings.BOOTSTRAP_ADMIN_PASSWORD or None)
    parser.add_argument(
        "--ip-allowlist",
        default=None,
        help="Optional comma-separated CIDR list restricting where this admin may sign in",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset the password of an existing account instead of failing",
    )
    args = parser.parse_args()

    username = args.username.strip().lower()
    password = args.password or generate_password()
    generated = args.password is None

    try:
        password = validate_password(password, name=args.name)
    except PasswordPolicyError as exc:
        print(f"Password rejected by policy: {exc.code}", file=sys.stderr)
        return 2

    async with session_scope() as db:
        existing = (
            await db.execute(select(AdminUser).where(AdminUser.username == username))
        ).scalar_one_or_none()

        if existing is not None and not args.reset:
            print(
                f"Admin '{username}' already exists. Re-run with --reset to set a new password.",
                file=sys.stderr,
            )
            return 1

        if existing is not None:
            existing.password_hash = hash_password(password)
            existing.must_change_password = True
            existing.failed_login_count = 0
            existing.locked_until = None
            # Invalidate every session the old password could still be using.
            existing.token_version += 1
            action = "reset"
            admin = existing
        else:
            admin = AdminUser(
                username=username,
                full_name=args.name,
                email=args.email,
                password_hash=hash_password(password),
                role=args.role,
                is_active=True,
                must_change_password=True,
                ip_allowlist=args.ip_allowlist,
            )
            db.add(admin)
            action = "created"

    print("=" * 64)
    print(f"Admin account {action}")
    print("=" * 64)
    print(f"  Username : {username}")
    print(f"  Role     : {args.role}")
    if generated:
        print(f"  Password : {password}")
        print()
        print("  This password is shown once and cannot be recovered.")
        print("  Store it in a password manager now.")
    else:
        print("  Password : (as supplied)")
    print()
    print("  Sign in at /admin and change it on first use.")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
