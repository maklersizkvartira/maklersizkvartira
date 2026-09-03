"""Prices quoted in dollars, ranked against prices quoted in so'm.

`listings.price` holds two different units and `listings.currency` says which
— so anything that compares prices has to convert first. Without that, 500 in
the column is read as 500 so'm no matter what the owner meant, which is four
orders of magnitude out and puts every dollar listing outside the price
filters and at the top of "cheapest first".

These tests exist because that failure is invisible in a catalogue where every
listing happens to be in so'm, which is exactly what the catalogue looked like
on the day the currency picker shipped.
"""

from __future__ import annotations

import pytest

from app.core.config import settings
from tests.conftest import auth_headers, register_and_verify

VALID_LISTING = {
    "title": "Yaxshi kvartira Chilonzorda, metro yonida",
    "description": "Uzoq muddatga ijaraga beriladi. Hamma sharoit bor, metro yaqin.",
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


async def test_a_dollar_price_is_stored_as_dollars(client, unique_phone):
    """What the owner typed is what comes back — not a converted figure.

    Converting on the way in would freeze one day's rate into the listing and
    quietly restate the owner's terms as a number they never agreed to.
    """
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens, price=500, currency="USD")
    assert listing["price"] == 500
    assert listing["currency"] == "USD"


async def test_a_dollar_listing_falls_inside_a_som_price_filter(client, unique_phone):
    """The bug this whole change exists for.

    A $500 flat is roughly six million so'm and belongs in a 3–8 million
    search. Compared raw it is the number 500, which is below every so'm
    minimum a searcher can set, so it silently disappeared from the catalogue
    the moment an agency started pricing in dollars.
    """
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens, price=500, currency="USD")

    response = await client.get(
        "/api/v1/listings", params={"minPrice": 3_000_000, "maxPrice": 8_000_000}
    )
    assert response.status_code == 200, response.text
    ids = [row["id"] for row in response.json()["data"]]
    assert listing["id"] in ids


async def test_a_dollar_listing_is_excluded_when_it_really_is_out_of_range(
    client, unique_phone
):
    """The other half: converting must not simply let everything through."""
    tokens = await _owner(client, unique_phone)
    listing = await _create(client, tokens, price=500, currency="USD")

    response = await client.get("/api/v1/listings", params={"maxPrice": 1_000_000})
    ids = [row["id"] for row in response.json()["data"]]
    assert listing["id"] not in ids


@pytest.mark.parametrize("sort_by, cheapest_first", [("PRICE_LOW", True), ("PRICE_HIGH", False)])
async def test_sorting_ranks_across_currencies(
    client, unique_phone, sort_by: str, cheapest_first: bool
):
    """A $100 flat is cheaper than a 5 000 000 so'm one; a $500 flat is not.

    Sorted on the raw column both dollar listings would lead "cheapest first",
    because 100 and 500 are both smaller than five million — the sort would
    look like it worked while ranking the most expensive listing first.
    """
    tokens = await _owner(client, unique_phone)
    cheap = await _create(client, tokens, price=100, currency="USD")
    middle = await _create(client, tokens, price=5_000_000, currency="UZS")
    dear = await _create(client, tokens, price=900, currency="USD")

    response = await client.get("/api/v1/listings", params={"sortBy": sort_by})
    order = [row["id"] for row in response.json()["data"]]
    ranked = [cheap["id"], middle["id"], dear["id"]]
    expected = ranked if cheapest_first else list(reversed(ranked))

    # Only the three this test made are compared: the fixture truncates
    # between tests, but asserting on positions rather than the whole list
    # keeps the test honest if an unrelated listing ever shares the run.
    assert [i for i in order if i in ranked] == expected


async def test_the_fallback_rate_is_a_plausible_one():
    """The static rate is what a failed lookup falls back to.

    It is not the rate anyone should be using, but it is the one every price
    on the site is drawn against when the Central Bank cannot be reached — so
    a placeholder that had drifted into nonsense would be worse than no
    conversion at all.
    """
    assert 5_000 < settings.USD_TO_UZS_RATE < 100_000
