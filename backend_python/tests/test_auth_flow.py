"""The registration -> SMS -> verify -> login flow, and its guarantees."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from tests.conftest import auth_headers, register_and_verify

PASSWORD = "Salom2026x"


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------
async def test_register_sends_code_and_creates_nothing_yet(client, db, unique_phone):
    phone = unique_phone()
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Dilshod Karimov",
            "phone": phone,
            "password": PASSWORD,
            "confirmPassword": PASSWORD,
            "role": "OWNER",
        },
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending_verification"
    assert body["debugCode"]
    # The masked phone must not echo the full number back.
    assert "***" in body["phone"]

    from app.models.user import User

    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    assert user is None, "no account may exist before the code is confirmed"


async def test_verify_creates_account_and_returns_tokens(client, db, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone, name="Dilshod Karimov", role="OWNER")

    assert tokens["accessToken"] and tokens["refreshToken"]
    assert tokens["user"]["phone"] == phone
    assert tokens["user"]["role"] == "OWNER"
    assert tokens["user"]["status"] == "ACTIVE"
    # The response must never carry credential material.
    assert "password" not in tokens["user"]
    assert "passwordHash" not in tokens["user"]


async def test_login_with_phone_and_password(client, unique_phone):
    phone = unique_phone()
    await register_and_verify(client, phone)

    response = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["user"]["phone"] == phone


async def test_login_accepts_any_written_phone_format(client, unique_phone):
    phone = unique_phone()
    await register_and_verify(client, phone)
    national = phone.replace("+998", "")

    for variant in (phone, f"998{national}", national, f"+998 {national[:2]} {national[2:5]} {national[5:7]} {national[7:]}"):
        response = await client.post(
            "/api/v1/auth/login", json={"phone": variant, "password": PASSWORD}
        )
        assert response.status_code == 200, f"{variant} should normalise to one account"


async def test_me_returns_the_signed_in_user(client, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)

    response = await client.get("/api/v1/auth/me", headers=auth_headers(tokens))
    assert response.status_code == 200
    assert response.json()["user"]["phone"] == phone


# ---------------------------------------------------------------------------
# The old backend's actual vulnerabilities
# ---------------------------------------------------------------------------
async def test_login_rejects_a_wrong_password(client, unique_phone):
    """The previous /auth/login never checked the password at all."""
    phone = unique_phone()
    await register_and_verify(client, phone)

    response = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": "TotallyWrong9x"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


async def test_login_without_a_password_is_rejected(client, unique_phone):
    phone = unique_phone()
    await register_and_verify(client, phone)

    response = await client.post("/api/v1/auth/login", json={"phone": phone})
    assert response.status_code == 422


async def test_unknown_and_wrong_password_are_indistinguishable(client, unique_phone):
    """Neither the code nor the message may reveal whether an account exists."""
    known = unique_phone()
    await register_and_verify(client, known)

    wrong_password = await client.post(
        "/api/v1/auth/login", json={"phone": known, "password": "TotallyWrong9x"}
    )
    unknown_account = await client.post(
        "/api/v1/auth/login", json={"phone": unique_phone(), "password": "TotallyWrong9x"}
    )
    assert wrong_password.status_code == unknown_account.status_code == 401
    assert wrong_password.json()["code"] == unknown_account.json()["code"]
    assert wrong_password.json()["message"] == unknown_account.json()["message"]


async def test_forged_token_is_rejected(client, db, unique_phone):
    """The old scheme was ``token_<userId>_<ts>`` - forgeable by anyone."""
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    user_id = tokens["user"]["id"]

    for forged in (
        f"token_{user_id}_1735000000",
        f"Bearer_{user_id}",
        user_id,
        "token_00000000-0000-0000-0000-000000000000_1",
    ):
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"}
        )
        assert response.status_code == 401, f"forged token accepted: {forged}"


async def test_token_signed_with_another_secret_is_rejected(client, unique_phone):
    import jwt

    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    user_id = tokens["user"]["id"]

    forged = jwt.encode(
        {
            "sub": user_id,
            "typ": "user",
            "role": "ADMIN",
            "tv": 1,
            "sid": user_id,
            "exp": 9_999_999_999,
            "iat": 1_700_000_000,
            "iss": "maklersiz.uz",
            "aud": "maklersiz.uz/api",
        },
        "an-attacker-chosen-secret",
        algorithm="HS256",
    )
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"}
    )
    assert response.status_code == 401


async def test_registering_an_existing_phone_cannot_take_the_account_over(
    client, unique_phone
):
    """The old /auth/register upserted, handing back a token for any phone."""
    phone = unique_phone()
    await register_and_verify(client, phone, name="Original Owner")

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Boshqa Odam",
            "phone": phone,
            "password": "Zaxira2026qx",
            "confirmPassword": "Zaxira2026qx",
            "role": "OWNER",
        },
    )
    assert response.status_code == 400
    assert response.json()["code"] == "phone_already_registered"

    # The original password still works; the attacker's does not.
    ok = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": PASSWORD}
    )
    assert ok.status_code == 200
    bad = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": "Zaxira2026qx"}
    )
    assert bad.status_code == 401


async def test_password_is_hashed_not_stored_in_plaintext(client, db, unique_phone):
    phone = unique_phone()
    await register_and_verify(client, phone)

    from app.models.user import User

    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one()
    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in user.password_hash
    # The reveal copy is ciphertext, never the password itself.
    assert user.password_secret is not None
    assert PASSWORD not in user.password_secret


# ---------------------------------------------------------------------------
# OTP behaviour
# ---------------------------------------------------------------------------
async def test_wrong_code_is_rejected_and_counts_down(client, unique_phone):
    phone = unique_phone()
    started = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "phone": phone,
            "password": PASSWORD,
            "confirmPassword": PASSWORD,
        },
    )
    assert started.status_code == 202

    response = await client.post(
        "/api/v1/auth/verify-code", json={"phone": phone, "code": "000000"}
    )
    assert response.status_code == 400
    body = response.json()
    assert body["code"] in ("otp_invalid", "otp_too_many_attempts")
    if body["code"] == "otp_invalid":
        assert body["params"]["remaining"] < 5


async def test_code_is_single_use(client, unique_phone):
    phone = unique_phone()
    started = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "phone": phone,
            "password": PASSWORD,
            "confirmPassword": PASSWORD,
        },
    )
    code = started.json()["debugCode"]

    first = await client.post(
        "/api/v1/auth/verify-code", json={"phone": phone, "code": code}
    )
    assert first.status_code == 200

    replay = await client.post(
        "/api/v1/auth/verify-code", json={"phone": phone, "code": code}
    )
    assert replay.status_code == 400
    assert replay.json()["code"] == "otp_not_found"


async def test_otp_attempts_are_capped(client, unique_phone):
    phone = unique_phone()
    await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "phone": phone,
            "password": PASSWORD,
            "confirmPassword": PASSWORD,
        },
    )
    codes = ["111111", "222222", "333333", "444444", "555555", "666666"]
    last_code = None
    for guess in codes:
        response = await client.post(
            "/api/v1/auth/verify-code", json={"phone": phone, "code": guess}
        )
        last_code = response.json()["code"]
    assert last_code in ("otp_too_many_attempts", "otp_not_found")


async def test_resend_is_rate_limited_by_cooldown(client, unique_phone):
    phone = unique_phone()
    await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "phone": phone,
            "password": PASSWORD,
            "confirmPassword": PASSWORD,
        },
    )
    response = await client.post("/api/v1/auth/resend-code", json={"phone": phone})
    assert response.status_code == 429
    assert response.json()["code"] == "otp_cooldown"


# ---------------------------------------------------------------------------
# Lockout, password policy, sessions
# ---------------------------------------------------------------------------
async def test_repeated_failures_lock_the_account(client, unique_phone):
    phone = unique_phone()
    await register_and_verify(client, phone)

    codes = []
    for _ in range(7):
        response = await client.post(
            "/api/v1/auth/login", json={"phone": phone, "password": "WrongPass9x"}
        )
        codes.append(response.json().get("code"))
    assert "account_locked" in codes

    # The correct password is refused too while the lock is in force.
    blocked = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": PASSWORD}
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "account_locked"


@pytest.mark.parametrize(
    "password,expected",
    [
        ("short1A", "password_too_short"),
        ("password", "password_too_simple"),
        ("12345678", "password_too_simple"),
        ("qwerty123", "password_too_common"),
        ("aaaaaaaaaa", "password_too_simple"),
    ],
)
async def test_weak_passwords_are_refused(client, unique_phone, password, expected):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "phone": unique_phone(),
            "password": password,
            "confirmPassword": password,
        },
    )
    assert response.status_code == 422
    assert response.json()["code"] == expected


async def test_password_confirmation_must_match(client, unique_phone):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "phone": unique_phone(),
            "password": PASSWORD,
            "confirmPassword": "Different2026x",
        },
    )
    assert response.status_code == 422
    assert response.json()["code"] == "password_mismatch"


async def test_refresh_rotates_and_replay_revokes_the_family(client, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    original_refresh = tokens["refreshToken"]

    rotated = await client.post(
        "/api/v1/auth/refresh", json={"refreshToken": original_refresh}
    )
    assert rotated.status_code == 200
    new_refresh = rotated.json()["refreshToken"]
    assert new_refresh != original_refresh

    # Replaying the spent token is treated as theft.
    replay = await client.post(
        "/api/v1/auth/refresh", json={"refreshToken": original_refresh}
    )
    assert replay.status_code == 401
    assert replay.json()["code"] == "refresh_reused"

    # ...and the rotated token is revoked along with it.
    after = await client.post("/api/v1/auth/refresh", json={"refreshToken": new_refresh})
    assert after.status_code == 401


async def test_changing_the_password_invalidates_existing_sessions(client, unique_phone):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone)
    headers = auth_headers(tokens)

    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 200

    changed = await client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "currentPassword": PASSWORD,
            "newPassword": "YangiParol2026x",
            "confirmPassword": "YangiParol2026x",
        },
    )
    assert changed.status_code == 200

    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"phone": phone, "password": "YangiParol2026x"}
        )
    ).status_code == 200


async def test_password_reset_via_sms_code(client, unique_phone):
    phone = unique_phone()
    await register_and_verify(client, phone)

    requested = await client.post("/api/v1/auth/forgot-password", json={"phone": phone})
    assert requested.status_code == 200
    code = requested.json()["debugCode"]
    assert code

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={
            "phone": phone,
            "code": code,
            "newPassword": "TiklanganParol9x",
            "confirmPassword": "TiklanganParol9x",
        },
    )
    assert reset.status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/login", json={"phone": phone, "password": "TiklanganParol9x"}
        )
    ).status_code == 200


async def test_forgot_password_does_not_reveal_whether_an_account_exists(
    client, unique_phone
):
    known = unique_phone()
    await register_and_verify(client, known)

    for target in (known, unique_phone()):
        response = await client.post(
            "/api/v1/auth/forgot-password", json={"phone": target}
        )
        assert response.status_code == 200
        assert response.json()["message"]


# ---------------------------------------------------------------------------
# Localisation
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "language,fragment",
    [("uz", "parol"), ("ru", "парол"), ("en", "password")],
)
async def test_errors_come_back_in_the_requested_language(
    client, unique_phone, language, fragment
):
    phone = unique_phone()
    await register_and_verify(client, phone)

    response = await client.post(
        "/api/v1/auth/login",
        json={"phone": phone, "password": "WrongPass9x"},
        headers={"X-Language": language},
    )
    assert response.status_code == 401
    assert fragment in response.json()["message"].lower()


async def test_accept_language_header_is_honoured(client, unique_phone):
    response = await client.post(
        "/api/v1/auth/login",
        json={"phone": unique_phone(), "password": "WrongPass9x"},
        headers={"Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"},
    )
    assert "Неверный" in response.json()["message"]


async def test_a_student_may_still_switch_to_owner(client, unique_phone):
    """Self-service role switching is the point of the field; keep it working."""
    phone = unique_phone()
    tokens = await register_and_verify(client, phone, role="STUDENT")

    response = await client.patch(
        "/api/v1/auth/profile", json={"role": "OWNER"}, headers=auth_headers(tokens)
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["role"] == "OWNER"


async def test_a_granted_role_survives_a_profile_update(client, db, unique_phone):
    """A granted role must not be lost to the profile form.

    DEVELOPER was silently demoted to OWNER the moment the account opened the
    profile page: the form posts the role it knows about, the handler wrote it
    straight through, and the only way back was a seeding script.
    """
    from sqlalchemy import select

    from app.models.user import User

    phone = unique_phone()
    tokens = await register_and_verify(client, phone, role="OWNER")

    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one()
    user.role = "DEVELOPER"
    await db.commit()

    response = await client.patch(
        "/api/v1/auth/profile",
        json={"role": "OWNER", "name": "Yangi Ism"},
        headers=auth_headers(tokens),
    )
    assert response.status_code == 200, response.text

    payload = response.json()["user"]
    assert payload["role"] == "DEVELOPER", "the granted role was overwritten"
    # The rest of the update still applies — only the role is protected.
    assert payload["name"] == "Yangi Ism"


# ---------------------------------------------------------------------------
# Admin recovery endpoint
# ---------------------------------------------------------------------------
"""This route reset the administrator's password with no authentication at
all, over GET, from a browser address bar — and bumped token_version as a side
effect, signing the real administrator out. These pin the door shut."""


async def test_admin_recovery_does_not_exist_without_a_token(client):
    # Off by default: the door should be absent, not merely locked.
    response = await client.post("/api/v1/admin/auth/bootstrap-reset-admin")
    assert response.status_code == 404


async def test_admin_recovery_rejects_get(client):
    # A GET is reachable from a link, an image tag or a redirect, which is
    # what made the original usable as a drive-by.
    response = await client.get("/api/v1/admin/auth/bootstrap-reset-admin")
    assert response.status_code in (404, 405)


async def test_admin_recovery_needs_the_right_token(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "BOOTSTRAP_TOKEN", "the-real-token", raising=False)
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_PASSWORD", "Recovery2026x", raising=False)
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_USERNAME", "recovered", raising=False)

    missing = await client.post("/api/v1/admin/auth/bootstrap-reset-admin")
    assert missing.status_code == 403, "no token must not be accepted"

    wrong = await client.post(
        "/api/v1/admin/auth/bootstrap-reset-admin",
        headers={"X-Bootstrap-Token": "not-it"},
    )
    assert wrong.status_code == 403

    right = await client.post(
        "/api/v1/admin/auth/bootstrap-reset-admin",
        headers={"X-Bootstrap-Token": "the-real-token"},
    )
    assert right.status_code == 200, right.text
    assert right.json()["username"] == "recovered"
