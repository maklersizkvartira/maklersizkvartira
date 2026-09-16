"""The support thread: who wrote what, and what the customer is told about it."""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers, register_and_verify

pytestmark = pytest.mark.anyio


async def _admin_headers(client) -> dict:
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    assert login.status_code == 200, login.text
    return auth_headers(login.json())


async def test_welcome_is_in_the_customers_language_and_unsigned(client, unique_phone):
    tokens = await register_and_verify(client, unique_phone(), language="ru")
    res = await client.get("/api/v1/chat/support", headers=auth_headers(tokens))
    assert res.status_code == 200, res.text
    messages = res.json()["messages"]
    assert len(messages) == 1
    welcome = messages[0]
    assert welcome["sender_type"] == "ADMIN"
    assert welcome["text"].startswith("Здравствуйте")
    # No person wrote it, so no operator is named on it.
    assert welcome["sender_name"] is None


async def test_an_operator_reply_carries_the_operators_name(client, unique_phone, admin_account):
    tokens = await register_and_verify(client, unique_phone())
    me = (await client.get("/api/v1/auth/me", headers=auth_headers(tokens))).json()
    user_id = me["user"]["id"]

    sent = await client.post(
        "/api/v1/chat/support/messages", json={"text": "E'lonim tasdiqlanmayapti"}, headers=auth_headers(tokens)
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()["sender_type"] == "USER"

    reply = await client.post(
        f"/api/v1/admin/support/conversations/{user_id}/messages",
        json={"text": "Tekshiryapmiz."},
        headers=await _admin_headers(client),
    )
    assert reply.status_code == 200, reply.text

    thread = (await client.get("/api/v1/chat/support", headers=auth_headers(tokens))).json()["messages"]
    # The customer wrote first, so no welcome was seeded ahead of them.
    assert [m["sender_type"] for m in thread] == ["USER", "ADMIN"]
    assert thread[-1]["sender_name"] == "Test Admin"
    assert thread[0]["sender_name"] is None


async def test_empty_and_oversized_messages_are_refused(client, unique_phone):
    tokens = await register_and_verify(client, unique_phone())
    for text in ("", "x" * 4001):
        res = await client.post("/api/v1/chat/support/messages", json={"text": text}, headers=auth_headers(tokens))
        assert res.status_code == 422, (len(text), res.text)
