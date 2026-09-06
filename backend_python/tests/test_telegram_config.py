"""The chat id, the credentials, and the message the team actually reads.

Every Telegram send in this project failed for a year and nothing said so.
Two separate causes, both encoded here:

The first is a supergroup id that lost its leading minus. ``-1004486550551``
copied out of a client, an export or a bot log becomes ``1004486550551``, and
Telegram reads a positive id as a *user* id: getChat answers
``400 Bad Request: chat not found``. Because the old code never looked at the
response body, the symptom was a bare ``False`` and an audit row saying
"delivered: false" with no reason attached.

The second is that the only send which ever worked was the one with its bot
token and channel id written into the Python file - which meant a leaked token
could only be rotated by editing source, and meant every OTHER notification
was pointed at an unset ``.env`` and quietly dropped.

No database here on purpose: these are the pure decisions, and they need to be
checkable without Postgres running.
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import normalise_chat_id, settings
from app.services import telegram


def test_a_supergroup_id_that_lost_its_sign_is_repaired():
    assert normalise_chat_id("1004486550551") == "-1004486550551"


def test_an_already_correct_id_is_left_alone():
    assert normalise_chat_id("-1004486550551") == "-1004486550551"


def test_a_channel_username_is_not_a_number():
    assert normalise_chat_id("@uyiz_ops") == "@uyiz_ops"


def test_a_user_id_is_never_made_negative():
    # A private chat with a person is a positive id and stays one. Repairing
    # it would break the only case where a bare number is already correct.
    assert normalise_chat_id("123456789") == "123456789"


def test_an_empty_value_stays_empty():
    assert normalise_chat_id(None) == ""
    assert normalise_chat_id("") == ""
    assert normalise_chat_id("   ") == ""


def test_no_bot_token_is_hardcoded_in_the_service():
    """The credentials come from the environment or they do not come at all.

    ``send_ai_chat_to_telegram`` used to carry a live bot token and channel id
    as module constants. They reached a public repository, and rotating them
    was a code change rather than a variable change.
    """
    source = Path(telegram.__file__).read_text(encoding="utf-8")
    assert "8760567987" not in source
    assert "-1004486550551" not in source


def test_the_ai_bot_falls_back_to_the_operations_bot():
    """One bot is the normal deployment; two is the exception."""
    probe = settings.model_copy(
        update={"TELEGRAM_BOT_TOKEN": "111111:ops-bot", "TELEGRAM_AI_BOT_TOKEN": ""}
    )
    assert probe.telegram_ai_bot_token == probe.TELEGRAM_BOT_TOKEN


async def test_a_lead_message_carries_the_name_the_number_and_the_ask(monkeypatch):
    """What the operations group has to be able to act on without opening anything.

    A lead is useless as a notification if the person reading it has to go
    looking for the number or guess what was wanted. The delivery itself goes
    through ``send_message`` - patched here - which is what keeps this on the
    configured bot, audited as TELEGRAM_NOTIFIED, and off the network in tests.
    """
    delivered: list[str] = []

    async def fake_send(db, text, *, context="notification"):
        delivered.append(text)
        return True

    monkeypatch.setattr(telegram, "send_message", fake_send)

    ok = await telegram.send_lead_notification(
        None,
        name="Aziz",
        phone="+998901234567",
        language="uz",
        session_key="abcdef0123456789",
        is_registered=False,
        note="Chilonzorda 2 xonali kerak",
        intent={"district": "Chilonzor", "rooms": 2, "maxPrice": 4_000_000},
    )

    assert ok is True
    assert delivered, "the team was never told"
    body = delivered[0]
    assert "Aziz" in body
    assert "+998 90 123 45 67" in body
    assert "🔔" in body
    assert "bog'lanishni so'radi" in body
