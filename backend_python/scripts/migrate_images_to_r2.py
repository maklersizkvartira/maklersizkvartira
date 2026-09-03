"""Move the base64 images already in the database into R2.

Every listing photo and every avatar is currently a ``data:`` URI stored in a
text column. This walks them, uploads each one to the bucket, and replaces the
column value with the public URL.

    python -m scripts.migrate_images_to_r2            # report only
    python -m scripts.migrate_images_to_r2 --apply    # actually move them

Reporting is the default on purpose: the second form rewrites rows.

Run it now rather than later. The cost of this migration is the number of
images in the database, and that number only goes up — today it is single
digits, which is why the whole thing finishes in seconds and can be watched.

Safe to run twice. A value that is already an ``https://`` URL is left alone,
so an interrupted run resumes rather than duplicating: the row is written back
after each listing, not once at the end.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import binascii
import re
import sys

from app.core import platform as _platform

_platform.configure_event_loop()

import httpx  # noqa: E402
import structlog  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core import r2  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.listing import Listing  # noqa: E402
from app.models.user import User  # noqa: E402

log = structlog.get_logger(__name__)

#: `data:image/jpeg;base64,....`. The type is captured because it decides both
#: the extension and the Content-Type the upload is signed for — guessing it
#: from the bytes would be work for no gain when the row already says.
DATA_URI_RE = re.compile(r"^data:(image/[a-z+]+);base64,(.+)$", re.IGNORECASE | re.S)


class Skip(Exception):
    """This particular image cannot be moved, but the run should continue."""


def _decode(value: str) -> tuple[bytes, str]:
    """Bytes and content type from a data URI, or ``Skip``."""
    match = DATA_URI_RE.match(value.strip())
    if not match:
        raise Skip("not a base64 data URI")
    content_type = match.group(1).lower()
    if content_type not in r2.ALLOWED_IMAGE_TYPES:
        raise Skip(f"unsupported type {content_type}")
    try:
        # `validate=False` mirrors what browsers accept: some of these rows
        # were written years apart by different clients and a stray newline
        # inside the payload should not cost somebody their photo.
        return base64.b64decode(match.group(2), validate=False), content_type
    except (binascii.Error, ValueError) as exc:
        raise Skip(f"undecodable base64: {exc}") from exc


async def _upload(client: httpx.AsyncClient, owner_id: str, prefix: str, value: str) -> str:
    """Put one image in the bucket and return the URL it is served from."""
    payload, content_type = _decode(value)
    if len(payload) > settings.MAX_IMAGE_BYTES:
        raise Skip(f"{len(payload)} bytes is over the per-image limit")

    key = r2.new_key(prefix, owner_id, content_type)
    url = r2.signed_put(
        account_id=settings.R2_ACCOUNT_ID,
        access_key=settings.R2_ACCESS_KEY_ID,
        secret_key=settings.R2_SECRET_ACCESS_KEY,
        bucket=settings.R2_PUBLIC_BUCKET,
        key=key,
        content_type=content_type,
        content_length=len(payload),
        expires_in=settings.R2_UPLOAD_EXPIRY_SECONDS,
    )
    response = await client.put(
        url,
        content=payload,
        headers={"Content-Type": content_type, "Content-Length": str(len(payload))},
    )
    if response.status_code not in (200, 201):
        # Not a Skip. A refused PUT means the credentials, the bucket or the
        # signature are wrong, and every following upload fails the same way —
        # far better to stop on the first one than to walk the whole table
        # printing the same error.
        raise RuntimeError(
            f"R2 refused the upload: {response.status_code} {response.text[:300]}"
        )
    return f"{settings.R2_PUBLIC_BASE_URL.rstrip('/')}/{key}"


async def _run(apply: bool) -> int:
    if apply and not settings.r2_configured:
        print("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and "
              "R2_SECRET_ACCESS_KEY before --apply.")
        return 2

    moved = skipped = 0
    async with httpx.AsyncClient(timeout=60.0) as client, SessionLocal() as db:
        listings = (await db.execute(select(Listing))).scalars().all()
        for listing in listings:
            images = list(listing.images or [])
            changed = False
            for index, value in enumerate(images):
                if value.startswith("https://"):
                    continue
                try:
                    if not apply:
                        _decode(value)
                        print(f"  would move listings/{listing.id} image {index + 1}"
                              f" ({len(value) // 1024}KB of base64)")
                        moved += 1
                        continue
                    images[index] = await _upload(
                        client, str(listing.owner_id), "listings", value
                    )
                    changed = True
                    moved += 1
                except Skip as exc:
                    print(f"  SKIP listings/{listing.id} image {index + 1}: {exc}")
                    skipped += 1
            if changed:
                listing.images = images
                # Committed per listing, so an interruption leaves finished
                # rows finished instead of rolling the whole table back.
                await db.commit()
                print(f"  moved {listing.id} ({len(images)} images)")

        users = (await db.execute(select(User).where(User.avatar.is_not(None)))).scalars().all()
        for user in users:
            if not user.avatar or user.avatar.startswith("https://"):
                continue
            try:
                if not apply:
                    _decode(user.avatar)
                    print(f"  would move avatar for users/{user.id}")
                    moved += 1
                    continue
                user.avatar = await _upload(client, str(user.id), "avatars", user.avatar)
                await db.commit()
                moved += 1
                print(f"  moved avatar for {user.id}")
            except Skip as exc:
                print(f"  SKIP avatar users/{user.id}: {exc}")
                skipped += 1

    verb = "moved" if apply else "would move"
    print(f"\n{verb} {moved}, skipped {skipped}")
    if not apply:
        print("Nothing was written. Re-run with --apply to move them.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="actually upload and rewrite the rows (default: report only)",
    )
    args = parser.parse_args()
    return asyncio.run(_run(apply=args.apply))


if __name__ == "__main__":
    sys.exit(main())
