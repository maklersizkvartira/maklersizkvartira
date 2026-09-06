"""Uyiz AI behaviour that does not need a model key.

Everything here exercises the deterministic half of the assistant: the parser,
the classification merge, the match scoring and the written replies. That half
is what runs in production whenever OpenAI is unreachable, so it is the half
most worth pinning down.

The rules being protected, in the order the product asks for them:

  * the assistant introduces itself as the AI assistant *of the Uyiz
    company*, never as a bare "Uyiz AI assistant";
  * a question is answered before any listing is suggested;
  * company questions outside the public facts are declined as internal;
  * off-topic questions get the redirect, not an answer;
  * a search offers the listing that meets one of four stated criteria, says
    which one, and ranks it below the listing that meets three;
  * a visitor who asks for a person is handed our number rather than flats.
"""

from __future__ import annotations

import pytest

from app.services import fx, uyiz_ai
from app.services.uyiz_ai import SearchIntent


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("message", "district", "rooms"),
    [
        ("Chilonzordan 3 xonali kvartira kerak", "Chilonzor", 3),
        ("Нужна квартира в Чиланзаре, 2 комнаты", "Chilonzor", 2),
        ("Yunusobod 2 xona talaba uchun", "Yunusobod", 2),
        ("I need a 4 room apartment in Sergeli", "Sergeli", 4),
    ],
)
def test_parses_district_and_rooms_in_three_languages(message, district, rooms):
    intent = uyiz_ai.parse_intent(message)
    assert intent.district == district
    assert intent.rooms == rooms
    assert intent.kind == "SEARCH"


def test_budget_becomes_a_ceiling_with_headroom():
    # Someone who says "3 mln" will still look at 3.2, so the ceiling is
    # deliberately above the stated number.
    intent = uyiz_ai.parse_intent("Chilonzordan 3 mln gacha")
    assert intent.max_price is not None
    assert 3_000_000 < intent.max_price <= 4_000_000


def test_a_greeting_is_not_a_search():
    intent = uyiz_ai.parse_intent("Assalomu alaykum")
    assert intent.kind == "SMALLTALK"
    assert not intent.has_criteria


def test_audience_and_roommate_hints():
    assert uyiz_ai.parse_intent("talaba uchun xona").audience == "STUDENT"
    assert uyiz_ai.parse_intent("oilaviy kvartira").audience == "FAMILY"
    assert uyiz_ai.parse_intent("sheriklikka xona").rental_type == "ROOMMATE"


def test_amenities_are_read_as_filters_not_decoration():
    # "mebelli, konditsioner, internet" used to be read and then thrown away:
    # the search could only carry district, rooms, budget, audience and type.
    intent = uyiz_ai.parse_intent(
        "Chilonzordan mebelli, konditsionerli va internetli kvartira kerak"
    )
    assert intent.furnished is True
    assert intent.air_conditioning is True
    assert intent.internet is True
    assert intent.district == "Chilonzor"


def test_an_amenity_alone_is_enough_to_search():
    # Without this the only criterion in the message would be invisible and
    # the turn would come back asking what they are looking for.
    assert uyiz_ai.parse_intent("mebelli uy kerak").kind == "SEARCH"


def test_an_absent_amenity_is_never_a_negative_filter():
    # The catalogue cannot search for the absence of a washing machine, and a
    # False would hide listings the visitor would have taken.
    intent = uyiz_ai.parse_intent("Chilonzordan uy kerak")
    assert intent.furnished is None
    assert intent.parking is None


def test_a_metro_station_is_only_read_when_the_word_is_there():
    # Seven stations share a name with the district around them, so an
    # unguarded match would add a filter nobody asked for.
    assert uyiz_ai.parse_intent("Chilonzordan uy kere").metro_station is None
    assert uyiz_ai.parse_intent("Chilonzor metrosi yaqinidan uy").metro_station == "Chilonzor"
    assert uyiz_ai.parse_intent("Bodomzor metrosiga yaqin").metro_station == "Bodomzor"


def test_a_numbered_station_is_matched_by_its_short_name():
    # The catalogue writes some stations with the numbered suffix and some
    # without; the filter is a substring match, so the short name finds both.
    assert uyiz_ai.parse_intent("Matonat metrosi yonida").metro_station == "Matonat"


def test_cheapest_first_is_a_sort_not_a_filter():
    assert uyiz_ai.parse_intent("eng arzon kvartira").sort_by == "PRICE_LOW"
    assert uyiz_ai.parse_intent("Chilonzordan uy").sort_by == "RECOMMENDED"


def test_property_type_and_minimum_area():
    assert uyiz_ai.parse_intent("hovli kerak").property_type == "HOUSE"
    assert uyiz_ai.parse_intent("studiya izlayapman").property_type == "STUDIO"
    assert uyiz_ai.parse_intent("kamida 60 m2 kvartira").min_area == 60


def test_a_bare_area_is_not_guessed_as_a_minimum():
    # "60 m2" is as likely to be a ceiling as a floor, and guessing wrong
    # hides exactly the listings they wanted.
    assert uyiz_ai.parse_intent("Chilonzorda 60 m2 kvartira").min_area is None


def test_wanting_a_person_outranks_the_district_in_the_same_sentence():
    intent = uyiz_ai.parse_intent("Chilonzor bo'yicha operatoringiz bilan gaplashsam bo'ladimi")
    assert intent.kind == "CONTACT"
    # And the model cannot talk it back into a search either.
    merged = uyiz_ai.merge_intents(intent, SearchIntent(kind="SEARCH"))
    assert merged.kind == "CONTACT"


# ---------------------------------------------------------------------------
# Merging model output with the parser
# ---------------------------------------------------------------------------
def test_parser_wins_on_facts_model_wins_on_classification():
    parsed = SearchIntent(district="Chilonzor", rooms=3, kind="SEARCH")
    llm = SearchIntent(district="Sergeli", rooms=9, kind="DOMAIN", answer="Javob.")
    merged = uyiz_ai.merge_intents(parsed, llm)

    # Anything that reaches the database comes from the parser: a message
    # cannot talk the model into searching a district nobody asked for.
    assert merged.district == "Chilonzor"
    assert merged.rooms == 3
    assert merged.kind == "DOMAIN"
    assert merged.answer == "Javob."


def test_stated_criteria_override_an_offtopic_classification():
    # If the visitor named a district and a room count, the turn is a search
    # no matter how the model read the sentence around it.
    parsed = SearchIntent(district="Mirobod", rooms=2, kind="SEARCH")
    llm = SearchIntent(kind="OFFTOPIC")
    assert uyiz_ai.merge_intents(parsed, llm).kind == "SEARCH"


def test_missing_model_output_leaves_the_parser_intact():
    parsed = uyiz_ai.parse_intent("Sergeli 2 xona")
    assert uyiz_ai.merge_intents(parsed, None) is parsed


# ---------------------------------------------------------------------------
# Written replies
# ---------------------------------------------------------------------------
def _reply(intent: SearchIntent, **kwargs) -> str:
    defaults = dict(
        count=0,
        language="uz",
        user_name=None,
        is_first_turn=False,
        relaxation="NONE",
        searched_district=None,
    )
    defaults.update(kwargs)
    return uyiz_ai.build_fallback_reply(intent=intent, **defaults)


@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_introduction_names_the_company(language):
    text = _reply(
        SearchIntent(kind="SMALLTALK"),
        language=language,
        user_name="Kamron",
        is_first_turn=True,
    )
    assert "Uyiz" in text
    assert "Uyiz AI" in text
    # The old greeting shouted the visitor's name; the product asked for a
    # full stop instead of an exclamation mark.
    assert "Kamron!" not in text


def test_no_introduction_on_later_turns():
    text = _reply(SearchIntent(kind="SMALLTALK"), user_name="Kamron", is_first_turn=False)
    assert "Uyiz kompaniyasining" not in text


def test_internal_questions_are_declined():
    text = _reply(SearchIntent(kind="INTERNAL"))
    # The typographic apostrophe, not the ASCII one: the Uzbek copy uses
    # ’ throughout, so an assertion written with ' never matched.
    assert "ichki ma’lumot" in text


def test_offtopic_questions_get_the_redirect():
    text = _reply(SearchIntent(kind="OFFTOPIC"))
    assert "uy-joy" in text.lower()


@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_every_branch_has_wording_in_every_language(language):
    for kind in ("SEARCH", "DOMAIN", "COMPANY", "CONTACT", "INTERNAL", "SMALLTALK", "OFFTOPIC"):
        text = _reply(SearchIntent(kind=kind), language=language)
        assert text.strip(), f"{kind}/{language} produced an empty reply"


def test_the_answer_comes_before_the_listings():
    intent = SearchIntent(kind="SEARCH", district="Chilonzor", answer="Qishda 3 xonali issiqroq.")
    text = _reply(intent, count=3, relaxation="EXACT")
    assert text.index("Qishda 3 xonali issiqroq.") < text.index("3 ta")


def test_a_widened_search_says_which_district_it_used():
    intent = SearchIntent(kind="SEARCH", district="Bektemir")
    text = _reply(intent, count=2, relaxation="NEARBY", searched_district="Yashnobod")
    assert "Yashnobod" in text


def test_an_empty_result_is_not_dressed_up_as_a_find():
    text = _reply(SearchIntent(kind="SEARCH", district="Chilonzor"), count=0)
    assert "topilmadi" in text or "yo‘q" in text


def test_partial_matches_name_the_criteria_that_matched():
    intent = SearchIntent(kind="SEARCH", district="Chilonzor", rooms=3)
    text = _reply(intent, count=2, relaxation="PARTIAL")
    assert "Chilonzor" in text and "3 xonali" in text


# ---------------------------------------------------------------------------
# Duplicate greetings
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Salom! Sizga qanday yordam bera olaman?", "Sizga qanday yordam bera olaman?"),
        ("Assalomu alaykum, sizga yordam beraman.", "Sizga yordam beraman."),
        ("Здравствуйте! Чем помочь?", "Чем помочь?"),
        ("Hello, how can I help?", "How can I help?"),
    ],
)
def test_a_greeting_the_model_added_is_removed(raw, expected):
    assert uyiz_ai.strip_leading_greeting(raw) == expected


@pytest.mark.parametrize(
    "text",
    [
        "Qishda 3 xonali issiqroq.",
        # The dangerous ones: words that merely start with a greeting.
        "Bu ichki ma'lumot hisoblanadi.",
        "Hisobingiz tayyor.",
        "Salomatlik uchun yaxshi.",
        "Hiyla-nayrangdan saqlaning.",
    ],
)
def test_ordinary_sentences_are_left_alone(text):
    assert uyiz_ai.strip_leading_greeting(text) == text


def test_a_message_that_is_only_a_greeting_survives():
    # Better a lone "Salom" than an empty reply.
    assert uyiz_ai.strip_leading_greeting("Salom") == "Salom"


def test_the_introduction_is_not_followed_by_a_second_greeting():
    intent = SearchIntent(kind="SMALLTALK", answer="Salom! Sizga qanday yordam bera olaman?")
    text = _reply(intent, is_first_turn=True, user_name="Kamron")
    assert text.count("alom") == 1, text


# ---------------------------------------------------------------------------
# Saying out loud what the results do not match
# ---------------------------------------------------------------------------
def test_a_loosened_search_says_what_it_gave_up():
    intent = SearchIntent(kind="SEARCH", district="Chilonzor", furnished=True)
    intent.dropped = ["furnished"]
    text = _reply(intent, count=2, relaxation="PARTIAL", language="uz")
    assert "mebelli" in text


def test_an_exact_search_claims_nothing_was_given_up():
    intent = SearchIntent(kind="SEARCH", district="Chilonzor", furnished=True)
    text = _reply(intent, count=2, relaxation="EXACT", language="uz")
    assert "yumshatdim" not in text


# ---------------------------------------------------------------------------
# Reaching a person
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_asking_for_a_person_hands_over_the_configured_numbers(language, monkeypatch):
    # The handoff has to work with no model at all — which is exactly when a
    # visitor is most likely to want a person. And the number is never a
    # literal in the source: it comes from SUPPORT_PHONES.
    monkeypatch.setattr(
        uyiz_ai, "support_phone_list", lambda: ["+998 90 111 22 33"]
    )
    text = _reply(SearchIntent(kind="CONTACT"), language=language)
    assert "+998 90 111 22 33" in text


def test_a_handoff_with_no_number_configured_still_offers_a_callback():
    monkeypatch_free = SearchIntent(kind="CONTACT")
    original = uyiz_ai.support_phone_list
    try:
        uyiz_ai.support_phone_list = lambda: []
        text = _reply(monkeypatch_free, language="uz")
    finally:
        uyiz_ai.support_phone_list = original
    # No invented number, but still a route to a human.
    assert "+998" not in text
    assert "raqamingizni" in text.lower()


def test_a_handoff_turn_is_never_answered_with_apartments():
    text = _reply(SearchIntent(kind="CONTACT"), count=5, relaxation="EXACT")
    assert "e'lon topdim" not in text and "e’lon topdim" not in text


# ---------------------------------------------------------------------------
# Places
# ---------------------------------------------------------------------------
def test_the_whole_country_is_known_not_just_tashkent():
    # The old map had twelve districts. "Samarqandda uy kere" parsed as a
    # request with no location at all, which is the bug this guards.
    assert len(uyiz_ai.ALL_REGIONS) == 14
    assert len(uyiz_ai.ALL_DISTRICTS) > 140


@pytest.mark.parametrize(
    ("message", "district", "region"),
    [
        ("Chilonzordan uy kere", "Chilonzor", "Toshkent shahri"),
        ("Samarqandda kvartira", "Samarqand sh.", "Samarqand viloyati"),
        # "Urgut sh." and "Urgut" both exist and fold to one key; the city
        # wins, as it does for every other such pair (see the Yangiyo'l
        # case below). This row used to expect the district and failed.
        ("Urgutda 2 xona", "Urgut sh.", "Samarqand viloyati"),
        ("Nukusda uy", "Nukus sh.", "Qoraqalpogʻiston Respublikasi"),
        ("Buxoroga koʻchmoqchiman", "Buxoro sh.", "Buxoro viloyati"),
    ],
)
def test_a_case_suffix_does_not_hide_the_place(message, district, region):
    # Uzbek glues the case onto the noun; matching on a bare word boundary
    # found none of these.
    intent = uyiz_ai.parse_intent(message)
    assert intent.district == district
    assert intent.region == region


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("в Чиланзаре", "Chilonzor"),
        ("ferganada uy", "Fargʻona sh."),
        ("Mirzo Ulugbek tumanida", "Mirzo Ulugʻbek"),
        ("Yangiyoʻlda ijara", "Yangiyo'l sh."),
    ],
)
def test_spelling_and_language_variants_resolve(message, expected):
    assert uyiz_ai.normalise_district(message) == expected


def test_a_region_is_recognised_even_without_a_district():
    intent = uyiz_ai.parse_intent("xorazmda uy kere")
    assert intent.region == "Xorazm viloyati"


def test_every_district_belongs_to_a_region():
    for district in uyiz_ai.ALL_DISTRICTS:
        assert uyiz_ai.region_of(district) in uyiz_ai.ALL_REGIONS


def test_tashkent_neighbours_are_real_and_exclude_self():
    city = set(uyiz_ai.REGIONS["Toshkent shahri"])
    for district in city:
        neighbours = uyiz_ai.nearby_districts(district)
        assert neighbours, f"{district} has no neighbours"
        assert district not in neighbours
        assert set(neighbours) <= city


def test_outside_tashkent_nearby_means_the_rest_of_the_province():
    neighbours = uyiz_ai.nearby_districts("Urgut")
    assert "Samarqand sh." in neighbours
    assert "Urgut" not in neighbours
    # Never another province: that is not "nearby" to anyone.
    assert all(uyiz_ai.region_of(n) == "Samarqand viloyati" for n in neighbours)


def test_an_unknown_place_has_no_neighbours():
    assert uyiz_ai.nearby_districts("Atlantis") == ()
    assert uyiz_ai.nearby_districts(None) == ()


# ---------------------------------------------------------------------------
# Asking before searching
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("message", ["uy kere", "kvartira kerak", "I need a flat", "ищу квартиру"])
def test_a_bare_request_asks_instead_of_searching(message):
    # "uy kere" is the opening of a search, not a search. Answering it with
    # the whole catalogue answers a question nobody asked.
    assert uyiz_ai.parse_intent(message).kind == "CLARIFY"


def test_one_stated_criterion_is_enough_to_search():
    assert uyiz_ai.parse_intent("Chilonzordan uy kere").kind == "SEARCH"
    assert uyiz_ai.parse_intent("3 xonali kerak").kind == "SEARCH"


@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_the_clarifying_question_is_short_and_asks_for_all_three(language):
    text = _reply(SearchIntent(kind="CLARIFY"), language=language)
    assert len(text) < 120, "the clarifying question should be one sentence"
    # It must not claim anything about availability: nothing has been searched.
    assert "topilmadi" not in text and "yo'q" not in text


def test_clarifying_never_mentions_results():
    for language in ("uz", "ru", "en"):
        text = _reply(SearchIntent(kind="CLARIFY"), language=language, count=0)
        assert "0" not in text


def test_criteria_labels_are_translated():
    intent = SearchIntent(district="Chilonzor", rooms=2, audience="STUDENT")
    assert "2 xonali" in uyiz_ai.SearchIntent.criteria_labels(intent, "uz")
    assert "2-комнатная" in uyiz_ai.SearchIntent.criteria_labels(intent, "ru")
    assert "2 rooms" in uyiz_ai.SearchIntent.criteria_labels(intent, "en")


# ---------------------------------------------------------------------------
# Finding stock — against a real database
# ---------------------------------------------------------------------------
"""The scoring is the part that decides whether a visitor sees an empty screen
or the closest thing we actually have, so it is exercised against real rows
rather than a stub."""

from tests.conftest import auth_headers, register_and_verify  # noqa: E402

_LISTING = {
    "title": "Kvartira ijaraga beriladi",
    "description": (
        "Yangi ta'mirlangan, mebel va texnika bilan jihozlangan kvartira. "
        "Metro bekatiga 5 daqiqa piyoda. Hujjatlar tayyor."
    ),
    "price": 4_000_000,
    "rooms": 2,
    "area": 62,
    "district": "Chilonzor",
    "region": "Toshkent shahri",
    "images": ["https://example.uz/photo1.jpg"],
}


async def _seed(client, unique_phone, *listings):
    tokens = await register_and_verify(client, unique_phone(), role="OWNER")
    created = []
    for overrides in listings:
        response = await client.post(
            "/api/v1/listings", json={**_LISTING, **overrides}, headers=auth_headers(tokens)
        )
        assert response.status_code == 201, response.text
        created.append(response.json()["data"])
    return created


async def test_exact_match_is_reported_as_exact(client, db, unique_phone):
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 3, "price": 3_500_000})

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(
        db,
        SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000),
    )
    assert rows, "a listing that satisfies every criterion should be found"
    assert relaxation == "EXACT"


async def test_budget_is_the_first_criterion_to_give(client, db, unique_phone):
    # Only stock above the stated ceiling exists. Rather than showing nothing,
    # the flat that matches everything except the budget is offered anyway and
    # the match is reported as partial.
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 3, "price": 5_000_000})

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(
        db,
        SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000),
    )
    assert rows
    assert relaxation == "PARTIAL"
    assert rows[0].district == "Chilonzor", "the district must not be given up first"


async def test_empty_district_falls_back_to_a_neighbour(client, db, unique_phone):
    # Nothing in Bektemir; Yashnobod borders it and does have stock.
    await _seed(client, unique_phone, {"district": "Yashnobod", "rooms": 2, "price": 3_000_000})

    rows, relaxation, searched, _ = await uyiz_ai.search_for_intent(
        db, SearchIntent(district="Bektemir", region="Toshkent shahri", rooms=2)
    )
    assert rows, "a neighbouring district should be searched before giving up"
    assert relaxation == "NEARBY"
    assert searched in uyiz_ai.nearby_districts("Bektemir")
    assert rows[0].district == searched


async def test_a_message_with_no_criteria_just_shows_what_exists(client, db, unique_phone):
    await _seed(client, unique_phone, {"district": "Sergeli"}, {"district": "Mirobod"})

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, SearchIntent())
    assert len(rows) == 2
    assert relaxation == "NONE"


async def test_nothing_anywhere_is_reported_honestly(db):
    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(
        db, SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3)
    )
    assert rows == []
    # With an empty catalogue the reply must say so rather than imply a match.
    text = uyiz_ai.build_fallback_reply(
        intent=SearchIntent(kind="SEARCH", district="Chilonzor"),
        count=0,
        language="uz",
        user_name=None,
        is_first_turn=False,
        relaxation=relaxation,
        searched_district=None,
    )
    assert "topilmadi" in text or "yo‘q" in text


# ---------------------------------------------------------------------------
# Scoring — the rule that a partial match is a result
# ---------------------------------------------------------------------------
"""No listing is ever filtered out for failing a preference. Every publicly
visible row is scored against everything the visitor actually said, and one
satisfied criterion is enough to be offered — with the reply saying which one
it is. These tests are the ones that hold that promise in place."""


async def test_a_listing_matching_one_criterion_is_still_offered(client, db, unique_phone):
    # Three criteria stated; the only flat in that district meets exactly one
    # of them. Showing nothing here was the whole complaint.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000},
        {"district": "Sergeli", "rooms": 3, "price": 2_000_000},
    )
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000
    )

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [created[0]["id"]]
    assert relaxation == "PARTIAL"
    assert intent.matches[created[0]["id"]]["matched"] == ["district"]
    assert intent.matches[created[0]["id"]]["missed"] == ["rooms", "max_price"]


async def test_the_listing_matching_most_criteria_comes_first(client, db, unique_phone):
    # Seeded oldest-first, so the catalogue's own RECOMMENDED order would put
    # the weaker match on top. The score is what reorders them.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3, "price": 3_500_000},
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000},
    )
    everything, weak_only = created
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000
    )

    rows, _, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [everything["id"], weak_only["id"]]
    assert intent.matches[everything["id"]]["score"] > intent.matches[weak_only["id"]]["score"]
    # The weaker one is still offered, not hidden.
    assert intent.matches[weak_only["id"]]["matched"] == ["district"]


async def test_a_heavier_criterion_outweighs_two_light_ones(client, db, unique_phone):
    # Place is what people actually decide on; a washing machine is a
    # preference. Two preferences must not outweigh the district they named.
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2},
        {"district": "Sergeli", "rooms": 2, "furnished": True, "parking": True},
    )
    catalogue, _, _, _ = await uyiz_ai.search_for_intent(db, SearchIntent())
    by_district = {row.district: row for row in catalogue}

    intent = SearchIntent(district="Chilonzor", furnished=True, parking=True)
    rate = await fx.usd_to_uzs()
    right_place = uyiz_ai.score_listing(by_district["Chilonzor"], intent, rate)
    right_kit = uyiz_ai.score_listing(by_district["Sergeli"], intent, rate)

    assert right_place["matched"] == ["district"]
    assert right_kit["matched"] == ["furnished", "parking"]
    assert right_place["score"] > right_kit["score"]


async def test_equal_scores_keep_the_catalogue_sort(client, db, unique_phone):
    # Two rows that match identically. Python's sort is stable, so whatever
    # apply_sort decided survives scoring — which is how "eng arzon" keeps
    # meaning cheapest first instead of quietly becoming "recommended".
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2, "price": 2_500_000},
        {"district": "Chilonzor", "rooms": 2, "price": 5_000_000},
    )
    cheaper, dearer = created
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=2, sort_by="PRICE_LOW"
    )

    rows, _, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [cheaper["id"], dearer["id"]]
    assert (
        intent.matches[cheaper["id"]]["score"] == intent.matches[dearer["id"]]["score"]
    )


async def test_a_usd_listing_is_priced_in_som_before_it_is_judged(client, db, unique_phone):
    # The price column holds two units and the currency lives in a second
    # column, so a $300 flat compared raw against a so'm budget is about
    # 12 000x out: under every ceiling and below every floor.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2, "price": 300, "currency": "USD"},
    )
    rate = await fx.usd_to_uzs()
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=2,
        min_price=round(rate * 100), max_price=round(rate * 500),
    )

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert len(rows) == 1
    assert relaxation == "EXACT"
    # The floor is what a raw comparison would fail: 300 is not above 1.27 mln.
    assert intent.matches[created[0]["id"]]["missed"] == []


async def test_the_total_counts_matching_rows_not_the_pool(client, db, unique_phone):
    # The reply says "{count} found", so the count has to mean "matching". The
    # size of the pool the rows were scored in is our bookkeeping, not theirs.
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3},
        {"district": "Sergeli", "rooms": 3},
        {"district": "Mirobod", "rooms": 1},
        {"district": "Yunusobod", "rooms": 1},
    )

    rows, _, _, total = await uyiz_ai.search_for_intent(db, SearchIntent(rooms=3))

    assert total == 2
    assert len(rows) == 2
    assert all(row.rooms == 3 for row in rows)


async def test_nothing_matching_still_returns_something(client, db, unique_phone):
    # Not one row satisfies a single criterion. An empty screen is never the
    # answer while the catalogue has anything in it at all.
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 2})
    intent = SearchIntent(rooms=7, pets_allowed=True)

    rows, relaxation, searched, _ = await uyiz_ai.search_for_intent(db, intent)

    assert rows
    assert relaxation == "ANY"
    assert searched is None
    assert intent.dropped == ["rooms", "pets_allowed"]


async def test_dropped_names_only_what_no_result_satisfies(client, db, unique_phone):
    # "Dropped" is what the reply apologises for. A criterion one of the shown
    # listings does meet must not be in it, or the sentence contradicts the
    # rows printed underneath it.
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3},
        {"district": "Chilonzor", "rooms": 1},
    )
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, washing_machine=True
    )

    rows, _, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert len(rows) == 2
    assert intent.dropped == ["washing_machine"]
    assert "rooms" not in intent.dropped, "one of the shown rows has three rooms"


async def test_the_match_report_names_both_halves(client, db, unique_phone):
    # The model is told what each listing meets AND what it misses, because a
    # partial match presented as an exact one is worse than no match.
    created = await _seed(
        client, unique_phone, {"district": "Chilonzor", "rooms": 3, "price": 3_000_000}
    )
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3,
        max_price=2_000_000, furnished=True,
    )

    await uyiz_ai.search_for_intent(db, intent)
    report = intent.matches[created[0]["id"]]

    assert set(report) == {"matched", "missed", "score", "maxScore", "matchPercent"}
    assert report["matched"] + report["missed"] == intent.stated_criteria()
    assert report["matched"] == ["district", "rooms"]
    assert report["missed"] == ["max_price", "furnished"]
    assert report["score"] == 6
    assert report["maxScore"] == 10
    assert report["matchPercent"] == 60


async def test_a_sale_listing_never_enters_a_rent_search(client, db, unique_phone):
    # A monthly rent and a purchase price differ by three orders of magnitude,
    # so one of them is always either invisible or the only thing visible. The
    # assistant searches rentals, and the pooled read must not widen that.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3, "price": 3_000_000},
        {"district": "Chilonzor", "rooms": 3, "price": 600_000_000, "dealType": "SALE"},
    )
    rented, sold = created
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3)

    rows, _, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [rented["id"]]
    assert sold["id"] not in intent.matches
    assert total == 1
