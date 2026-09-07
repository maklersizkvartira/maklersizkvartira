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

import time
from types import SimpleNamespace

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


def test_a_dollar_sign_after_the_number_is_still_a_budget():
    # The reported bug, in the visitor's own words: "1500$ ga uy kere" and the
    # assistant recommended the entire catalogue. The pattern accepted the
    # sign only as a prefix, so the one way Uzbek actually writes a dollar
    # amount parsed as no budget at all, has_criteria came back False, and the
    # search fell through to "show what we have".
    intent = uyiz_ai.parse_intent("1500$ ga uy kere")
    assert intent.max_price is not None
    assert intent.max_price == round(1500 * fx.cached_rate())
    assert intent.price_was_usd is True
    assert intent.kind == "SEARCH"


@pytest.mark.parametrize(
    "message",
    ["$1500", "1500$", "1500 $", "1500usd", "1500 dollar", "1500 доллар", "1 500$"],
)
def test_every_way_a_budget_is_written_parses(message):
    # Sign before, sign after, sign spaced off, the word in three languages,
    # and a thousands separator. All of them are the same fifteen hundred.
    assert uyiz_ai.parse_intent(message).max_price == round(1500 * fx.cached_rate())


def test_a_stated_ceiling_is_not_quietly_raised():
    # Every budget branch used to end in "* 1.25", so somebody who said "3 mln"
    # was shown 3.75 mln flats with nothing saying so. A near miss is scored,
    # kept and labelled honestly now, so the ceiling can simply be the ceiling.
    assert uyiz_ai.parse_intent("Chilonzordan 3 mln gacha").max_price == 3_000_000


def test_a_budget_in_thousands_of_som_parses():
    assert uyiz_ai.parse_intent("500 ming").max_price == 500_000


@pytest.mark.parametrize("message", ["5-uy", "2024"])
def test_an_implausibly_small_number_is_not_a_budget(message):
    # A house number, a floor or a year read as money filters the catalogue
    # down to nothing, and the visitor is never told their number was misread.
    assert uyiz_ai.parse_intent(message).max_price is None


#: (message, floor, ceiling, was_usd, rejected). A bound is written as the
#: currency the visitor used and the number they said, so the expectation is
#: the same arithmetic the parser has to do rather than a copy of its output.
_MONEY_CASES = [
    # Every way a dollar budget is written. All of them are 1500 dollars.
    ("1500$ ga uy kere", None, ("USD", 1500), True, False),
    ("$1500", None, ("USD", 1500), True, False),
    ("1500 dollar", None, ("USD", 1500), True, False),
    ("1500 $", None, ("USD", 1500), True, False),
    ("1 500$", None, ("USD", 1500), True, False),
    ("1500usd", None, ("USD", 1500), True, False),
    ("1500 доллар", None, ("USD", 1500), True, False),
    # The Latin transliteration an Uzbek keyboard produces for "у.е." (D10).
    ("1500 y.e", None, ("USD", 1500), True, False),
    ("1500 ue", None, ("USD", 1500), True, False),
    # A scale word and a currency word COMBINE. "2 ming dollar" used to parse
    # as no budget at all and "200 ming dollar" as a 200 000-so'm ceiling —
    # the reported bug, alive in the phrasing ordinary Uzbek uses (D3).
    ("2 ming dollar", None, ("USD", 2_000), True, False),
    ("200 ming dollar", None, ("USD", 200_000), True, False),
    # So'm, in words and in digits. A billion is a real purchase budget.
    ("1.5 mlrd so'm", None, ("UZS", 1_500_000_000), False, False),
    ("3 mln", None, ("UZS", 3_000_000), False, False),
    ("500 ming", None, ("UZS", 500_000), False, False),
    ("3000000", None, ("UZS", 3_000_000), False, False),
    # A range: "gacha" marks the ceiling and "dan" the floor, and reading the
    # floor as the ceiling threw away the top half of the budget (D9).
    ("1500$ dan 2000$ gacha", ("USD", 1500), ("USD", 2000), True, False),
    ("300$ dan 500$ gacha", ("USD", 300), ("USD", 500), True, False),
    # A date is not money. This one used to parse as 25.7 billion so'm (D1).
    ("05.09.2025, 400$", None, ("USD", 400), True, False),
    ("12.05.2024 da ko'chaman", None, None, False, True),
    # Neither is a phone number — 998 billion so'm, above what the listings
    # page will even accept as a filter (D12).
    ("telefonim 90 123 45 67, 500$ gacha", None, ("USD", 500), True, False),
    ("+998901234567 raqamim", None, None, False, True),
    # Nor a floor area: "80 m kv" was an 80-million-so'm budget nobody
    # stated, because "m" used to be a scale word (D2).
    ("Chilonzorda 80 m kv uy kere", None, None, False, True),
    ("60 m2 kvartira", None, None, False, True),
    # A decimal point is a decimal point, not a thousands separator (D11).
    ("1500.50$", None, ("USD", 1500.50), True, False),
    # $1.50 is not a housing budget in any currency, so it is refused rather
    # than read as $15.
    ("1.5$", None, None, False, True),
    # A pasted price keeps its thousands separator, and on this keyboard that
    # separator is a comma or a stop as often as it is a space. All of these
    # used to parse as NO budget at all, which dropped the visitor into the
    # "here are some recent listings" branch this whole workstream exists to
    # delete — the originally reported symptom, in a shape nobody tested.
    ("1,500$", None, ("USD", 1500), True, False),
    ("$1,500", None, ("USD", 1500), True, False),
    ("1,500 dollar", None, ("USD", 1500), True, False),
    ("2,000$ gacha", None, ("USD", 2000), True, False),
    ("1.500$", None, ("USD", 1500), True, False),
    ("$1.500", None, ("USD", 1500), True, False),
    ("1.500.000 so'm", None, ("UZS", 1_500_000), False, False),
    ("1,500,000 so'm", None, ("UZS", 1_500_000), False, False),
    ("12,000,000", None, ("UZS", 12_000_000), False, False),
    # The Uzbek dative on a bare so'm amount. "ga" as the hectare word is far
    # rarer than "ga" as the ending on a price, and treating it as hectares
    # threw away a complete, idiomatic request.
    ("3 000 000 ga uy kere", None, ("UZS", 3_000_000), False, False),
    ("500 000 ga uy kere", None, ("UZS", 500_000), False, False),
    # ...but the hectare word spelled out is still an area, not a budget.
    ("3 000 000 gektar yer", None, None, False, True),
    # A hyphen range with the currency written once at either end. Reading the
    # unmarked end as so'm put it under MIN_PLAUSIBLE_BUDGET, where it was
    # discarded, and the range collapsed to a single number.
    ("$1500-2000", ("USD", 1500), ("USD", 2000), True, False),
    ("1500-2000$", ("USD", 1500), ("USD", 2000), True, False),
    ("1500$ - 2000$", ("USD", 1500), ("USD", 2000), True, False),
    # A scale word written once at one end of a range is the same shape.
    ("2-3 mln so'm", ("UZS", 2_000_000), ("UZS", 3_000_000), False, False),
    # "dan boshlab" is a floor, and the suffix is glued to the currency word.
    ("850 ming so'mdan boshlab", ("UZS", 850_000), None, False, False),
    # A scale word used to buy the token an exemption from the measurement
    # check, so an area, a year, a floor count and a room count each came back
    # as a budget nobody stated — D2 again, through a side door.
    ("100 ming kv.m yer", None, None, False, True),
    ("2 mln kvadrat metr", None, None, False, True),
    ("2 mln yil", None, None, False, True),
    ("3 mln xonali", None, None, False, True),
    # A year, a house number, a plot, a floor. None of them is money.
    ("2024-yil", None, None, False, True),
    ("5-uy", None, None, False, True),
    ("80 sotix", None, None, False, True),
    ("3-qavat", None, None, False, True),
]


@pytest.mark.parametrize(
    ("message", "floor", "ceiling", "was_usd", "rejected"), _MONEY_CASES
)
def test_the_money_parser_reads_what_people_actually_write(
    message, floor, ceiling, was_usd, rejected
):
    """The one test that has to fail before any of this is worth shipping.

    A visitor typed "1500$ ga uy kere" and was answered with unrelated
    listings. Two rounds of patching the old regex pair fixed that phrasing
    and left eight others broken, which is why the pair is gone and this
    table exists: every shape of budget anybody has actually been seen to
    write, and every number that looks like one and is not, with the answer
    spelled out. Nothing here asserts ``None`` merely because the parser
    happens to fail on it.
    """
    rate = fx.cached_rate()

    def expected(bound):
        if bound is None:
            return None
        currency, amount = bound
        return float(round(amount * rate)) if currency == "USD" else float(amount)

    reading = uyiz_ai.parse_money(message)

    assert reading.min_uzs == expected(floor), message
    assert reading.max_uzs == expected(ceiling), message
    assert reading.was_usd is was_usd, message
    assert reading.rejected is rejected, message


def test_a_currency_borrowed_across_a_hyphen_cannot_make_a_phone_a_budget():
    """The range fix must not hand the phone rule a way round itself.

    A hyphen range shares its currency mark between its two ends, and the
    phone rule skips a long digit run only when nothing on it names money —
    so if the shared mark counted, "$1500-998901234567" would read a pasted
    phone number as a 12-billion-dollar budget. The rule reads the token's
    own marks for exactly this reason; this test is what says so.
    """
    reading = uyiz_ai.parse_money("$1500-998901234567")
    assert reading.max_uzs == round(1500 * fx.cached_rate())
    assert reading.min_uzs is None


def test_a_budget_reaches_the_intent_and_a_misread_number_does_not():
    # parse_money is what parse_intent runs on, so the two cannot drift.
    intent = uyiz_ai.parse_intent("Chilonzorda 200 ming dollarga uy")
    assert intent.max_price == round(200_000 * fx.cached_rate())
    assert intent.price_was_usd is True
    assert uyiz_ai.parse_intent("+998901234567, uy kere").max_price is None


def test_the_live_rate_is_used_not_the_old_constant(monkeypatch):
    # USD_TO_UZS = 12_700 was the exact number app.services.fx was written to
    # replace; its own docstring says that constant was 7.5% wrong.
    monkeypatch.setattr(fx, "_cached", (20_000.0, time.monotonic()))
    assert uyiz_ai.parse_intent("1500$ ga uy").max_price == 30_000_000


def test_wanting_to_buy_is_read_from_the_message():
    assert uyiz_ai.parse_intent("Chilonzordan sotib olmoqchiman").deal_type == "SALE"
    assert uyiz_ai.parse_intent("купить квартиру").deal_type == "SALE"


def test_an_ijara_message_stays_a_rental_search():
    # Rent wins a tie: the catalogue is still mostly rentals, and RENT is what
    # a message with no word either way means.
    assert uyiz_ai.parse_intent("Chilonzorda ijara kvartira").deal_type == "RENT"
    assert uyiz_ai.parse_intent("Chilonzordan uy kere").deal_type == "RENT"


def test_a_negated_rental_word_is_not_a_rental_search():
    # "ijara emas" says the opposite of "ijara", and "ijarasiz" is a different
    # word again. Both used to be read as an explicit request to rent, so a
    # visitor who said in the same sentence that they wanted to buy was handed
    # rentals. (D-FIX-1)
    assert uyiz_ai.parse_intent("kvartira sotib olmoqchiman, ijara emas").deal_type == "SALE"
    assert uyiz_ai.parse_intent("ijarasiz sotib olaman").deal_type == "SALE"
    # The ordinary case suffix is still the same word and must still match.
    assert uyiz_ai.parse_intent("Chilonzorda ijaraga kvartira").deal_type == "RENT"


def test_an_explicit_rental_word_is_marked_as_stated():
    # "RENT" is both the default and something people say, so the string alone
    # cannot tell them apart — and while it could not, merge_intents let a
    # model that misread "ijara" turn a renter's search into a sale-only one.
    stated = uyiz_ai.parse_intent("Chilonzorda ijara kvartira")
    assert stated.deal_type == "RENT" and stated.deal_type_stated is True
    silent = uyiz_ai.parse_intent("Chilonzordan uy kere")
    assert silent.deal_type == "RENT" and silent.deal_type_stated is False


def test_the_model_cannot_overrule_a_visitor_who_said_ijara():
    parsed = uyiz_ai.parse_intent("Chilonzorda ijara kvartira, 3 xonali")
    misread = SearchIntent(district="Chilonzor", rooms=3, deal_type="SALE")
    assert uyiz_ai.merge_intents(parsed, misread).deal_type == "RENT"
    # ...but it still decides when the visitor said nothing either way.
    silent = uyiz_ai.parse_intent("Chilonzorda 3 xonali kvartira")
    assert uyiz_ai.merge_intents(silent, misread).deal_type == "SALE"


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


def test_the_currency_survives_the_merge_even_for_a_floor():
    # price_was_usd is the only thing that tells the reply layer which
    # currency to say the number back in: by the time anybody reads the
    # intent the amount is in so'm. A stated floor carries it too. (M3)
    parsed = uyiz_ai.parse_intent("1500$ dan boshlab")
    assert parsed.min_price and parsed.price_was_usd is True
    merged = uyiz_ai.merge_intents(parsed, SearchIntent(kind="SEARCH"))
    assert merged.min_price == parsed.min_price
    assert merged.price_was_usd is True


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


def test_naming_only_a_province_is_something_to_search_on():
    # It used to be nothing: has_criteria was False, the read went out with no
    # filter at all, and somebody asking about Qashqadaryo was shown Tashkent
    # flats with no warning that the province had been dropped. (R-FIX-2)
    intent = uyiz_ai.parse_intent("Qashqadaryoda uy kere")
    assert intent.region == "Qashqadaryo viloyati"
    assert intent.stated_criteria() == ["region"]
    assert intent.has_criteria is True
    assert intent.kind == "SEARCH"


def test_a_province_beside_a_district_is_not_recited_back():
    # The region is derived from the district here rather than asked for, and
    # the pool is already filtered on it, so scoring it would hand every row
    # the same free three points and the reply would name our own bookkeeping.
    intent = uyiz_ai.parse_intent("Chilonzordan 3 xonali kvartira")
    assert intent.region == "Toshkent shahri"
    assert "region" not in intent.stated_criteria()


def test_every_district_belongs_to_a_region():
    for district in uyiz_ai.ALL_DISTRICTS:
        assert uyiz_ai.region_of(district) in uyiz_ai.ALL_REGIONS


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


def test_the_mirror_admits_every_row_the_sql_would():
    # criterion_matches is apply_filters written out in Python, and the two
    # diverging is worse than either being wrong on its own: a criterion the
    # SQL would have honoured and the mirror calls a miss becomes a listing
    # the assistant needlessly apologises for, or cuts on MIN_SCORE. (R-FIX-4)
    row = SimpleNamespace(
        price=3_000_000, currency="UZS", district="Sergeli",
        region="Toshkent shahri", metro_station=None,
        # Not NULL, and apply_filters:148 tests NULL. A cleared form field
        # saves an empty string, and the SQL admits that row.
        university_name="", rooms=2, area=60, is_roommate=False,
        roommate_gender=None, property_type="APARTMENT", safety_badges=[],
    )
    rate = 12_700.0

    # apply_filters:138 skips the clause entirely for ANY, so ANY is not a
    # filter. Requiring is_roommate here scored every whole-flat listing zero.
    assert uyiz_ai.criterion_matches(
        row, "roommate_gender", SearchIntent(roommate_gender="ANY"), rate
    ) is True
    assert uyiz_ai.criterion_matches(
        row, "audience", SearchIntent(audience="STUDENT"), rate
    ) is True


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


async def test_an_empty_district_does_not_mean_an_empty_answer(client, db, unique_phone):
    # Nothing in Bektemir. The row that does exist matches the room count, so
    # it is offered — and the reply is told to say where it actually is
    # rather than presenting it as a Bektemir listing.
    await _seed(client, unique_phone, {"district": "Yashnobod", "rooms": 2, "price": 3_000_000})

    rows, relaxation, searched, _ = await uyiz_ai.search_for_intent(
        db, SearchIntent(district="Bektemir", region="Toshkent shahri", rooms=2)
    )
    assert rows, "a row matching the rest of the request is still an answer"
    assert relaxation == "NEARBY"
    assert searched == "Yashnobod"
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
    # Three criteria stated; the flat in the district they named meets exactly
    # one of them. Showing nothing here was the whole complaint — so it is
    # still offered, with the one thing it matches named. It no longer wins,
    # though: the Sergeli flat answers two of the three. (R-FIX-1)
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000},
        {"district": "Sergeli", "rooms": 3, "price": 2_000_000},
    )
    right_place, better_match = created
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000
    )

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [better_match["id"], right_place["id"]]
    assert relaxation == "PARTIAL"
    assert intent.matches[right_place["id"]]["matched"] == ["district"]
    assert intent.matches[right_place["id"]]["missed"] == ["rooms", "max_price"]


async def test_the_listing_matching_most_criteria_comes_first(client, db, unique_phone):
    # Seeded oldest-first, so the catalogue's own RECOMMENDED order would put
    # the weaker match on top. The score is what reorders them.
    #
    # Nothing here is a perfect match — the washing machine is stated and
    # neither row has one — which is what keeps the weaker listing on screen
    # to be ranked at all. A perfect row now answers on its own; see
    # test_a_perfect_match_is_not_denied_by_the_partials_beside_it. (S-FIX-1)
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3, "price": 3_500_000},
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000},
    )
    everything, weak_only = created
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3,
        max_price=4_000_000, washing_machine=True,
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


async def test_the_deal_type_is_never_relaxed_away(client, db, unique_phone):
    # Nothing in the catalogue satisfies a single stated criterion, so every
    # one of them is dropped. The partition is not among them and never can
    # be: it is not a criterion, so it is not weighted, not scored and not
    # something a search is allowed to trade away for a result.
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 2})
    intent = SearchIntent(rooms=7, pets_allowed=True)

    _, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert relaxation == "ANY"
    assert intent.dropped == ["rooms", "pets_allowed"]
    assert "deal_type" not in intent.dropped
    assert "deal_type" not in intent.stated_criteria()
    assert "deal_type" not in uyiz_ai.CRITERION_WEIGHTS


async def test_nothing_matching_shows_three_examples_not_five(client, db, unique_phone):
    # Nothing scored anywhere, so these rows answer no question the visitor
    # asked. Three of them read as examples; five read as a result list, which
    # is how a request for a home at 1500$ came back as a screenful of
    # unrelated flats presented as recommendations.
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor"}, {"district": "Sergeli"}, {"district": "Mirobod"},
        {"district": "Yunusobod"}, {"district": "Yashnobod"},
    )

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(
        db, SearchIntent(rooms=7, pets_allowed=True), limit=5
    )

    assert relaxation == "ANY"
    assert len(rows) <= 3


async def test_a_rental_never_enters_a_sale_search(client, db, unique_phone):
    # The other half of the partition, and the one that only exists now that
    # the assistant searches sales too. A rental is not a cheaper version of
    # a sale: the price is one month in one case and the whole property in
    # the other, so offering one to somebody buying answers a different
    # question rather than answering theirs badly.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3, "price": 3_000_000},
        {"district": "Chilonzor", "rooms": 3, "price": 600_000_000, "dealType": "SALE"},
    )
    rented, sold = created
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, deal_type="SALE"
    )

    rows, _, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [sold["id"]]
    assert rented["id"] not in intent.matches
    assert total == 1


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


async def test_a_better_match_one_district_over_can_win(client, db, unique_phone):
    """The user's own rule, and the one the search used to invert.

    The pool was gated on district in SQL and the loop stopped at the first
    tier that produced any scoring row, so a listing one district over that
    answered three of four criteria was never scored at all while a listing in
    the named district that answered one was presented as the result. There is
    no ladder any more: one pool, and district is a criterion worth three
    points like any other place. (R-FIX-1)
    """
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000},
        {"district": "Yunusobod", "rooms": 3, "price": 3_000_000, "furnished": True},
    )
    right_place, better_match = created

    def intent() -> SearchIntent:
        return SearchIntent(
            district="Chilonzor", region="Toshkent shahri", rooms=3,
            max_price=4_000_000, furnished=True,
        )

    ranked = intent()
    rows, relaxation, searched, total = await uyiz_ai.search_for_intent(db, ranked)

    # Three criteria beat one, across a district boundary.
    assert [str(row.id) for row in rows] == [better_match["id"], right_place["id"]]
    assert ranked.matches[better_match["id"]]["matched"] == [
        "rooms", "max_price", "furnished"
    ]
    assert ranked.matches[right_place["id"]]["matched"] == ["district"]
    assert (
        ranked.matches[better_match["id"]]["score"]
        > ranked.matches[right_place["id"]]["score"]
    )
    # Both rows scored, so both are counted and the Chilonzor one is still on
    # screen — which is why this answer is PARTIAL rather than NEARBY.
    assert total == 2
    assert relaxation == "PARTIAL"
    assert searched == "Chilonzor"

    # With one slot to give, it goes to the better match and the reply is told
    # plainly that nothing in the district they named is being shown.
    only = intent()
    rows, relaxation, searched, total = await uyiz_ai.search_for_intent(db, only, limit=1)

    assert [str(row.id) for row in rows] == [better_match["id"]]
    assert relaxation == "NEARBY"
    assert searched == "Yunusobod"
    assert total == 2


async def test_a_province_search_never_answers_with_another_province(
    client, db, unique_phone
):
    # Region used to be filtered in SQL and scored nowhere, so when it was the
    # only thing stated has_criteria was False and the read went out with no
    # filter at all. "Qashqadaryoda uy kere" came back as Tashkent flats with
    # nothing saying the province had been dropped. (R-FIX-2)
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "region": "Toshkent shahri"},
        {"district": "Qarshi sh.", "region": "Qashqadaryo viloyati"},
    )
    intent = SearchIntent(region="Qashqadaryo viloyati")

    rows, relaxation, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert [row.district for row in rows] == ["Qarshi sh."]
    assert intent.stated_criteria() == ["region"]
    assert relaxation == "EXACT"
    assert total == 1


async def test_the_sort_the_visitor_asked_for_survives_a_tie(client, db, unique_phone):
    # Two rows of equal weight, one matching three light criteria and one
    # matching a single heavy one. The old second sort key ranked on how many
    # criteria matched, which quietly overrode PRICE_LOW: "eng arzon" stopped
    # meaning cheapest first among equally-scoring rows. (R-FIX-4)
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2, "price": 8_000_000,
         "area": 60, "furnished": True, "parking": True},
        {"district": "Chilonzor", "rooms": 3, "price": 2_000_000, "area": 30},
    )
    three_light, one_heavy = created
    intent = SearchIntent(
        rooms=3, min_area=50, furnished=True, parking=True, sort_by="PRICE_LOW"
    )

    rows, _, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert intent.matches[three_light["id"]]["score"] == 3
    assert intent.matches[one_heavy["id"]]["score"] == 3
    assert len(intent.matches[three_light["id"]]["matched"]) == 3
    assert len(intent.matches[one_heavy["id"]]["matched"]) == 1
    assert [str(row.id) for row in rows] == [one_heavy["id"], three_light["id"]]


async def test_the_pool_count_is_used_rather_than_thrown_away(
    client, db, unique_phone
):
    # list_public runs its SELECT count(*) whether or not the caller keeps the
    # answer, so discarding it bought a wasted aggregate per chat turn and
    # nothing else. It is the honest "how many exist where we looked", which
    # is a different number from "how many of them match". (R-FIX-5)
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3},
        {"district": "Sergeli", "rooms": 1},
        {"district": "Mirobod", "rooms": 1},
    )
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=3)

    _, _, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert total == 1, "one row scores; the other two match nothing stated"
    assert intent.total_in_scope == 3


async def test_nothing_matching_counts_nothing_as_matching(client, db, unique_phone):
    # The examples shown when nothing scored are not results, so they must not
    # be counted as matching ones — the model writes "N ta mos" from this
    # number. The size of the pool they came from is total_in_scope. (R-FIX-3)
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 2})
    intent = SearchIntent(rooms=7, pets_allowed=True)

    rows, relaxation, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert relaxation == "ANY"
    assert rows and total == 0
    assert intent.total_in_scope == 1


# ---------------------------------------------------------------------------
# A perfect match is announced as a find, not as a failure
# ---------------------------------------------------------------------------
"""``relaxation`` used to be EXACT only when *every* returned row matched
everything, and the pooled read hands back near-misses beside the good row. So
the plainest search on the site — "Chilonzorda 2 xonali kvartira" with a
flawless Chilonzor 2-room in stock — opened with "Barcha shartlaringizga
to'liq mos e'lon topilmadi" printed over a row scoring 6 out of 6. These tests
hold the two halves of the fix: a perfect result is shown on its own, and the
label comes from the best row rather than from the worst one. (S-FIX-1)"""


async def test_a_perfect_match_is_not_denied_by_the_partials_beside_it(
    client, db, unique_phone
):
    # The reported turn, in the visitor's own words: "Chilonzorda 2 xonali
    # kvartira". One flawless Chilonzor 2-room, one 2-room elsewhere. Before
    # the fix both came back, ``all(not missed)`` was False because of the
    # Yunusobod row, and the reply denied the listing it was printing.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2, "price": 3_000_000},
        {"district": "Yunusobod", "rooms": 2, "price": 3_000_000},
    )
    flawless, elsewhere = created
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=2)

    rows, relaxation, searched, total = await uyiz_ai.search_for_intent(db, intent)

    assert relaxation == "EXACT"
    assert [str(row.id) for row in rows] == [flawless["id"]]
    assert elsewhere["id"] not in intent.matches, (
        "a near-miss padding a perfect answer is noise, not a result"
    )
    assert intent.dropped == []
    assert searched == "Chilonzor"
    assert total == 1

    # And the sentence the visitor actually reads is the finding one.
    text = uyiz_ai.build_fallback_reply(
        intent=intent,
        count=len(rows),
        language="uz",
        user_name=None,
        is_first_turn=False,
        relaxation=relaxation,
        searched_district=searched,
    )
    assert "topilmadi" not in text


async def test_a_perfect_match_on_its_own_is_still_exact(client, db, unique_phone):
    # The degenerate half of the same rule: with nothing to dilute it, one
    # perfect row must stay EXACT exactly as it always was.
    created = await _seed(
        client, unique_phone, {"district": "Chilonzor", "rooms": 2, "price": 3_000_000}
    )
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=2)

    rows, relaxation, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [created[0]["id"]]
    assert relaxation == "EXACT"
    assert total == 1


async def test_every_perfect_row_is_shown_not_only_the_first(client, db, unique_phone):
    # "Only perfect rows" means all of them, up to the limit — narrowing to
    # one would hide stock that answers the request completely.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2, "price": 3_000_000},
        {"district": "Chilonzor", "rooms": 2, "price": 3_500_000},
        {"district": "Sergeli", "rooms": 4, "price": 3_000_000},
    )
    first, second, _other = created
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=2)

    rows, relaxation, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert relaxation == "EXACT"
    assert {str(row.id) for row in rows} == {first["id"], second["id"]}
    assert total == 2


async def test_a_partial_result_is_labelled_from_the_best_row(client, db, unique_phone):
    # Nothing is perfect here, so the label still has to be the honest one —
    # judged on the top-ranked row rather than on every row at once.
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 3, "price": 9_000_000},
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000},
    )
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000
    )

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert len(rows) == 2, "with nothing perfect, the near-misses are the answer"
    assert relaxation == "PARTIAL"
    assert intent.dropped == ["max_price"]


# ---------------------------------------------------------------------------
# Region is scored, never filtered
# ---------------------------------------------------------------------------
"""``region`` was the one place criterion left as an unconditional SQL filter
after the district gate came off, and ``Listing.region`` is nullable and
optional on create. So a listing published without one was invisible to every
assistant search, and a search in a province with no stock returned an empty
screen while the code's own comment promised it never would. Region is pooled
and scored now, exactly like district. (S-FIX-2)"""


async def test_a_listing_with_no_region_is_still_found_by_its_district(
    client, db, unique_phone
):
    # API-created, imported and admin-created rows can carry a NULL region.
    # ``Listing.region.ilike(...)`` is never true for NULL, so the filter hid
    # them from every search — a flat denial with the exact listing in stock.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 2, "price": 3_000_000, "region": None},
    )
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=2)

    rows, relaxation, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [created[0]["id"]]
    assert rows[0].region is None, "the row under test must really have no region"
    assert relaxation == "EXACT"
    assert total == 1


async def test_a_province_with_no_stock_degrades_instead_of_emptying(
    client, db, unique_phone
):
    # Samarqand has nothing; the catalogue is all Tashkent. An empty list is
    # never the answer while an approved listing exists, so the 2-room flat
    # that answers everything but the place is offered and the place is named
    # as given up.
    created = await _seed(
        client, unique_phone, {"district": "Chilonzor", "rooms": 2, "price": 3_000_000}
    )
    intent = SearchIntent(district="Urgut", region="Samarqand viloyati", rooms=2)

    rows, relaxation, searched, total = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [created[0]["id"]]
    assert relaxation == "NEARBY"
    assert searched == "Chilonzor"
    assert total == 1
    assert intent.dropped == ["district"]


async def test_a_province_named_alone_with_no_stock_still_answers(
    client, db, unique_phone
):
    # The same failure with no district to fall back on. "Qashqadaryoda uy
    # kere" against an empty Qashqadaryo used to return nothing at all; the
    # province is scored now, so it degrades to examples rather than a denial.
    await _seed(client, unique_phone, {"district": "Chilonzor", "rooms": 2})
    intent = SearchIntent(region="Qashqadaryo viloyati")

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert rows, "an empty list is never returned while an approved listing exists"
    assert relaxation == "ANY"
    assert intent.dropped == ["region"], "the province is said out loud, not hidden"


async def test_the_right_region_still_outranks_the_wrong_one(client, db, unique_phone):
    # Removing the SQL gate must not make a province meaningless: it is worth
    # three points, so the row in the province they named still wins.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "region": "Toshkent shahri", "rooms": 2},
        {"district": "Qarshi sh.", "region": "Qashqadaryo viloyati", "rooms": 2},
    )
    _tashkent, qashqadaryo = created
    intent = SearchIntent(region="Qashqadaryo viloyati", rooms=2)

    rows, relaxation, _, _ = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [qashqadaryo["id"]]
    assert relaxation == "EXACT"


async def test_one_stated_criterion_is_still_enough_to_be_offered(
    client, db, unique_phone
):
    # The user's rule, re-pinned against both fixes at once: nothing is
    # perfect, so the row meeting exactly one of three stated criteria is
    # still offered and the one thing it meets is named.
    created = await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "rooms": 5, "price": 9_000_000, "region": None},
    )
    intent = SearchIntent(
        district="Chilonzor", region="Toshkent shahri", rooms=3, max_price=4_000_000
    )

    rows, relaxation, _, total = await uyiz_ai.search_for_intent(db, intent)

    assert [str(row.id) for row in rows] == [created[0]["id"]]
    assert intent.matches[created[0]["id"]]["matched"] == ["district"]
    assert relaxation == "PARTIAL"
    assert total == 1


async def test_the_pool_is_not_narrowed_by_the_region_that_was_asked_for(
    client, db, unique_phone
):
    # ``total_in_scope`` is "how many exist where we looked", and where we
    # look is the whole catalogue for this deal type now. A region filter on
    # the read made that number — and the pool behind it — silently smaller.
    await _seed(
        client, unique_phone,
        {"district": "Chilonzor", "region": "Toshkent shahri", "rooms": 2},
        {"district": "Qarshi sh.", "region": "Qashqadaryo viloyati", "rooms": 2},
        {"district": "Urgut", "region": "Samarqand viloyati", "rooms": 4},
    )
    intent = SearchIntent(district="Chilonzor", region="Toshkent shahri", rooms=2)

    await uyiz_ai.search_for_intent(db, intent)

    assert intent.total_in_scope == 3
