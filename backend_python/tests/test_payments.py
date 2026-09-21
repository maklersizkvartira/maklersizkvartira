"""The money paths: Click and Payme webhooks, the wallet, the purchases.

Every test here signs a request the way the gateway would and then checks
the ledger, because the bugs that matter in a payment webhook are not
"does it answer" but "does it credit exactly once, exactly the right
account, and only when the signature is real".
"""

from __future__ import annotations

import base64
import hashlib
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.services.payme import current_time_ms
from app.models.listing import Listing
from app.models.payment import PaymentTransaction, WalletTransaction
from app.models.user import User
from tests.conftest import auth_headers, register_and_verify
from tests.test_listings_and_admin import VALID_LISTING

pytestmark = pytest.mark.anyio

CLICK = "/api/v1/payments/click/prepare-or-complete"
PAYME = "/api/v1/payments/payme"
SECRET = "test-click-secret"
SERVICE_ID = "990011"
PAYME_KEY = "test-payme-secret"
#: Payme cancels a transaction older than 12 hours by timeout, so the
#: `time` a test sends has to be now, not a constant.
NOW_MS = current_time_ms()


@pytest.fixture(autouse=True)
def _gateway_config(monkeypatch):
    monkeypatch.setattr(settings, "CLICK_SERVICE_ID", SERVICE_ID)
    monkeypatch.setattr(settings, "CLICK_MERCHANT_ID", "880022")
    monkeypatch.setattr(settings, "CLICK_SECRET_KEY", SECRET)
    monkeypatch.setattr(settings, "CLICK_TEST_MODE", False)
    monkeypatch.setattr(settings, "PAYME_MERCHANT_ID", "0123456789abcdef01234567")
    monkeypatch.setattr(settings, "PAYME_SECRET_KEY", PAYME_KEY)
    monkeypatch.setattr(settings, "PAYME_TEST_SECRET_KEY", "sandbox-key")
    monkeypatch.setattr(settings, "PAYME_TEST_MODE", False)


async def _user(client, unique_phone, role="OWNER"):
    phone = unique_phone()
    tokens = await register_and_verify(client, phone, role=role)
    me = await client.get("/api/v1/auth/me", headers=auth_headers(tokens))
    assert me.status_code == 200, me.text
    return tokens, phone, me.json()["data"] if "data" in me.json() else me.json()


def _sign(*, click_trans_id, merchant_trans_id, amount, action, sign_time, merchant_prepare_id=None, secret=SECRET):
    prep = merchant_prepare_id or ""
    raw = (
        f"{click_trans_id}{SERVICE_ID}{secret}{merchant_trans_id}{amount}{action}{sign_time}"
        if action == 0
        else f"{click_trans_id}{SERVICE_ID}{secret}{merchant_trans_id}{prep}{amount}{action}{sign_time}"
    )
    return hashlib.md5(raw.encode()).hexdigest()


def _click_form(*, merchant_trans_id, amount, action, click_trans_id="555001", merchant_prepare_id=None, error=0, secret=SECRET):
    sign_time = "2026-09-16 12:00:00"
    form = {
        "click_trans_id": click_trans_id,
        "service_id": SERVICE_ID,
        "click_paydoc_id": "77",
        "merchant_trans_id": merchant_trans_id,
        "amount": amount,
        "action": str(action),
        "error": str(error),
        "error_note": "",
        "sign_time": sign_time,
        "sign_string": _sign(
            click_trans_id=click_trans_id,
            merchant_trans_id=merchant_trans_id,
            amount=amount,
            action=action,
            sign_time=sign_time,
            merchant_prepare_id=merchant_prepare_id,
            secret=secret,
        ),
    }
    if merchant_prepare_id is not None:
        form["merchant_prepare_id"] = merchant_prepare_id
    return form


async def _balance(db, phone: str) -> float:
    db.expire_all()
    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one()
    return float(user.balance)


async def _topup(client, tokens, amount=20000, **extra):
    res = await client.post(
        "/api/v1/payments/topup",
        json={"amount": amount, "gateway": "click", **extra},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 200, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Click: web checkout
# ---------------------------------------------------------------------------
async def test_click_prepare_then_complete_credits_exactly_once(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    created = await _topup(client, tokens, 20000)
    tx_id = created["transactionId"]
    assert "my.click.uz/services/pay" in created["clickUrl"]
    assert f"transaction_param={tx_id}" in created["clickUrl"]

    prepare = await client.post(CLICK, data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action=0))
    assert prepare.status_code == 200, prepare.text
    assert prepare.json()["error"] == 0
    assert prepare.json()["merchant_prepare_id"] == tx_id
    assert await _balance(db, phone) == 0.0

    complete_form = _click_form(merchant_trans_id=tx_id, amount="20000.00", action=1, merchant_prepare_id=tx_id)
    complete = await client.post(CLICK, data=complete_form)
    assert complete.status_code == 200, complete.text
    assert complete.json()["error"] == 0
    assert await _balance(db, phone) == 20000.0

    # Click retries Complete. The retry is acknowledged and credits nothing.
    again = await client.post(CLICK, data=complete_form)
    assert again.json()["error"] == 0
    assert await _balance(db, phone) == 20000.0
    ledger = (await db.execute(select(WalletTransaction))).scalars().all()
    assert len(ledger) == 1


async def test_click_rejects_a_bad_signature_before_believing_anything(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    tx_id = (await _topup(client, tokens))["transactionId"]

    forged = _click_form(merchant_trans_id=tx_id, amount="20000.00", action=1, merchant_prepare_id=tx_id, secret="wrong")
    res = await client.post(CLICK, data=forged)
    assert res.status_code == 200
    assert res.json()["error"] == -1
    assert await _balance(db, phone) == 0.0

    # An `error < 0` from an unsigned request must not cancel the order either.
    res = await client.post(
        CLICK, data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action=0, error=-5017, secret="wrong")
    )
    assert res.json()["error"] == -1
    db.expire_all()
    tx = await db.get(PaymentTransaction, uuid.UUID(tx_id))
    assert tx.status == "PENDING"


async def test_click_refuses_everything_when_no_secret_is_configured(client, unique_phone, monkeypatch):
    tokens, _, _ = await _user(client, unique_phone)
    tx_id = (await _topup(client, tokens))["transactionId"]
    monkeypatch.setattr(settings, "CLICK_SECRET_KEY", "")
    res = await client.post(CLICK, data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action=0, secret=""))
    assert res.json()["error"] == -1


async def test_click_complete_needs_the_prepare_it_was_issued(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    tx_id = (await _topup(client, tokens))["transactionId"]

    # Complete without a Prepare: signed, but the transaction was never prepared.
    res = await client.post(
        CLICK, data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action=1, merchant_prepare_id=tx_id)
    )
    assert res.json()["error"] == -6
    assert await _balance(db, phone) == 0.0


async def test_click_wrong_amount_and_signed_error_close_the_order(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    tx_id = (await _topup(client, tokens, 20000))["transactionId"]

    res = await client.post(CLICK, data=_click_form(merchant_trans_id=tx_id, amount="19000.00", action=0))
    assert res.json()["error"] == -2

    res = await client.post(CLICK, data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action=0, error=-5017))
    assert res.json()["error"] == -9
    db.expire_all()
    tx = await db.get(PaymentTransaction, uuid.UUID(tx_id))
    assert tx.status == "CANCELLED"

    # A cancelled order can no longer be prepared or paid.
    res = await client.post(CLICK, data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action=0))
    assert res.json()["error"] == -9
    assert await _balance(db, phone) == 0.0


async def test_click_test_transaction_only_in_test_mode(client, monkeypatch):
    res = await client.post(CLICK, data=_click_form(merchant_trans_id="test", amount="1000.00", action=0))
    assert res.json()["error"] == -5

    monkeypatch.setattr(settings, "CLICK_TEST_MODE", True)
    res = await client.post(CLICK, data=_click_form(merchant_trans_id="test", amount="1000.00", action=0))
    assert res.json()["error"] == 0
    assert res.json()["merchant_prepare_id"] == "test"


# ---------------------------------------------------------------------------
# Click: paid directly from the Click app, by phone number
# ---------------------------------------------------------------------------
async def test_click_direct_payment_by_phone_credits_that_user(client, db, unique_phone):
    _, phone, _ = await _user(client, unique_phone)
    _, other_phone, _ = await _user(client, unique_phone)

    typed = phone[1:]  # "998901234567" as a customer types it
    prepare = await client.post(CLICK, data=_click_form(merchant_trans_id=typed, amount="15000", action=0, click_trans_id="900"))
    assert prepare.json()["error"] == 0, prepare.text
    prepare_id = prepare.json()["merchant_prepare_id"]
    uuid.UUID(prepare_id)  # a real transaction was opened

    complete = await client.post(
        CLICK, data=_click_form(merchant_trans_id=typed, amount="15000", action=1, merchant_prepare_id=prepare_id, click_trans_id="900")
    )
    assert complete.json()["error"] == 0, complete.text
    assert await _balance(db, phone) == 15000.0
    assert await _balance(db, other_phone) == 0.0


async def test_click_direct_payment_wildcards_match_nobody(client, db, unique_phone):
    """`%%%%%%%%` used to reach `ilike` unescaped and match every user."""
    await _user(client, unique_phone)
    await _user(client, unique_phone)
    for typed in ("%%%%%%%%", "________", "%"):
        res = await client.post(CLICK, data=_click_form(merchant_trans_id=typed, amount="15000", action=0))
        assert res.status_code == 200, res.text
        assert res.json()["error"] == -5
    assert (await db.execute(select(PaymentTransaction))).scalars().all() == []


async def test_click_direct_amount_must_be_within_bounds(client, unique_phone):
    _, phone, _ = await _user(client, unique_phone)
    res = await client.post(CLICK, data=_click_form(merchant_trans_id=phone, amount="500", action=0))
    assert res.json()["error"] == -2
    res = await client.post(CLICK, data=_click_form(merchant_trans_id=phone, amount="99999999", action=0))
    assert res.json()["error"] == -2


# ---------------------------------------------------------------------------
# Top-up creation
# ---------------------------------------------------------------------------
async def test_topup_return_url_is_pinned_to_our_site(client, unique_phone):
    tokens, _, _ = await _user(client, unique_phone)
    created = await _topup(client, tokens, returnUrl="https://evil.example/steal?x=1")
    assert "evil.example" not in created["clickUrl"]
    assert "return_url=https%3A%2F%2Fuyiz.uz%2Fprofile" in created["clickUrl"]

    created = await _topup(client, tokens, returnUrl="https://uyiz.uz/profile?tab=wallet")
    assert "return_url=https%3A%2F%2Fuyiz.uz%2Fprofile%3Ftab%3Dwallet" in created["clickUrl"]


async def test_topup_payme_return_url_cannot_inject_parameters(client, unique_phone):
    tokens, _, _ = await _user(client, unique_phone)
    res = await client.post(
        "/api/v1/payments/topup",
        json={"amount": 20000, "gateway": "payme", "returnUrl": "https://uyiz.uz/p;a=1"},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 200, res.text
    encoded = res.json()["paymeUrl"].rsplit("/", 1)[1]
    decoded = base64.b64decode(encoded).decode()
    assert decoded.count(";a=") == 1
    assert "a=2000000" in decoded
    assert decoded.endswith(";c=https://uyiz.uz/profile")


async def test_topup_rejects_bad_amounts_and_stray_fields(client, unique_phone):
    tokens, _, _ = await _user(client, unique_phone)
    for amount in (0, 500, 999, 5_000_001, -20000):
        res = await client.post("/api/v1/payments/topup", json={"amount": amount}, headers=auth_headers(tokens))
        assert res.status_code in (400, 422), (amount, res.text)
    res = await client.post(
        "/api/v1/payments/topup",
        json={"amount": 20000, "cardPan": "8600123412341234"},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 422


async def test_a_new_topup_supersedes_the_previous_open_one(client, db, unique_phone):
    tokens, _, _ = await _user(client, unique_phone)
    first = (await _topup(client, tokens))["transactionId"]
    second = (await _topup(client, tokens))["transactionId"]
    assert first != second

    db.expire_all()
    assert (await db.get(PaymentTransaction, uuid.UUID(first))).status == "CANCELLED"
    assert (await db.get(PaymentTransaction, uuid.UUID(second))).status == "PENDING"

    # The superseded link can no longer be paid into.
    res = await client.post(CLICK, data=_click_form(merchant_trans_id=first, amount="20000.00", action=0))
    assert res.json()["error"] == -9


async def test_topup_status_is_scoped_to_its_owner(client, db, unique_phone):
    """The site asks this the moment a customer comes back from the gateway.

    It must answer for the person who opened the checkout, distinguish an
    abandoned checkout from a paid one, and say nothing at all to anybody
    else — the sheet that hung on "redirecting" had no way to ask before.
    """
    tokens, phone, _ = await _user(client, unique_phone)
    other_tokens, _, _ = await _user(client, unique_phone)
    created = await _topup(client, tokens, 20000)
    tx_id = created["transactionId"]

    pending = await client.get(f"/api/v1/payments/topup/{tx_id}/status", headers=auth_headers(tokens))
    assert pending.status_code == 200, pending.text
    assert pending.json()["status"] == "PENDING"
    assert pending.json()["paid"] is False
    assert pending.json()["amount"] == 20000.0

    # Somebody else's checkout is not visible, not even as a status.
    theirs = await client.get(f"/api/v1/payments/topup/{tx_id}/status", headers=auth_headers(other_tokens))
    assert theirs.status_code == 404

    missing = await client.get(f"/api/v1/payments/topup/{uuid.uuid4()}/status", headers=auth_headers(tokens))
    assert missing.status_code == 404

    anonymous = await client.get(f"/api/v1/payments/topup/{tx_id}/status")
    assert anonymous.status_code in (401, 403)

    prepare = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action="0"),
    )
    assert prepare.json()["error"] == 0, prepare.text
    complete = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(
            merchant_trans_id=tx_id,
            amount="20000.00",
            action="1",
            merchant_prepare_id=str(prepare.json()["merchant_prepare_id"]),
        ),
    )
    assert complete.json()["error"] == 0, complete.text

    paid = await client.get(f"/api/v1/payments/topup/{tx_id}/status", headers=auth_headers(tokens))
    assert paid.status_code == 200
    assert paid.json()["paid"] is True
    assert paid.json()["status"] == "SUCCESS"
    assert paid.json()["balance"] == 20000.0
    assert await _balance(db, phone) == 20000.0


async def test_topup_needs_a_configured_gateway(client, unique_phone, monkeypatch):
    tokens, _, _ = await _user(client, unique_phone)
    monkeypatch.setattr(settings, "PAYME_MERCHANT_ID", "")
    res = await client.post(
        "/api/v1/payments/topup", json={"amount": 20000, "gateway": "payme"}, headers=auth_headers(tokens)
    )
    assert res.status_code == 503
    assert res.json()["code"] == "payments_unavailable"


async def test_topup_requires_a_signed_in_user(client):
    res = await client.post("/api/v1/payments/topup", json={"amount": 20000})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Spending the wallet
# ---------------------------------------------------------------------------
async def _fund(client, tokens, amount):
    tx_id = (await _topup(client, tokens, amount))["transactionId"]
    amt = f"{amount:.2f}"
    prepare = await client.post(CLICK, data=_click_form(merchant_trans_id=tx_id, amount=amt, action=0, click_trans_id=tx_id[:6]))
    assert prepare.json()["error"] == 0, prepare.text
    complete = await client.post(
        CLICK, data=_click_form(merchant_trans_id=tx_id, amount=amt, action=1, merchant_prepare_id=tx_id, click_trans_id=tx_id[:6])
    )
    assert complete.json()["error"] == 0, complete.text


async def test_buying_a_badge_debits_once_and_never_overdraws(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    await _fund(client, tokens, 25000)

    res = await client.post("/api/v1/payments/buy-service", json={"serviceType": "VERIFIED_BADGE"}, headers=auth_headers(tokens))
    assert res.status_code == 200, res.text
    assert res.json()["balanceAfter"] == 5000.0
    assert await _balance(db, phone) == 5000.0

    res = await client.post("/api/v1/payments/buy-service", json={"serviceType": "VERIFIED_BADGE"}, headers=auth_headers(tokens))
    assert res.status_code == 400
    assert res.json()["code"] == "already_verified"

    mine = await client.post("/api/v1/listings", json=VALID_LISTING, headers=auth_headers(tokens))
    assert mine.status_code == 201, mine.text
    res = await client.post(
        "/api/v1/payments/buy-service",
        json={"serviceType": "VIP_LISTING", "listingId": mine.json()["data"]["id"]},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 400
    assert res.json()["code"] == "insufficient_balance"
    assert await _balance(db, phone) == 5000.0

    wallet = await client.get("/api/v1/payments/wallet", headers=auth_headers(tokens))
    assert wallet.status_code == 200
    assert wallet.json()["isVerified"] is True
    assert wallet.json()["balance"] == 5000.0


async def test_click_reversal_after_success_takes_the_money_back(client, db, unique_phone):
    """Click can cancel a payment it already settled; the wallet has to follow.

    Only the PENDING case was handled, so a signed cancellation of a credited
    top-up left the so'm in the wallet while the card was refunded.
    """
    tokens, phone, _ = await _user(client, unique_phone)
    created = await _topup(client, tokens, 20000)
    tx_id = created["transactionId"]

    prepare = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(merchant_trans_id=tx_id, amount="20000.00", action="0"),
    )
    assert prepare.json()["error"] == 0, prepare.text
    complete = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(
            merchant_trans_id=tx_id,
            amount="20000.00",
            action="1",
            merchant_prepare_id=str(prepare.json()["merchant_prepare_id"]),
        ),
    )
    assert complete.json()["error"] == 0, complete.text
    assert await _balance(db, phone) == 20000.0

    reversal = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(
            merchant_trans_id=tx_id,
            amount="20000.00",
            action="1",
            merchant_prepare_id=str(prepare.json()["merchant_prepare_id"]),
            error=-9,
        ),
    )
    assert reversal.json()["error"] == -9, reversal.text
    assert await _balance(db, phone) == 0.0

    db.expire_all()
    tx = (await db.execute(select(PaymentTransaction).where(PaymentTransaction.id == uuid.UUID(tx_id)))).scalar_one()
    assert tx.status == "REFUNDED"
    refunds = (
        await db.execute(
            select(WalletTransaction).where(
                WalletTransaction.reference_id == uuid.UUID(tx_id),
                WalletTransaction.type == "REFUND",
            )
        )
    ).scalars().all()
    assert len(refunds) == 1
    assert refunds[0].amount == -20000.0

    # A repeated cancellation must not debit twice: REFUNDED is terminal.
    again = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(
            merchant_trans_id=tx_id,
            amount="20000.00",
            action="1",
            merchant_prepare_id=str(prepare.json()["merchant_prepare_id"]),
            error=-9,
        ),
    )
    assert again.json()["error"] == -9
    assert await _balance(db, phone) == 0.0


async def test_a_reversal_records_what_it_could_actually_take(client, db, unique_phone):
    """The ledger must state the real delta, not the wished-for one.

    When the wallet has been spent down, the clawback is partial. Writing the
    full amount into wallet_transactions made SUM(amount) and users.balance
    disagree for good.
    """
    tokens, phone, _ = await _user(client, unique_phone)
    created = await _topup(client, tokens, 25000)
    tx_id = created["transactionId"]

    prepare = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(merchant_trans_id=tx_id, amount="25000.00", action="0"),
    )
    complete = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(
            merchant_trans_id=tx_id,
            amount="25000.00",
            action="1",
            merchant_prepare_id=str(prepare.json()["merchant_prepare_id"]),
        ),
    )
    assert complete.json()["error"] == 0
    spent = await client.post(
        "/api/v1/payments/buy-service", json={"serviceType": "VERIFIED_BADGE"}, headers=auth_headers(tokens)
    )
    assert spent.status_code == 200, spent.text
    assert await _balance(db, phone) == 5000.0

    reversal = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data=_click_form(
            merchant_trans_id=tx_id,
            amount="25000.00",
            action="1",
            merchant_prepare_id=str(prepare.json()["merchant_prepare_id"]),
            error=-9,
        ),
    )
    assert reversal.json()["error"] == -9
    # Never negative, and the row says what really moved.
    assert await _balance(db, phone) == 0.0
    refund = (
        await db.execute(
            select(WalletTransaction).where(
                WalletTransaction.reference_id == uuid.UUID(tx_id),
                WalletTransaction.type == "REFUND",
            )
        )
    ).scalar_one()
    assert refund.amount == -5000.0
    assert refund.balance_after == 0.0
    assert "qoplanmadi" in refund.description


async def test_two_badge_purchases_racing_pay_for_one_badge(client, db, unique_phone):
    """`user.is_verified` was read off an unlocked row, so both requests passed."""
    import asyncio

    tokens, phone, _ = await _user(client, unique_phone)
    await _fund(client, tokens, 45000)

    first, second = await asyncio.gather(
        client.post("/api/v1/payments/buy-service", json={"serviceType": "VERIFIED_BADGE"}, headers=auth_headers(tokens)),
        client.post("/api/v1/payments/buy-service", json={"serviceType": "VERIFIED_BADGE"}, headers=auth_headers(tokens)),
    )
    codes = sorted([first.status_code, second.status_code])
    assert codes == [200, 400], f"{first.status_code}/{first.text} {second.status_code}/{second.text}"
    loser = first if first.status_code == 400 else second
    assert loser.json()["code"] == "already_verified"
    assert await _balance(db, phone) == 25000.0

    charges = (
        await db.execute(
            select(WalletTransaction).where(
                WalletTransaction.type == "PURCHASE_VERIFIED_BADGE",
                WalletTransaction.user_id == (
                    select(User.id).where(User.phone == phone).scalar_subquery()
                ),
            )
        )
    ).scalars().all()
    assert len(charges) == 1


async def test_vip_extends_vip_not_whatever_top_was_left(client, db, unique_phone):
    """VIP read its expiry from `featured_until`, so leftover Top became free VIP."""
    tokens, phone, _ = await _user(client, unique_phone)
    await _fund(client, tokens, 100000)
    mine = await client.post("/api/v1/listings", json=VALID_LISTING, headers=auth_headers(tokens))
    assert mine.status_code == 201, mine.text
    listing_id = mine.json()["data"]["id"]

    for _ in range(3):
        res = await client.post(
            "/api/v1/payments/buy-service",
            json={"serviceType": "TOP_LISTING", "listingId": listing_id},
            headers=auth_headers(tokens),
        )
        assert res.status_code == 200, res.text

    res = await client.post(
        "/api/v1/payments/buy-service",
        json={"serviceType": "VIP_LISTING", "listingId": listing_id},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 200, res.text

    db.expire_all()
    listing = (await db.execute(select(Listing).where(Listing.id == uuid.UUID(listing_id)))).scalar_one()
    now = datetime.now(timezone.utc)
    vip_days = (listing.vip_until - now).total_seconds() / 86400
    top_days = (listing.featured_until - now).total_seconds() / 86400
    # One week of VIP was bought, so one week of VIP is what it gets — while
    # the three weeks of Top already paid for are untouched.
    assert 6.5 < vip_days < 7.5, vip_days
    assert 20.5 < top_days < 21.5, top_days


async def test_top_purchase_needs_your_own_public_listing(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    other_tokens, _, _ = await _user(client, unique_phone)
    await _fund(client, tokens, 20000)

    theirs = await client.post("/api/v1/listings", json=VALID_LISTING, headers=auth_headers(other_tokens))
    assert theirs.status_code == 201, theirs.text
    res = await client.post(
        "/api/v1/payments/buy-service",
        json={"serviceType": "TOP_LISTING", "listingId": theirs.json()["data"]["id"]},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 404
    assert await _balance(db, phone) == 20000.0

    mine = await client.post("/api/v1/listings", json=VALID_LISTING, headers=auth_headers(tokens))
    assert mine.status_code == 201, mine.text
    res = await client.post(
        "/api/v1/payments/buy-service",
        json={"serviceType": "TOP_LISTING", "listingId": mine.json()["data"]["id"]},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 200, res.text
    assert res.json()["balanceAfter"] == 13000.0
    detail = await client.get(f"/api/v1/listings/{mine.json()['data']['id']}", headers=auth_headers(tokens))
    assert detail.json()["data"]["isFeatured"] is True


# ---------------------------------------------------------------------------
# Payme
# ---------------------------------------------------------------------------
def _payme_auth(key=PAYME_KEY):
    return {"Authorization": "Basic " + base64.b64encode(f"Paycom:{key}".encode()).decode()}


async def _rpc(client, method, params, key=PAYME_KEY, req_id=1):
    return await client.post(PAYME, json={"id": req_id, "method": method, "params": params}, headers=_payme_auth(key))


async def test_payme_rejects_wrong_and_sandbox_keys_unless_test_mode(client, unique_phone, monkeypatch):
    res = await _rpc(client, "CheckTransaction", {"id": "x"}, key="wrong")
    assert res.json()["error"]["code"] == -32504

    # The old code accepted two hardcoded keys forever; the sandbox key
    # now works only while PAYME_TEST_MODE is on.
    res = await _rpc(client, "CheckTransaction", {"id": "x"}, key="sandbox-key")
    assert res.json()["error"]["code"] == -32504
    monkeypatch.setattr(settings, "PAYME_TEST_MODE", True)
    res = await _rpc(client, "CheckTransaction", {"id": "x"}, key="sandbox-key")
    assert res.json()["error"]["code"] == -31003  # authenticated; transaction simply absent


async def test_payme_full_flow_credits_once_and_refund_debits(client, db, unique_phone):
    tokens, phone, _ = await _user(client, unique_phone)
    res = await client.post(
        "/api/v1/payments/topup", json={"amount": 30000, "gateway": "payme"}, headers=auth_headers(tokens)
    )
    order_id = res.json()["transactionId"]
    account = {"order_id": order_id}

    check = await _rpc(client, "CheckPerformTransaction", {"amount": 3000000, "account": account})
    assert check.json()["result"]["allow"] is True, check.text

    bad = await _rpc(client, "CheckPerformTransaction", {"amount": 2999999, "account": account})
    assert bad.json()["error"]["code"] == -31001

    create = await _rpc(client, "CreateTransaction", {"id": "pm-1", "time": NOW_MS, "amount": 3000000, "account": account})
    assert create.json()["result"]["state"] == 1, create.text

    # A second Payme transaction for the same live order is refused.
    clash = await _rpc(client, "CreateTransaction", {"id": "pm-2", "time": NOW_MS + 1, "amount": 3000000, "account": account})
    assert clash.json()["error"]["code"] == -31050

    perform = await _rpc(client, "PerformTransaction", {"id": "pm-1"})
    assert perform.json()["result"]["state"] == 2, perform.text
    assert await _balance(db, phone) == 30000.0

    again = await _rpc(client, "PerformTransaction", {"id": "pm-1"})
    assert again.json()["result"]["state"] == 2
    assert await _balance(db, phone) == 30000.0

    cancel = await _rpc(client, "CancelTransaction", {"id": "pm-1", "reason": 5})
    assert cancel.json()["result"]["state"] == -2
    assert await _balance(db, phone) == 0.0

    statement = await _rpc(client, "GetStatement", {"from": NOW_MS - 1000, "to": NOW_MS + 1000})
    rows = statement.json()["result"]["transactions"]
    assert [r["id"] for r in rows] == ["pm-1"]


async def test_payme_malformed_input_is_an_rpc_error_not_a_500(client):
    for params in ({"amount": "abc", "account": {"order_id": "1"}}, {"amount": None, "account": "nope"}, {}):
        res = await _rpc(client, "CheckPerformTransaction", params)
        assert res.status_code == 200, res.text
        assert "error" in res.json()
    res = await _rpc(client, "GetStatement", {"from": "x", "to": []})
    assert res.json()["error"]["code"] == -32600
    res = await client.post(PAYME, content=b"{not json", headers=_payme_auth())
    assert res.json()["error"]["code"] == -32700


async def test_payme_sandbox_rows_never_touch_a_wallet(client, db, unique_phone, monkeypatch):
    _, phone, _ = await _user(client, unique_phone)
    monkeypatch.setattr(settings, "PAYME_TEST_MODE", True)
    account = {"order_id": "sandbox_test"}
    create = await _rpc(client, "CreateTransaction", {"id": "sb-1", "time": NOW_MS, "amount": 500000, "account": account})
    assert create.json()["result"]["state"] == 1, create.text
    perform = await _rpc(client, "PerformTransaction", {"id": "sb-1"})
    assert perform.json()["result"]["state"] == 2
    assert await _balance(db, phone) == 0.0
    cancel = await _rpc(client, "CancelTransaction", {"id": "sb-1", "reason": 5})
    assert cancel.json()["result"]["state"] == -2
    # It used to debit the first user here: a refund of money never credited.
    assert await _balance(db, phone) == 0.0
    assert (await db.execute(select(WalletTransaction))).scalars().all() == []


async def test_health_endpoints_do_not_leak_merchant_ids(client):
    res = await client.get("/api/v1/payments/click/prepare")
    assert res.status_code == 200
    assert SERVICE_ID not in res.text
    res = await client.get(PAYME)
    assert "0123456789abcdef01234567" not in res.text


async def test_click_audit_row_keeps_only_bounded_protocol_fields(client, db, unique_phone):
    """An unsigned stranger can put a row in this table; they cannot choose its size.

    The webhook stores its audit row before the signature is checked — which
    is what an audit trail is for — so the body was a 6 MiB JSONB blob per
    request from anyone on the internet, retained forever. The signature
    material and the card number are dropped as well: one is what a replay
    would need, the other is a PAN.
    """
    junk = "x" * 200_000
    res = await client.post(
        "/api/v1/payments/click/prepare-or-complete",
        data={
            **_click_form(merchant_trans_id=str(uuid.uuid4()), amount="20000.00", action="0"),
            "card_number": "8600123412341234",
            "junk_field": junk,
        },
    )
    assert res.status_code == 200
    from app.models.payment import ClickPaymentLog

    row = (
        await db.execute(select(ClickPaymentLog).order_by(ClickPaymentLog.created_at.desc()).limit(1))
    ).scalar_one()
    stored = row.raw_request or {}
    assert "junk_field" not in stored
    assert "sign_string" not in stored
    assert "card_number" not in stored
    assert stored.get("amount") == "20000.00"
    assert all(len(str(v)) <= 512 for v in stored.values())


async def test_click_non_ascii_signature_is_a_refusal_not_a_crash(client, db):
    """`compare_digest` raises TypeError on non-ASCII; that used to be a 500."""
    form = _click_form(merchant_trans_id=str(uuid.uuid4()), amount="20000.00", action="0")
    form["sign_string"] = "ü" * 32
    res = await client.post("/api/v1/payments/click/prepare-or-complete", data=form)
    assert res.status_code == 200, res.text
    assert res.json()["error"] == -1


async def test_payme_rejects_malformed_integers_without_raising(client):
    """'--5' and Unicode digits passed `str.isdigit()` and then broke `int()`."""
    from app.routers.payments import _as_int

    assert _as_int("--5") is None
    assert _as_int("²") is None
    assert _as_int(" 42 ") == 42
    assert _as_int(True) is None
