"""Unit tests for the agent layer.

These deliberately avoid the database. Everything here is a rule that has to
hold before a query is ever issued — who may call which tool, what "the second
one" resolves to, whether a word counts as consent — and each of those is a
place where being wrong means acting on the wrong row or on somebody else's
behalf. They are the cheapest tests in the suite and the ones most worth
having.
"""

from __future__ import annotations

import json
import types
import uuid

import pytest

from app.core.config import settings
from app.models.enums import UserRole
from app.services import ai_agent, ai_tools
from app.services.ai_tools import ToolContext, ToolError


@pytest.fixture(autouse=True)
def clean_tables():
    """No database in this module.

    Shadows the session-wide fixture from ``conftest``, which truncates real
    tables and therefore needs a real Postgres.
    """
    yield


# ---------------------------------------------------------------------------
# Doubles
# ---------------------------------------------------------------------------
def _user(role: str = UserRole.STUDENT.value, name: str = "Aziz"):
    return types.SimpleNamespace(
        id=uuid.uuid4(), role=role, name=name, language="uz", phone="998901234567"
    )


def _session():
    return types.SimpleNamespace(
        id=uuid.uuid4(),
        session_key="k" * 32,
        last_intent=None,
        agent_state=None,
        # The lead columns, present and empty. ``_capture_lead`` reads them to
        # decide whether this session has already paged the team (L-FIX-2) and
        # writes ``lead_delivered`` back (L-FIX-1), so a double that lacked
        # them would exercise only the getattr fallbacks.
        lead_name=None,
        lead_phone=None,
        lead_note=None,
        lead_captured_at=None,
        lead_delivered=None,
    )


class _FakeDb:
    """Just enough session for a handler that flushes and writes an audit row.

    ``_capture_lead`` genuinely persists the lead before it tries to send it —
    that ordering is what keeps a Telegram outage from losing the number — so
    a ``None`` db would fail the test before it reached the thing under test.
    """

    def __init__(self):
        self.flushes = 0

    async def flush(self):
        self.flushes += 1


def _ctx(viewer=None, shown=None, said=(), db=None) -> ToolContext:
    return ToolContext(
        db=db,
        viewer=viewer,
        language="uz",
        session=_session(),
        shown_ids=list(shown or []),
        # What the *visitor* typed, and only that. Leaving it empty is not a
        # neutral default any more: L-FIX-3 fails closed, so a lead test that
        # does not say what the visitor typed is testing a refusal.
        visitor_messages=tuple(said),
    )


class _LoopDb:
    """Enough of an ``AsyncSession`` for one whole ``run_turn``.

    Wider than :class:`_FakeDb` because the loop also loads the tuning rows
    and writes an audit entry; the rows are collected rather than stored.
    """

    def __init__(self) -> None:
        self.added: list = []

    def add(self, entry) -> None:
        self.added.append(entry)

    async def flush(self) -> None:
        return None

    async def execute(self, statement):
        return types.SimpleNamespace(all=list)


def _wants(tool: str, arguments: dict, call_id: str = "c1") -> dict:
    """A model reply that asks for one tool call."""
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": tool, "arguments": json.dumps(arguments)},
            }
        ],
    }


@pytest.fixture
def scripted(monkeypatch):
    """Queue model replies and let the real tools run underneath them.

    The provider is replaced, not the tools, so what these tests exercise is
    the context ``run_turn`` actually builds — which is the whole of the
    L-FIX-3 regression: the guard was correct and its only caller never fed
    it anything to check against.
    """
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    sent: list[dict] = []

    def install(*replies):
        queue = list(replies)

        async def fake_call(*, model, messages, tools, temperature):
            sent.append({"messages": list(messages)})
            return queue.pop(0) if queue else {"role": "assistant", "content": "ok"}

        monkeypatch.setattr(ai_agent, "_call", fake_call)
        return sent

    return install


def _listing(**over):
    """A row shaped like ``Listing`` with everything :mod:`ai_tools` reads."""
    base = dict(
        id=uuid.uuid4(), title="Chilonzorda 2 xonali", description="x " * 60,
        district="Chilonzor", region="Toshkent shahri", rooms=2, price=3_000_000,
        currency="UZS", area=54.0, floor=3, total_floors=9,
        metro_station="Chilonzor", metro_distance_minutes=7,
        furnished=True, internet=True, air_conditioning=True,
        washing_machine=True, parking=True, pets_allowed=False,
        is_roommate=False, trust_score=100, risk_score=0, ai_risk_reasons=[],
        safety_badges=["VERIFIED_OWNER"], images=["a", "b", "c", "d"],
        status="APPROVED", views_count=10, favorites_count=2, contact_count=1,
        is_featured=False, moderation_note=None, published_at=None,
        latitude=41.3, longitude=69.2, university_name=None,
        university_distance_minutes=None, roommate_gender=None,
        deposit_price=None, utilities_included=False, property_type="APARTMENT",
        owner_id=uuid.uuid4(), is_public=True, deal_type="RENT",
    )
    base.update(over)
    return types.SimpleNamespace(**base)


# ---------------------------------------------------------------------------
# Permission — the part a prompt cannot be trusted with
# ---------------------------------------------------------------------------
async def test_a_guest_cannot_save_a_favorite_however_the_model_asks():
    ctx = _ctx(viewer=None, shown=[str(uuid.uuid4())])
    with pytest.raises(ToolError) as exc:
        await ai_tools.execute(ctx, "add_favorite", {"listing_ref": 1})
    assert "signed in" in str(exc.value)


async def test_a_tenant_account_cannot_reach_owner_tools():
    ctx = _ctx(viewer=_user(UserRole.STUDENT.value))
    with pytest.raises(ToolError) as exc:
        await ai_tools.execute(ctx, "my_listings", {})
    assert "owner account" in str(exc.value)


async def test_an_owner_account_can():
    """The negative tests above must fail for the right reason.

    Without this, ``my_listings`` could be refused to everyone and the two
    tests above would still pass.
    """
    ctx = _ctx(viewer=_user(UserRole.OWNER.value))
    tool = ai_tools.TOOLS["my_listings"]
    assert ctx.viewer.role in tool.allowed_roles


async def test_an_invented_tool_name_is_refused():
    with pytest.raises(ToolError):
        await ai_tools.execute(_ctx(), "drop_all_listings", {})


def test_owner_tools_are_hidden_from_someone_with_no_listings():
    """Not the security boundary — but it keeps the conversation sensible."""
    guest = [t["function"]["name"] for t in ai_tools.schemas_for(_ctx())]
    owner = [
        t["function"]["name"]
        for t in ai_tools.schemas_for(_ctx(viewer=_user(UserRole.OWNER.value)))
    ]
    assert "my_listings" not in guest
    assert "my_listings" in owner
    assert "search_listings" in guest


def test_every_tool_that_writes_requires_a_signed_in_account():
    """A tool that changes state must never be reachable anonymously."""
    writes = {"add_favorite", "remove_favorite", "my_listings",
              "listing_performance", "list_favorites"}
    for name in writes:
        assert ai_tools.TOOLS[name].requires_auth, f"{name} is open to guests"


# ---------------------------------------------------------------------------
# Listing references — the model must not be able to name a row
# ---------------------------------------------------------------------------
async def test_a_reference_with_nothing_shown_is_an_error_not_a_guess():
    with pytest.raises(ToolError) as exc:
        await ai_tools._resolve_listing(_ctx(), 1)
    assert "search_listings first" in str(exc.value)


async def test_a_reference_past_the_end_is_refused():
    ctx = _ctx(shown=[str(uuid.uuid4())])
    with pytest.raises(ToolError) as exc:
        await ai_tools._resolve_listing(ctx, 4)
    assert "no number 4" in str(exc.value)


@pytest.mark.parametrize("bad", [None, "abc", 0, 999, {"id": "x"}])
def test_a_malformed_reference_never_becomes_a_row(bad):
    with pytest.raises(ToolError):
        ai_tools._ref_of({"listing_ref": bad})


def test_a_new_result_set_replaces_what_the_second_one_means():
    """Otherwise "save the second one" points into a stale search."""
    ctx = _ctx()
    first = [_listing(), _listing(), _listing()]
    ai_tools._remember(ctx, first)
    assert ctx.shown_ids == [str(r.id) for r in first]

    second = [_listing()]
    ai_tools._remember(ctx, second)
    assert ctx.shown_ids == [str(second[0].id)]


# ---------------------------------------------------------------------------
# What the model is allowed to see
# ---------------------------------------------------------------------------
def test_a_listing_projection_carries_no_phone_number():
    row = _listing()
    row.owner = types.SimpleNamespace(phone="998901112233", name="Owner")
    blob = repr(ai_tools._listing_public(row, position=1))
    assert "998901112233" not in blob
    assert "phone" not in blob.lower()


def test_user_written_text_reaches_the_model_truncated():
    """Titles and descriptions are the one place an injection could ride in."""
    row = _listing(title="T" * 500, description="D" * 5000)
    view = ai_tools._listing_public(row, position=1)
    assert len(view["title"]) <= 120
    assert len(view["note"]) <= 200


# ---------------------------------------------------------------------------
# The budget, in the words it was said in
# ---------------------------------------------------------------------------
def test_the_search_tool_takes_the_currency_it_was_told():
    """The model reports which currency it heard; it does not convert.

    Without this parameter the only way to express "1500$" is to convert it,
    and a model converting at a rate it invented produces a budget nobody
    stated. That is how a $1500 search came back with the whole catalogue in
    it.
    """
    params = ai_tools.TOOLS["search_listings"].parameters["properties"]
    assert params["price_currency"]["enum"] == ["UZS", "USD"]


def test_the_search_tool_can_ask_for_sale_listings():
    """Buying is a different question, not a wider rental search.

    A sale price is the whole property and a rent price is one month, so a
    tool that cannot say which one was meant can only answer one of them.
    """
    params = ai_tools.TOOLS["search_listings"].parameters["properties"]
    assert params["deal_type"]["enum"] == ["RENT", "SALE", "ALL"]


def test_the_model_is_told_not_to_convert_currency():
    """The server owns the exchange rate, and the description has to say so.

    A model left to do the arithmetic is the dropped budget arriving by a
    different road: nothing downstream can tell 1500 dollars from 1500 so'm,
    and the visitor is shown places at four times what they said.
    """
    params = ai_tools.TOOLS["search_listings"].parameters["properties"]
    assert "Do not convert it" in params["max_price"]["description"]


def test_the_currency_parameter_says_it_is_required_with_a_price():
    """JSON Schema cannot require a field against a sibling, so the words must.

    ``price_currency`` used to say "Defaults to UZS", which invited exactly
    the call that broke: ``{"max_price": 1500}`` for a visitor who said
    ``1500$``, read as a 1 500-so'm ceiling (D5). The handler now refuses to
    assume, and the description has to stop promising that it will.
    """
    params = ai_tools.TOOLS["search_listings"].parameters["properties"]
    description = params["price_currency"]["description"]
    assert "REQUIRED whenever you pass max_price" in description
    assert "no default" in description


# ---------------------------------------------------------------------------
# The budget the tool was handed — M2 (D5, D6), M3 (D7), R-FIX-3
#
# These drive ``_search_listings`` itself rather than the schema, because the
# defects here all live in the handler: a currency it was not given, a
# conversion it did or did not do, a number too small or too large to have
# been anybody's housing budget. The database is stubbed out; what is being
# tested is the arithmetic and the refusals in front of it.
# ---------------------------------------------------------------------------
_RATE = 12_700.0


def _stub_search(monkeypatch, rows=(), relaxation="EXACT", district=None, total=0,
                 reports=None):
    """Replace the search with a recorder, and pin the exchange rate.

    Returns a dict that holds the ``SearchIntent`` the handler built, which is
    where every budget assertion below actually looks: the payload is what the
    model reads, but the intent is what the search would have run on.
    """
    seen: dict = {}

    async def fake_search(db, intent, *, limit=5):
        seen["intent"] = intent
        intent.matches = dict(reports or {})
        return list(rows), relaxation, district, total

    async def fake_rate():
        return _RATE

    monkeypatch.setattr(ai_tools.uyiz_ai, "search_for_intent", fake_search)
    monkeypatch.setattr(ai_tools.fx, "usd_to_uzs", fake_rate)
    monkeypatch.setattr(ai_tools.fx, "cached_rate", lambda: _RATE)
    return seen


def test_an_unknown_currency_is_refused_out_loud_not_read_as_som():
    """"EUR" used to be a silent factor-of-13,000 error (D5).

    Anything that is not UZS or USD fell straight through the ``== "USD"``
    test and was searched as so'm, with no log and no rejection. The model can
    recover from an error — it asks the visitor which they meant — and cannot
    recover from a wrong answer it was never told about.
    """
    with pytest.raises(ToolError) as exc:
        ai_tools._stated_currency({"price_currency": "EUR"})
    assert "must be UZS or USD" in str(exc.value)


@pytest.mark.parametrize("written", [" usd ", "usd", "Usd", "UZS ", " uzs"])
def test_a_currency_written_sloppily_is_still_understood(written):
    """Case and stray whitespace are not a reason to reject a valid currency.

    ``"usd "`` with a trailing space was one of the strings that used to fall
    through the equality test and become so'm, so the normalisation and the
    rejection have to be the same step.
    """
    assert ai_tools._stated_currency({"price_currency": written}) in {"UZS", "USD"}


async def test_a_budget_with_no_currency_is_read_from_what_the_visitor_typed(monkeypatch):
    """The visitor's own sentence outranks the model's omission (D5).

    A model that follows max_price's "pass 1500 for 1500$" and forgets
    price_currency is a real call, not a hypothetical. Rather than assume
    so'm, the handler re-reads what the person actually wrote — "1500$" says
    which currency it is no matter what the model chose to forward.
    """
    seen = _stub_search(monkeypatch)
    ctx = _ctx(said=["Chilonzorda 1500$ ga uy kere"])
    await ai_tools._search_listings(ctx, {"district": "Chilonzor", "max_price": 1500})

    intent = seen["intent"]
    assert intent.max_price == round(1500 * _RATE)
    assert intent.price_was_usd is True


async def test_a_budget_with_no_currency_and_no_clue_is_dropped_and_confessed(monkeypatch):
    """1500 so'm is not a budget, and searching on it silently is the bug.

    With nothing in the visitor's words to settle it the handler reads the
    number as so'm — and then the plausibility floor throws it away, because
    nobody in Uzbekistan rents anything for 1 500 so'm. Both facts go into the
    note so the reply asks instead of presenting the catalogue as a match.
    """
    seen = _stub_search(monkeypatch)
    payload = await ai_tools._search_listings(_ctx(), {"district": "Chilonzor", "max_price": 1500})

    assert seen["intent"].max_price is None
    assert seen["intent"].price_was_usd is False
    assert "Confirm the currency" in payload["note"]
    assert "DROPPED" in payload["note"]


async def test_a_purchase_budget_of_a_billion_survives_the_tool_path(monkeypatch):
    """D6. ``_safe_float`` capped at 1e9 and ate every real sale budget.

    ``ListingFilters`` was widened to MAX_SALE_UZS precisely because a billion
    so'm is under the price of an ordinary Tashkent flat, but the helper this
    path used was never widened with it — so "1.5 mlrd so'mga uy sotib
    olmoqchiman" arrived correctly from the model and was thrown away here.
    """
    seen = _stub_search(monkeypatch)
    await ai_tools._search_listings(
        _ctx(),
        {"max_price": 1_500_000_000, "price_currency": "UZS", "deal_type": "SALE"},
    )
    assert seen["intent"].max_price == 1_500_000_000
    assert seen["intent"].deal_type == "SALE"


@pytest.mark.parametrize(
    "args",
    [
        # Above MAX_SALE_UZS as stated, so ``_safe_money`` drops it...
        {"max_price": 900_000_000_000, "price_currency": "UZS"},
        # ...and above it only after conversion, which only the plausibility
        # window catches. Both have to be confessed, not silently swallowed.
        {"max_price": 50_000_000, "price_currency": "USD"},
    ],
)
async def test_a_budget_the_listings_page_would_reject_never_reaches_the_search(
    monkeypatch, args
):
    """The ceiling is shared with ``parse_money`` so the two cannot disagree.

    Above MAX_PLAUSIBLE_BUDGET is a number ``ListingFilters`` would 422 on, so
    a search that accepted it could never be mirrored into the listings page
    behind the chat — and a ceiling that high matches every row, which is how
    the whole catalogue gets presented as fitting a budget.
    """
    seen = _stub_search(monkeypatch)
    payload = await ai_tools._search_listings(_ctx(), dict(args))
    assert seen["intent"].max_price is None
    assert "not a believable housing budget" in payload["note"]


async def test_the_payload_says_the_budget_back_in_the_currency_it_was_heard_in(monkeypatch):
    """M3/D7. ``price_was_usd`` had no reader, so the prompt rule had no data.

    ``label_for`` renders so'm unconditionally, so without this block the
    visitor who wrote "1500$" reads "19.1 mln so'm gacha" back — a different
    question answered — and the model is left re-deriving the currency from
    the raw message, which is the arithmetic this parameter exists to remove.
    """
    _stub_search(monkeypatch, rows=[_listing()])
    payload = await ai_tools._search_listings(
        _ctx(), {"district": "Chilonzor", "max_price": 1500, "price_currency": "USD"}
    )

    assert payload["budget"]["statedCurrency"] == "USD"
    assert payload["budget"]["maxUzs"] == round(1500 * _RATE)
    assert payload["budget"]["maxAsStated"] == 1500
    assert "Never quote so'm" in payload["budget"]["note"]


async def test_a_som_budget_is_reported_back_as_som(monkeypatch):
    """The other half: the block must not turn every budget into dollars."""
    _stub_search(monkeypatch, rows=[_listing()])
    payload = await ai_tools._search_listings(
        _ctx(), {"district": "Chilonzor", "max_price": 3_000_000, "price_currency": "UZS"}
    )
    assert payload["budget"]["statedCurrency"] == "UZS"
    assert payload["budget"]["maxAsStated"] == 3_000_000


async def test_a_search_with_no_budget_carries_no_budget_block(monkeypatch):
    """A key that is present but empty is something the model will narrate."""
    _stub_search(monkeypatch, rows=[_listing()])
    payload = await ai_tools._search_listings(_ctx(), {"district": "Chilonzor", "rooms": 2})
    assert "budget" not in payload


async def test_the_payload_lets_the_model_tell_a_weak_match_from_a_strong_one(monkeypatch):
    """R-FIX-3. ``totalMatching`` counts rows that scored at all.

    The payload used to give the model no way to tell that apart from rows
    that matched everything, so "12 apartments matching your criteria" was
    written about twelve rows whose best score was 3 out of 12. maxScore and
    bestMatchPercent are what make the count readable, and the note says so.
    """
    row = _listing()
    reports = {
        str(row.id): {
            "matched": ["district"],
            "missed": ["rooms", "max_price"],
            "score": 3,
            "maxScore": 12,
            "matchPercent": 25,
        }
    }
    _stub_search(monkeypatch, rows=[row], relaxation="PARTIAL", total=12, reports=reports)
    payload = await ai_tools._search_listings(
        _ctx(), {"district": "Chilonzor", "rooms": 2, "max_price": 3_000_000, "price_currency": "UZS"}
    )

    assert payload["totalMatching"] == 12
    assert payload["maxScore"] == 12
    assert payload["bestMatchPercent"] == 25
    assert "AT LEAST ONE criterion" in payload["note"]
    assert payload["listings"][0]["match"]["missedLabels"]


# ---------------------------------------------------------------------------
# Owner advice is measured, not imagined
# ---------------------------------------------------------------------------
def test_a_complete_listing_gets_no_invented_criticism():
    assert ai_tools._advice_for(_listing()) == []


def test_missing_photos_are_the_first_thing_said():
    advice = ai_tools._advice_for(_listing(images=[]))
    assert advice[0]["impact"] == "high"
    assert "photo" in advice[0]["issue"]


def test_a_thin_description_is_measured_in_words():
    advice = ai_tools._advice_for(_listing(description="Ijaraga beriladi"))
    assert any("2 words" in item["issue"] for item in advice)


def test_views_without_contacts_is_reported_as_the_real_problem():
    advice = ai_tools._advice_for(_listing(views_count=200, contact_count=0))
    assert any("nobody asked" in item["issue"] for item in advice)


def test_a_low_reliability_score_is_reported_as_a_confirmed_report():
    # The score no longer carries a machine verdict, so the advice must not
    # quote one: it points the owner at the administrator's decision instead.
    advice = ai_tools._advice_for(
        _listing(
            trust_score=40,
            ai_risk_reasons=["Firibgarlik — tasdiqlangan shikoyat (-25)"],
        )
    )
    hit = next(i for i in advice if "reliability percentage" in i["issue"])
    assert "40 of 100" in hit["issue"]
    assert "confirmed by an administrator" in hit["fix"]


def test_advice_is_capped_so_one_bad_listing_cannot_flood_the_prompt():
    worst = _listing(
        images=[], description="", district=None, metro_station=None, area=None,
        latitude=None, longitude=None, furnished=False, internet=False,
        air_conditioning=False, washing_machine=False, parking=False,
        trust_score=10, views_count=500, contact_count=0,
    )
    assert len(ai_tools._advice_for(worst)) <= 6


# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("word", ["ha", "Ha.", "mayli", "yes", "да", "ok", "tasdiqlayman"])
def test_a_plain_yes_is_read_as_consent(word):
    assert ai_agent.read_confirmation(word) is True


@pytest.mark.parametrize(
    "word",
    [
        "yo'q",        # ASCII apostrophe, as people type it
        "yo‘q",   # the typographic one the interface's own button uses
        "yo’q",
        "Yoʻq",
        "yoq",         # no apostrophe at all
        "нет", "cancel", "bekor qil", "no",
    ],
)
def test_a_plain_no_is_read_as_refusal(word):
    """Uzbek has several apostrophes and the button uses a different one than
    the keyboard. All of them have to mean no, or the button does nothing."""
    assert ai_agent.read_confirmation(word) is False


@pytest.mark.parametrize(
    "text",
    [
        "ha lekin avval narxini ko'rsat va keyin o'ylab ko'raman rostdan ham kerakmi",
        "Chilonzorda 2 xonali kvartira kerak",
        "",
        "haqiqatan ham shu tumanda boshqa variant bormi",
    ],
)
def test_anything_that_is_not_an_answer_is_not_taken_as_one(text):
    """A sentence that merely starts with "ha-" must not delete something."""
    assert ai_agent.read_confirmation(text) is None


def test_the_confirmation_question_is_written_in_every_language():
    for language in ("uz", "ru", "en"):
        question = ai_agent.confirmation_question(
            "remove_favorite", {}, language
        )
        assert question and question.endswith("?")


def test_destructive_and_outward_facing_tools_ask_first():
    assert ai_tools.TOOLS["remove_favorite"].needs_confirmation
    assert ai_tools.TOOLS["request_support_callback"].needs_confirmation
    # A search changes nothing and must never interrupt the conversation.
    assert not ai_tools.TOOLS["search_listings"].needs_confirmation


# ---------------------------------------------------------------------------
# Lead capture — the one handoff that must not stop and ask
# ---------------------------------------------------------------------------
def test_lead_capture_does_not_stop_to_ask_permission():
    """Handing over a number IS the consent.

    The loop only pauses on a tool flagged ``needs_confirmation``. Flagging
    this one would cost a whole round trip asking "shall I send it?" of
    somebody who has just answered exactly that question, and that extra beat
    is where people close the chat.
    """
    assert not ai_tools.TOOLS["capture_lead"].needs_confirmation


def test_lead_capture_insists_on_a_number():
    """A lead with no way to call it back is not a lead."""
    assert ai_tools.TOOLS["capture_lead"].parameters["required"] == ["phone"]


async def test_a_guest_lead_without_a_name_is_refused():
    """Support cannot open a conversation with an anonymous number."""
    ctx = _ctx(said=["raqamim 998901234567"])
    with pytest.raises(ToolError) as exc:
        await ai_tools._capture_lead(ctx, {"phone": "998901234567"})
    assert "not signed in" in str(exc.value)


async def test_a_malformed_number_never_becomes_a_lead():
    """The model cannot check a number; a mistyped digit is a call that
    never arrives and nothing downstream would ever notice."""
    with pytest.raises(ToolError) as exc:
        await ai_tools._capture_lead(_ctx(), {"phone": "12", "name": "Aziz"})
    assert "not a valid" in str(exc.value)


def test_the_confirmation_sentence_exists_in_every_language():
    """The one promise in this conversation that has to read the same twice.

    The model is told to say it word for word, so a language missing from
    here would have it improvising a timeframe nobody agreed to.
    """
    assert set(ai_tools.LEAD_CONFIRMATION) == {"uz", "ru", "en"}
    assert "rahmat" in ai_tools.LEAD_CONFIRMATION["uz"]
    assert "Спасибо" in ai_tools.LEAD_CONFIRMATION["ru"]
    assert "Thank you" in ai_tools.LEAD_CONFIRMATION["en"]


# ---------------------------------------------------------------------------
# L-FIX-1 — a promise is only allowed when somebody was actually paged
#
# This is the original production failure wearing a different face. Telegram
# refuses the send, nobody is paged, and the visitor is told support has their
# details and will call shortly. They stop looking; nobody calls; the only
# trace is one log line. The rest of the file tests refusals before the send —
# these test what is said after one that did not happen.
# ---------------------------------------------------------------------------
def _stub_telegram(monkeypatch, *, ok: bool, detail: str = ""):
    """Point the real send at a fake Telegram and count what leaves.

    ``_capture_lead`` goes through ``telegram.send_lead_notification``
    deliberately, so patching the transport rather than the sender keeps the
    audit row, the configuration check and the delivery boolean on the path
    under test. Returns the list of texts that reached ``_post``.
    """
    from app.core import audit
    from app.services import telegram

    sent: list[str] = []

    async def fake_post(*, token, chat_id, text):
        sent.append(text)
        return ok, detail

    async def fake_record(*args, **kwargs):
        return None

    monkeypatch.setattr(telegram, "_post", fake_post)
    monkeypatch.setattr(
        telegram,
        "settings",
        types.SimpleNamespace(
            TELEGRAM_BOT_TOKEN="1234:test", telegram_chat_id="-1001234567890"
        ),
    )
    monkeypatch.setattr(audit, "record", fake_record)
    return sent


async def test_a_rejected_telegram_send_never_promises_a_callback(monkeypatch):
    """"chat not found" must not come out as "we will call you shortly".

    Reproduced by making ``_post`` answer exactly what a group id that lost
    its leading minus answers. The lead is still saved and still audited, so
    the visitor is told the truth about that and nothing about a timeframe.
    """
    _stub_telegram(monkeypatch, ok=False, detail="Bad Request: chat not found")
    ctx = _ctx(db=_FakeDb(), said=["raqamim 998901234567"])

    result = await ai_tools._capture_lead(ctx, {"phone": "998901234567", "name": "Aziz"})

    assert result["deliveredToTeam"] is False
    assert result["sayToVisitor"] == ai_tools.LEAD_CONFIRMATION_UNDELIVERED["uz"]
    assert result["sayToVisitor"] != ai_tools.LEAD_CONFIRMATION["uz"]
    # Written down, not only logged: the operator desk shows this as a warning
    # pill, which is the only way an undelivered lead ever gets acted on.
    assert ctx.session.lead_delivered is False
    assert ctx.session.lead_phone == "+998901234567"


async def test_a_delivered_lead_gets_the_sentence_that_promises_the_call(monkeypatch):
    """The negative test above must fail for the right reason.

    Without this, ``_lead_sentence`` could return the cautious wording always
    and the test above would still pass while every visitor was under-served.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["raqamim 998901234567"])

    result = await ai_tools._capture_lead(ctx, {"phone": "998901234567", "name": "Aziz"})

    assert result["deliveredToTeam"] is True
    assert result["sayToVisitor"] == ai_tools.LEAD_CONFIRMATION["uz"]
    assert ctx.session.lead_delivered is True
    assert len(sent) == 1


def test_the_undelivered_sentence_exists_in_every_language_and_promises_no_time():
    """It is the fallback for a failure, so a missing language is the failure.

    A language absent from here would fall back to Uzbek for a Russian
    speaker at the exact moment the conversation has already gone wrong.
    """
    assert set(ai_tools.LEAD_CONFIRMATION_UNDELIVERED) == {"uz", "ru", "en"}
    assert ai_tools.LEAD_CONFIRMATION_UNDELIVERED["uz"] == (
        "Ma'lumotlaringizni saqlab qo'ydik. Jamoamiz ularni ko'rib chiqib siz "
        "bilan bog'lanadi. Murojaatingiz uchun rahmat!"
    )
    # No wording anywhere in the table may commit to a time, because nothing
    # downstream is going to keep it.
    for language, sentence in ai_tools.LEAD_CONFIRMATION_UNDELIVERED.items():
        for timeframe in ("yaqin orada", "ближайшее время", "shortly"):
            assert timeframe not in sentence, language


@pytest.mark.parametrize("language", ["uz", "ru", "en"])
def test_the_sentence_chosen_follows_delivery_in_every_language(language):
    assert ai_tools._lead_sentence(language, True) == ai_tools.LEAD_CONFIRMATION[language]
    assert (
        ai_tools._lead_sentence(language, False)
        == ai_tools.LEAD_CONFIRMATION_UNDELIVERED[language]
    )


# ---------------------------------------------------------------------------
# L-FIX-2 — one lead per session, not one per tool call
# ---------------------------------------------------------------------------
async def test_two_capture_calls_in_one_turn_page_the_team_once(monkeypatch):
    """``run_turn`` executes every entry in ``tool_calls``.

    One assistant message carrying two ``capture_lead`` calls used to page the
    team twice for one person, and the second page lands while an operator is
    already dialling the first. The visitor still gets their confirmation both
    times — the answer is the same, the notification is not repeated.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["raqamim 998901234567"])
    args = {"phone": "+998 90 123 45 67", "name": "Aziz"}

    first = await ai_tools._capture_lead(ctx, args)
    second = await ai_tools._capture_lead(ctx, args)

    assert len(sent) == 1
    assert second["alreadyRecorded"] is True
    assert second["sayToVisitor"] == first["sayToVisitor"]


async def test_a_repeat_of_an_undelivered_lead_repeats_the_cautious_sentence(monkeypatch):
    """The second call must not quietly upgrade a promise the first refused.

    Returning early is only safe if it returns the *same* answer; a dedupe
    that defaulted to the optimistic wording would reintroduce L-FIX-1 on the
    second call of the very turn that failed on the first.
    """
    _stub_telegram(monkeypatch, ok=False, detail="Unauthorized")
    ctx = _ctx(db=_FakeDb(), said=["raqamim 998901234567"])
    args = {"phone": "998901234567", "name": "Aziz"}

    await ai_tools._capture_lead(ctx, args)
    second = await ai_tools._capture_lead(ctx, args)

    assert second["deliveredToTeam"] is False
    assert second["sayToVisitor"] == ai_tools.LEAD_CONFIRMATION_UNDELIVERED["uz"]


async def test_a_different_number_in_the_same_session_is_a_new_lead(monkeypatch):
    """Correcting a mistyped digit is not a duplicate.

    The dedupe is on the number, not on the session, because the commonest
    reason to call this twice is that the first number was wrong — and that
    lead has to reach the team.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["998901234567 yoq, 998935554433"])

    await ai_tools._capture_lead(ctx, {"phone": "998901234567", "name": "Aziz"})
    await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})

    assert len(sent) == 2


# ---------------------------------------------------------------------------
# L-FIX-3 — the number has to be the visitor's own
# ---------------------------------------------------------------------------
async def test_a_number_lifted_from_a_listing_is_not_the_visitors(monkeypatch):
    """Listing descriptions reach the model, so landlords' numbers do too.

    A landlord's number typed into a description can be picked out of the
    context and paged as though the visitor had offered it: a stranger gets a
    support call about a flat they never advertised for, and the person who
    actually wanted one is never called.
    """
    _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["Chilonzorda arzon uy bormi?"])

    with pytest.raises(ToolError) as exc:
        await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})
    assert "did not come from the visitor" in str(exc.value)


@pytest.mark.parametrize(
    "typed",
    [
        "mening raqamim +998 93 555 44 33",
        "93 555 44 33 ga qo'ng'iroq qiling",
        "998935554433",
        "(93) 555-44-33",
    ],
)
async def test_the_number_the_visitor_typed_is_accepted_however_they_spaced_it(
    monkeypatch, typed
):
    """People write a phone number a dozen ways and all of them are the same.

    The comparison is on digits alone for exactly this reason; a guard that
    demanded one spelling would refuse most real visitors and teach the model
    to stop calling the tool.
    """
    _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["Chilonzorda uy kere", typed])

    result = await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})
    assert result["recorded"] is True


async def test_a_signed_in_visitors_own_account_number_is_always_theirs(monkeypatch):
    """They asked us to use the number on their account, and never typed it.

    Refusing that would break the commonest polite case — "use the number you
    already have" — so the account number is a second source of truth beside
    the transcript.
    """
    _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(viewer=_user(), db=_FakeDb(), said=["iltimos qo'ng'iroq qiling"])

    result = await ai_tools._capture_lead(ctx, {"phone": "998901234567"})
    assert result["recorded"] is True


async def test_a_caller_that_supplied_no_transcript_is_refused_not_trusted(monkeypatch):
    """The guard fails closed. An empty transcript proves nothing.

    This is the round-3 regression itself: the field defaulted to ``()``,
    ``run_turn`` never passed it, and "unknown" was read as "fine" — so the
    guard was live in the source and dead in production, and a landlord's
    number went through exactly as it had before. Refusing here means that the
    day somebody adds a second caller and forgets the transcript, lead capture
    breaks loudly instead of paging strangers quietly.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb())
    assert ctx.visitor_messages == ()

    with pytest.raises(ToolError) as exc:
        await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})
    assert "did not come from the visitor" in str(exc.value)
    assert sent == []
    assert ctx.session.lead_phone is None


async def test_the_account_number_is_the_one_way_past_an_empty_transcript(monkeypatch):
    """The narrow exemption, written down so it stays narrow.

    "Use the number you already have" is a real and polite request, and the
    person making it is signed in — their account is a second source of truth
    beside the transcript. It is the only one: every other number has to have
    been typed by the visitor.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(viewer=_user(), db=_FakeDb())
    assert ctx.visitor_messages == ()

    result = await ai_tools._capture_lead(ctx, {"phone": "998901234567"})
    assert result["recorded"] is True
    assert len(sent) == 1


# ---------------------------------------------------------------------------
# L-FIX-3 where it actually broke: the guard is only as good as its caller
#
# The rule above was written correctly in round 2 and never once ran in
# production, because ``run_turn`` — the only place a ToolContext is built
# outside tests — did not pass the transcript. These three tests are about
# the wiring rather than the rule.
# ---------------------------------------------------------------------------
async def test_run_turn_hands_the_guard_what_the_visitor_typed_this_turn(
    scripted, monkeypatch
):
    """The visitor's own words reach the tools, and only theirs.

    Two things are asserted together because they broke together: the current
    message has to be in there — it is not in ``history`` yet, and the
    commonest capture of all is somebody typing their number and the model
    calling the tool in the same turn — and an operator's turn must not be,
    since ``ai.py`` relabels those as assistant rows and an operator is not
    the visitor.
    """
    seen: list = []
    real_execute = ai_tools.execute

    async def spy(ctx, name, args):
        seen.append(ctx)
        return await real_execute(ctx, name, args)

    monkeypatch.setattr(ai_agent.ai_tools, "execute", spy)
    _stub_telegram(monkeypatch, ok=True)
    scripted(
        _wants("capture_lead", {"phone": "998935554433", "name": "Aziz"}),
        {"role": "assistant", "content": "Qabul qilindi."},
    )

    await ai_agent.run_turn(
        db=_LoopDb(), viewer=None, session=_session(),
        message="raqamim +998 93 555 44 33, ismim Aziz",
        history=[
            {"role": "user", "content": "Chilonzorda uy bormi?"},
            {
                "role": "assistant",
                "content": "[Uyiz operator]: 998 99 000 11 22 ga qo'ng'iroq qiling",
            },
        ],
        language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert seen, "the tool never ran"
    assert seen[0].visitor_messages == (
        "Chilonzorda uy bormi?",
        "raqamim +998 93 555 44 33, ismim Aziz",
    )


async def test_the_number_typed_in_the_same_turn_is_captured(scripted, monkeypatch):
    """The commonest lead there is, driven end to end.

    The visitor types their number and the model calls the tool before that
    message has ever been part of ``history``. A guard fed only the history
    would refuse exactly this, which is a worse failure than the hole it
    closes — so it is pinned here and not left to the wiring test above.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    session = _session()
    scripted(
        _wants("capture_lead", {"phone": "998935554433", "name": "Aziz"}),
        {"role": "assistant", "content": "Qabul qilindi."},
    )

    outcome = await ai_agent.run_turn(
        db=_LoopDb(), viewer=None, session=session,
        message="Menga bog'laning, raqamim 93 555 44 33, ismim Aziz",
        history=[], language="uz", user_name=None, is_first_turn=False,
        shown_ids=[],
    )

    assert "capture_lead" in outcome.actions
    assert session.lead_phone == "+998935554433"
    assert len(sent) == 1


async def test_a_landlords_number_from_a_listing_never_pages_the_team(
    scripted, monkeypatch
):
    """The attack the reviewer reproduced, run through the real caller.

    A publisher writes their number into a description, the description
    reaches the model, and the model offers it to ``capture_lead`` as though
    the visitor had given it. Before the transcript was wired in this paged
    the team with a stranger's number and wrote it onto the session; now the
    refusal goes back to the model as a sentence it can act on.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    session = _session()
    replies = scripted(
        _wants("capture_lead", {"phone": "998935554433", "name": "Aziz"}),
        {"role": "assistant", "content": "Raqamingizni yozib bering."},
    )

    outcome = await ai_agent.run_turn(
        db=_LoopDb(), viewer=None, session=session,
        message="Chilonzorda arzon uy bormi?",
        history=[], language="uz", user_name=None, is_first_turn=False,
        shown_ids=[],
    )

    assert sent == [], "a stranger was paged as the visitor"
    assert session.lead_phone is None
    assert "capture_lead" not in outcome.actions
    tool_replies = [m for m in replies[1]["messages"] if m.get("role") == "tool"]
    assert "did not come from the visitor" in tool_replies[0]["content"]


# ---------------------------------------------------------------------------
# L-FIX-2, second half — a correction must not destroy the first lead
#
# Two calls with different numbers used to overwrite lead_name/lead_phone and
# page again, and the first person then existed nowhere the panel can read:
# the session holds one lead, and the audit row carried no phone at all. A
# second, different number is a correction, and a correction is additive.
# ---------------------------------------------------------------------------
def _stub_audit(monkeypatch):
    """Collect the lead rows ``_capture_lead`` writes.

    Only the lead ones: the Telegram send audits itself as TELEGRAM_NOTIFIED
    through the same function, and those rows are not what is under test.
    """
    from app.core import audit
    from app.models.enums import AuditAction

    rows: list[dict] = []

    async def fake_record(db, action, **kwargs):
        if action == AuditAction.AI_LEAD_CAPTURED:
            rows.append({"action": action, **kwargs})

    monkeypatch.setattr(audit, "record", fake_record)
    return rows


async def test_a_corrected_number_pages_again_and_says_it_is_a_correction(monkeypatch):
    """The team must not get two leads with no way to tell them apart.

    An operator reading two "YANGI MUROJAAT" pages a second apart dials both,
    and one of those two people has no idea why. The second page names the
    number it replaces, so the desk closes the first instead of chasing it.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["998901234567 yoq, 998935554433"])

    await ai_tools._capture_lead(ctx, {"phone": "998901234567", "name": "Aziz"})
    second = await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})

    assert len(sent) == 2
    assert second["corrected"] is True
    assert second["correctedFrom"] == "+998 90 123 45 67"
    assert "TUZATISH" in sent[1]
    assert "+998 90 123 45 67" in sent[1], "the page never named the number it replaces"


async def test_the_first_number_survives_the_correction_on_the_session(monkeypatch):
    """The panel reads four columns; a bare overwrite loses a whole person.

    ``AdminAiSessionRow`` shows lead_name, lead_phone, lead_note and the
    timestamp, so a second number that simply replaced the first left the
    first visitor uncontactable from anywhere an operator can look. The note
    is where the replaced lead goes: it is the one column that can hold it and
    it is already on the row.
    """
    _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["998901234567 yoq, 998935554433"])

    await ai_tools._capture_lead(
        ctx, {"phone": "998901234567", "name": "Aziz", "note": "Chilonzor, 2 xona"}
    )
    await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})

    assert ctx.session.lead_phone == "+998935554433"
    assert "+998 90 123 45 67" in ctx.session.lead_note
    assert "Chilonzor, 2 xona" in ctx.session.lead_note


async def test_both_numbers_are_recoverable_from_the_audit_trail(monkeypatch):
    """The durable record, since the session only has room for one lead.

    The audit row used to carry the name and nothing else, so a corrected
    lead was gone from every store the company keeps. Each capture now writes
    its own phone, and a correction writes the one it replaced beside it.
    """
    _stub_telegram(monkeypatch, ok=True)
    rows = _stub_audit(monkeypatch)
    ctx = _ctx(db=_FakeDb(), said=["998901234567 yoq, 998935554433"])

    await ai_tools._capture_lead(ctx, {"phone": "998901234567", "name": "Aziz"})
    await ai_tools._capture_lead(ctx, {"phone": "998935554433", "name": "Aziz"})

    assert [r["meta"]["phone"] for r in rows] == [
        "+998 90 123 45 67",
        "+998 93 555 44 33",
    ]
    assert rows[1]["meta"]["correctionOf"] == "+998 90 123 45 67"


async def test_a_correction_may_reuse_the_name_already_given(monkeypatch):
    """A corrected number with no name must not be refused.

    The model has already sent the name once this session; making it repeat
    itself is how a corrected number ends up reaching nobody at all.
    """
    sent = _stub_telegram(monkeypatch, ok=True)
    ctx = _ctx(db=_FakeDb(), said=["998901234567 yoq, 998935554433"])

    await ai_tools._capture_lead(ctx, {"phone": "998901234567", "name": "Aziz"})
    second = await ai_tools._capture_lead(ctx, {"phone": "998935554433"})

    assert second["name"] == "Aziz"
    assert len(sent) == 2


# ---------------------------------------------------------------------------
# Conversation memory
# ---------------------------------------------------------------------------
def test_a_short_conversation_is_sent_whole():
    history = [{"role": "user", "content": f"m{i}"} for i in range(4)]
    recent, summary = ai_agent._history_messages(history)
    assert len(recent) == 4
    assert summary is None


def test_a_long_conversation_keeps_the_recent_turns_and_folds_the_rest():
    history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg{i}"}
        for i in range(30)
    ]
    recent, summary = ai_agent._history_messages(history)
    assert len(recent) == ai_agent.RECENT_TURNS
    assert recent[-1]["content"] == "msg29"
    # The criteria live in what the visitor said, so those are what survive.
    assert "msg0" in summary
    assert len(summary) <= 600


def test_one_enormous_message_cannot_blow_the_context():
    history = [{"role": "user", "content": "x" * 50_000}]
    recent, _ = ai_agent._history_messages(history)
    assert len(recent[0]["content"]) <= 1500


# ---------------------------------------------------------------------------
# The instruction itself
# ---------------------------------------------------------------------------
def test_the_prompt_tells_the_model_it_is_talking_to_a_guest():
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=True, summary=None
    )
    assert "NOT signed in" in prompt
    assert "never pretend it was" in prompt


def test_the_prompt_names_the_company_on_a_first_turn():
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=True, summary=None
    )
    assert "Uyiz kompaniyasining AI yordamchisiman" in prompt


def test_a_later_turn_is_told_not_to_greet_again():
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert "not greet or introduce yourself again" in prompt


def test_an_owner_is_announced_as_one():
    prompt = ai_agent.build_system_prompt(
        language="uz",
        viewer=_user(UserRole.OWNER.value),
        user_name="Aziz",
        is_first_turn=False,
        summary=None,
    )
    assert "property OWNER" in prompt


@pytest.mark.parametrize("language,expected", [("uz", "Uzbek"), ("ru", "Russian"), ("en", "English")])
def test_the_reply_language_is_stated_explicitly(language, expected):
    prompt = ai_agent.build_system_prompt(
        language=language, viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert f"Write in {expected}" in prompt


def test_the_prompt_forbids_inventing_inventory_and_leaking_numbers():
    # Flattened: the prompt is hard-wrapped, so a rule can fall across a line
    # break and a literal search would miss a rule that is present.
    prompt = " ".join(
        ai_agent.build_system_prompt(
            language="uz", viewer=None, user_name=None,
            is_first_turn=False, summary=None,
        ).split()
    ).lower()
    assert "inventing an apartment" in prompt
    assert "never state anybody's phone number" in prompt
    assert "internal company matters" in prompt
    assert "never transfer money before seeing the apartment" in prompt


def test_an_earlier_summary_is_carried_into_the_prompt():
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=False,
        summary="Chilonzor | 2 xona | 500$",
    )
    assert "Chilonzor | 2 xona | 500$" in prompt


def test_the_prompt_refuses_the_off_topic_question_in_three_languages():
    """A refusal the model writes itself drifts into answering the question.

    "One warm sentence" is read by a model as licence to hedge, so the
    sentence is written out here and the model only has to pick a language.
    """
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert (
        "Kechirasiz, bu savol Uyiz faoliyatidan tashqarida. Men uy-joy — "
        "ijara, xarid va sotuv bo'yicha yordam beraman. Shu yo'nalishdagi "
        "savolingiz bo'lsa, bajonidil javob beraman."
    ) in prompt
    assert (
        "Извините, этот вопрос вне сферы Uyiz. Я помогаю с жильём — арендой, "
        "покупкой и продажей недвижимости. Если у вас есть вопрос по этой "
        "теме, с радостью помогу."
    ) in prompt
    assert (
        "I'm sorry — that's outside what Uyiz covers. I help with housing: "
        "renting, buying and selling property. If you have a question in "
        "that area, I'd be glad to help."
    ) in prompt


def test_the_prompt_keeps_company_internals_private_in_three_languages():
    """Headcount, revenue and how moderation decides are asked for often,
    and rephrasing the question is the usual way in."""
    prompt = ai_agent.build_system_prompt(
        language="ru", viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert (
        "Bu — kompaniyaning ichki ma'lumoti, shuning uchun uni oshkor qila "
        "olmayman. Ammo uy-joy tanlash yoki e'lonlar bo'yicha savolingiz "
        "bo'lsa, bajonidil yordam beraman."
    ) in prompt
    assert (
        "Это внутренняя информация компании, и я не могу её раскрывать. Но "
        "если у вас есть вопрос по жилью или объявлениям, буду рад помочь."
    ) in prompt
    assert (
        "That's the company's internal information, so I'm not able to share "
        "it. If you have a question about housing or listings, though, I'd be "
        "glad to help."
    ) in prompt


def test_the_prompt_names_three_conveniences():
    """Three, named, and never a fourth — otherwise "why Uyiz?" is answered
    with invented features. Flattened, because the list is hard-wrapped."""
    prompt = " ".join(
        ai_agent.build_system_prompt(
            language="uz", viewer=None, user_name=None,
            is_first_turn=False, summary=None,
        ).split()
    ).lower()
    assert "what uyiz gives you" in prompt
    assert "this assistant" in prompt
    assert "the map" in prompt
    assert "free and it is transparent" in prompt


def test_the_prompt_tells_the_model_to_answer_property_advice():
    """"I can only search listings" is the wrong answer to "how do I buy"."""
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert "ADVICE ABOUT PROPERTY" in prompt


def test_the_prompt_forbids_asking_permission_before_capturing_a_lead():
    """The tool does not stop to ask, so the prompt must not either."""
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert "Do not ask permission to send it" in prompt


def test_the_prompt_separates_renting_from_buying():
    """A rental is not a cheaper version of a sale.

    Flattened: the prompt is hard-wrapped, so this rule falls across a line
    break and a literal search would miss a rule that is present.
    """
    prompt = " ".join(
        ai_agent.build_system_prompt(
            language="uz", viewer=None, user_name=None,
            is_first_turn=False, summary=None,
        ).split()
    )
    assert "never offer a rental to somebody who asked to buy" in prompt


def test_the_prompt_refuses_to_widen_a_budget_silently():
    """The reported bug: someone asked for a home at 1500$ and got everything.

    Reading the number is the parser's job. This is the other half: when
    nothing is inside the budget, saying so beats quietly showing what is
    above it, because a listing over the ceiling presented without comment
    reads as an answer to a question nobody asked.
    """
    prompt = " ".join(
        ai_agent.build_system_prompt(
            language="uz", viewer=None, user_name=None,
            is_first_turn=False, summary=None,
        ).split()
    )
    assert "Never quietly widen a budget" in prompt


def test_the_reply_ceiling_is_a_chat_bubble():
    """"ai juda kop yozvordi" -- the other half of the same report.

    The prompt asks for three sentences; the ceiling is what holds when the
    model ignores it. A phone screen is a bubble, not a document, and the
    listing cards underneath already carry the photo, district, rooms and
    price the prose kept repeating.
    """
    prompt = ai_agent.build_system_prompt(
        language="uz", viewer=None, user_name=None, is_first_turn=False, summary=None
    )
    assert ai_agent.MAX_REPLY_CHARS <= 700
    assert "Under 400 characters" in prompt


# ---------------------------------------------------------------------------
# Degrading safely
# ---------------------------------------------------------------------------
async def test_with_no_api_key_the_agent_declines_rather_than_guessing():
    """The router then falls through to the deterministic path."""
    from app.core.config import settings

    original = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = ""
    try:
        outcome = await ai_agent.run_turn(
            db=None, viewer=None, session=_session(), message="uy kerak",
            history=[], language="uz", user_name=None, is_first_turn=True,
            shown_ids=[],
        )
    finally:
        settings.OPENAI_API_KEY = original
    assert outcome.reply is None
    assert outcome.rows == []


def test_every_tool_declares_what_the_chat_shows_while_it_runs():
    for name, tool in ai_tools.TOOLS.items():
        assert tool.progress or name in {"get_support_contacts"}, name
        assert tool.description.strip(), name
        assert tool.parameters["type"] == "object", name
