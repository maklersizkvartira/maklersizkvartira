"""The live chat desk: an operator taking an AI conversation over.

These run against the real database and the real routers, because every bug
this feature can have lives in a seam. Whether a takeover actually stops the
model is a question about two routers agreeing on one column; whether an
operator's turn burns the visitor's daily quota is a question about one
literal string being spelled the same way in three files. Neither survives
being asked of a mock.
"""

from __future__ import annotations

import asyncio
import types
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import hash_password
from app.main import app
from app.models.ai import AIMessage, AISession
from app.models.enums import AdminRole
from app.models.user import AdminUser
from app.routers.ai import _used_today
from app.services import ai_agent, ai_tools
from tests.conftest import auth_headers

#: Long enough for MIN_SESSION_KEY_LENGTH, which the assistant endpoints
#: enforce so a session identifier cannot be guessed by a third party.
SESSION_KEY = "s" * 32

ADMIN_PASSWORD = "AdminPass2026!x"


async def _admin_tokens(client, username: str = "testadmin") -> dict:
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": username, "password": ADMIN_PASSWORD},
    )
    assert login.status_code == 200, login.text
    return login.json()


async def _second_moderator(db) -> AdminUser:
    """A colleague at the next desk, so "someone else" is a real account."""
    other = AdminUser(
        username="othermod",
        full_name="Boshqa Operator",
        password_hash=hash_password(ADMIN_PASSWORD),
        role=AdminRole.MODERATOR.value,
        is_active=True,
    )
    db.add(other)
    await db.commit()
    await db.refresh(other)
    return other


async def _seed_session(db, **overrides) -> AISession:
    """A guest conversation, which is what an anonymous visitor's widget has."""
    session = AISession(
        session_key=overrides.pop("session_key", SESSION_KEY),
        guest_label="guest",
        language="uz",
        message_count=0,
        **overrides,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _seed_message(
    db,
    session: AISession,
    role: str,
    content: str,
    created_at: datetime | None = None,
) -> AIMessage:
    msg = AIMessage(session_id=session.id, role=role, content=content)
    if created_at is not None:
        # Stamped by hand so the unread arithmetic is tested against times
        # this file chose, not against whatever the database clock and the
        # test process clock happen to disagree about.
        msg.created_at = created_at
        msg.updated_at = created_at
    db.add(msg)
    await db.commit()
    return msg


def _visitor_ctx(db, session: AISession, *said: str, viewer=None):
    """A ToolContext shaped the way ``run_turn`` really builds one.

    ``visitor_messages`` is not optional decoration on a lead test.
    :func:`ai_tools._is_the_visitors_own_number` fails **closed** on an empty
    transcript, and deliberately: listing descriptions are fed to the model,
    so a landlord's number written into one can be lifted out of the context
    and paged as though the visitor had offered it, and a guard a caller can
    switch off by forgetting an argument is not a guard. So a test that hands
    a phone number to ``capture_lead`` has to say where the visitor typed it,
    exactly as ``run_turn`` does: every user-role turn of the history, then
    this turn's own message, oldest first.
    """
    return ai_tools.ToolContext(
        db=db,
        viewer=viewer,
        language="uz",
        session=session,
        shown_ids=[],
        visitor_messages=tuple(said),
    )


def _pin_the_rate(monkeypatch) -> None:
    """Fix the dollar rate for a test that runs a search.

    Every ``search_for_intent`` awaits ``fx.usd_to_uzs``, which goes to the
    Central Bank on a cold process, and a test that reaches the internet
    fails for reasons that have nothing to do with what it is asking.
    """

    async def fixed_rate() -> float:
        return 12_700.0

    monkeypatch.setattr("app.services.fx.usd_to_uzs", fixed_rate)


async def _takeover(client, tokens: dict, session: AISession):
    return await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/takeover",
        headers=auth_headers(tokens),
    )


async def _unread(client, tokens: dict) -> dict[str, int]:
    """The desk's queue, as the badge counts it."""
    listed = await client.get(
        "/api/v1/admin/ai/sessions", headers=auth_headers(tokens)
    )
    assert listed.status_code == 200, listed.text
    return {row["sessionKey"]: row["unreadCount"] for row in listed.json()["data"]}


async def _at_the_same_moment(*requests):
    """Two operators, two connections, one row - genuinely at once.

    Each caller gets its own client, so each request runs on its own database
    session; `gather` puts them both in flight before either commits. That is
    the only way to tell a conditional UPDATE apart from a SELECT followed by
    a write, because the check-then-act version passes every test that asks
    its two questions one after the other.
    """
    transport = httpx.ASGITransport(app=app)

    async def _run(build):
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test", timeout=30.0
        ) as ac:
            return await build(ac)

    return await asyncio.gather(*(_run(build) for build in requests))


# ---------------------------------------------------------------------------
# Taking a conversation over
# ---------------------------------------------------------------------------
async def test_a_moderator_can_take_a_conversation_over(client, db, admin_account):
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)

    taken = await _takeover(client, tokens, session)
    assert taken.status_code == 200, taken.text
    row = taken.json()["data"]
    assert row["takenOverBy"] == str(admin_account.id)
    assert row["takenOverByName"] == "Test Admin"
    assert row["takenOverAt"] is not None


async def test_a_second_admin_cannot_steal_a_live_thread(client, db, admin_account):
    """Two operators answering the same visitor is worse than a queue."""
    session = await _seed_session(db)
    await _second_moderator(db)

    first = await _takeover(client, await _admin_tokens(client), session)
    assert first.status_code == 200, first.text

    stolen = await _takeover(
        client, await _admin_tokens(client, "othermod"), session
    )
    assert stolen.status_code == 409, stolen.text
    assert stolen.json()["code"] == "ai_session_already_taken"


async def test_two_moderators_tapping_take_over_at_once_leave_one_winner(
    client, db, admin_account
):
    """H-FIX-7: the 409 has to be the rule, not a courtesy under contention.

    A hot conversation appears in the queue and two moderators tap it within
    the same few milliseconds. The old route read `taken_over_by`, found it
    NULL in both requests, and let both write: last writer won, both panels
    rendered an enabled composer, and the loser's next reply came back 409
    telling them to take over a thread they had just been told they held.
    With the precondition in the WHERE clause the database picks the winner
    and the loser is told so immediately, which is the only moment the answer
    is still useful.
    """
    session = await _seed_session(db)
    await _second_moderator(db)
    mine = await _admin_tokens(client)
    theirs = await _admin_tokens(client, "othermod")
    url = f"/api/v1/admin/ai/sessions/{session.id}/takeover"

    first, second = await _at_the_same_moment(
        lambda ac: ac.post(url, headers=auth_headers(mine)),
        lambda ac: ac.post(url, headers=auth_headers(theirs)),
    )
    assert sorted([first.status_code, second.status_code]) == [200, 409], (
        first.text,
        second.text,
    )
    loser = first if first.status_code == 409 else second
    assert loser.json()["code"] == "ai_session_already_taken"

    # And the row agrees with whoever was told they won.
    winner = first if first.status_code == 200 else second
    await db.refresh(session)
    assert str(session.taken_over_by) == winner.json()["data"]["takenOverBy"]


async def test_a_reply_is_refused_once_the_thread_is_released_under_you(
    client, db, admin_account
):
    """H-FIX-7, the other half: the precondition is read at write time.

    Desks hand off and shifts end, so any moderator may release a thread -
    including one this operator is in the middle of typing into. Checking
    `taken_over_by` and then inserting are two different instants; the insert
    now carries the check, so a turn can never land in a conversation the
    operator stopped holding while the request was open.
    """
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)

    released = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/release",
        headers=auth_headers(tokens),
    )
    assert released.status_code == 200, released.text

    late = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Yozib bo'lgandim..."},
        headers=auth_headers(tokens),
    )
    assert late.status_code == 409, late.text
    assert late.json()["code"] == "ai_session_not_taken"

    count = (
        await db.execute(
            select(func.count()).select_from(AIMessage).where(
                AIMessage.session_id == session.id
            )
        )
    ).scalar_one()
    assert count == 0


async def test_an_operator_turn_is_counted_exactly_once(client, db, admin_account):
    """`message_count` moves in the same statement that guards the write.

    Incremented in Python on a row read earlier in the request, it was a
    read-modify-write over a column two other writers also touch.
    """
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)
    for text in ("Salom", "Qanday yordam bera olaman?"):
        sent = await client.post(
            f"/api/v1/admin/ai/sessions/{session.id}/messages",
            json={"content": text},
            headers=auth_headers(tokens),
        )
        assert sent.status_code == 200, sent.text

    await db.refresh(session)
    assert session.message_count == 2


async def test_taking_over_twice_is_idempotent(client, db, admin_account):
    """A reloaded tab re-sends this; it must not be told it lost the thread."""
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)

    assert (await _takeover(client, tokens, session)).status_code == 200
    again = await _takeover(client, tokens, session)
    assert again.status_code == 200, again.text
    assert again.json()["data"]["takenOverBy"] == str(admin_account.id)


async def test_releasing_leaves_the_timestamp_behind(client, db, admin_account):
    """The thread goes back to the AI; the history still shows a human was on it."""
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)

    released = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/release",
        headers=auth_headers(tokens),
    )
    assert released.status_code == 200, released.text
    row = released.json()["data"]
    assert row["takenOverBy"] is None
    assert row["takenOverByName"] is None
    assert row["takenOverAt"] is not None


# ---------------------------------------------------------------------------
# The operator's own turn
# ---------------------------------------------------------------------------
async def test_an_operator_reply_is_stored_as_the_admin_role(
    client, db, admin_account
):
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)

    sent = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Assalomu alaykum, men Uyiz jamoasidanman."},
        headers=auth_headers(tokens),
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()["data"]["role"] == "admin"

    stored = (
        await db.execute(
            select(AIMessage).where(AIMessage.session_id == session.id)
        )
    ).scalars().all()
    assert [m.role for m in stored] == ["admin"]
    assert stored[0].content == "Assalomu alaykum, men Uyiz jamoasidanman."


async def test_a_reply_before_takeover_is_refused(client, db, admin_account):
    """The panel's disabled composer is a courtesy; this is the rule."""
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)

    refused = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Salom"},
        headers=auth_headers(tokens),
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["code"] == "ai_session_not_taken"


async def test_an_operator_reply_does_not_burn_the_visitor_quota(
    client, db, admin_account
):
    """`role="admin"` is lowercase and distinct for exactly this reason.

    The daily ceiling counts rows whose role is the literal string "user".
    An operator's turn filed under that role would spend a quota belonging to
    the person the operator is trying to help, and nothing on either screen
    would say where the questions had gone.
    """
    ctx = types.SimpleNamespace(ip="203.0.113.9")
    session = await _seed_session(db, ip="203.0.113.9")
    await _seed_message(db, session, "user", "Chilonzorda kvartira bormi?")

    before = await _used_today(db, viewer=None, ctx=ctx)
    assert before == 1

    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)
    sent = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Bor, hozir yuboraman."},
        headers=auth_headers(tokens),
    )
    assert sent.status_code == 200, sent.text

    assert await _used_today(db, viewer=None, ctx=ctx) == before


# ---------------------------------------------------------------------------
# What the visitor sees
# ---------------------------------------------------------------------------
async def test_the_visitor_sees_the_operator_turn_in_their_own_history(
    client, db, admin_account
):
    """The widget replays roles verbatim, so nothing has to be translated."""
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)
    await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Men sizga yordam beraman."},
        headers=auth_headers(tokens),
    )

    replay = await client.get(
        f"/api/v1/smart/assistant/history?session_key={session.session_key}"
    )
    assert replay.status_code == 200, replay.text
    messages = replay.json()["messages"]
    assert [m["role"] for m in messages] == ["admin"]
    assert messages[0]["content"] == "Men sizga yordam beraman."


async def test_a_taken_over_session_gets_no_machine_answer(
    client, db, admin_account
):
    """The single most important assertion in this file.

    While an operator holds the thread the agent is not called at all: the
    visitor's turn is stored and the reply comes back empty, which is the wire
    signal the widget renders as a handover banner rather than as an empty AI
    bubble. Two voices answering the same person is worse than a pause.

    H-FIX-3 also decided what this response must NOT carry. The operator's
    name is a staff member's legal name and has no business reaching an
    anonymous visitor, so the field is gone rather than nulled - the widget
    labels the bubble "Uyiz jamoasi" from its own dictionary. Asserted as an
    absence on purpose: a well-meaning re-add would otherwise leak a name to
    every guest in the country and break no test.
    """
    session = await _seed_session(db)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, session)

    answered = await client.post(
        "/api/v1/smart/assistant",
        json={"sessionKey": session.session_key, "message": "Odam bilan gaplashsam?"},
    )
    assert answered.status_code == 200, answered.text
    body = answered.json()
    assert body["handledByHuman"] is True
    assert body["reply"] == ""
    assert body["listings"] == []
    assert "operatorName" not in body

    roles = (
        await db.execute(
            select(AIMessage.role).where(AIMessage.session_id == session.id)
        )
    ).scalars().all()
    assert "assistant" not in roles
    assert roles.count("user") == 1


# ---------------------------------------------------------------------------
# The queue itself
# ---------------------------------------------------------------------------
async def test_the_captured_lead_reaches_the_admin_list(
    client, db, admin_account, monkeypatch
):
    """A lead is only worth taking if the desk can see it without a query."""
    sent: list[str] = []

    async def fake_send(db_, text, *, context="notification"):
        sent.append(text)
        return True

    monkeypatch.setattr("app.services.telegram.send_message", fake_send)

    session = await _seed_session(db)
    # The visitor's own words, because that is what the desk's lead actually
    # comes from: the number is in the last line, the one this turn carries.
    ctx = _visitor_ctx(
        db,
        session,
        "Chilonzorda 2 xonali kvartira kerak",
        "Aziz, raqamim +998901234567",
    )
    captured = await ai_tools.TOOLS["capture_lead"].handler(
        ctx,
        {"name": "Aziz", "phone": "+998901234567", "note": "Chilonzor, 2 xona"},
    )
    await db.commit()
    assert captured["recorded"] is True
    assert sent, "the team was never told"

    tokens = await _admin_tokens(client)
    listed = await client.get(
        "/api/v1/admin/ai/sessions?has_lead=true", headers=auth_headers(tokens)
    )
    assert listed.status_code == 200, listed.text
    rows = listed.json()["data"]
    assert [row["sessionKey"] for row in rows] == [session.session_key]
    assert rows[0]["leadName"] == "Aziz"
    assert rows[0]["leadPhone"] == "+998901234567"
    assert rows[0]["leadNote"] == "Chilonzor, 2 xona"
    assert rows[0]["leadCapturedAt"] is not None

    # The other half of the filter: a conversation with no lead must not be
    # in the "has a lead" queue, or the filter is decoration.
    empty = await client.get(
        "/api/v1/admin/ai/sessions?has_lead=false", headers=auth_headers(tokens)
    )
    assert empty.status_code == 200
    assert empty.json()["data"] == []


async def test_unread_counts_only_visitor_turns_since_the_read_mark(
    client, db, admin_account
):
    """Unread is "what the visitor said after I last looked", nothing else.

    The assistant's own turns are not unread - the operator has no reason to
    read the machine back - and a conversation nobody has opened yet has no
    read mark at all, which must count everything rather than nothing.
    """
    mark = datetime.now(timezone.utc) - timedelta(hours=1)
    read = await _seed_session(db, session_key="r" * 32, admin_read_at=mark)
    await _seed_message(db, read, "user", "eski savol", mark - timedelta(minutes=5))
    await _seed_message(db, read, "user", "yangi savol", mark + timedelta(minutes=5))
    await _seed_message(db, read, "user", "yana bir savol", mark + timedelta(minutes=6))
    await _seed_message(db, read, "assistant", "javob", mark + timedelta(minutes=7))

    never = await _seed_session(db, session_key="n" * 32)
    await _seed_message(db, never, "user", "hech kim ochmagan", mark)

    tokens = await _admin_tokens(client)
    listed = await client.get(
        "/api/v1/admin/ai/sessions", headers=auth_headers(tokens)
    )
    assert listed.status_code == 200, listed.text
    by_key = {row["sessionKey"]: row for row in listed.json()["data"]}
    assert by_key["r" * 32]["unreadCount"] == 2
    assert by_key["n" * 32]["unreadCount"] == 1
    assert by_key["r" * 32]["lastMessageAt"] is not None

    # Opening the thread in order to answer it is what clears it, and the
    # desk says so out loud: `?mark_read=true`. See H-FIX-6 below.
    opened = await client.get(
        f"/api/v1/admin/ai/sessions/{read.id}/messages?mark_read=true",
        headers=auth_headers(tokens),
    )
    assert opened.status_code == 200, opened.text
    assert [m["content"] for m in opened.json()["data"]] == [
        "eski savol",
        "yangi savol",
        "yana bir savol",
        "javob",
    ]

    after = await client.get(
        "/api/v1/admin/ai/sessions", headers=auth_headers(tokens)
    )
    cleared = {row["sessionKey"]: row for row in after.json()["data"]}
    assert cleared["r" * 32]["unreadCount"] == 0
    assert cleared["n" * 32]["unreadCount"] == 1


async def test_reading_a_transcript_does_not_clear_the_desk_badge(
    client, db, admin_account
):
    """H-FIX-6: `/ai` audits transcripts, `/chat` answers them.

    Both screens call this one endpoint, and they even share a query key. The
    unconditional read mark meant a colleague opening a conversation on the
    read-only auditing sheet zeroed the unread count the live desk uses to
    pick its next thread - within one six-second list poll the badge went to
    zero with three visitor questions still unanswered. The mark is opt-in
    now, so auditing is a read and only the desk's own open is a read
    *receipt*.
    """
    mark = datetime.now(timezone.utc) - timedelta(hours=1)
    session = await _seed_session(db, admin_read_at=mark)
    await _seed_message(db, session, "user", "birinchi", mark + timedelta(minutes=1))
    await _seed_message(db, session, "user", "ikkinchi", mark + timedelta(minutes=2))
    tokens = await _admin_tokens(client)
    assert (await _unread(client, tokens))[SESSION_KEY] == 2

    audited = await client.get(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        headers=auth_headers(tokens),
    )
    assert audited.status_code == 200, audited.text
    assert [m["content"] for m in audited.json()["data"]] == ["birinchi", "ikkinchi"]
    assert (await _unread(client, tokens))[SESSION_KEY] == 2, (
        "reading a transcript must not answer it"
    )

    # Spelled the other way it is also ignored, the way FastAPI ignores every
    # query key it has never heard of: this parameter is bare snake_case.
    wrong_case = await client.get(
        f"/api/v1/admin/ai/sessions/{session.id}/messages?markRead=true",
        headers=auth_headers(tokens),
    )
    assert wrong_case.status_code == 200, wrong_case.text
    assert (await _unread(client, tokens))[SESSION_KEY] == 2

    opened = await client.get(
        f"/api/v1/admin/ai/sessions/{session.id}/messages?mark_read=true",
        headers=auth_headers(tokens),
    )
    assert opened.status_code == 200, opened.text
    assert (await _unread(client, tokens))[SESSION_KEY] == 0


async def test_an_undelivered_lead_is_visible_on_the_queue_row(
    client, db, admin_account
):
    """A lead Telegram refused must not look like one the team was paged about.

    `capture_lead` tells the visitor something softer when the send failed,
    but the only person who can actually rescue that lead is an operator
    reading this queue - so the delivery result rides on the row itself
    rather than living in a log line nobody is watching.
    """
    lost = await _seed_session(
        db,
        session_key="u" * 32,
        lead_name="Aziz",
        lead_phone="+998901234567",
        lead_captured_at=datetime.now(timezone.utc),
        lead_delivered=False,
    )
    paged = await _seed_session(
        db,
        session_key="d" * 32,
        lead_name="Dilnoza",
        lead_phone="+998901234568",
        lead_captured_at=datetime.now(timezone.utc),
        lead_delivered=True,
    )

    tokens = await _admin_tokens(client)
    listed = await client.get(
        "/api/v1/admin/ai/sessions?has_lead=true", headers=auth_headers(tokens)
    )
    assert listed.status_code == 200, listed.text
    rows = {row["sessionKey"]: row for row in listed.json()["data"]}
    assert rows[lost.session_key]["leadDelivered"] is False
    assert rows[paged.session_key]["leadDelivered"] is True


async def test_an_operator_turn_never_reaches_the_model_as_role_admin(
    client, db, admin_account, monkeypatch
):
    """H-FIX-10: the highest-risk line in the whole change, pinned.

    "admin" is not a role the Chat Completions API accepts. Sent one, it
    answers 400 - and because every later turn replays the same transcript,
    that 400 comes back on every turn for the rest of the conversation.
    routers/ai.py maps a stored operator row to an assistant message labelled
    `[Uyiz operator]:` before anything downstream sees it.

    The mapping reads like dead complexity: `ai_agent` and `uyiz_ai` both
    re-emit whatever role they are handed, so collapsing it back to a plain
    comprehension looks like a tidy-up and breaks nothing any other test
    asks about. Nothing else in the tree pins it. This does, at the seam that
    matters - the real endpoint, on a session an operator has answered and
    handed back, with the provider call recording what it was given.
    """
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    seen: list[dict] = []

    async def fake_call(*, model, messages, tools, temperature):
        seen.extend(dict(m) for m in messages)
        return {"role": "assistant", "content": "Albatta, davom etamiz."}

    monkeypatch.setattr(ai_agent, "_call", fake_call)

    # A conversation an operator joined and then released: the transcript
    # keeps their turn, and the model is answering again.
    session = await _seed_session(db)
    await _seed_message(db, session, "user", "Chilonzorda kvartira bormi?")
    await _seed_message(db, session, "admin", "Salom, men Uyiz jamoasidanman.")

    answered = await client.post(
        "/api/v1/smart/assistant",
        json={"sessionKey": session.session_key, "message": "Rahmat, davom etaylik"},
    )
    assert answered.status_code == 200, answered.text
    assert seen, "the model was never called, so this test pinned nothing"

    assert [m for m in seen if m.get("role") == "admin"] == [], (
        "a stored operator role reached the provider - this 400s the session "
        "permanently"
    )
    labelled = [
        m
        for m in seen
        if "[Uyiz operator]: Salom, men Uyiz jamoasidanman."
        in (m.get("content") or "")
    ]
    assert labelled, "the operator's turn never reached the model at all"
    assert all(m["role"] == "assistant" for m in labelled)


async def test_a_conversation_that_is_gone_is_a_404_not_a_500(client, admin_account):
    """Every one of the three writes goes through the same guard."""
    tokens = await _admin_tokens(client)
    missing = uuid.uuid4()
    for path in ("takeover", "release", "messages"):
        response = await client.post(
            f"/api/v1/admin/ai/sessions/{missing}/{path}",
            json={"content": "Salom"},
            headers=auth_headers(tokens),
        )
        assert response.status_code == 404, f"{path}: {response.text}"
        assert response.json()["code"] == "ai_session_not_found"


async def test_the_takeover_filter_is_snake_case_on_the_wire(
    client, db, admin_account
):
    """`?taken_over=` is a bare route parameter, so it is not camelCased.

    Sent as `takenOver` it would be a query key FastAPI has never heard of,
    silently ignored, and the desk would be handed the entire queue with a
    "live only" tab lit up. There is nothing in a 200 to say that happened,
    which is why it is pinned here.
    """
    live = await _seed_session(db, session_key="l" * 32)
    await _seed_session(db, session_key="q" * 32)
    tokens = await _admin_tokens(client)
    await _takeover(client, tokens, live)

    only_live = await client.get(
        "/api/v1/admin/ai/sessions?taken_over=true", headers=auth_headers(tokens)
    )
    assert only_live.status_code == 200, only_live.text
    assert [row["sessionKey"] for row in only_live.json()["data"]] == ["l" * 32]
    assert only_live.json()["meta"]["total"] == 1

    only_ai = await client.get(
        "/api/v1/admin/ai/sessions?taken_over=false", headers=auth_headers(tokens)
    )
    assert [row["sessionKey"] for row in only_ai.json()["data"]] == ["q" * 32]


async def test_a_colleague_cannot_type_into_a_thread_they_do_not_hold(
    client, db, admin_account
):
    session = await _seed_session(db)
    await _second_moderator(db)
    await _takeover(client, await _admin_tokens(client), session)

    intruder = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Men ham javob beraman"},
        headers=auth_headers(await _admin_tokens(client, "othermod")),
    )
    assert intruder.status_code == 409, intruder.text
    assert intruder.json()["code"] == "ai_session_taken_by_other"

    # And nothing was written.
    count = (
        await db.execute(
            select(func.count()).select_from(AIMessage).where(
                AIMessage.session_id == session.id
            )
        )
    ).scalar_one()
    assert count == 0


# ---------------------------------------------------------------------------
# A budget the parser refused
# ---------------------------------------------------------------------------
async def test_a_refused_budget_is_reported_to_the_model_not_swallowed(
    db, monkeypatch
):
    """A number the parser found and refused must reach the model.

    ``MoneyReading.rejected`` was write-only: the parser could tell "no money
    was mentioned" apart from "money was mentioned and refused", and nothing
    downstream could. So a visitor who wrote their budget in a shape the
    parser will not read - "1500 dan 2000 gacha dollar", the currency written
    once after the whole range - was answered with a search that had no
    budget in it at all, described as if it had one. The payload has to say
    so, so the assistant asks for the number again instead.
    """
    _pin_the_rate(monkeypatch)
    session = await _seed_session(db)
    ctx = _visitor_ctx(
        db,
        session,
        "Chilonzorda kvartira kerak",
        "1500 dan 2000 gacha dollar",
    )

    payload = await ai_tools.TOOLS["search_listings"].handler(
        ctx, {"district": "Chilonzor"}
    )

    assert payload.get("budgetUnreadable") is True
    # And it has to be actionable: the model is told to ask, not to invent.
    assert "budget" in payload["note"].lower()
    assert "ask" in payload["note"].lower()


async def test_an_ordinary_search_is_not_accused_of_an_unreadable_budget(
    db, monkeypatch
):
    """The flag must not fire on the commonest sentence on the site.

    ``parse_money("Chilonzorda 2 xonali kvartira")`` is rejected=True - the
    room count is a number it found and refused - so keying the flag on that
    alone would have the assistant asking every visitor to repeat a budget
    they never stated. The message has to name money for the refusal to mean
    a budget was lost.
    """
    _pin_the_rate(monkeypatch)
    session = await _seed_session(db)
    ctx = _visitor_ctx(db, session, "Chilonzorda 2 xonali kvartira")

    payload = await ai_tools.TOOLS["search_listings"].handler(
        ctx, {"district": "Chilonzor", "rooms": 2}
    )

    assert "budgetUnreadable" not in payload


async def test_a_budget_that_was_read_is_not_reported_as_unreadable(db, monkeypatch):
    """A search that has a budget has nothing to ask about.

    The same message can carry a refused number and a perfectly good budget
    ("telefonim 90 123 45 67, 500$ gacha"), and a search that ran on a real
    ceiling must not send the model back to ask for one.
    """
    _pin_the_rate(monkeypatch)
    session = await _seed_session(db)
    ctx = _visitor_ctx(db, session, "telefonim 90 123 45 67, 500$ gacha")

    payload = await ai_tools.TOOLS["search_listings"].handler(
        ctx, {"district": "Chilonzor", "max_price": 500, "price_currency": "USD"}
    )

    assert "budgetUnreadable" not in payload
