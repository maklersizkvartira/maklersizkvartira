"""The transcript's order, pinned at every seam that reads it.

`created_at` was never a total order and the tree spent three rounds acting as
though it were. It defaults to Postgres `now()`, which is the *transaction*
timestamp, so one assistant request — which writes the visitor's row in the
handler and the model's answer in `_finish`, inside a single transaction — puts
two rows in the table carrying byte-identical timestamps. `ORDER BY created_at`
then returns that pair in whatever order the plan happens to produce, and the
"newest twenty, reversed" window turned that accident into the model reading
its own reply before the question it answered.

These tests run against the real Postgres and the real routers, because the
whole defect is a disagreement between what the ORM asked for and what the
database is allowed to return — a mocked session would have handed back the
insertion order and agreed with everything.

Two fixtures appear below. `_seed_turns` is the production shape — a timestamp
per turn, tied inside it — and reproduces the reviewer's window directly, but
only when the planner happens to pick the losing plan, because tied rows may
come back in heap order or in reverse heap order and one of those looks right
by accident. `_seed_scrambled` closes that gap: it stores the conversation on
one timestamp in an order that is neither its own nor its reverse, so ordering
by `created_at` is wrong under every plan and the assertion is about the ORDER
BY rather than about the heap.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.core.config import settings
from app.models.ai import AIMessage, AISession
from app.services import ai_agent
from tests.conftest import auth_headers

SESSION_KEY = "o" * 32
ADMIN_PASSWORD = "AdminPass2026!x"

#: A fixed wall clock, so the timestamps in these tests are the ones the file
#: chose and not whatever the database clock and the test process disagree
#: about.
BASE = datetime(2026, 9, 7, 10, 0, 0, tzinfo=timezone.utc)

#: The contents this file seeds are `q<n>` and `a<n>`; everything else in a
#: model payload is a system prompt or the turn being sent.
_TURN_CONTENT = re.compile(r"^[qa]\d+$")


async def _seed_session(db, **overrides) -> AISession:
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


async def _seed_turns(db, session: AISession, turns: int = 12):
    """`turns` question-and-answer pairs, a second apart, each pair tied.

    The shared timestamp inside a turn is the whole point and is not a
    shortcut: it is exactly what Postgres writes when one request stores a
    question and the answer to it, because `now()` is the transaction clock.
    """
    for turn in range(1, turns + 1):
        stamp = BASE + timedelta(seconds=turn)
        for role, prefix in (("user", "q"), ("assistant", "a")):
            msg = AIMessage(session_id=session.id, role=role, content=f"{prefix}{turn}")
            msg.created_at = stamp
            msg.updated_at = stamp
            db.add(msg)
        await db.commit()


async def _seed_scrambled(db, session: AISession, turns: int = 12):
    """The same conversation, stored in an order that is not its own.

    Every row shares one timestamp — so `created_at` has nothing to say about
    any of them — and the rows are written answers-first, so the order they sit
    in the heap is neither the conversation's order nor its reverse. `seq` is
    written by hand, ascending in the order the turns were actually said, which
    is exactly what the migration's backfill does to the rows that predate the
    column.

    This is the fixture the ordering tests need, and it is not a trick. A test
    seeded in conversation order measures the accident rather than the query:
    Postgres is free to return tied rows in heap order or in reverse heap
    order depending on the plan it picks, and both of those happen to look
    right when the heap already holds the conversation in order. Pulling the
    two apart is the only way an assertion is about the ORDER BY at all.
    """
    ordinal = {}
    n = 0
    for turn in range(1, turns + 1):
        ordinal[f"q{turn}"] = (n := n + 1)
        ordinal[f"a{turn}"] = (n := n + 1)

    for prefix, role in (("a", "assistant"), ("q", "user")):
        for turn in range(1, turns + 1):
            content = f"{prefix}{turn}"
            msg = AIMessage(session_id=session.id, role=role, content=content)
            msg.created_at = BASE
            msg.updated_at = BASE
            msg.seq = ordinal[content]
            db.add(msg)
    await db.commit()

    # Hand-written seq values leave the identity behind them, and the routes
    # under test write more rows into this same session. Move it past what was
    # seeded so a generated number cannot collide with a seeded one — the same
    # thing the migration does after its backfill.
    await db.execute(
        text("SELECT setval(pg_get_serial_sequence('ai_messages', 'seq'), :v)"),
        {"v": n},
    )
    await db.commit()


def _turn_contents(messages) -> list[str]:
    return [
        c for c in (m.get("content") or "" for m in messages) if _TURN_CONTENT.match(c)
    ]


def _folded(messages) -> str | None:
    """The older half of the router's window, as the system prompt kept it.

    Only `ai_agent.RECENT_TURNS` rows of the router's twenty reach the payload
    verbatim; `_history_messages` folds everything older into one line of the
    visitor's questions, joined by " | ", and puts it in the system prompt. So
    the verbatim turns are a *suffix* of the window, and this line is the only
    place the rest of it can be read back — which is what makes it worth
    asserting on: a window that came back reversed shows up here as questions
    in descending order.
    """
    for msg in messages:
        if msg.get("role") != "system":
            continue
        found = re.search(r"q\d+(?: \| q\d+)*", msg.get("content") or "")
        if found:
            return found.group(0)
    return None


def _inversions(window: list[str]) -> list[str]:
    """Turns whose answer is presented before the question it answers."""
    bad = []
    for i, content in enumerate(window):
        if content.startswith("a"):
            question = "q" + content[1:]
            if question in window and window.index(question) > i:
                bad.append(f"turn {content[1:]}")
    return bad


# ---------------------------------------------------------------------------
# The root cause
# ---------------------------------------------------------------------------
async def test_one_request_writes_one_timestamp_but_two_positions(db):
    """Why `created_at` cannot order a transcript, stated as an assertion.

    If this test's first assertion ever starts failing, somebody has changed
    `created_at` to a statement clock and `seq` may be redundant. Until then it
    is the reason every read below orders by `seq`.
    """
    session = await _seed_session(db)

    # Exactly what the assistant route does: the visitor's row and the answer
    # to it, added in that order, committed once.
    question = AIMessage(session_id=session.id, role="user", content="salom")
    answer = AIMessage(session_id=session.id, role="assistant", content="assalom")
    db.add(question)
    db.add(answer)
    await db.commit()
    await db.refresh(question)
    await db.refresh(answer)

    assert question.created_at == answer.created_at, (
        "created_at stopped being the transaction timestamp; re-read the "
        "ordering comments in routers/ai.py before trusting them"
    )
    assert question.seq < answer.seq, (
        "seq did not separate two rows of one transaction, which is the only "
        "thing it exists to do"
    )


# ---------------------------------------------------------------------------
# The model's window
# ---------------------------------------------------------------------------
async def test_the_model_never_reads_the_answer_before_the_question(
    client, db, monkeypatch
):
    """The regression H-FIX-8 introduced: a reversed window over tied rows.

    Twelve turns, a second apart, each pair sharing its timestamp. The window
    is the newest twenty rows — turns 3 to 12 — and every one of them has to
    reach the model question-first. Ordered by `created_at` this came back as
    ['q3','a3','a4','q4','a5','q5', ...]: four of the ten turns had the
    assistant answering before it was asked, and a model handed that transcript
    is being told it speaks first.
    """
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    seen: list[dict] = []

    async def fake_call(*, model, messages, tools, temperature):
        seen.extend(dict(m) for m in messages)
        return {"role": "assistant", "content": "Xo'p."}

    monkeypatch.setattr(ai_agent, "_call", fake_call)

    session = await _seed_session(db)
    await _seed_turns(db, session, turns=12)

    answered = await client.post(
        "/api/v1/smart/assistant",
        json={"sessionKey": session.session_key, "message": "yana bitta savol"},
    )
    assert answered.status_code == 200, answered.text
    assert seen, "the model was never called, so this test pinned nothing"

    window = _turn_contents(seen)
    expected = [f"{p}{t}" for t in range(3, 13) for p in ("q", "a")]
    assert (
        _inversions(window) == []
    ), f"the model was handed an answer before its question: {window}"
    assert window == expected[-len(window) :], (
        f"the verbatim turns are not the newest ones, in order: {window}"
    )
    assert _folded(seen) == "q3 | q4 | q5 | q6 | q7 | q8", (
        "the folded half of the window is not turns 3-8 in order, so the "
        "router handed over the wrong twenty rows"
    )


async def test_the_model_window_is_the_order_by_and_not_the_heap_order(
    client, db, monkeypatch
):
    """The same window, over rows whose timestamps say nothing at all.

    `_seed_scrambled` puts the conversation in the table in an order that is
    neither its own nor its reverse, on one shared timestamp. Ordered by
    `created_at` the answer is then wrong under every plan Postgres can pick —
    the wrong twenty rows, in the wrong order — which is what makes this the
    assertion that fails on the shipped code rather than passing by luck.
    """
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    seen: list[dict] = []

    async def fake_call(*, model, messages, tools, temperature):
        seen.extend(dict(m) for m in messages)
        return {"role": "assistant", "content": "Xo'p."}

    monkeypatch.setattr(ai_agent, "_call", fake_call)

    session = await _seed_session(db)
    await _seed_scrambled(db, session, turns=12)

    answered = await client.post(
        "/api/v1/smart/assistant",
        json={"sessionKey": session.session_key, "message": "yana bitta savol"},
    )
    assert answered.status_code == 200, answered.text

    window = _turn_contents(seen)
    expected = [f"{p}{t}" for t in range(3, 13) for p in ("q", "a")]
    assert window == expected[-len(window) :], (
        f"the window followed the heap and not the transcript: {window}"
    )
    assert _folded(seen) == "q3 | q4 | q5 | q6 | q7 | q8", (
        "the older half of the window is not turns 3-8 in order, so the "
        "router handed over the wrong twenty rows"
    )


# ---------------------------------------------------------------------------
# The visitor's own transcript
# ---------------------------------------------------------------------------
async def test_the_visitor_history_returns_the_newest_hundred(client, db):
    """The visitor's transcript was capped at the OLDEST hundred rows.

    The widget's poll decides what is new purely from this array, so a session
    that reached 100 rows stopped changing: nothing an operator wrote ever
    reached the visitor again, while the handover banner went on telling them a
    person was answering. That is reachable exactly when it matters, because a
    thread an operator holds skips the daily quota.
    """
    session = await _seed_session(db)
    await _seed_turns(db, session, turns=60)  # 120 rows

    replayed = await client.get(
        f"/api/v1/smart/assistant/history?session_key={session.session_key}"
    )
    assert replayed.status_code == 200, replayed.text
    contents = [m["content"] for m in replayed.json()["messages"]]

    assert len(contents) == 100
    assert (
        contents[-1] == "a60"
    ), "the newest message is missing from the visitor's own transcript"
    assert contents[0] == "q11", "the window is not the newest hundred, oldest-first"
    assert _inversions(contents) == [], f"a turn came back inverted: {contents}"


async def test_the_visitor_history_follows_the_transcript_not_the_heap(client, db):
    """Same endpoint, rows stored out of order on one timestamp."""
    session = await _seed_session(db)
    await _seed_scrambled(db, session, turns=12)

    replayed = await client.get(
        f"/api/v1/smart/assistant/history?session_key={session.session_key}"
    )
    assert replayed.status_code == 200, replayed.text
    contents = [m["content"] for m in replayed.json()["messages"]]
    assert contents == [f"{p}{t}" for t in range(1, 13) for p in ("q", "a")]


# ---------------------------------------------------------------------------
# The operator's transcript
# ---------------------------------------------------------------------------
async def test_the_admin_transcript_window_keeps_each_turn_in_order(
    client, db, admin_account
):
    """The desk reads the tail; the tail must not arrive answer-first.

    `limit` on this route takes the newest N and reverses them, the same shape
    as the model's window and with the same tie to trip over. An operator
    reading a thread answer-first cannot tell what was actually said.
    """
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": ADMIN_PASSWORD},
    )
    assert login.status_code == 200, login.text
    tokens = login.json()

    session = await _seed_session(db)
    await _seed_scrambled(db, session, turns=12)

    listed = await client.get(
        f"/api/v1/admin/ai/sessions/{session.id}/messages?limit=20",
        headers=auth_headers(tokens),
    )
    assert listed.status_code == 200, listed.text
    contents = [m["content"] for m in listed.json()["data"]]
    assert contents == [
        f"{p}{t}" for t in range(3, 13) for p in ("q", "a")
    ], f"the operator's tail came back out of order: {contents}"


async def test_an_operator_reply_lands_after_everything_it_answers(
    client, db, admin_account
):
    """An operator's turn is the newest row, however the clock rounds.

    The reply is written by its own request, so its `now()` is later than the
    conversation's — but a conversation seeded in the same second would tie
    with it, and the desk would show the operator answering before the question
    that prompted them.
    """
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": ADMIN_PASSWORD},
    )
    tokens = login.json()

    session = await _seed_session(db)
    await _seed_scrambled(db, session, turns=3)
    taken = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/takeover",
        headers=auth_headers(tokens),
    )
    assert taken.status_code == 200, taken.text

    sent = await client.post(
        f"/api/v1/admin/ai/sessions/{session.id}/messages",
        json={"content": "Salom, men Uyiz jamoasidanman."},
        headers=auth_headers(tokens),
    )
    assert sent.status_code == 200, sent.text

    rows = (
        await db.execute(
            select(AIMessage)
            .where(AIMessage.session_id == session.id)
            .order_by(AIMessage.seq.asc())
        )
    ).scalars().all()
    assert [r.content for r in rows][-1] == "Salom, men Uyiz jamoasidanman."
    assert [r.seq for r in rows] == sorted(r.seq for r in rows)
