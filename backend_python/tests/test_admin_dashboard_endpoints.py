"""The two dashboard endpoints, called the way the panel calls them.

`GET /admin/balances` shipped broken and stayed broken, because nothing here
ever called it. Its service function referenced `count_of`, which at the time
was a closure inside a *different* function further down the same file — so
every request raised `NameError` and the SMS-and-assistant card the endpoint
exists to fill has never rendered a number.

Nothing about that is subtle once the line runs. It survived precisely because
no test made it run. So these tests are deliberately shallow: they do not
assert on the numbers, they assert that asking produces an answer at all. That
is the check that was missing.
"""

from __future__ import annotations


async def _admin_tokens(client):
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    assert login.status_code == 200, login.text
    return login.json()


def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_balances_answers(client, admin_account):
    """The regression. A 500 here is the bug that shipped."""
    tokens = await _admin_tokens(client)
    response = await client.get("/api/v1/admin/balances", headers=_auth(tokens))
    assert response.status_code == 200, response.text

    data = response.json()["data"]
    # `sms` may legitimately be null — the provider is unreachable in tests, and
    # the panel renders that as "unknown" rather than as zero on purpose.
    assert "sms" in data
    ai = data["ai"]
    for key in ("messagesToday", "messagesThisMonth", "costAvailable"):
        assert key in ai, f"{key} missing from {ai}"
    assert isinstance(ai["messagesToday"], int)
    assert ai["costAvailable"] is False


async def test_stats_answers(client, admin_account):
    """The other half of the same dashboard, and the same shallow check."""
    tokens = await _admin_tokens(client)
    response = await client.get("/api/v1/admin/stats", headers=_auth(tokens))
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert isinstance(data, dict) and data, "stats returned nothing"


async def test_both_require_staff(client):
    """Signed out, neither says anything about the business."""
    for path in ("/api/v1/admin/balances", "/api/v1/admin/stats"):
        response = await client.get(path)
        assert response.status_code in (401, 403), f"{path}: {response.status_code}"
