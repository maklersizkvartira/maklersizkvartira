"""The agent loop driven by a scripted model.

The provider is replaced here, not the tools: the tools run for real against
stubbed rows, so what is under test is the loop's own decisions — when it
stops, when it asks before acting, what it does with a tool that refuses, and
what survives when the provider dies halfway through a turn.

Those are exactly the paths that cannot be checked against the real API
without spending money and accepting a different answer every run.
"""

from __future__ import annotations

import json
import types
import uuid

import pytest

from app.core.config import settings
from app.models.enums import UserRole
from app.services import ai_agent


@pytest.fixture(autouse=True)
def clean_tables():
    """No database in this module — shadows the Postgres fixture in conftest."""
    yield


# ---------------------------------------------------------------------------
# Doubles
# ---------------------------------------------------------------------------
def _user(role: str = UserRole.STUDENT.value):
    return types.SimpleNamespace(
        id=uuid.uuid4(), role=role, name="Aziz", language="uz", phone="998901234567"
    )


def _session():
    return types.SimpleNamespace(
        session_key="k" * 32, last_intent=None, agent_state=None
    )


def _listing(**over):
    base = dict(
        id=uuid.uuid4(), title="Chilonzorda 2 xonali", description="x " * 60,
        district="Chilonzor", region="Toshkent shahri", rooms=2, price=3_000_000,
        currency="UZS", area=54.0, floor=3, total_floors=9,
        metro_station="Chilonzor", metro_distance_minutes=7,
        furnished=True, internet=True, air_conditioning=True,
        washing_machine=True, parking=True, pets_allowed=False,
        is_roommate=False, trust_score=85, risk_score=5, ai_risk_reasons=[],
        safety_badges=[], images=["a", "b", "c", "d"], status="APPROVED",
        views_count=10, favorites_count=2, contact_count=1, is_featured=False,
        moderation_note=None, published_at=None, latitude=41.3, longitude=69.2,
        university_name=None, university_distance_minutes=None,
        roommate_gender=None, deposit_price=None, utilities_included=False,
        property_type="APARTMENT", owner_id=uuid.uuid4(), is_public=True,
    )
    base.update(over)
    return types.SimpleNamespace(**base)


def _assistant(text: str) -> dict:
    return {"role": "assistant", "content": text}


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
    """Queue model replies; hand back the requests the loop actually made."""
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    sent: list[dict] = []

    def install(*replies):
        queue = list(replies)

        async def fake_call(*, model, messages, tools, temperature):
            sent.append({"model": model, "messages": list(messages), "tools": tools})
            return queue.pop(0) if queue else _assistant("fallback")

        monkeypatch.setattr(ai_agent, "_call", fake_call)
        return sent

    return install


@pytest.fixture
def stub_search(monkeypatch):
    """Let the search tool return rows without a database behind it."""

    def install(rows, relaxation="EXACT", district="Chilonzor", total=None):
        async def fake(db, intent, *, limit=5):
            return (
                list(rows),
                relaxation,
                district,
                total if total is not None else len(rows),
            )

        monkeypatch.setattr(ai_agent.ai_tools.shield_ai, "search_for_intent", fake)

    return install


# ---------------------------------------------------------------------------
# The ordinary turn
# ---------------------------------------------------------------------------
async def test_a_search_turn_runs_the_tool_and_answers_from_its_rows(
    scripted, stub_search
):
    rows = [_listing(), _listing()]
    stub_search(rows)
    scripted(
        _wants("search_listings", {"district": "Chilonzor", "rooms": 2}),
        _assistant("Chilonzorda 2 ta variant bor."),
    )

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(),
        message="Chilonzorda 2 xonali kvartira kerak",
        history=[], language="uz", user_name=None, is_first_turn=True, shown_ids=[],
    )

    assert outcome.reply == "Chilonzorda 2 ta variant bor."
    assert [r.id for r in outcome.rows] == [r.id for r in rows]
    # The rows stay addressable next turn, and the listings page gets filters.
    assert outcome.shown_ids == [str(r.id) for r in rows]
    assert outcome.last_search["district"] == "Chilonzor"
    # A search changes nothing, so there is nothing to badge as done.
    assert outcome.actions == []


async def test_the_tools_offered_depend_on_who_is_asking(scripted):
    """An owner is offered owner tools; a guest is never shown them."""
    sent = scripted(_assistant("Salom."), _assistant("Salom."))

    await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="salom",
        history=[], language="uz", user_name=None, is_first_turn=True, shown_ids=[],
    )
    guest = {t["function"]["name"] for t in (sent[0]["tools"] or [])}

    await ai_agent.run_turn(
        db=None, viewer=_user(UserRole.OWNER.value), session=_session(),
        message="salom", history=[], language="uz", user_name="Aziz",
        is_first_turn=True, shown_ids=[],
    )
    owner = {t["function"]["name"] for t in (sent[1]["tools"] or [])}

    assert "my_listings" not in guest
    assert "my_listings" in owner
    assert "search_listings" in guest


async def test_the_reasoning_tier_is_used_only_after_a_tool_has_returned(
    scripted, stub_search, monkeypatch
):
    monkeypatch.setattr(settings, "OPENAI_MODEL", "cheap-model")
    monkeypatch.setattr(settings, "OPENAI_MODEL_SMART", "strong-model")
    stub_search([_listing()])
    sent = scripted(
        _wants("search_listings", {"district": "Chilonzor"}),
        _assistant("Mana."),
    )

    await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="Chilonzor",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert sent[0]["model"] == "cheap-model"   # routing: which tool?
    assert sent[1]["model"] == "strong-model"  # reasoning over what came back


# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
async def test_an_irreversible_action_asks_before_it_runs(scripted):
    scripted(_wants("request_support_callback", {"phone": "998901234567"}))

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(),
        message="Menga qo'ng'iroq qiling, raqamim 998901234567",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert outcome.pending == {
        "name": "request_support_callback",
        "arguments": {"phone": "998901234567"},
    }
    assert outcome.reply == ai_agent.confirmation_question(
        "request_support_callback", {}, "uz"
    )
    # Nothing happened yet — that is the whole point.
    assert outcome.actions == []


async def test_a_confirmed_callback_reaches_the_support_team(scripted, monkeypatch):
    delivered: list[str] = []

    async def fake_send(db, text, *, context="notification"):
        delivered.append(text)
        return True

    monkeypatch.setattr("app.services.telegram.send_message", fake_send)
    sent = scripted(_assistant("Raqamingiz qabul qilindi, tez orada bog'lanamiz."))

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="ha",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
        approved={
            "name": "request_support_callback",
            "arguments": {"phone": "998901234567"},
        },
    )

    assert "request_support_callback" in outcome.actions
    assert delivered, "support was never told"
    assert "998 90 123 45 67" in delivered[0]
    # The model wrote its reply already knowing the result.
    assert "carried out" in sent[0]["messages"][-1]["content"]


async def test_a_malformed_number_is_refused_before_anyone_is_paged(
    scripted, monkeypatch
):
    delivered: list[str] = []

    async def fake_send(db, text, *, context="notification"):
        delivered.append(text)
        return True

    monkeypatch.setattr("app.services.telegram.send_message", fake_send)
    sent = scripted(_assistant("Raqamni qayta yozib bering."))

    await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="ha",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
        approved={"name": "request_support_callback", "arguments": {"phone": "12"}},
    )

    assert delivered == []
    assert "not a valid" in sent[0]["messages"][-1]["content"]


async def test_a_refused_action_is_explained_to_the_model_not_swallowed(scripted):
    sent = scripted(_assistant("Yaxshi, bekor qildim."))

    await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="yoq",
        history=[], language="uz", user_name=None, is_first_turn=False,
        shown_ids=[], declined={"name": "remove_favorite", "arguments": {}},
    )

    notes = [m["content"] for m in sent[0]["messages"] if m["role"] == "system"]
    assert any("declined the action" in note for note in notes)


# ---------------------------------------------------------------------------
# When something goes wrong
# ---------------------------------------------------------------------------
async def test_a_tool_refusal_becomes_an_honest_sentence_not_an_exception(scripted):
    """A guest asking to save a listing must be told to sign in."""
    sent = scripted(
        _wants("add_favorite", {"listing_ref": 1}),
        _assistant("Buning uchun avval tizimga kiring."),
    )

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="sevimlilarga qosh",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert outcome.reply == "Buning uchun avval tizimga kiring."
    tool_replies = [m for m in sent[1]["messages"] if m.get("role") == "tool"]
    assert "signed in" in tool_replies[0]["content"]
    assert outcome.actions == []


async def test_a_model_that_only_calls_tools_still_ends_with_words(
    scripted, stub_search, monkeypatch
):
    monkeypatch.setattr(settings, "AI_MAX_TOOL_STEPS", 2)
    stub_search([_listing()])
    sent = scripted(
        _wants("search_listings", {"district": "Chilonzor"}, "a"),
        _wants("search_listings", {"district": "Yunusobod"}, "b"),
        _assistant("Mana topganlarim."),
    )

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="qidir",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert outcome.reply == "Mana topganlarim."
    # The budget is spent by withdrawing the tools, which is what forces an
    # answer rather than a third round of searching.
    assert sent[-1]["tools"] is None
    assert len(sent) == 3


async def test_a_provider_failure_mid_turn_keeps_what_the_tools_already_did(
    stub_search, monkeypatch
):
    """The search really ran. Only the prose is missing, and the router writes it."""
    rows = [_listing()]
    stub_search(rows)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    queue = [_wants("search_listings", {"district": "Chilonzor"}), None]

    async def flaky(*, model, messages, tools, temperature):
        return queue.pop(0)

    monkeypatch.setattr(ai_agent, "_call", flaky)

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="Chilonzor",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert outcome.reply is None      # the deterministic path writes the words
    assert len(outcome.rows) == 1     # but the work is not thrown away
    assert outcome.shown_ids == [str(rows[0].id)]


async def test_a_model_that_names_a_tool_that_does_not_exist_is_corrected(scripted):
    sent = scripted(
        _wants("delete_everything", {}),
        _assistant("Buni qila olmayman."),
    )

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="hammasini ochir",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    tool_replies = [m for m in sent[1]["messages"] if m.get("role") == "tool"]
    assert "no tool called" in tool_replies[0]["content"]
    assert outcome.reply == "Buni qila olmayman."


async def test_broken_tool_arguments_do_not_crash_the_turn(scripted, stub_search):
    """Models occasionally emit arguments that are not valid JSON."""
    stub_search([_listing()])
    broken = {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": "c1",
                "type": "function",
                "function": {"name": "search_listings", "arguments": "{not json"},
            }
        ],
    }
    scripted(broken, _assistant("Mana."))

    outcome = await ai_agent.run_turn(
        db=None, viewer=None, session=_session(), message="qidir",
        history=[], language="uz", user_name=None, is_first_turn=False, shown_ids=[],
    )

    assert outcome.reply == "Mana."


# ---------------------------------------------------------------------------
# Memory across turns
# ---------------------------------------------------------------------------
async def test_a_reference_from_a_previous_turn_still_resolves(
    scripted, stub_search, monkeypatch
):
    """"Save the second one" has to work a turn after the search."""
    rows = [_listing(), _listing()]
    saved: list[str] = []

    async def fake_get(db, listing_id):
        return next(r for r in rows if str(r.id) == str(listing_id))

    async def fake_stat(db, *, listing_id, stat, delta, user):
        saved.append(str(listing_id))
        return None

    monkeypatch.setattr(
        ai_agent.ai_tools.listing_service, "get_public_listing", fake_get
    )
    monkeypatch.setattr(ai_agent.ai_tools.listing_service, "record_stat", fake_stat)
    scripted(
        _wants("add_favorite", {"listing_ref": 2}),
        _assistant("Ikkinchisini saqladim."),
    )

    outcome = await ai_agent.run_turn(
        db=None, viewer=_user(), session=_session(),
        message="ikkinchisini sevimlilarga qosh",
        history=[{"role": "user", "content": "Chilonzor"}],
        language="uz", user_name="Aziz", is_first_turn=False,
        # What the previous turn showed, as the server recorded it.
        shown_ids=[str(r.id) for r in rows],
    )

    assert saved == [str(rows[1].id)], "the wrong listing was saved"
    assert "add_favorite" in outcome.actions


async def test_consent_does_not_carry_to_a_second_action_in_the_same_turn(
    scripted, monkeypatch
):
    """Saying yes to one thing must not authorise whatever comes next.

    The turn begins with an approved callback. If the model then asks to
    remove a favourite, that is a different action the visitor never agreed
    to, and it has to stop and ask.
    """
    async def fake_send(db, text, *, context="notification"):
        return True

    monkeypatch.setattr("app.services.telegram.send_message", fake_send)
    scripted(_wants("remove_favorite", {"listing_ref": 1}))

    outcome = await ai_agent.run_turn(
        db=None, viewer=_user(), session=_session(), message="ha",
        history=[], language="uz", user_name="Aziz", is_first_turn=False,
        shown_ids=[str(uuid.uuid4())],
        approved={
            "name": "request_support_callback",
            "arguments": {"phone": "998901234567"},
        },
    )

    assert outcome.pending == {
        "name": "remove_favorite",
        "arguments": {"listing_ref": 1},
    }
    assert "remove_favorite" not in outcome.actions
