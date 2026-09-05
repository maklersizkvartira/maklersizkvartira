"""What a conversation tells each side about the other.

The catalogue is careful with a phone number. `_serialise` in the listings
router strips `owner.phone` for anybody who is not the owner or staff, with a
docstring saying why: a stranger browsing does not need it, and revealing it is
the moment a contact is counted.

Starting a conversation walked straight around that. `ConversationOut` embedded
`UserOut` for both parties, and `UserOut` carries `phone` and `email` — so the
conversation list handed the enquirer the owner's number, and the owner the
enquirer's, before either had said anything, and with none of it metered.

These check the shape of the reply rather than any particular value, because
the defect was never a bad value: it was a schema that answered a question
nobody asked.
"""

from __future__ import annotations

from tests.conftest import auth_headers, register_and_verify

LISTING = {
    "title": "Yaxshi kvartira Chilonzorda, metro yonida",
    "description": "Hamma sharoit bor, metro yaqin. Uzoq muddatga.",
    "price": 5_000_000,
    "rooms": 2,
    "area": 62,
    "district": "Chilonzor",
    "region": "Toshkent shahri",
    "images": ["https://example.uz/photo1.jpg"],
}


async def _conversation(client, unique_phone):
    owner = await register_and_verify(client, unique_phone(), role="OWNER")
    created = await client.post(
        "/api/v1/listings", json=LISTING, headers=auth_headers(owner)
    )
    assert created.status_code == 201, created.text
    listing_id = created.json()["data"]["id"]

    seeker = await register_and_verify(client, unique_phone(), role="STUDENT")
    started = await client.post(
        f"/api/v1/chat/conversations/{listing_id}", headers=auth_headers(seeker)
    )
    assert started.status_code in (200, 201), started.text
    return owner, seeker


async def test_the_conversation_list_carries_no_phone_or_email(client, unique_phone):
    owner, seeker = await _conversation(client, unique_phone)

    for who, tokens in (("seeker", seeker), ("owner", owner)):
        response = await client.get(
            "/api/v1/chat/conversations", headers=auth_headers(tokens)
        )
        assert response.status_code == 200, response.text
        body = response.text
        assert '"phone"' not in body, f"{who} was sent a phone number"
        assert '"email"' not in body, f"{who} was sent an email address"


async def test_a_participant_is_still_named_and_pictured(client, unique_phone):
    """Narrowing the payload must not empty it — the thread needs a name."""
    _, seeker = await _conversation(client, unique_phone)
    response = await client.get(
        "/api/v1/chat/conversations", headers=auth_headers(seeker)
    )
    # This endpoint answers with a bare array, not the {status, data} envelope
    # the listings routes use.
    items = response.json()
    assert items, "no conversation came back"
    party = items[0].get("owner") or items[0].get("user")
    assert party and party.get("name"), f"the other party has no name: {party}"


async def test_the_listing_api_still_gates_the_phone(client, unique_phone):
    """The gate this was bypassing, asserted so the two cannot drift apart."""
    owner = await register_and_verify(client, unique_phone(), role="OWNER")
    created = await client.post(
        "/api/v1/listings", json=LISTING, headers=auth_headers(owner)
    )
    listing_id = created.json()["data"]["id"]

    stranger = await register_and_verify(client, unique_phone(), role="STUDENT")
    seen = await client.get(
        f"/api/v1/listings/{listing_id}", headers=auth_headers(stranger)
    )
    assert seen.status_code == 200, seen.text
    assert seen.json()["data"]["owner"]["phone"] is None
