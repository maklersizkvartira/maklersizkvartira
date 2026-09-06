"""The live chat desk: an operator taking an AI conversation over.

These run against the real database and the real routers, because every bug
this feature can have lives in a seam. Whether a takeover actually stops the
model is a question about two routers agreeing on one column; whether an
operator's turn burns the visitor's daily quota is a question about one
literal string being spelled the same way in three files. Neither survives
being asked of a mock.
"""

from __future__ import annotations

import types
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.security import hash_password
from app.models.ai import AIMessage, AISession
from app.models.enums import AdminRole
from app.models.user import AdminUser
from app.routers.ai import _used_today
from app.services import ai_tools
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


async def _takeover(client, tokens: dict, session: AISession):
    return await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/takeover",
        headers=auth_headers(tokens),
    )


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
    assert body["operatorName"] == "Test Admin"

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
    ctx = ai_tools.ToolContext(
        db=db, viewer=None, language="uz", session=session
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

    # Opening the thread is what clears it.
    opened = await client.get(
        f"/api/v1/admin/ai/sessions/{read.id}/messages",
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
