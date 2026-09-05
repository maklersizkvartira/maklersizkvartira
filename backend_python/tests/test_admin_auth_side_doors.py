"""The admin login form is not the only thing that checks an admin password.

`POST /admin/auth/login` is carefully guarded: rate limited per IP, a lockout
after five failures, a `LoginAttempt` row and an audit entry for every miss.
Two other endpoints answered the same question — "is this the administrator's
password?" — and inherited none of it, because each had grown its own copy of
the lookup and its own `verify_password` beside the guarded one.

That is the shape of the bug these cover: not a missing check, but a second
unguarded copy of a check that exists. So the tests are written against the
side doors rather than the front one, and they assert the guards are reachable
*through* them.

The username matching is the other half. All three endpoints resolved the name
with `ILIKE` against raw input, which is a pattern language, not a comparison:
`%` matched whatever account existed, so none of this needed the
administrator's name to begin with.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.user import AdminUser

ADMIN_PASSWORD = "AdminPass2026!x"


async def _verify(client, username: str, password: str):
    return await client.post(
        "/api/v1/admin/auth/verify-credentials",
        json={"username": username, "password": password},
    )


async def test_a_wildcard_is_not_a_username(client, admin_account):
    """`%` is a character somebody typed, not "any administrator".

    With `ILIKE` it matched the only staff account on the site, so an attacker
    guessing passwords never had to learn who they were guessing against.
    """
    response = await _verify(client, "%", ADMIN_PASSWORD)
    assert response.status_code == 401, response.text


@pytest.mark.parametrize("pattern", ["%", "_" * len("testadmin"), "testadmi_", "test%"])
async def test_no_pattern_resolves_to_an_account(client, admin_account, pattern):
    """Every wildcard shape, including the one that walks a name out.

    `a%`, `b%`, `c%` … answers "does a staff account start with this letter",
    which is the whole username in twenty-six guesses a character.
    """
    assert (await _verify(client, pattern, ADMIN_PASSWORD)).status_code == 401


async def test_the_real_username_still_works(client, admin_account):
    """The fix must not cost the case-insensitivity the ILIKE was reached for."""
    for spelling in ("testadmin", "TestAdmin", "@testadmin", "  testadmin  "):
        response = await _verify(client, spelling, ADMIN_PASSWORD)
        assert response.status_code == 200, f"{spelling}: {response.text}"
        assert response.json()["valid"] is True


async def test_a_wrong_password_is_still_refused(client, admin_account):
    assert (await _verify(client, "testadmin", "not-the-password")).status_code == 401


async def test_guessing_here_locks_the_account(client, admin_account, db):
    """The point of the whole change.

    Failures against this endpoint used to cost nothing: no counter moved, so
    an attacker could sit on it indefinitely while `/admin/auth/login` — the
    door with the lock on it — went untouched.
    """
    for _ in range(settings.MAX_FAILED_LOGINS):
        await _verify(client, "testadmin", "wrong-password")

    await db.refresh(admin_account)
    assert admin_account.locked_until is not None, (
        "five failed guesses through verify-credentials left the account unlocked"
    )

    # And the lock is honoured here too, not only on the login form: the
    # correct password is refused while it stands.
    locked = await _verify(client, "testadmin", ADMIN_PASSWORD)
    assert locked.status_code == 403, locked.text


async def test_face_login_takes_no_wildcard_either(client, admin_account):
    response = await client.post(
        "/api/v1/admin/auth/face-login",
        json={"username": "%", "image": "data:image/png;base64,AAAA"},
    )
    # Whatever it answers, it must not be an answer about a real account.
    assert response.status_code != 200, response.text
    assert "testadmin" not in response.text


async def test_enrolling_a_face_needs_the_password_and_counts_a_miss(
    client, admin_account, db
):
    """Enrolling a face is handing out a second permanent key to the account.

    It is unauthenticated by necessity — the whole point is the first
    enrolment — so it takes the password, and a wrong one has to cost the same
    as a wrong one anywhere else.
    """
    before = admin_account.failed_login_count or 0
    response = await client.post(
        "/api/v1/admin/auth/face-register",
        json={
            "username": "testadmin",
            "password": "wrong-password",
            "image": "data:image/png;base64,AAAA",
        },
    )
    assert response.status_code == 401, response.text

    await db.refresh(admin_account)
    assert (admin_account.failed_login_count or 0) > before, (
        "a failed face enrolment did not count against the account"
    )


async def test_a_missing_account_and_a_wrong_password_look_the_same(
    client, admin_account
):
    """Otherwise the endpoint answers "does this administrator exist?"."""
    missing = await _verify(client, "nosuchadmin", ADMIN_PASSWORD)
    wrong = await _verify(client, "testadmin", "wrong-password")
    assert missing.status_code == wrong.status_code == 401
    assert missing.json()["code"] == wrong.json()["code"]
