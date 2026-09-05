"""Renting and selling in the same catalogue, without either drowning the other.

Every listing on this platform used to be a rental, and the price column meant
one month. Selling puts a second meaning in that column — the whole property,
paid once — and the two are three orders of magnitude apart. Left in one list
they do not merely look untidy: a price filter is a range of monthly rents, so
a sale listing is either invisible under every filter a searcher would set, or
the only thing they can see when they raise the ceiling far enough to find it.

So the tests that matter here are not "can a sale listing be created". They are
"does a sale listing stay out of the rentals", and "does a listing switched to
sale stop carrying the deposit it had".
"""

from __future__ import annotations

from tests.conftest import auth_headers, register_and_verify

VALID_LISTING = {
    "title": "Yaxshi kvartira Chilonzorda, metro yonida",
    "description": "Hamma sharoit bor, metro yaqin. Uzoq muddatga.",
    "price": 5_000_000,
    "rooms": 2,
    "area": 62,
    "district": "Chilonzor",
    "region": "Toshkent shahri",
    "images": ["https://example.uz/photo1.jpg"],
}


async def _owner(client, unique_phone):
    return await register_and_verify(client, unique_phone(), role="OWNER")


async def _create(client, tokens, **overrides):
    response = await client.post(
        "/api/v1/listings",
        json={**VALID_LISTING, **overrides},
        headers=auth_headers(tokens),
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def _ids(client, **params):
    response = await client.get("/api/v1/listings", params=params)
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["data"]]


async def test_a_listing_that_says_nothing_is_a_rental(client, unique_phone):
    """The default every existing row, client and bookmark relies on.

    Nothing that predates selling sends a deal type, and all of it meant rent.
    """
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens)
    assert listing["dealType"] == "RENT"


async def test_a_sale_listing_is_stored_as_one(client, unique_phone):
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens, dealType="SALE", price=600_000_000)
    assert listing["dealType"] == "SALE"
    assert listing["price"] == 600_000_000


async def test_a_sale_listing_stays_out_of_the_rentals(client, unique_phone):
    """The reason the column exists.

    A search with no deal type is a search for somewhere to live this month.
    """
    tokens = await _owner(client, unique_phone)
    rental = await _create(client, tokens)
    sale = await _create(client, tokens, dealType="SALE", price=600_000_000)

    rentals = await _ids(client)
    assert rental["id"] in rentals
    assert sale["id"] not in rentals


async def test_a_rental_stays_out_of_the_sales(client, unique_phone):
    tokens = await _owner(client, unique_phone)
    rental = await _create(client, tokens)
    sale = await _create(client, tokens, dealType="SALE", price=600_000_000)

    sales = await _ids(client, dealType="SALE")
    assert sale["id"] in sales
    assert rental["id"] not in sales


async def test_asking_for_all_returns_both(client, unique_phone):
    tokens = await _owner(client, unique_phone)
    rental = await _create(client, tokens)
    sale = await _create(client, tokens, dealType="SALE", price=600_000_000)

    both = await _ids(client, dealType="ALL")
    assert rental["id"] in both
    assert sale["id"] in both


async def test_a_sale_price_does_not_break_the_rent_price_filter(client, unique_phone):
    """A ceiling high enough to include a sale must still exclude it.

    Without the deal filter, "up to 700 million" — an unremarkable thing to ask
    when the slider runs to the top — returns a flat for sale as though it were
    a monthly rent.
    """
    tokens = await _owner(client, unique_phone)
    sale = await _create(client, tokens, dealType="SALE", price=600_000_000)

    assert sale["id"] not in await _ids(client, maxPrice=700_000_000)


async def test_selling_clears_the_deposit_and_the_utilities_question(
    client, unique_phone
):
    """None of the three has any meaning once the money changes hands once."""
    tokens = await _owner(client, unique_phone)
    listing = await _create(
        client,
        tokens,
        dealType="SALE",
        price=600_000_000,
        depositPrice=3_000_000,
        utilitiesIncluded=True,
    )
    assert listing["depositPrice"] is None
    assert listing["utilitiesIncluded"] is False


async def test_a_sale_cannot_be_a_roommate_offer(client, unique_phone):
    tokens = await _owner(client, unique_phone)
    listing = await _create(
        client,
        tokens,
        dealType="SALE",
        price=600_000_000,
        isRoommate=True,
        roommateGender="GIRLS",
    )
    assert listing["isRoommate"] is False


async def test_switching_a_rental_to_a_sale_drops_what_it_was_carrying(
    client, unique_phone
):
    """The case a form cannot cover.

    The deposit was legitimately set while the listing was a rental. Nothing on
    the sale form mentions it, so nothing on the sale form can clear it — and
    the detail page would render a purchase price with a deposit under it.
    """
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens, depositPrice=3_000_000)
    assert listing["depositPrice"] == 3_000_000

    response = await client.patch(
        f"/api/v1/listings/{listing['id']}",
        json={"dealType": "SALE", "price": 600_000_000},
        headers=auth_headers(tokens),
    )
    assert response.status_code == 200, response.text
    updated = response.json()["data"]
    assert updated["dealType"] == "SALE"
    assert updated["depositPrice"] is None


async def test_editing_a_sale_listing_cannot_smuggle_a_deposit_back(
    client, unique_phone
):
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens, dealType="SALE", price=600_000_000)

    response = await client.patch(
        f"/api/v1/listings/{listing['id']}",
        json={"depositPrice": 3_000_000},
        headers=auth_headers(tokens),
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["depositPrice"] is None
