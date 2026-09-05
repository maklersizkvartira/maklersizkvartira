"""Face ID as an unauthenticated way in, and the two halves that made it one.

The panel signs staff in with a photo. That is fine on its own. What was not
fine is that `GET /admin/auth/face-status` needed no token and answered with
every active administrator's username, role and **the enrolled reference photo
itself**, base64 in the JSON — and `POST /admin/auth/face-login` accepted a
photo plus a username as complete proof of identity, with no password, no
lockout, no rate limit and no record of a failure.

Those two compose. Ask the first endpoint who the administrators are and what
they look like; hand the second one back the picture it just gave you. It
matches itself, obviously, and the reply is a live SUPERADMIN token pair. Two
requests, no guessing, nothing to brute-force — which is also why the password
hardening next door could not help: this path never asks for a password.

A biometric template is not a secret you can rotate. Publishing one is worse
than publishing a password hash.
"""

from __future__ import annotations

import base64
import io as _io

import pytest

pytest.importorskip("PIL")

from PIL import Image  # noqa: E402

from app.models.user import AdminUser  # noqa: E402


def _photo(kind: str = "enrolled") -> str:
    """A deterministic image the encoder accepts — a stand-in for a face.

    The two kinds are structurally opposite on purpose. The matcher is a
    histogram of gradient directions, so two smooth gradients score alike
    however different their colours are; telling a match from a mismatch needs
    images whose *edges* differ, not their hues. "enrolled" is a smooth
    diagonal ramp with almost no edges; "other" is a fine checkerboard, which
    is nothing but edges.
    """
    size = 160
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            if kind == "other":
                v = 255 if ((x // 4) + (y // 4)) % 2 else 0
                px[x, y] = (v, v, v)
            else:
                v = (x + y) % 256
                px[x, y] = (v, v // 2, 255 - v)
    buf = _io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


async def _enrol(client, admin_account, db) -> str:
    """Give the admin a Face ID, the way the panel does, and return the photo."""
    photo = _photo()
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    assert login.status_code == 200, login.text
    response = await client.post(
        "/api/v1/admin/auth/face-register",
        json={"username": "testadmin", "image": photo},
        headers={"Authorization": f"Bearer {login.json()['accessToken']}"},
    )
    assert response.status_code == 200, response.text
    await db.refresh(admin_account)
    assert admin_account.face_encoding, "enrolment did not store an encoding"
    return photo


async def test_face_status_does_not_hand_out_the_roster(client, admin_account, db):
    """Anonymous callers learn nothing about who the staff are."""
    await _enrol(client, admin_account, db)

    response = await client.get("/api/v1/admin/auth/face-status")
    assert response.status_code in (401, 403), (
        f"face-status answered an anonymous caller with {response.status_code}"
    )
    body = response.text
    assert "testadmin" not in body, "the admin's username leaked to an anonymous caller"
    assert "SUPERADMIN" not in body, "the admin's role leaked to an anonymous caller"


async def test_face_status_does_not_hand_out_the_enrolled_photo(
    client, admin_account, db
):
    """The one that turns a roster leak into a takeover.

    The stored photo IS the credential on the face-login path. Publishing it is
    publishing the key, and unlike a password nobody can change their face.
    """
    photo = await _enrol(client, admin_account, db)
    payload = photo.split(",", 1)[1][:64]

    response = await client.get("/api/v1/admin/auth/face-status")
    assert payload not in response.text, "the enrolled reference photo was served anonymously"

    # Not even to a signed-in administrator: nothing needs it back, and the
    # comparison it exists for happens on the server.
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "testadmin", "password": "AdminPass2026!x"},
    )
    authed = await client.get(
        "/api/v1/admin/auth/face-status",
        headers={"Authorization": f"Bearer {login.json()['accessToken']}"},
    )
    assert authed.status_code == 200, authed.text
    assert authed.json()["enrolled"] is True
    assert payload not in authed.text, "the reference photo is still being handed out"


async def test_replaying_the_enrolled_photo_is_not_a_login(client, admin_account, db):
    """The takeover itself, end to end.

    Even handed the exact enrolment image — the strongest possible match — a
    photo alone must not mint an administrator's tokens.
    """
    photo = await _enrol(client, admin_account, db)

    response = await client.post(
        "/api/v1/admin/auth/face-login",
        json={"username": "testadmin", "image": photo},
    )
    assert response.status_code != 200, (
        "an unauthenticated photo replay returned "
        + str(response.json().keys())
        + " — this is a full admin takeover"
    )
    assert "accessToken" not in response.text


async def test_the_right_password_and_face_still_signs_in(client, admin_account, db):
    """The feature has to keep working: password plus the enrolled face."""
    photo = await _enrol(client, admin_account, db)
    response = await client.post(
        "/api/v1/admin/auth/face-login",
        json={
            "username": "testadmin",
            "password": "AdminPass2026!x",
            "image": photo,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["accessToken"]


async def test_a_failed_face_attempt_is_counted(client, admin_account, db):
    """Guessing at this door has to cost what guessing at the other one costs."""
    await _enrol(client, admin_account, db)
    before = admin_account.failed_login_count or 0

    await client.post(
        "/api/v1/admin/auth/face-login",
        json={
            "username": "testadmin",
            "password": "AdminPass2026!x",
            "image": _photo("other"),
        },
    )
    await db.refresh(admin_account)
    assert (admin_account.failed_login_count or 0) > before, (
        "a failed face attempt left no trace and cost nothing"
    )


async def test_a_moderator_cannot_enrol_a_face_on_the_superadmin(
    client, admin_account, db
):
    """The escalation that made the whole feature dangerous from the inside.

    Enrolling took a `username` and no role check at all, so the lowest staff
    account could put its own face on the SUPERADMIN's row — and back when a
    face alone signed you in, that was the takeover, from a MODERATOR login.
    It is still not theirs to overwrite: replacing somebody's face locks that
    person out of their own biometric sign-in.
    """
    from app.core.security import hash_password
    from app.models.enums import AdminRole
    from app.models.user import AdminUser

    db.add(
        AdminUser(
            username="lowmod",
            full_name="Low Moderator",
            password_hash=hash_password("ModPass2026!x"),
            role=AdminRole.MODERATOR.value,
            is_active=True,
        )
    )
    await db.commit()

    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"username": "lowmod", "password": "ModPass2026!x"},
    )
    assert login.status_code == 200, login.text

    response = await client.post(
        "/api/v1/admin/auth/face-register",
        json={"username": "testadmin", "image": _photo()},
        headers={"Authorization": f"Bearer {login.json()['accessToken']}"},
    )
    assert response.status_code == 403, (
        f"a MODERATOR enrolled a face on the SUPERADMIN account ({response.status_code})"
    )

    await db.refresh(admin_account)
    assert not admin_account.face_encoding, "the SUPERADMIN's face was overwritten"


async def test_enrolling_on_your_own_account_still_works(client, admin_account, db):
    """The rule is "yours only", not "nobody's"."""
    photo = await _enrol(client, admin_account, db)
    assert photo
