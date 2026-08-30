"""Unit tests for the agent layer.

These deliberately avoid the database. Everything here is a rule that has to
hold before a query is ever issued — who may call which tool, what "the second
one" resolves to, whether a word counts as consent — and each of those is a
place where being wrong means acting on the wrong row or on somebody else's
behalf. They are the cheapest tests in the suite and the ones most worth
having.
"""

from __future__ import annotations

import types
import uuid

import pytest

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
        session_key="k" * 32, last_intent=None, agent_state=None
    )


def _ctx(viewer=None, shown=None) -> ToolContext:
    return ToolContext(
        db=None,
        viewer=viewer,
        language="uz",
        session=_session(),
        shown_ids=list(shown or []),
    )


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
        owner_id=uuid.uuid4(), is_public=True,
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
