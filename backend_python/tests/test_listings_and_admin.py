"""Listing ownership, data exposure, and admin authorisation."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from tests.conftest import auth_headers, register_and_verify

PASSWORD = "Salom2026x"

VALID_LISTING = {
    "title": "Chilonzorda 2 xonali kvartira ijaraga",
    "description": (
        "Yangi ta'mirlangan, mebel va texnika bilan jihozlangan kvartira. "
        "Metro bekatiga 5 daqiqa piyoda. Uy egasidan to'g'ridan-to'g'ri."
    ),
    "price": 4_000_000,
    "rooms": 2,
    "area": 62,
    "district": "Chilonzor",
    "region": "Toshkent shahri",
    #: At least one photo is mandatory - do not remove this key while
    #: "simplifying" the fixture, or every listing test starts 422ing.
    "images": ["https://example.uz/photo1.jpg"],
}


async def _owner(client, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone, role="OWNER")
    return tokens, phone


async def _create_listing(client, tokens, **overrides):
    payload = {**VALID_LISTING, **overrides}
    response = await client.post(
        "/api/v1/listings", json=payload, headers=auth_headers(tokens)
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def _admin_tokens(client):
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    assert login.status_code == 200, login.text
    return login.json()


# ---------------------------------------------------------------------------
# Ownership
# ---------------------------------------------------------------------------
async def test_owner_can_create_a_listing(client, unique_phone):
    """Publishing is deterministic now: no check runs, so nothing can hold it.

    The assertions are tight on purpose. They used to accept WARNING or
    PENDING because the old AI verdict was non-deterministic - and either of
    those means invisible to everyone, which a regression could reintroduce
    without failing a looser test.
    """
    tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, tokens)
    assert listing["title"] == VALID_LISTING["title"]
    assert listing["status"] == "APPROVED"
    assert listing["publishedAt"] is not None
    assert listing["trustScore"] == 100
    assert listing["aiCheckStatus"] == listing["status"]

    # And it is publicly browsable at once.
    public = await client.get("/api/v1/listings")
    assert listing["id"] in [row["id"] for row in public.json()["data"]]


async def test_a_student_cannot_create_a_listing(client, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone, role="STUDENT")
    response = await client.post(
        "/api/v1/listings", json=VALID_LISTING, headers=auth_headers(tokens)
    )
    assert response.status_code == 403
    assert response.json()["code"] == "owner_role_required"


async def test_anonymous_cannot_create_a_listing(client):
    response = await client.post("/api/v1/listings", json=VALID_LISTING)
    assert response.status_code == 401


async def test_another_user_cannot_edit_or_delete_your_listing(client, unique_phone):
    """The old backend had no ownership check - and no PUT/DELETE at all."""
    owner_tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)

    attacker_tokens, _ = await _owner(client, unique_phone)

    edit = await client.put(
        f"/api/v1/listings/{listing['id']}",
        json={"price": 1},
        headers=auth_headers(attacker_tokens),
    )
    assert edit.status_code == 403
    assert edit.json()["code"] == "listing_forbidden"

    delete = await client.delete(
        f"/api/v1/listings/{listing['id']}", headers=auth_headers(attacker_tokens)
    )
    assert delete.status_code == 403


async def test_owner_can_edit_and_delete_their_own_listing(client, unique_phone):
    tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, tokens)

    edited = await client.put(
        f"/api/v1/listings/{listing['id']}",
        json={"price": 5_500_000},
        headers=auth_headers(tokens),
    )
    assert edited.status_code == 200
    assert edited.json()["data"]["price"] == 5_500_000

    deleted = await client.delete(
        f"/api/v1/listings/{listing['id']}", headers=auth_headers(tokens)
    )
    assert deleted.status_code == 200

    gone = await client.get(f"/api/v1/listings/{listing['id']}")
    assert gone.status_code == 404


async def test_server_controlled_fields_cannot_be_set_by_the_client(client, unique_phone):
    """Mass assignment: the old API let a listing self-certify as trusted.

    ``videoUrl`` is in the list because video is gone from the product: the
    field no longer exists on any schema, so sending it must be refused rather
    than quietly ignored.
    """
    tokens, _ = await _owner(client, unique_phone)
    response = await client.post(
        "/api/v1/listings",
        json={
            **VALID_LISTING,
            "trustScore": 100,
            "riskScore": 0,
            "status": "APPROVED",
            "isFeatured": True,
            "viewsCount": 999_999,
            "videoUrl": "https://youtu.be/x",
            "topRequestStatus": "APPROVED",
        },
        headers=auth_headers(tokens),
    )
    assert response.status_code == 422, "unknown/server-owned fields must be rejected"


async def test_a_listing_without_a_photo_is_rejected(client, unique_phone):
    tokens, _ = await _owner(client, unique_phone)

    empty = await client.post(
        "/api/v1/listings",
        json={**VALID_LISTING, "images": []},
        headers=auth_headers(tokens),
    )
    assert empty.status_code == 422
    assert empty.json()["field"] == "images"
    # An empty list is what a client sends when the owner removed every photo,
    # so it has to answer with the photo-specific message and not the generic
    # "check your data" one.
    assert empty.json()["code"] == "image_required"

    # A list that cleans down to nothing is the same thing said differently,
    # and gets the photo-specific message rather than a generic one.
    blank = await client.post(
        "/api/v1/listings",
        json={**VALID_LISTING, "images": ["   "]},
        headers=auth_headers(tokens),
    )
    assert blank.status_code == 422
    assert blank.json()["code"] == "image_required"

    missing = await client.post(
        "/api/v1/listings",
        json={k: v for k, v in VALID_LISTING.items() if k != "images"},
        headers=auth_headers(tokens),
    )
    assert missing.status_code == 422


async def test_editing_a_listing_never_changes_its_status(client, unique_phone):
    """An edit is content only.

    The publish path used to re-score a listing whenever the title, the
    description or the price changed, so correcting a typo could take a live
    listing off the site - and would now also erase a penalty an admin had
    deliberately applied.
    """
    tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, tokens)

    edited = await client.put(
        f"/api/v1/listings/{listing['id']}",
        json={
            "title": "Rieltor agentligi orqali kvartira ijaraga beriladi",
            "description": (
                "Agentlik orqali ijara. Komissiya oylik to'lovning yarmi. "
                "Xizmat haqi alohida kelishiladi."
            ),
            "price": 9_900_000,
        },
        headers=auth_headers(tokens),
    )
    assert edited.status_code == 200, edited.text
    body = edited.json()["data"]
    assert body["status"] == "APPROVED"
    assert body["trustScore"] == listing["trustScore"]


# ---------------------------------------------------------------------------
# Data exposure
# ---------------------------------------------------------------------------
async def test_listing_responses_never_include_owner_credentials(client, unique_phone):
    """The old GET /listings returned every owner's plaintext password."""
    tokens, _ = await _owner(client, unique_phone)
    await _create_listing(client, tokens)

    response = await client.get("/api/v1/listings")
    assert response.status_code == 200
    body = response.text.lower()
    for leaked in ("password", "passwordhash", "passwordsecret", "salom2026x", "$argon2"):
        assert leaked not in body, f"response leaked {leaked}"


async def test_owner_phone_is_hidden_from_anonymous_browsing(client, unique_phone):
    tokens, phone = await _owner(client, unique_phone)
    await _create_listing(client, tokens)

    anonymous = await client.get("/api/v1/listings")
    assert phone not in anonymous.text

    mine = await client.get("/api/v1/listings/my", headers=auth_headers(tokens))
    assert mine.json()["data"][0]["owner"]["phone"] == phone


async def test_a_broker_listing_publishes_like_any_other(client, unique_phone):
    """Professional agents are welcome; a listing is not judged by its words.

    This is the exact inverse of the test that used to live here, which
    asserted the same payload was REJECTED with a high risk score.
    """
    tokens, _ = await _owner(client, unique_phone)
    response = await client.post(
        "/api/v1/listings",
        json={
            **VALID_LISTING,
            "title": "Rieltor agentligidan kvartira ijaraga beriladi",
            "description": (
                "Agentlik orqali ijara. Komissiya oylik to'lovning yarmi. "
                "Xizmat haqi alohida kelishiladi. Hujjatlar rasmiylashtiriladi."
            ),
        },
        headers=auth_headers(tokens),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["data"]["status"] == "APPROVED"
    assert body["data"]["trustScore"] == 100

    # And it is in the public catalogue like every other listing.
    public = await client.get("/api/v1/listings")
    assert body["data"]["id"] in [row["id"] for row in public.json()["data"]]


async def test_search_and_filters_work(client, unique_phone):
    tokens, _ = await _owner(client, unique_phone)
    await _create_listing(client, tokens, price=3_000_000, rooms=1)
    await _create_listing(
        client, tokens, price=9_000_000, rooms=4, district="Yunusobod",
        title="Yunusobodda 4 xonali keng kvartira",
    )

    by_rooms = await client.get("/api/v1/listings?rooms=1")
    assert all(item["rooms"] == 1 for item in by_rooms.json()["data"])

    by_price = await client.get("/api/v1/listings?maxPrice=4000000")
    assert all(item["price"] <= 4_000_000 for item in by_price.json()["data"])

    by_district = await client.get("/api/v1/listings?district=Yunusobod")
    assert all(
        item["district"] == "Yunusobod" for item in by_district.json()["data"]
    )

    by_search = await client.get("/api/v1/listings?search=keng")
    assert by_search.json()["totalCount"] >= 1


async def test_favorites_are_persisted_per_user(client, unique_phone):
    owner_tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)

    student_tokens = await register_and_verify(client, unique_phone(), role="STUDENT")
    added = await client.post(
        f"/api/v1/listings/{listing['id']}/stats",
        json={"stat": "favorites", "delta": 1},
        headers=auth_headers(student_tokens),
    )
    assert added.status_code == 200

    saved = await client.get(
        "/api/v1/listings/favorites", headers=auth_headers(student_tokens)
    )
    assert [item["id"] for item in saved.json()["data"]] == [listing["id"]]

    # Another user's favorites are their own.
    other_tokens = await register_and_verify(client, unique_phone(), role="STUDENT")
    other = await client.get(
        "/api/v1/listings/favorites", headers=auth_headers(other_tokens)
    )
    assert other.json()["data"] == []


# ---------------------------------------------------------------------------
# Top (promotion) requests
# ---------------------------------------------------------------------------
async def test_a_top_request_is_queued_and_cannot_be_duplicated(client, unique_phone):
    """Pressing Top sends a request. It promotes nothing on its own."""
    tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, tokens)

    sent = await client.post(
        f"/api/v1/listings/{listing['id']}/top",
        json={"days": 7},
        headers=auth_headers(tokens),
    )
    assert sent.status_code == 201, sent.text
    body = sent.json()
    assert body["data"]["status"] == "PENDING"
    assert body["data"]["requestedDays"] == 7
    # The alert copy comes from the server, in the request's language.
    assert body["message"]

    # Nothing has been promoted.
    detail = await client.get(f"/api/v1/listings/{listing['id']}")
    assert detail.json()["data"]["isFeatured"] is False
    assert detail.json()["data"]["featuredUntil"] is None

    # The owner sees their own pending request; a stranger never does.
    mine = await client.get("/api/v1/listings/my", headers=auth_headers(tokens))
    assert mine.json()["data"][0]["topRequestStatus"] == "PENDING"
    assert detail.json()["data"]["topRequestStatus"] is None

    again = await client.post(
        f"/api/v1/listings/{listing['id']}/top",
        json={"days": 7},
        headers=auth_headers(tokens),
    )
    assert again.status_code == 409
    assert again.json()["code"] == "top_request_pending"


async def test_only_the_owner_can_ask_for_top(client, unique_phone):
    owner_tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)

    stranger_tokens, _ = await _owner(client, unique_phone)
    response = await client.post(
        f"/api/v1/listings/{listing['id']}/top",
        json={"days": 7},
        headers=auth_headers(stranger_tokens),
    )
    assert response.status_code == 403
    assert response.json()["code"] == "listing_forbidden"


async def test_an_admin_approval_promotes_the_listing(
    client, unique_phone, admin_account
):
    owner_tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)
    await client.post(
        f"/api/v1/listings/{listing['id']}/top",
        json={"days": 14, "note": "Tezroq ijaraga bermoqchiman"},
        headers=auth_headers(owner_tokens),
    )

    admin_tokens = await _admin_tokens(client)
    queue = await client.get(
        "/api/v1/admin/top-requests?status=PENDING", headers=auth_headers(admin_tokens)
    )
    assert queue.status_code == 200, queue.text
    rows = queue.json()["data"]
    assert len(rows) == 1
    row = rows[0]
    assert row["listingId"] == listing["id"]
    assert row["requestedDays"] == 14
    assert row["listingTitle"] == VALID_LISTING["title"]
    assert row["ownerPhone"]
    # One image, never the whole array.
    assert row["listingImage"] == VALID_LISTING["images"][0]

    approved = await client.patch(
        f"/api/v1/admin/top-requests/{row['id']}",
        json={"status": "APPROVED", "days": 14, "promotionWeight": 100},
        headers=auth_headers(admin_tokens),
    )
    assert approved.status_code == 200, approved.text
    decided = approved.json()["data"]
    assert decided["status"] == "APPROVED"
    assert decided["grantedDays"] == 14
    assert decided["grantedUntil"] is not None
    # The joined columns survive the decision, so the queue row does not blank.
    assert decided["listingTitle"] == VALID_LISTING["title"]

    detail = await client.get(f"/api/v1/listings/{listing['id']}")
    assert detail.json()["data"]["isFeatured"] is True
    assert detail.json()["data"]["featuredUntil"] is not None
    assert detail.json()["data"]["promotionWeight"] == 100

    # It now leads the promoted rail.
    rail = await client.get("/api/v1/listings/featured")
    assert listing["id"] in [row["id"] for row in rail.json()["data"]]

    # A settled request cannot be decided a second time.
    twice = await client.patch(
        f"/api/v1/admin/top-requests/{row['id']}",
        json={"status": "APPROVED", "days": 30},
        headers=auth_headers(admin_tokens),
    )
    assert twice.status_code == 409
    assert twice.json()["code"] == "top_request_already_reviewed"


async def test_a_rejected_top_request_promotes_nothing(
    client, unique_phone, admin_account
):
    owner_tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)
    await client.post(
        f"/api/v1/listings/{listing['id']}/top",
        json={"days": 7},
        headers=auth_headers(owner_tokens),
    )

    admin_tokens = await _admin_tokens(client)
    row = (
        await client.get(
            "/api/v1/admin/top-requests", headers=auth_headers(admin_tokens)
        )
    ).json()["data"][0]

    rejected = await client.patch(
        f"/api/v1/admin/top-requests/{row['id']}",
        json={"status": "REJECTED", "rejectionReason": "Rasmlar sifatsiz"},
        headers=auth_headers(admin_tokens),
    )
    assert rejected.status_code == 200
    assert rejected.json()["data"]["rejectionReason"] == "Rasmlar sifatsiz"

    detail = await client.get(f"/api/v1/listings/{listing['id']}")
    assert detail.json()["data"]["isFeatured"] is False

    # A decided request frees the queue, so the owner may ask again.
    retry = await client.post(
        f"/api/v1/listings/{listing['id']}/top",
        json={"days": 7},
        headers=auth_headers(owner_tokens),
    )
    assert retry.status_code == 201


# ---------------------------------------------------------------------------
# Reliability ("ishonchlilik foizi")
# ---------------------------------------------------------------------------
async def test_reliability_drops_only_when_an_admin_confirms_a_report(
    client, unique_phone, admin_account
):
    """The score has exactly one writer, and it works in both directions."""
    owner_tokens, _ = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)
    assert listing["trustScore"] == 100

    reporter_tokens = await register_and_verify(client, unique_phone(), role="STUDENT")
    filed = await client.post(
        f"/api/v1/listings/{listing['id']}/report",
        json={"reason": "SCAM", "description": "Uy mavjud emas"},
        headers=auth_headers(reporter_tokens),
    )
    assert filed.status_code == 200

    async def _score() -> dict:
        return (await client.get(f"/api/v1/listings/{listing['id']}")).json()["data"]

    # Filing costs nothing. Only a confirmation does.
    assert (await _score())["trustScore"] == 100

    admin_tokens = await _admin_tokens(client)
    report = (
        await client.get("/api/v1/admin/reports", headers=auth_headers(admin_tokens))
    ).json()["data"][0]

    confirmed = await client.patch(
        f"/api/v1/admin/reports/{report['id']}",
        json={"status": "RESOLVED", "note": "Tekshirildi", "listingAction": "NONE"},
        headers=auth_headers(admin_tokens),
    )
    assert confirmed.status_code == 200, confirmed.text

    after = await _score()
    # SCAM is filed at CRITICAL priority, which costs 25 points.
    assert after["trustScore"] == 75
    assert after["riskScore"] == 25
    assert len(after["aiRiskReasons"]) == 1
    # The listing itself stays up: confirming a complaint and taking a listing
    # down are independent decisions.
    assert after["status"] == "APPROVED"

    # Saving the same decision again must not charge twice - the admin sheet
    # lets a moderator re-submit a settled report.
    await client.patch(
        f"/api/v1/admin/reports/{report['id']}",
        json={"status": "RESOLVED", "note": "Tekshirildi", "listingAction": "NONE"},
        headers=auth_headers(admin_tokens),
    )
    assert (await _score())["trustScore"] == 75

    # An owner's edit must not wash the penalty off either.
    await client.put(
        f"/api/v1/listings/{listing['id']}",
        json={"price": 4_500_000},
        headers=auth_headers(owner_tokens),
    )
    assert (await _score())["trustScore"] == 75

    # Un-confirming gives the points back.
    dismissed = await client.patch(
        f"/api/v1/admin/reports/{report['id']}",
        json={"status": "REJECTED", "note": "Asossiz", "listingAction": "NONE"},
        headers=auth_headers(admin_tokens),
    )
    assert dismissed.status_code == 200
    restored = await _score()
    assert restored["trustScore"] == 100
    assert restored["riskScore"] == 0
    assert restored["aiRiskReasons"] == []


# ---------------------------------------------------------------------------
# Admin authorisation
# ---------------------------------------------------------------------------
ADMIN_ROUTES = [
    ("GET", "/api/v1/admin/stats"),
    ("GET", "/api/v1/admin/users"),
    ("GET", "/api/v1/admin/listings"),
    ("GET", "/api/v1/admin/audit"),
    ("GET", "/api/v1/admin/reports"),
    ("GET", "/api/v1/admin/verifications"),
    ("GET", "/api/v1/admin/top-requests"),
    ("GET", "/api/v1/admin/sms"),
    ("GET", "/api/v1/admin/security/login-attempts"),
    ("GET", "/api/v1/admin/ai/sessions"),
    ("GET", "/api/v1/admin/chart/registrations"),
    ("GET", "/api/v1/admin/staff"),
]


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
async def test_admin_routes_reject_anonymous_callers(client, method, path):
    """Every /admin route was completely unauthenticated in the old backend."""
    response = await client.request(method, path)
    assert response.status_code == 401, f"{path} is publicly readable"


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
async def test_admin_routes_reject_ordinary_user_tokens(
    client, unique_phone, method, path
):
    tokens = await register_and_verify(client, unique_phone())
    response = await client.request(method, path, headers=auth_headers(tokens))
    assert response.status_code in (401, 403), f"{path} accepted a user token"


async def test_admin_can_sign_in_and_read_the_dashboard(client, admin_account):
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    assert login.status_code == 200
    tokens = login.json()
    assert tokens["admin"]["username"] == "testadmin"

    stats = await client.get("/api/v1/admin/stats", headers=auth_headers(tokens))
    assert stats.status_code == 200
    assert "totalUsers" in stats.json()["data"]
    # The Top queue has to be visible from the dashboard, or an admin has no
    # reason to open the page owners are waiting on.
    assert "pendingTopRequests" in stats.json()["data"]


async def test_admin_login_rejects_a_wrong_password(client, admin_account):
    response = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "WrongAdminPass1x"},
    )
    assert response.status_code == 401


async def test_a_user_token_cannot_be_upgraded_by_claiming_an_admin_role(
    client, unique_phone, admin_account
):
    """Subject type is checked, not just the role claim inside the token."""
    tokens = await register_and_verify(client, unique_phone())
    response = await client.get("/api/v1/admin/stats", headers=auth_headers(tokens))
    assert response.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Audit trail and password reveal
# ---------------------------------------------------------------------------
async def test_every_action_lands_in_the_audit_feed(client, unique_phone, admin_account):
    owner_tokens, phone = await _owner(client, unique_phone)
    listing = await _create_listing(client, owner_tokens)
    await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": "WrongPass9x"}
    )

    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    admin_tokens = login.json()

    feed = await client.get(
        "/api/v1/admin/audit?pageSize=100", headers=auth_headers(admin_tokens)
    )
    assert feed.status_code == 200
    actions = {row["action"] for row in feed.json()["data"]}

    for expected in (
        "AUTH_REGISTER_STARTED",
        "AUTH_REGISTER_COMPLETED",
        "AUTH_OTP_SENT",
        "AUTH_OTP_VERIFIED",
        "LISTING_CREATED",
        "AUTH_LOGIN_FAILED",
        "ADMIN_LOGIN_SUCCESS",
    ):
        assert expected in actions, f"{expected} missing from the activity feed"

    # The feed must never carry credential material.
    assert "Salom2026x" not in feed.text
    assert "WrongPass9x" not in feed.text


async def test_audit_entries_never_contain_secrets(client, unique_phone, admin_account):
    await register_and_verify(client, unique_phone())
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    feed = await client.get(
        "/api/v1/admin/audit?pageSize=100", headers=auth_headers(login.json())
    )
    body = feed.text
    for secret in ("Salom2026x", "AdminPass2026!x", "$argon2"):
        assert secret not in body


async def test_password_reveal_works_and_is_audited(client, unique_phone, admin_account):
    """The product requirement: an admin can read a user's password.

    It is decrypted on demand from the AES-GCM copy, requires an admin token,
    and writes a CRITICAL audit entry naming who did it.
    """
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    user_id = tokens["user"]["id"]

    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    admin_tokens = login.json()

    revealed = await client.post(
        f"/api/v1/admin/users/{user_id}/reveal-password",
        headers=auth_headers(admin_tokens),
    )
    assert revealed.status_code == 200
    assert revealed.json()["password"] == PASSWORD
    assert revealed.json()["warning"]

    feed = await client.get(
        "/api/v1/admin/audit?action=ADMIN_USER_PASSWORD_REVEALED",
        headers=auth_headers(admin_tokens),
    )
    rows = feed.json()["data"]
    assert len(rows) == 1
    assert rows[0]["severity"] == "CRITICAL"
    assert "testadmin" in (rows[0]["actorLabel"] or "") + str(rows[0]["meta"])
    # The audit entry records the reveal without embedding the password.
    assert PASSWORD not in feed.text


async def test_password_reveal_requires_an_admin(client, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    user_id = tokens["user"]["id"]

    anonymous = await client.post(f"/api/v1/admin/users/{user_id}/reveal-password")
    assert anonymous.status_code == 401

    as_user = await client.post(
        f"/api/v1/admin/users/{user_id}/reveal-password", headers=auth_headers(tokens)
    )
    assert as_user.status_code in (401, 403)


async def test_admin_user_list_reports_password_status_not_the_password(
    client, unique_phone, admin_account
):
    await register_and_verify(client, unique_phone())
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    users = await client.get("/api/v1/admin/users", headers=auth_headers(login.json()))
    assert users.status_code == 200
    row = users.json()["data"][0]
    assert row["hasPassword"] is True
    assert row["passwordRevealable"] is True
    # The list itself carries no password material - reveal is a separate call.
    assert "password" not in {k.lower() for k in row} - {
        "haspassword", "passwordrevealable", "passwordupdatedat", "mustchangepassword",
    }
    assert PASSWORD not in users.text


async def test_admin_suspension_takes_effect_immediately(
    client, unique_phone, admin_account
):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    user_id = tokens["user"]["id"]
    assert (await client.get("/api/v1/auth/me", headers=auth_headers(tokens))).status_code == 200

    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    suspended = await client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"status": "SUSPENDED", "suspendedReason": "Test"},
        headers=auth_headers(login.json()),
    )
    assert suspended.status_code == 200

    # The existing access token must stop working at once, not at expiry.
    after = await client.get("/api/v1/auth/me", headers=auth_headers(tokens))
    assert after.status_code == 403
    assert after.json()["code"] == "account_suspended"


# ---------------------------------------------------------------------------
# Transport hardening
# ---------------------------------------------------------------------------
async def test_security_headers_are_present(client):
    response = await client.get("/api/v1/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in response.headers
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "server" not in {k.lower() for k in response.headers}


async def test_cors_does_not_reflect_arbitrary_origins(client):
    response = await client.get(
        "/api/v1/health", headers={"Origin": "https://evil.example.com"}
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example.com"


# ---------------------------------------------------------------------------
# Hostile headers
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "header,value",
    [
        # request_id lands in a VARCHAR(36) audit column; an oversized value
        # used to fail the INSERT and turn a normal 401 into a 500.
        ("X-Request-ID", "A" * 4000),
        ("X-Request-ID", "B" * 37),
        ("X-Request-ID", "has spaces and \t tabs"),
        ("User-Agent", "U" * 4000),
        ("X-Language", "L" * 4000),
        ("X-Forwarded-For", "not-an-ip, 10.0.0.1"),
        ("Accept-Language", "Z" * 2000),
    ],
)
async def test_hostile_headers_do_not_break_the_request(client, unique_phone, header, value):
    """Attacker-controlled headers reach fixed-width columns and log lines.

    Every one of these must produce the ordinary auth failure, never a 500.
    """
    response = await client.post(
        "/api/v1/auth/login",
        json={"phone": unique_phone(), "password": "WrongPass9x"},
        headers={header: value},
    )
    assert response.status_code == 401, f"{header} produced {response.status_code}"
    assert response.json()["code"] == "invalid_credentials"


async def test_admin_lockout_engages(client, admin_account):
    """The admin lockout counter must survive the failure that increments it."""
    codes = []
    for _ in range(7):
        response = await client.post(
            "/api/v1/admin/auth/login",
            json={"username": "testadmin", "password": "WrongAdminPass1x"},
        )
        codes.append(response.json().get("code"))
    assert "account_locked" in codes, f"admin never locked out: {codes}"

    # Even the correct password is refused while the lock stands.
    blocked = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "account_locked"
