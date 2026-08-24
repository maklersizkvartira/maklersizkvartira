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
# District data
# ---------------------------------------------------------------------------
def test_every_district_has_neighbours_and_they_are_real():
    known = set(shield_ai.TASHKENT_DISTRICTS)
    assert set(shield_ai.NEARBY_DISTRICTS) == known
    for district, neighbours in shield_ai.NEARBY_DISTRICTS.items():
        assert neighbours, f"{district} has no neighbours"
        assert district not in neighbours, f"{district} lists itself"
        assert set(neighbours) <= known, f"{district} points at an unknown district"


def test_aliases_resolve_to_canonical_districts():
    known = set(shield_ai.TASHKENT_DISTRICTS)
    for alias in shield_ai._DISTRICT_ALIASES:
        assert shield_ai.normalise_district(alias) in known


def test_criteria_labels_are_translated():
    intent = SearchIntent(district="Chilonzor", rooms=2, audience="STUDENT")
    assert "2 xonali" in shield_ai.SearchIntent.criteria_labels(intent, "uz")
    assert "2-комнатная" in shield_ai.SearchIntent.criteria_labels(intent, "ru")
    assert "2 rooms" in shield_ai.SearchIntent.criteria_labels(intent, "en")
