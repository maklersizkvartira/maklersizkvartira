"""Shield AI behaviour that does not need a model key.

Everything here exercises the deterministic half of the assistant: the parser,
the classification merge, the relaxation plan and the written replies. That
half is what runs in production whenever OpenAI is unreachable, so it is the
half most worth pinning down.

The rules being protected, in the order the product asks for them:

  * the assistant introduces itself as the AI assistant *of the MaklersizUy
    company*, never as a bare "Shield AI assistant";
  * a question is answered before any listing is suggested;
  * company questions outside the public facts are declined as internal;
  * off-topic questions get the redirect, not an answer;
  * a search loosens one criterion at a time and only then looks at
    neighbouring districts.
"""

from __future__ import annotations

import pytest

from app.services import shield_ai
from app.services.shield_ai import SearchIntent


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
    intent = shield_ai.parse_intent(message)
    assert intent.district == district
    assert intent.rooms == rooms
    assert intent.kind == "SEARCH"


def test_budget_becomes_a_ceiling_with_headroom():
    # Someone who says "3 mln" will still look at 3.2, so the ceiling is
    # deliberately above the stated number.
    intent = shield_ai.parse_intent("Chilonzordan 3 mln gacha")
    assert intent.max_price is not None
    assert 3_000_000 < intent.max_price <= 4_000_000


def test_a_greeting_is_not_a_search():
    intent = shield_ai.parse_intent("Assalomu alaykum")
    assert intent.kind == "SMALLTALK"
    assert not intent.has_criteria


def test_audience_and_roommate_hints():
    assert shield_ai.parse_intent("talaba uchun xona").audience == "STUDENT"
    assert shield_ai.parse_intent("oilaviy kvartira").audience == "FAMILY"
    assert shield_ai.parse_intent("sheriklikka xona").rental_type == "ROOMMATE"


# ---------------------------------------------------------------------------
# Merging model output with the parser
# ---------------------------------------------------------------------------
def test_parser_wins_on_facts_model_wins_on_classification():
    parsed = SearchIntent(district="Chilonzor", rooms=3, kind="SEARCH")
    llm = SearchIntent(district="Sergeli", rooms=9, kind="DOMAIN", answer="Javob.")
    merged = shield_ai.merge_intents(parsed, llm)

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
    assert shield_ai.merge_intents(parsed, llm).kind == "SEARCH"


def test_missing_model_output_leaves_the_parser_intact():
    parsed = shield_ai.parse_intent("Sergeli 2 xona")
    assert shield_ai.merge_intents(parsed, None) is parsed


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
    return shield_ai.build_fallback_reply(intent=intent, **defaults)


@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_introduction_names_the_company(language):
    text = _reply(
        SearchIntent(kind="SMALLTALK"),
        language=language,
        user_name="Kamron",
        is_first_turn=True,
    )
    assert "MaklersizUy" in text
    assert "Shield AI" in text
    # The old greeting shouted the visitor's name; the product asked for a
    # full stop instead of an exclamation mark.
    assert "Kamron!" not in text


def test_no_introduction_on_later_turns():
    text = _reply(SearchIntent(kind="SMALLTALK"), user_name="Kamron", is_first_turn=False)
    assert "MaklersizUy kompaniyasining" not in text


def test_internal_questions_are_declined():
    text = _reply(SearchIntent(kind="INTERNAL"))
    assert "ichki ma'lumot" in text


def test_offtopic_questions_get_the_redirect():
    text = _reply(SearchIntent(kind="OFFTOPIC"))
    assert "uy-joy" in text.lower()


@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_every_branch_has_wording_in_every_language(language):
    for kind in ("SEARCH", "DOMAIN", "COMPANY", "INTERNAL", "SMALLTALK", "OFFTOPIC"):
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
    assert "topilmadi" in text or "yo'q" in text


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
    assert shield_ai.strip_leading_greeting(raw) == expected


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
    assert shield_ai.strip_leading_greeting(text) == text


def test_a_message_that_is_only_a_greeting_survives():
    # Better a lone "Salom" than an empty reply.
    assert shield_ai.strip_leading_greeting("Salom") == "Salom"


def test_the_introduction_is_not_followed_by_a_second_greeting():
    intent = SearchIntent(kind="SMALLTALK", answer="Salom! Sizga qanday yordam bera olaman?")
    text = _reply(intent, is_first_turn=True, user_name="Kamron")
    assert text.count("alom") == 1, text


# ---------------------------------------------------------------------------
# Relaxation plan
# ---------------------------------------------------------------------------
def test_plan_starts_strict_and_loosens_one_step_at_a_time():
    intent = SearchIntent(district="Chilonzor", rooms=3, max_price=3_000_000)
    steps = shield_ai._plan(intent)

    assert steps[0]["rooms"] == 3 and steps[0]["max_price"] == 3_000_000
    # Budget gives first — it is the criterion people are most flexible on.
    assert steps[1]["max_price"] > 3_000_000
    assert any(s["max_price"] is None and s["rooms"] == 3 for s in steps)
    assert any(s["rooms"] is None for s in steps)
    # The district is never dropped: "somewhere else entirely" is not what
    # they asked for, so that case is handled by the neighbour search.
    assert all(s["district"] == "Chilonzor" for s in steps)


def test_plan_has_no_duplicate_steps():
    steps = shield_ai._plan(SearchIntent(district="Sergeli"))
    seen = [tuple(sorted(s.items(), key=lambda kv: kv[0])) for s in steps]
    assert len(seen) == len(set(seen))


# ---------------------------------------------------------------------------
# Places
# ---------------------------------------------------------------------------
def test_the_whole_country_is_known_not_just_tashkent():
    # The old map had twelve districts. "Samarqandda uy kere" parsed as a
    # request with no location at all, which is the bug this guards.
    assert len(shield_ai.ALL_REGIONS) == 14
    assert len(shield_ai.ALL_DISTRICTS) > 140


@pytest.mark.parametrize(
    ("message", "district", "region"),
    [
        ("Chilonzordan uy kere", "Chilonzor", "Toshkent shahri"),
        ("Samarqandda kvartira", "Samarqand sh.", "Samarqand viloyati"),
        ("Urgutda 2 xona", "Urgut", "Samarqand viloyati"),
        ("Nukusda uy", "Nukus sh.", "Qoraqalpogʻiston Respublikasi"),
        ("Buxoroga koʻchmoqchiman", "Buxoro sh.", "Buxoro viloyati"),
    ],
)
def test_a_case_suffix_does_not_hide_the_place(message, district, region):
    # Uzbek glues the case onto the noun; matching on a bare word boundary
    # found none of these.
    intent = shield_ai.parse_intent(message)
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
    assert shield_ai.normalise_district(message) == expected


def test_a_region_is_recognised_even_without_a_district():
    intent = shield_ai.parse_intent("xorazmda uy kere")
    assert intent.region == "Xorazm viloyati"


def test_every_district_belongs_to_a_region():
    for district in shield_ai.ALL_DISTRICTS:
        assert shield_ai.region_of(district) in shield_ai.ALL_REGIONS


def test_tashkent_neighbours_are_real_and_exclude_self():
    city = set(shield_ai.REGIONS["Toshkent shahri"])
    for district in city:
        neighbours = shield_ai.nearby_districts(district)
        assert neighbours, f"{district} has no neighbours"
        assert district not in neighbours
        assert set(neighbours) <= city


def test_outside_tashkent_nearby_means_the_rest_of_the_province():
    neighbours = shield_ai.nearby_districts("Urgut")
    assert "Samarqand sh." in neighbours
    assert "Urgut" not in neighbours
    # Never another province: that is not "nearby" to anyone.
    assert all(shield_ai.region_of(n) == "Samarqand viloyati" for n in neighbours)


def test_an_unknown_place_has_no_neighbours():
    assert shield_ai.nearby_districts("Atlantis") == ()
    assert shield_ai.nearby_districts(None) == ()


# ---------------------------------------------------------------------------
# Asking before searching
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("message", ["uy kere", "kvartira kerak", "I need a flat", "ищу квартиру"])
def test_a_bare_request_asks_instead_of_searching(message):
    # "uy kere" is the opening of a search, not a search. Answering it with
    # the whole catalogue answers a question nobody asked.
    assert shield_ai.parse_intent(message).kind == "CLARIFY"


def test_one_stated_criterion_is_enough_to_search():
    assert shield_ai.parse_intent("Chilonzordan uy kere").kind == "SEARCH"
    assert shield_ai.parse_intent("3 xonali kerak").kind == "SEARCH"


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
    assert "2 xonali" in shield_ai.SearchIntent.criteria_labels(intent, "uz")
    assert "2-комнатная" in shield_ai.SearchIntent.criteria_labels(intent, "ru")
    assert "2 rooms" in shield_ai.SearchIntent.criteria_labels(intent, "en")


# ---------------------------------------------------------------------------
# Finding stock — against a real database
# ---------------------------------------------------------------------------
"""The relaxation ladder is the part that decides whether a visitor sees an
empty screen or the closest thing we actually have, so it is exercised against
real rows rather than a stub."""

from tests.conftest import auth_headers, register_and_verify  # noqa: E402

_LISTING = {
    "title": "Kvartira ijaraga beriladi",
    "description": (
        "Yangi ta'mirlangan, mebel va texnika bilan jihozlangan kvartira. "
        "Metro bekatiga 5 daqiqa piyoda. Uy egasidan, vositachisiz."
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

    rows, relaxation, _, _ = await shield_ai.search_for_intent(
        db,
        SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000),
    )
    assert rows, "a listing that satisfies every criterion should be found"
    assert relaxation == "EXACT"


async def test_budget_is_the_first_criterion_to_give(client, db, unique_phone):
    # Only stock above the stated ceiling exists. Rather than showing nothing,
    # the search lifts the budget one step and reports the match as partial.
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 3, "price": 5_000_000})

    rows, relaxation, _, _ = await shield_ai.search_for_intent(
        db,
        SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000),
    )
    assert rows
    assert relaxation == "PARTIAL"
    assert rows[0].district == "Chilonzor", "the district must not be given up first"


async def test_empty_district_falls_back_to_a_neighbour(client, db, unique_phone):
    # Nothing in Bektemir; Yashnobod borders it and does have stock.
    await _seed(client, unique_phone, {"district": "Yashnobod", "rooms": 2, "price": 3_000_000})

    rows, relaxation, searched, _ = await shield_ai.search_for_intent(
        db, SearchIntent(district="Bektemir", region="Toshkent shahri", rooms=2)
    )
    assert rows, "a neighbouring district should be searched before giving up"
    assert relaxation == "NEARBY"
    assert searched in shield_ai.nearby_districts("Bektemir")
    assert rows[0].district == searched


async def test_a_message_with_no_criteria_just_shows_what_exists(client, db, unique_phone):
    await _seed(client, unique_phone, {"district": "Sergeli"}, {"district": "Mirobod"})

    rows, relaxation, _, _ = await shield_ai.search_for_intent(db, SearchIntent())
    assert len(rows) == 2
    assert relaxation == "NONE"


async def test_nothing_anywhere_is_reported_honestly(db):
    rows, relaxation, _, _ = await shield_ai.search_for_intent(
        db, SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3)
    )
    assert rows == []
    # With an empty catalogue the reply must say so rather than imply a match.
    text = shield_ai.build_fallback_reply(
        intent=SearchIntent(kind="SEARCH", district="Chilonzor"),
        count=0,
        language="uz",
        user_name=None,
        is_first_turn=False,
        relaxation=relaxation,
        searched_district=None,
    )
    assert "topilmadi" in text or "yo'q" in text
