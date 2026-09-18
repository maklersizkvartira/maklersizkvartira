"""Payment router: the Click and Payme webhooks, and the user's wallet.

Money moves through three doors here, and each one is guarded differently:

* **Click** signs every Prepare/Complete with MD5 over the secret key. The
  signature is checked before anything else is believed — before Click's own
  `error` field, before the transaction lookup — because an unsigned request
  is not from Click, whatever it claims.
* **Payme** authenticates with HTTP Basic and a JSON-RPC body. Sandbox
  behaviour (arbitrary accounts, arbitrary amounts) exists only behind
  `PAYME_TEST_MODE`.
* **The wallet** is spent by the signed-in user. Every credit and every debit
  is a single `UPDATE users SET balance = balance ± x` — never a Python
  read-modify-write — and every transaction row is locked (`FOR UPDATE`)
  while it changes state, so two concurrent Completes credit once and two
  concurrent purchases cannot overdraw.

The frontend (`src/services/paymentApi.ts`) sends the amount, the gateway
and a return URL, and reads back a checkout link. Card numbers never pass
through here in the clear: Click and Payme mask them, and we keep at most
the last four digits.
"""

from __future__ import annotations

import json
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import structlog
from fastapi import APIRouter, Form, Request, Response
from sqlalchemy import String, cast, desc, exists, func, or_, select, update
from sqlalchemy.orm import lazyload

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.errors import BadRequest, NotFound, ServiceUnavailable
from app.core.rate_limit import enforce
from app.models.listing import Listing
from app.models.payment import ClickPaymentLog, PaymePaymentLog, PaymentTransaction, WalletTransaction
from app.models.user import User
from app.schemas.payment import (
    BuyServiceRequest,
    BuyServiceResponse,
    CreateTopUpRequest,
    CreateTopUpResponse,
    WalletInfoResponse,
    WalletTransactionOut,
)
from app.services import click as click_service
from app.services import ops_alerts
from app.services import payme as payme_service

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

# Service Prices in UZS
PRICES = {
    "VERIFIED_BADGE": 20_000.0,
    "TOP_LISTING": 7_000.0,
    "VIP_LISTING": 12_000.0,
}

#: A top-up that was never paid stops being reusable after this. Click and
#: Payme both give up on a checkout within hours; a PENDING row a week old is
#: an abandoned one, and the webhook must not let it be paid into later.
PENDING_TOPUP_TTL = timedelta(hours=24)

#: The keys under which the gateways have been seen to send a masked card
#: number. Only the last four digits are kept, whatever arrives.
_CARD_KEYS = ("card_pan", "card_number", "pan", "card_mask", "card")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def mask_card(value: Any) -> str | None:
    """Reduce whatever a gateway sent to `•••• 1234`.

    A full PAN is a thing we are not allowed to store (PCI DSS) and have no
    use for. The old code kept the string as received and the admin panel
    then rendered it back out under `rawCardPan`.
    """
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if len(digits) < 4:
        return None
    return f"•••• {digits[-4:]}"


def _amount_ok(amount: float) -> bool:
    return (
        math.isfinite(amount)
        and settings.PAYMENT_MIN_TOPUP_UZS <= amount <= settings.PAYMENT_MAX_TOPUP_UZS
    )


def _safe_return_url(candidate: str | None) -> str:
    """Only a URL on our own site may be the place a gateway sends the customer back to.

    The gateways redirect to whatever we put in the link. Left unchecked, a
    payment link generated through our API could deliver the customer, fresh
    from entering a card, to any page an attacker chose — and Payme's `;`
    separated parameter string could be extended through it as well.
    """
    fallback = f"{settings.SITE_URL.rstrip('/')}/profile"
    if not candidate:
        return fallback
    try:
        site = urlsplit(settings.SITE_URL)
        target = urlsplit(candidate.strip())
    except ValueError:
        return fallback
    if target.scheme not in ("https", "http") or not target.netloc:
        return fallback
    allowed_hosts = {site.netloc.lower()}
    allowed_hosts.update(
        urlsplit(origin).netloc.lower() for origin in settings.cors_origin_list if "://" in origin
    )
    if target.netloc.lower() not in allowed_hosts:
        return fallback
    if ";" in candidate or "\n" in candidate or "\r" in candidate:
        return fallback
    return candidate.strip()


async def _credit_wallet(
    db: DbSession, *, user_id: uuid.UUID, amount: float, description: str, reference_id: uuid.UUID | None
) -> float:
    """Add `amount` to a wallet atomically and record it. Returns the new balance."""
    new_balance = (
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(balance=User.balance + float(amount))
            .returning(User.balance)
        )
    ).scalar_one()
    db.add(
        WalletTransaction(
            user_id=user_id,
            type="TOPUP",
            amount=float(amount),
            balance_after=new_balance,
            description=description,
            reference_id=reference_id,
        )
    )
    return float(new_balance)


async def _announce_payment(db: DbSession, *, user_id: uuid.UUID, amount: float, provider: str) -> None:
    """Tell the operations group a wallet was funded. After the commit, never before it."""
    payer = await db.get(User, user_id)
    if payer is None:
        return
    await ops_alerts.payment_received(db, user_name=payer.name, phone=payer.phone, amount=amount, provider=provider)


async def _lock_transaction(db: DbSession, tx_id: uuid.UUID) -> PaymentTransaction | None:
    """Load a transaction row and hold it until the request commits.

    The gateways retry, and they retry concurrently. Two Completes for one
    transaction that both read `status == PENDING` before either writes
    would both credit; the lock serialises them so the second sees SUCCESS.
    """
    return (
        await db.execute(
            select(PaymentTransaction)
            .where(PaymentTransaction.id == tx_id)
            .options(lazyload("*"))
            .with_for_update(of=PaymentTransaction)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()


def _parse_uuid(value: Any) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value).strip())
    except (ValueError, TypeError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# Click Webhook (Prepare & Complete)
# ---------------------------------------------------------------------------
@router.get("/click/prepare-or-complete", summary="Click webhook health check")
@router.get("/click/prepare", summary="Click prepare health check")
@router.get("/click/complete", summary="Click complete health check")
async def click_webhook_health() -> dict[str, Any]:
    """Health check for Click webhook endpoints when checked via GET in a browser.

    Says whether the integration is configured, and nothing about how: the
    service id used to be echoed here to anyone who asked.
    """
    return {
        "status": "ok",
        "service": "Click Payment Webhook",
        "configured": click_service.is_configured(),
        "supported_actions": ["PREPARE (action=0)", "COMPLETE (action=1)"],
    }


async def _find_direct_payer(db: DbSession, target_param: str) -> User | None:
    """Resolve the identifier a customer typed into the Click app.

    Click's catalogue lets a customer pay "Uyiz.uz" directly and type any
    string as the account: a phone, the short id printed on their wallet
    card, or a referral code. Every match here must be exact or a fixed
    prefix — a lookup that could match more than one user would credit one
    of them at random.
    """
    if not target_param or len(target_param) > 64:
        return None

    # 1. Full user UUID
    if (u_uuid := _parse_uuid(target_param)) is not None:
        return (await db.execute(select(User).where(User.id == u_uuid))).scalar_one_or_none()

    # 2. UUID prefix, as printed on the wallet card. `ilike` treats `%` and
    #    `_` as wildcards, so a customer (or anyone) typing "%%%%%%%%" used to
    #    match every user; only hex characters can be part of a UUID.
    if len(target_param) >= 8 and all(c in "0123456789abcdefABCDEF-" for c in target_param):
        rows = (
            await db.execute(
                select(User).where(cast(User.id, String).ilike(f"{target_param.lower()}%")).limit(2)
            )
        ).scalars().all()
        if len(rows) == 1:
            return rows[0]
        if rows:
            return None

    # 3. Phone number (+99890..., 99890..., 90..., 890...)
    clean_digits = "".join(c for c in target_param if c.isdigit())
    candidate_phones = {target_param}
    if len(clean_digits) == 9:
        candidate_phones.add(f"+998{clean_digits}")
    elif len(clean_digits) == 12 and clean_digits.startswith("998"):
        candidate_phones.add(f"+{clean_digits}")
    elif len(clean_digits) == 10 and clean_digits.startswith("8"):
        candidate_phones.add(f"+998{clean_digits[1:]}")
    rows = (
        await db.execute(select(User).where(User.phone.in_(list(candidate_phones))).limit(2))
    ).scalars().all()
    if len(rows) == 1:
        return rows[0]
    if rows:
        return None

    # 4. Referral code, with or without the prefix the card prints
    if len(target_param) <= 20:
        clean_code = target_param.upper()
        for prefix in ("UYIZ-", "UYIZ", "ID-", "ID:", "ID"):
            if clean_code.startswith(prefix):
                clean_code = clean_code[len(prefix):].strip()
                break
        rows = (
            await db.execute(
                select(User)
                .where(or_(User.referral_code == target_param.upper(), User.referral_code == clean_code))
                .limit(2)
            )
        ).scalars().all()
        if len(rows) == 1:
            return rows[0]

    return None


@router.post("/click/prepare-or-complete", summary="Click webhook endpoint")
@router.post("/click/prepare", summary="Click prepare webhook alias")
@router.post("/click/complete", summary="Click complete webhook alias")
async def click_webhook(
    request: Request,
    db: DbSession,
    click_trans_id: str = Form(...),
    service_id: str = Form(...),
    click_paydoc_id: str = Form(default=""),
    merchant_trans_id: str = Form(...),
    amount: float = Form(...),
    action: int = Form(...),
    error: int = Form(...),
    error_note: str = Form(default=""),
    sign_time: str = Form(...),
    sign_string: str = Form(...),
    merchant_prepare_id: str | None = Form(default=None),
) -> dict[str, Any]:
    """Handle Click's Prepare (action=0) and Complete (action=1) requests.

    Complies with docs.click.uz specifications and logs all actions.
    """
    client_ip = request.client.host if request.client else None
    raw_form = {k: v for k, v in (await request.form()).items() if isinstance(v, str)}
    merchant_trans_id = merchant_trans_id.strip()
    merchant_prepare_id = merchant_prepare_id.strip() if merchant_prepare_id else None

    log.info(
        "click.webhook_received",
        action=action,
        click_trans_id=click_trans_id,
        merchant_trans_id=merchant_trans_id,
        amount=amount,
        client_ip=client_ip,
    )

    # 1. Base log record (will update with response)
    audit_log = ClickPaymentLog(
        action="PREPARE" if action == 0 else "COMPLETE",
        click_trans_id=click_trans_id[:64],
        service_id=service_id[:64],
        merchant_trans_id=merchant_trans_id[:64],
        amount=amount if math.isfinite(amount) else None,
        raw_request=raw_form,
        client_ip=client_ip,
    )
    db.add(audit_log)

    async def _respond(err_code: int, err_text: str, extra: dict | None = None) -> dict[str, Any]:
        resp: dict[str, Any] = {
            "click_trans_id": click_trans_id,
            "merchant_trans_id": merchant_trans_id,
            "merchant_prepare_id": merchant_prepare_id or merchant_trans_id,
            "error": err_code,
            "error_note": err_text,
        }
        if extra:
            resp.update(extra)
        audit_log.error_code = err_code
        audit_log.error_note = err_text
        audit_log.raw_response = resp
        await db.commit()
        return resp

    # 2. Signature first. Nothing below — not even Click's own `error`
    #    field — is trusted from a request that is not provably Click's.
    if not click_service.is_configured() or service_id != settings.CLICK_SERVICE_ID:
        log.error("click.not_configured_or_wrong_service", service_id=service_id)
        return await _respond(click_service.CLICK_SIGN_CHECK_FAILED, "SIGN CHECK FAILED!")

    is_valid = click_service.verify_click_signature(
        click_trans_id=click_trans_id,
        service_id=service_id,
        secret_key=settings.CLICK_SECRET_KEY,
        merchant_trans_id=merchant_trans_id,
        merchant_prepare_id=merchant_prepare_id,
        amount=raw_form.get("amount", amount),
        action=action,
        sign_time=sign_time,
        sign_string=sign_string,
    )
    if not is_valid:
        log.error("click.sign_check_failed", click_trans_id=click_trans_id)
        return await _respond(click_service.CLICK_SIGN_CHECK_FAILED, "SIGN CHECK FAILED!")

    if action not in (0, 1):
        return await _respond(click_service.CLICK_ACTION_NOT_FOUND, "Action not found")

    # 3. Click's onboarding check. Signed, credits nothing, and only while
    #    the switch is on.
    if settings.CLICK_TEST_MODE and merchant_trans_id.lower() == "test":
        log.info("click.test_transaction_success", action=action, click_trans_id=click_trans_id)
        key = "merchant_prepare_id" if action == 0 else "merchant_confirm_id"
        return await _respond(click_service.CLICK_SUCCESS, "Success", {key: "test"})

    # 4. Find the transaction: by merchant_prepare_id (Complete) or by the
    #    transaction_param we put in the checkout link (Prepare from the web).
    payment_tx: PaymentTransaction | None = None
    lookup_uuid = _parse_uuid(merchant_prepare_id or merchant_trans_id)
    if lookup_uuid is not None:
        payment_tx = await _lock_transaction(db, lookup_uuid)
        if payment_tx is not None and payment_tx.provider != "CLICK":
            # A Payme order id pasted into a Click request. Signed, so it is
            # Click's mistake rather than an attack, but it is still the
            # wrong ledger.
            payment_tx = None

    # 5. Click told us the payment failed on its side. Now that we know the
    #    request is genuine, close the transaction so the link cannot be
    #    paid into later, and answer with Click's own code.
    if error < 0:
        log.warning("click.reported_error", error=error, error_note=error_note)
        if payment_tx is not None and payment_tx.status == "PENDING":
            payment_tx.status = "CANCELLED"
            payment_tx.error_code = error
            payment_tx.error_note = error_note[:500] if error_note else None
        return await _respond(click_service.CLICK_TRANSACTION_CANCELLED, error_note or "Click reported error")

    if not _amount_ok(amount):
        log.error("click.amount_out_of_range", amount=amount)
        return await _respond(click_service.CLICK_INCORRECT_AMOUNT, "Incorrect amount")

    # 6. No transaction: the customer paid us directly from the Click app,
    #    typing an identifier as the account.
    if payment_tx is None:
        if action != 0:
            log.error("click.direct_complete_without_prepare", merchant_trans_id=merchant_trans_id)
            return await _respond(click_service.CLICK_TRANSACTION_NOT_FOUND, "Transaction not found")

        user = await _find_direct_payer(db, merchant_trans_id)
        if user is None:
            log.error("click.user_or_tx_not_found", merchant_trans_id=merchant_trans_id)
            return await _respond(click_service.CLICK_USER_NOT_FOUND, "User or transaction not found")

        payment_tx = PaymentTransaction(
            user_id=user.id,
            provider="CLICK",
            status="PENDING",
            amount=amount,
            service_type="TOPUP_DIRECT_CLICK",
        )
        db.add(payment_tx)
        await db.flush()

    # 7. Amount must be exactly what the transaction was opened for.
    if abs(float(payment_tx.amount) - float(amount)) > 0.01:
        log.error("click.incorrect_amount", expected=payment_tx.amount, received=amount)
        return await _respond(click_service.CLICK_INCORRECT_AMOUNT, "Incorrect amount")

    card = next((raw_form[k] for k in _CARD_KEYS if raw_form.get(k)), None)
    if card:
        payment_tx.card_pan = mask_card(card)

    # ACTION 0: PREPARE
    if action == 0:
        if payment_tx.status == "SUCCESS":
            return await _respond(click_service.CLICK_ALREADY_PAID, "Already paid")
        if payment_tx.status != "PENDING":
            return await _respond(click_service.CLICK_TRANSACTION_CANCELLED, "Transaction cancelled")
        if payment_tx.service_type == "TOPUP" and _now() - payment_tx.created_at > PENDING_TOPUP_TTL:
            payment_tx.status = "CANCELLED"
            payment_tx.error_note = "expired"
            return await _respond(click_service.CLICK_TRANSACTION_CANCELLED, "Transaction expired")

        payment_tx.click_trans_id = click_trans_id[:64]
        payment_tx.click_paydoc_id = click_paydoc_id[:64]
        payment_tx.merchant_prepare_id = str(payment_tx.id)
        return await _respond(
            click_service.CLICK_SUCCESS,
            "Success",
            {"merchant_prepare_id": str(payment_tx.id)},
        )

    # ACTION 1: COMPLETE
    if payment_tx.status == "SUCCESS":
        return await _respond(
            click_service.CLICK_SUCCESS,
            "Success (already processed)",
            {"merchant_confirm_id": str(payment_tx.id)},
        )
    if payment_tx.status != "PENDING":
        return await _respond(click_service.CLICK_TRANSACTION_CANCELLED, "Transaction cancelled")
    # A Complete must follow a Prepare of the same transaction: Click sends
    # back the merchant_prepare_id we answered with, and it must match.
    if not payment_tx.merchant_prepare_id or merchant_prepare_id != payment_tx.merchant_prepare_id:
        log.error("click.complete_prepare_mismatch", merchant_prepare_id=merchant_prepare_id)
        return await _respond(click_service.CLICK_TRANSACTION_NOT_FOUND, "Transaction not found")
    if payment_tx.click_trans_id and payment_tx.click_trans_id != click_trans_id:
        log.error("click.complete_trans_id_mismatch", click_trans_id=click_trans_id)
        return await _respond(click_service.CLICK_TRANSACTION_NOT_FOUND, "Transaction not found")

    payment_tx.status = "SUCCESS"
    payment_tx.click_trans_id = click_trans_id[:64]
    payment_tx.click_paydoc_id = click_paydoc_id[:64]
    payment_tx.completed_at = _now()

    new_balance = await _credit_wallet(
        db,
        user_id=payment_tx.user_id,
        amount=payment_tx.amount,
        description=f"Click orqali hisob to‘ldirildi (+{int(payment_tx.amount):,} so'm)",
        reference_id=payment_tx.id,
    )
    log.info(
        "click.payment_completed",
        user_id=str(payment_tx.user_id),
        amount=payment_tx.amount,
        new_balance=new_balance,
    )
    await _announce_payment(db, user_id=payment_tx.user_id, amount=payment_tx.amount, provider="Click")
    return await _respond(
        click_service.CLICK_SUCCESS,
        "Success",
        {"merchant_confirm_id": str(payment_tx.id)},
    )


# ---------------------------------------------------------------------------
# User Wallet & Top-up Endpoints
# ---------------------------------------------------------------------------
@router.post("/topup", response_model=CreateTopUpResponse, summary="Create topup payment (Click or Payme)")
async def create_topup(
    payload: CreateTopUpRequest,
    user: CurrentUser,
    db: DbSession,
) -> CreateTopUpResponse:
    """Create a pending payment transaction and return gateway payment URLs."""
    await enforce("payment_topup", str(user.id))

    if not _amount_ok(payload.amount):
        raise BadRequest(
            "topup_amount_out_of_range",
            params={
                "min": f"{settings.PAYMENT_MIN_TOPUP_UZS:,}".replace(",", " "),
                "max": f"{settings.PAYMENT_MAX_TOPUP_UZS:,}".replace(",", " "),
            },
            field="amount",
        )

    provider = "PAYME" if payload.gateway == "payme" else "CLICK"
    configured = payme_service.is_configured() if provider == "PAYME" else click_service.is_configured()
    if not configured:
        raise ServiceUnavailable("payments_unavailable")

    # A new checkout link supersedes the ones before it. Every "top up" press
    # opens a PENDING row, and most are abandoned on the gateway's page; the
    # first version capped a person at five open rows and then refused them
    # with "too many unfinished payments" — which is what somebody trying the
    # button a few times saw on their sixth try. Now the older links are
    # closed instead (a Prepare against one answers "cancelled"), so there is
    # never more than one live checkout per account and no cap to hit.
    await db.execute(
        update(PaymentTransaction)
        .where(
            PaymentTransaction.user_id == user.id,
            PaymentTransaction.status == "PENDING",
            PaymentTransaction.service_type == "TOPUP",
        )
        .values(status="CANCELLED", error_note="superseded")
    )

    tx = PaymentTransaction(
        user_id=user.id,
        provider=provider,
        status="PENDING",
        amount=round(float(payload.amount), 2),
        service_type="TOPUP",
    )
    db.add(tx)
    await db.flush()

    return_url = _safe_return_url(payload.return_url)

    click_url: str | None = None
    payme_url: str | None = None
    if provider == "PAYME":
        payme_url = payme_service.generate_payme_checkout_url(
            amount_uzs=tx.amount,
            transaction_id=str(tx.id),
            return_url=return_url,
        )
    else:
        click_url = click_service.generate_click_url(
            amount=tx.amount,
            transaction_param=str(tx.id),
            return_url=return_url,
        )

    await db.commit()

    return CreateTopUpResponse(
        transaction_id=tx.id,
        amount=tx.amount,
        click_url=click_url,
        click_card_url=click_url,
        payme_url=payme_url,
    )


@router.get("/wallet", response_model=WalletInfoResponse, summary="Get current user wallet & history")
async def get_wallet_info(
    user: CurrentUser,
    db: DbSession,
) -> WalletInfoResponse:
    """Returns user balance and recent transaction history."""
    stmt = (
        select(WalletTransaction)
        .where(WalletTransaction.user_id == user.id)
        .order_by(desc(WalletTransaction.created_at))
        .limit(50)
    )
    txs = (await db.execute(stmt)).scalars().all()

    # Asked of the whole ledger, not the fifty rows above: the badge used to
    # vanish from this response once its purchase scrolled out of the page.
    has_badge_purchase = (
        await db.execute(
            select(
                exists().where(
                    WalletTransaction.user_id == user.id,
                    WalletTransaction.type == "PURCHASE_VERIFIED_BADGE",
                )
            )
        )
    ).scalar_one()

    return WalletInfoResponse(
        balance=float(user.balance),
        is_verified=bool(user.is_verified and has_badge_purchase),
        transactions=[WalletTransactionOut.model_validate(t) for t in txs],
    )


@router.post("/buy-service", response_model=BuyServiceResponse, summary="Purchase a service using balance")
async def buy_service(
    payload: BuyServiceRequest,
    user: CurrentUser,
    db: DbSession,
) -> BuyServiceResponse:
    """Spend wallet balance to purchase services (Verified badge, Top listing, VIP listing)."""
    await enforce("payment_buy", str(user.id))

    cost = PRICES.get(payload.service_type)
    if cost is None:
        raise BadRequest("invalid_service_type")

    now = _now()
    description = ""
    listing: Listing | None = None

    if payload.service_type == "VERIFIED_BADGE":
        if user.is_verified:
            raise BadRequest("already_verified")
    else:
        if not payload.listing_id:
            raise BadRequest("listing_id_required", field="listing_id")
        listing = (
            await db.execute(
                select(Listing)
                .where(Listing.id == payload.listing_id, Listing.owner_id == user.id)
                .options(lazyload("*"))
                .with_for_update(of=Listing)
            )
        ).scalar_one_or_none()
        if not listing:
            raise NotFound("listing_not_found")
        if not listing.is_public:
            raise BadRequest("top_listing_not_public")

    # The debit is one conditional UPDATE: it succeeds only if the balance
    # covers the cost at the moment it runs, so two purchases racing for the
    # same money cannot both go through. Checking `user.balance` in Python
    # first was exactly that race.
    new_balance = (
        await db.execute(
            update(User)
            .where(User.id == user.id, User.balance >= float(cost))
            .values(balance=User.balance - float(cost))
            .returning(User.balance)
        )
    ).scalar_one_or_none()
    if new_balance is None:
        raise BadRequest("insufficient_balance")

    if payload.service_type == "VERIFIED_BADGE":
        user.is_verified = True
        user.verification_level = max(user.verification_level, 2)
        description = "Tasdiqlanganlik (Galochka) sotib olindi"
    else:
        assert listing is not None
        days = 7
        expire_at = (
            max(listing.featured_until, now) + timedelta(days=days)
            if listing.featured_until and listing.featured_until > now
            else now + timedelta(days=days)
        )
        if payload.service_type == "TOP_LISTING":
            listing.is_featured = True
            listing.featured_until = expire_at
            listing.promotion_weight = max(listing.promotion_weight, 10)
            description = f"Top e'lon xarid qilindi: '{listing.title[:30]}'"
        else:
            listing.is_vip = True
            listing.vip_until = expire_at
            listing.is_featured = True
            listing.featured_until = expire_at
            listing.promotion_weight = max(listing.promotion_weight, 20)
            description = f"VIP e'lon xarid qilindi: '{listing.title[:30]}'"

    db.add(
        WalletTransaction(
            user_id=user.id,
            type=f"PURCHASE_{payload.service_type}",
            amount=-cost,
            balance_after=float(new_balance),
            description=description,
            reference_id=payload.listing_id,
        )
    )
    await db.commit()
    await ops_alerts.service_purchased(
        db, user_name=user.name, phone=user.phone, service=payload.service_type, cost=cost
    )

    return BuyServiceResponse(
        status="success",
        message=f"{description}. Balansingizdan {int(cost):,} so'm yechildi.",
        balance_after=float(new_balance),
    )


# ---------------------------------------------------------------------------
# Payme Merchant API (JSON-RPC 2.0 Webhook)
# ---------------------------------------------------------------------------
@router.options("/payme")
@router.options("/payme/")
async def payme_webhook_options() -> Response:
    return Response(status_code=200)


@router.get("/payme", summary="Payme webhook health check")
@router.get("/payme/", summary="Payme webhook health check (slash)")
async def payme_webhook_health() -> dict[str, Any]:
    """Health check for Payme webhook endpoint when checked via GET."""
    return {
        "status": "ok",
        "service": "Payme Merchant API Webhook (JSON-RPC 2.0)",
        "configured": payme_service.is_configured(),
        "supported_methods": [
            "CheckPerformTransaction",
            "CreateTransaction",
            "PerformTransaction",
            "CancelTransaction",
            "CheckTransaction",
            "GetStatement",
        ],
    }


def _as_int(value: Any) -> int | None:
    """Payme sends integers, but a malformed request must produce an error
    response, not a traceback: every `int(params[...])` used to be a 500."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


_SANDBOX_ORDER_IDS = frozenset({"1", "test", "demo", "sandbox_test"})


@router.post("/payme", summary="Payme Merchant API JSON-RPC 2.0 endpoint")
@router.post("/payme/", summary="Payme Merchant API JSON-RPC 2.0 endpoint (slash)")
async def payme_webhook(
    request: Request,
    db: DbSession,
) -> dict[str, Any]:
    """Handle Payme JSON-RPC 2.0 requests with full audit logging and soliq fiscalization."""
    client_ip = request.client.host if request.client else None
    auth_header = request.headers.get("Authorization")

    # 1. Read raw JSON body first so we always have req_id for Payme responses
    body: dict[str, Any] = {}
    try:
        raw = await request.body()
        parsed = json.loads(raw.decode("utf-8")) if raw else {}
        body = parsed if isinstance(parsed, dict) else {}
    except (ValueError, UnicodeDecodeError):
        body = {}

    req_id = body.get("id")
    method = body.get("method")
    params = body.get("params") if isinstance(body.get("params"), dict) else {}
    account = params.get("account") if isinstance(params.get("account"), dict) else {}

    # 2. Verify Basic Auth. The header itself is never logged: on a failed
    #    attempt it is somebody's guess at our secret, and on a typo it is
    #    the secret with one character wrong.
    if not payme_service.is_configured() or not payme_service.verify_payme_auth(auth_header):
        log.warning("payme.auth_failed", client_ip=client_ip, req_id=req_id, method=method)
        return payme_service.payme_error_response(
            req_id,
            payme_service.PAYME_ERROR_INSUFFICIENT_PRIVILEGE,
            "Ushbu amalni bajarish uchun imtiyozlar yetarli emas",
            "Недостаточно привилегий для выполнения метода",
        )

    if not body:
        return payme_service.payme_error_response(
            req_id,
            payme_service.PAYME_ERROR_PARSE,
            "JSON parsing xatosi",
            "Ошибка парсинга JSON",
        )

    log.info("payme.webhook_received", method=method, req_id=req_id, client_ip=client_ip)

    amount_tiyin = _as_int(params.get("amount"))
    order_id_str = str(account.get("order_id")).strip() if account.get("order_id") is not None else None
    payme_trans_id = str(params.get("id")).strip()[:64] if params.get("id") is not None else None

    # 3. Audit log entry (will be saved at completion)
    audit_log = PaymePaymentLog(
        method=str(method or "UNKNOWN")[:64],
        payme_trans_id=payme_trans_id,
        account_param=order_id_str[:128] if order_id_str else None,
        amount=amount_tiyin / 100 if amount_tiyin is not None else None,
        raw_request=body,
        client_ip=client_ip,
    )
    db.add(audit_log)

    async def _send_response(resp: dict[str, Any]) -> dict[str, Any]:
        audit_log.raw_response = resp
        if "error" in resp:
            audit_log.error_code = resp["error"].get("code")
            audit_log.error_message = str(resp["error"].get("message"))
        await db.commit()
        return resp

    def _err(code: int, uz: str, ru: str, data: Any = None) -> dict[str, Any]:
        return payme_service.payme_error_response(req_id, code, uz, ru, data=data)

    def _ok(result: dict[str, Any]) -> dict[str, Any]:
        return payme_service.payme_success_response(req_id, result)

    async def _find_by_payme_id(lock: bool = False) -> PaymentTransaction | None:
        if not payme_trans_id:
            return None
        stmt = select(PaymentTransaction).where(PaymentTransaction.payme_trans_id == payme_trans_id)
        if lock:
            # The row's `user`/`listing` relationships are joined eagerly,
            # and Postgres refuses FOR UPDATE across an outer join; lock
            # this table only, and load nothing else.
            stmt = stmt.options(lazyload("*")).with_for_update(of=PaymentTransaction)
        return (await db.execute(stmt)).scalars().first()

    def _amount_error() -> dict[str, Any]:
        return _err(payme_service.PAYME_ERROR_INCORRECT_AMOUNT, "Noto'g'ri summa", "Неверная сумма", data="amount")

    def _order_not_found() -> dict[str, Any]:
        return _err(payme_service.PAYME_ERROR_ORDER_NOT_FOUND, "Buyurtma topilmadi", "Заказ не найден", data="order_id")

    def _tx_not_found() -> dict[str, Any]:
        return _err(payme_service.PAYME_ERROR_TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi", "Транзакция не найдена")

    def _missing_id() -> dict[str, Any]:
        return _err(payme_service.PAYME_ERROR_INVALID_JSON_RPC, "id ko'rsatilmadi", "Не указан id транзакции")

    def _is_sandbox(tx: PaymentTransaction | None) -> bool:
        if not settings.PAYME_TEST_MODE:
            return False
        return (order_id_str in _SANDBOX_ORDER_IDS) or (tx is not None and tx.service_type == "SANDBOX_TEST")

    async def _sandbox_transaction(order_uuid: uuid.UUID | None) -> PaymentTransaction | None:
        """The sandbox runner on test.paycom.uz pays into accounts it invents.
        Only with PAYME_TEST_MODE on, and such rows never touch a wallet."""
        if not settings.PAYME_TEST_MODE or amount_tiyin is None or amount_tiyin <= 0:
            return None
        if payme_trans_id:
            existing = (
                await db.execute(
                    select(PaymentTransaction).where(
                        PaymentTransaction.service_type == "SANDBOX_TEST",
                        PaymentTransaction.payme_trans_id == payme_trans_id,
                    )
                )
            ).scalars().first()
            if existing:
                return existing
        first_user = (await db.execute(select(User).limit(1))).scalars().first()
        if not first_user:
            return None
        tx = PaymentTransaction(
            id=order_uuid or uuid.uuid4(),
            user_id=first_user.id,
            provider="PAYME",
            status="PENDING",
            amount=amount_tiyin / 100,
            service_type="SANDBOX_TEST",
        )
        db.add(tx)
        await db.flush()
        return tx

    async def _load_order(lock: bool) -> PaymentTransaction | None:
        """The order behind `account.order_id`, real or sandbox, PAYME only."""
        order_uuid = _parse_uuid(order_id_str) if order_id_str else None
        tx = None
        if order_uuid is not None:
            tx = await _lock_transaction(db, order_uuid) if lock else await db.get(PaymentTransaction, order_uuid)
            if tx is not None and tx.provider != "PAYME":
                tx = None
        if tx is None and _is_sandbox(None):
            tx = await _sandbox_transaction(order_uuid)
        return tx

    def _check_amount(tx: PaymentTransaction) -> tuple[int | None, dict[str, Any] | None]:
        """Returns (expected_tiyin, error)."""
        if amount_tiyin is None or amount_tiyin <= 0 or amount_tiyin > settings.PAYMENT_MAX_TOPUP_UZS * 100:
            return None, _amount_error()
        if _is_sandbox(tx):
            tx.amount = amount_tiyin / 100
            return amount_tiyin, None
        expected = int(round(tx.amount * 100))
        if amount_tiyin != expected:
            return None, _amount_error()
        return expected, None

    now_ms = payme_service.current_time_ms()

    # -----------------------------------------------------------------------
    # METHOD: CheckPerformTransaction
    # -----------------------------------------------------------------------
    if method == "CheckPerformTransaction":
        if not order_id_str:
            return await _send_response(
                _err(payme_service.PAYME_ERROR_ORDER_NOT_FOUND, "account.order_id ko'rsatilmadi", "Не указан параметр order_id", data="order_id")
            )
        tx = await _load_order(lock=False)
        if not tx:
            return await _send_response(_order_not_found())

        expected_tiyin, amount_err = _check_amount(tx)
        if amount_err:
            return await _send_response(amount_err)

        if tx.status == "SUCCESS" or tx.payme_state == payme_service.STATE_DONE:
            return await _send_response(
                _err(payme_service.PAYME_ERROR_ALREADY_PAID, "Tranzaksiya allaqachon bajarilgan", "Транзакция уже выполнена")
            )
        if tx.status not in ("PENDING",) and not _is_sandbox(tx):
            return await _send_response(_order_not_found())
        if tx.service_type == "TOPUP" and _now() - tx.created_at > PENDING_TOPUP_TTL:
            return await _send_response(_order_not_found())

        return await _send_response(
            _ok({"allow": True, "detail": payme_service.get_payme_fiscal_detail(expected_tiyin or 0)})
        )

    # -----------------------------------------------------------------------
    # METHOD: CreateTransaction
    # -----------------------------------------------------------------------
    if method == "CreateTransaction":
        trans_time = _as_int(params.get("time"))
        if not payme_trans_id or trans_time is None or amount_tiyin is None:
            return await _send_response(
                _err(payme_service.PAYME_ERROR_INVALID_JSON_RPC, "Kerakli parametrlar yetarli emas", "Недостаточно параметров")
            )

        # Payme retries CreateTransaction with the same id: answer for the
        # transaction it already opened.
        existing_tx = await _find_by_payme_id(lock=True)
        if existing_tx:
            if existing_tx.payme_state == payme_service.STATE_IN_PROGRESS:
                if (now_ms - (existing_tx.payme_time or 0)) > payme_service.TRANSACTION_TIMEOUT_MS:
                    existing_tx.payme_state = payme_service.STATE_CANCELED
                    existing_tx.payme_reason = payme_service.REASON_CANCELLED_BY_TIMEOUT
                    existing_tx.payme_cancel_time = now_ms
                    existing_tx.status = "CANCELLED"
                    return await _send_response(
                        _err(payme_service.PAYME_ERROR_COULD_NOT_PERFORM, "Tranzaksiya muddati tugagan", "Срок транзакции истек")
                    )
                return await _send_response(
                    _ok({
                        "create_time": existing_tx.payme_time,
                        "transaction": str(existing_tx.id),
                        "state": existing_tx.payme_state,
                        "receivers": None,
                    })
                )
            if existing_tx.payme_state == payme_service.STATE_DONE:
                return await _send_response(
                    _err(payme_service.PAYME_ERROR_COULD_NOT_PERFORM, "Tranzaksiya allaqachon bajarilgan", "Транзакция уже выполнена")
                )
            return await _send_response(
                _err(payme_service.PAYME_ERROR_COULD_NOT_PERFORM, "Tranzaksiya bekor qilingan", "Транзакция отменена")
            )

        if not order_id_str:
            return await _send_response(
                _err(payme_service.PAYME_ERROR_ORDER_NOT_FOUND, "order_id ko'rsatilmadi", "Не указан order_id", data="account")
            )

        tx = await _load_order(lock=True)
        if not tx:
            return await _send_response(_order_not_found())

        _, amount_err = _check_amount(tx)
        if amount_err:
            return await _send_response(amount_err)

        if tx.status == "SUCCESS":
            return await _send_response(
                _err(payme_service.PAYME_ERROR_COULD_NOT_PERFORM, "Buyurtma allaqachon to'langan", "Заказ уже оплачен")
            )
        if tx.status != "PENDING" and not _is_sandbox(tx):
            return await _send_response(_order_not_found())
        if tx.service_type == "TOPUP" and _now() - tx.created_at > PENDING_TOPUP_TTL:
            return await _send_response(_order_not_found())

        # One Payme transaction per order. A second one for an order that is
        # still in progress is Payme's -31050 "account taken" case.
        if not _is_sandbox(tx) and tx.payme_trans_id and tx.payme_trans_id != payme_trans_id:
            if tx.payme_state == payme_service.STATE_IN_PROGRESS:
                return await _send_response(
                    _err(payme_service.PAYME_ERROR_ORDER_NOT_FOUND, "Buyurtma uchun boshqa tranzaksiya mavjud", "Другая транзакция заняла этот счет", data="order_id")
                )
            # A cancelled attempt may be retried under a fresh Payme id.

        card = next((params[k] for k in _CARD_KEYS if params.get(k)), None) or account.get("card")
        if card:
            tx.card_pan = mask_card(card)
        tx.payme_trans_id = payme_trans_id
        tx.payme_time = trans_time
        tx.payme_state = payme_service.STATE_IN_PROGRESS
        tx.payme_reason = None
        tx.payme_cancel_time = None
        tx.provider = "PAYME"

        return await _send_response(
            _ok({
                "create_time": tx.payme_time,
                "transaction": str(tx.id),
                "state": tx.payme_state,
                "receivers": None,
            })
        )

    # -----------------------------------------------------------------------
    # METHOD: PerformTransaction
    # -----------------------------------------------------------------------
    if method == "PerformTransaction":
        if not payme_trans_id:
            return await _send_response(_missing_id())
        tx = await _find_by_payme_id(lock=True)
        if not tx:
            return await _send_response(_tx_not_found())

        if tx.payme_state == payme_service.STATE_IN_PROGRESS:
            if (now_ms - (tx.payme_time or 0)) > payme_service.TRANSACTION_TIMEOUT_MS:
                tx.payme_state = payme_service.STATE_CANCELED
                tx.payme_reason = payme_service.REASON_CANCELLED_BY_TIMEOUT
                tx.payme_cancel_time = now_ms
                tx.status = "CANCELLED"
                return await _send_response(
                    _err(payme_service.PAYME_ERROR_COULD_NOT_PERFORM, "Tranzaksiya muddati tugagan", "Срок транзакции истек")
                )

            tx.payme_state = payme_service.STATE_DONE
            tx.payme_perform_time = now_ms
            tx.status = "SUCCESS"
            tx.completed_at = _now()

            card = next((params[k] for k in _CARD_KEYS if params.get(k)), None)
            if card:
                tx.card_pan = mask_card(card)

            # Only real payments reach a wallet; sandbox rows never do.
            if tx.service_type != "SANDBOX_TEST":
                await _credit_wallet(
                    db,
                    user_id=tx.user_id,
                    amount=tx.amount,
                    description=f"Payme orqali hisob to‘ldirildi (+{int(tx.amount):,} so'm)",
                    reference_id=tx.id,
                )
            log.info("payme.payment_completed", user_id=str(tx.user_id), amount=tx.amount, payme_trans_id=payme_trans_id)
            if tx.service_type != "SANDBOX_TEST":
                await _announce_payment(db, user_id=tx.user_id, amount=tx.amount, provider="Payme")

            return await _send_response(
                _ok({"transaction": str(tx.id), "perform_time": now_ms, "state": payme_service.STATE_DONE})
            )

        if tx.payme_state == payme_service.STATE_DONE:
            return await _send_response(
                _ok({
                    "transaction": str(tx.id),
                    "perform_time": tx.payme_perform_time or tx.payme_time or now_ms,
                    "state": payme_service.STATE_DONE,
                })
            )

        return await _send_response(
            _err(payme_service.PAYME_ERROR_COULD_NOT_PERFORM, "Tranzaksiya bekor qilingan", "Транзакция отменена")
        )

    # -----------------------------------------------------------------------
    # METHOD: CancelTransaction
    # -----------------------------------------------------------------------
    if method == "CancelTransaction":
        if not payme_trans_id:
            return await _send_response(_missing_id())
        reason = _as_int(params.get("reason"))
        if reason is None:
            reason = payme_service.REASON_UNKNOWN

        tx = await _find_by_payme_id(lock=True)
        if not tx:
            return await _send_response(_tx_not_found())

        if tx.payme_state == payme_service.STATE_IN_PROGRESS:
            tx.payme_state = payme_service.STATE_CANCELED
            tx.payme_cancel_time = now_ms
            tx.payme_reason = reason
            tx.status = "CANCELLED"
            return await _send_response(
                _ok({"transaction": str(tx.id), "cancel_time": now_ms, "state": payme_service.STATE_CANCELED})
            )

        if tx.payme_state == payme_service.STATE_DONE:
            # Payme is refunding the customer; take the money back out of
            # the wallet it went into. A sandbox row never credited one, so
            # it must not debit one either — it used to.
            tx.payme_state = payme_service.STATE_POST_CANCELED
            tx.payme_cancel_time = now_ms
            tx.payme_reason = reason
            tx.status = "REFUNDED"

            if tx.service_type != "SANDBOX_TEST":
                new_balance = (
                    await db.execute(
                        update(User)
                        .where(User.id == tx.user_id)
                        .values(balance=func.greatest(0.0, User.balance - float(tx.amount)))
                        .returning(User.balance)
                    )
                ).scalar_one_or_none()
                if new_balance is not None:
                    db.add(
                        WalletTransaction(
                            user_id=tx.user_id,
                            type="REFUND",
                            amount=-float(tx.amount),
                            balance_after=float(new_balance),
                            description=f"Payme to'lovi bekor qilindi (-{int(tx.amount):,} so'm)",
                            reference_id=tx.id,
                        )
                    )

            return await _send_response(
                _ok({"transaction": str(tx.id), "cancel_time": now_ms, "state": payme_service.STATE_POST_CANCELED})
            )

        return await _send_response(
            _ok({"transaction": str(tx.id), "cancel_time": tx.payme_cancel_time or now_ms, "state": tx.payme_state})
        )

    # -----------------------------------------------------------------------
    # METHOD: CheckTransaction
    # -----------------------------------------------------------------------
    if method == "CheckTransaction":
        if not payme_trans_id:
            return await _send_response(_missing_id())
        tx = await _find_by_payme_id()
        if not tx:
            return await _send_response(_tx_not_found())
        return await _send_response(
            _ok({
                "create_time": tx.payme_time or 0,
                "perform_time": tx.payme_perform_time or 0,
                "cancel_time": tx.payme_cancel_time or 0,
                "transaction": str(tx.id),
                "state": tx.payme_state or 0,
                "reason": tx.payme_reason,
            })
        )

    # -----------------------------------------------------------------------
    # METHOD: GetStatement
    # -----------------------------------------------------------------------
    if method == "GetStatement":
        from_time = _as_int(params.get("from"))
        to_time = _as_int(params.get("to"))
        if from_time is None or to_time is None:
            return await _send_response(
                _err(payme_service.PAYME_ERROR_INVALID_JSON_RPC, "from/to ko'rsatilmadi", "Не указаны from/to")
            )
        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.provider == "PAYME",
                PaymentTransaction.payme_trans_id.is_not(None),
                PaymentTransaction.payme_time >= from_time,
                PaymentTransaction.payme_time <= to_time,
            )
            .order_by(PaymentTransaction.payme_time.asc())
            .limit(5000)
        )
        tx_list = (await db.execute(stmt)).scalars().all()
        transactions = [
            {
                "id": t.payme_trans_id,
                "time": t.payme_time or 0,
                "amount": int(round(t.amount * 100)),
                "account": {"order_id": str(t.id)},
                "create_time": t.payme_time or 0,
                "perform_time": t.payme_perform_time or 0,
                "cancel_time": t.payme_cancel_time or 0,
                "transaction": str(t.id),
                "state": t.payme_state or 0,
                "reason": t.payme_reason,
            }
            for t in tx_list
        ]
        return await _send_response(_ok({"transactions": transactions}))

    # -----------------------------------------------------------------------
    # UNKNOWN METHOD
    # -----------------------------------------------------------------------
    return await _send_response(
        _err(payme_service.PAYME_ERROR_METHOD_NOT_FOUND, f"Noma'lum usul: {method}", f"Метод не найден: {method}")
    )
