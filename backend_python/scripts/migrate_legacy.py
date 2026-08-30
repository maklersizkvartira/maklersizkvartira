"""Import users and listings from the old Prisma schema.

The legacy tables (``User``, ``Listing``, ``AISession``, ``AIMessage``) live in
the same PostgreSQL database. This copies them into the new schema and then
puts every imported account into ``REGISTRATION_REQUIRED``.

Why not carry the old passwords over: they were stored in plaintext, so every
one of them must be considered compromised. An imported user keeps their
account, their phone number and all of their listings, but has to re-register
on the same number to set a real password - at which point
``complete_registration`` reclaims the existing row rather than creating a
duplicate.

    python -m scripts.migrate_legacy --dry-run
    python -m scripts.migrate_legacy
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
import uuid

from sqlalchemy import text

from app.core import platform as _platform

_platform.configure_event_loop()

from app.core.database import session_scope  # noqa: E402
from app.core.phone import InvalidPhoneError, normalise_phone  # noqa: E402
from app.models.enums import (  # noqa: E402
    ListingStatus,
    UserRole,
    UserStatus,
)

LEGACY_USER_TABLE = '"User"'
LEGACY_LISTING_TABLE = '"Listing"'


async def table_exists(db, name: str) -> bool:
    result = await db.execute(
        text("SELECT to_regclass(:name) IS NOT NULL"), {"name": name}
    )
    return bool(result.scalar())


def _referral_code() -> str:
    import secrets

    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _clean_phone(raw: str | None) -> str | None:
    """Return the canonical phone, or None for non-phone identifiers."""
    if not raw:
        return None
    if raw.startswith("google:") or "@" in raw:
        return None
    try:
        return normalise_phone(raw)
    except InvalidPhoneError:
        return None


async def migrate(dry_run: bool) -> int:
    imported_users = skipped_users = imported_listings = skipped_listings = 0
    seen_phones: set[str] = set()
    id_map: dict[str, uuid.UUID] = {}

    async with session_scope() as db:
        if not await table_exists(db, "User"):
            print("No legacy \"User\" table found - nothing to migrate.")
            return 0

        rows = (await db.execute(text(f'SELECT * FROM {LEGACY_USER_TABLE}'))).mappings().all()
        print(f"Legacy users found: {len(rows)}")

        for row in rows:
            legacy_id = str(row["id"])
            raw_phone = row.get("phone")
            phone = _clean_phone(raw_phone)
            is_google = bool(raw_phone) and (
                raw_phone.startswith("google:") or "@" in raw_phone
            )

            if phone is None and not is_google:
                skipped_users += 1
                print(f"  skip user {legacy_id}: unusable phone {raw_phone!r}")
                continue

            if phone and phone in seen_phones:
                # The old "last 9 digits" matching allowed duplicates; keep the
                # first and leave the rest behind rather than colliding.
                skipped_users += 1
                print(f"  skip user {legacy_id}: duplicate phone {phone}")
                continue
            if phone:
                seen_phones.add(phone)

            new_id = uuid.uuid4()
            id_map[legacy_id] = new_id
            role = row.get("role") or UserRole.STUDENT.value
            if role not in {r.value for r in UserRole}:
                role = UserRole.STUDENT.value

            if not dry_run:
                await db.execute(
                    text(
                        """
                        INSERT INTO users (
                            id, name, phone, email, google_uid, avatar,
                            password_hash, password_secret, must_change_password,
                            role, status, trust_score, verification_level,
                            is_verified, xp_points, referral_code, language, theme,
                            failed_login_count, token_version,
                            admin_note, created_at, updated_at
                        ) VALUES (
                            :id, :name, :phone, :email, :google_uid, :avatar,
                            NULL, NULL, TRUE,
                            :role, :status, :trust_score, 1,
                            FALSE, 0, :referral_code, 'uz', 'system',
                            0, 1,
                            :admin_note, :created_at, NOW()
                        )
                        """
                    ),
                    {
                        "id": new_id,
                        "name": (row.get("name") or "Foydalanuvchi")[:120],
                        # Google-only accounts have no real number; park them on
                        # a unique placeholder so the column stays unique.
                        "phone": phone or f"legacy:{legacy_id}",
                        "email": raw_phone if is_google and "@" in (raw_phone or "") else None,
                        "google_uid": (
                            raw_phone.replace("google:", "")
                            if is_google and raw_phone.startswith("google:")
                            else None
                        ),
                        "avatar": row.get("avatar"),
                        "role": role,
                        "status": UserStatus.REGISTRATION_REQUIRED.value,
                        "trust_score": int(row.get("trustScore") or 50),
                        "referral_code": _referral_code(),
                        "admin_note": (
                            "Imported from the legacy backend. The account had a "
                            "plaintext password, which was discarded; the owner "
                            "must re-register on the same phone number."
                        ),
                        "created_at": row.get("createdAt"),
                    },
                )
            imported_users += 1

        # -- Listings --------------------------------------------------------
        if await table_exists(db, "Listing"):
            listings = (
                await db.execute(text(f"SELECT * FROM {LEGACY_LISTING_TABLE}"))
            ).mappings().all()
            print(f"Legacy listings found: {len(listings)}")

            for row in listings:
                owner_legacy = str(row.get("ownerId"))
                owner_id = id_map.get(owner_legacy)
                if owner_id is None:
                    skipped_listings += 1
                    continue

                # The legacy `aiCheckStatus` column held a publish-time machine
                # verdict. That scanner is gone: a listing now publishes
                # immediately and only an administrator can take it down. So the
                # only verdict worth carrying over is a REJECTED one (somebody
                # deliberately pulled the listing); PENDING and WARNING were
                # waiting on a check that will never run again and would strand
                # the row in a status nothing can clear.
                status = row.get("aiCheckStatus") or ListingStatus.APPROVED.value
                if status not in {s.value for s in ListingStatus}:
                    status = ListingStatus.APPROVED.value
                if status in {
                    ListingStatus.PENDING.value,
                    ListingStatus.WARNING.value,
                }:
                    status = ListingStatus.APPROVED.value

                if not dry_run:
                    await db.execute(
                        text(
                            """
                            INSERT INTO listings (
                                id, title, description, price, currency, deposit_price,
                                utilities_included, rooms, area, floor, total_floors,
                                property_type, region, district, address, latitude, longitude,
                                metro_station, metro_distance_minutes, university_name,
                                university_distance_minutes, furnished, pets_allowed,
                                parking, internet, air_conditioning, washing_machine,
                                images, has_virtual_tour, is_roommate,
                                roommate_gender, roommate_spots_available,
                                contact_telegram, preferred_contact_time,
                                status, trust_score, risk_score, ai_risk_reasons,
                                safety_badges, is_featured, promotion_weight,
                                views_count, favorites_count, contact_count,
                                published_at, owner_id, created_at, updated_at
                            ) VALUES (
                                :id, :title, :description, :price, 'UZS', :deposit_price,
                                :utilities_included, :rooms, :area, :floor, :total_floors,
                                :property_type, :region, :district, :address, :latitude, :longitude,
                                :metro_station, :metro_distance_minutes, :university_name,
                                :university_distance_minutes, :furnished, :pets_allowed,
                                :parking, :internet, :air_conditioning, :washing_machine,
                                :images, :has_virtual_tour, :is_roommate,
                                :roommate_gender, :roommate_spots_available,
                                :contact_telegram, :preferred_contact_time,
                                :status, :trust_score, :risk_score, :ai_risk_reasons,
                                :safety_badges, FALSE, 0,
                                :views_count, :favorites_count, :contact_count,
                                :created_at, :owner_id, :created_at, NOW()
                            )
                            """
                        ),
                        {
                            "id": uuid.uuid4(),
                            "title": (row.get("title") or "E'lon")[:160],
                            "description": row.get("description") or "",
                            "price": float(row.get("price") or 0) or 1,
                            "deposit_price": row.get("depositPrice"),
                            "utilities_included": bool(row.get("utilitiesIncluded")),
                            "rooms": int(row.get("rooms") or 1),
                            "area": row.get("area"),
                            "floor": row.get("floor"),
                            "total_floors": row.get("totalFloors"),
                            "property_type": row.get("propertyType") or "APARTMENT",
                            "region": row.get("region"),
                            "district": row.get("district"),
                            "address": row.get("address"),
                            "latitude": row.get("latitude"),
                            "longitude": row.get("longitude"),
                            "metro_station": row.get("metroStation"),
                            "metro_distance_minutes": row.get("metroDistanceMinutes"),
                            "university_name": row.get("universityName"),
                            "university_distance_minutes": row.get(
                                "universityDistanceMinutes"
                            ),
                            "furnished": bool(row.get("furnished")),
                            "pets_allowed": bool(row.get("petsAllowed")),
                            "parking": bool(row.get("parking")),
                            "internet": bool(row.get("internet")),
                            "air_conditioning": bool(row.get("airConditioning")),
                            "washing_machine": bool(row.get("washingMachine")),
                            "images": row.get("images") or [],
                            "has_virtual_tour": bool(row.get("hasVirtualTour")),
                            "is_roommate": bool(row.get("isRoommate")),
                            "roommate_gender": row.get("roommateGender"),
                            "roommate_spots_available": row.get("roommateSpotsAvailable"),
                            "contact_telegram": _clean_handle(row.get("contactTelegram")),
                            "preferred_contact_time": row.get("preferredContactTime"),
                            "status": status,
                            # Reliability starts at 100 for everyone and only
                            # drops when an administrator confirms a report, so
                            # the legacy scanner's trustScore / riskScore /
                            # aiRiskReasons are not carried over. Badges are
                            # likewise re-derived by the app; the retired
                            # NO_COMMISSION / AI_CHECKED / STUDENT_FRIENDLY
                            # values must never re-enter the table.
                            "trust_score": 100,
                            "risk_score": 0,
                            "ai_risk_reasons": [],
                            "safety_badges": [
                                b for b in (row.get("safetyBadges") or [])
                                if b in {"VERIFIED_OWNER", "PROPERTY_VERIFIED"}
                            ],
                            "views_count": int(row.get("viewsCount") or 0),
                            "favorites_count": int(row.get("favoritesCount") or 0),
                            "contact_count": int(row.get("contactCount") or 0),
                            "created_at": row.get("createdAt"),
                            "owner_id": owner_id,
                        },
                    )
                imported_listings += 1

        if dry_run:
            # Roll the whole transaction back, but carry the tallies out so the
            # dry run still reports what it would have done.
            raise _Rollback(
                imported_users, skipped_users, imported_listings, skipped_listings
            )

    return _report(imported_users, skipped_users, imported_listings, skipped_listings, dry_run)


def _clean_handle(value: str | None) -> str | None:
    if not value:
        return None
    handle = value.strip().lstrip("@").replace("https://t.me/", "")
    return handle[:64] if re.fullmatch(r"[A-Za-z0-9_]{4,32}", handle) else None


class _Rollback(Exception):
    """Signals the dry run to discard everything, carrying the tallies."""

    def __init__(self, users: int, skipped_users: int, listings: int, skipped_listings: int):
        super().__init__("dry run")
        self.stats = (users, skipped_users, listings, skipped_listings)


def _report(users, skipped_users, listings, skipped_listings, dry_run) -> int:
    print()
    print("=" * 60)
    print("DRY RUN - nothing was written" if dry_run else "Migration complete")
    print("=" * 60)
    print(f"  users imported    : {users}")
    print(f"  users skipped     : {skipped_users}")
    print(f"  listings imported : {listings}")
    print(f"  listings skipped  : {skipped_listings}")
    print()
    print("  Every imported account is REGISTRATION_REQUIRED: the old")
    print("  plaintext passwords were discarded. Owners re-register on the")
    print("  same phone number and reclaim their account and listings.")
    print("=" * 60)
    return 0


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        return await migrate(args.dry_run)
    except _Rollback as rollback:
        return _report(*rollback.stats, True)
    except Exception as exc:  # noqa: BLE001
        print(f"Migration failed, nothing committed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
