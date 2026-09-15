"""Payment router for Click Webhook (Prepare & Complete) and user wallet management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy import desc, select

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.errors import BadRequest, NotFound
from app.models.listing import Listing
from app.models.payment import ClickPaymentLog, PaymentTransaction, WalletTransaction
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

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

# Service Prices in UZS
PRICES = {
    "VERIFIED_BADGE": 20_000.0,
    "TOP_LISTING": 7_000.0,
    "VIP_LISTING": 12_000.0,
}


# ---------------------------------------------------------------------------
# Click Webhook (Prepare & Complete)
# ---------------------------------------------------------------------------
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
    raw_form = dict(await request.form())

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
        click_trans_id=click_trans_id,
        service_id=service_id,
        merchant_trans_id=merchant_trans_id,
        amount=amount,
        raw_request=raw_form,
        client_ip=client_ip,
    )
    db.add(audit_log)

    def _respond(err_code: int, err_text: str, extra: dict | None = None) -> dict[str, Any]:
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
        return resp

    # 2. Check Click Error first
    if int(error) < 0:
        log.warning("click.reported_error", error=error, error_note=error_note)
        await db.commit()
        return _respond(int(error), error_note or "Click reported error")

    # 3. Check Signature
    is_valid = click_service.verify_click_signature(
        click_trans_id=click_trans_id,
        service_id=service_id,
        secret_key=settings.CLICK_SECRET_KEY,
        merchant_trans_id=merchant_trans_id,
        merchant_prepare_id=merchant_prepare_id,
        amount=amount,
        action=action,
        sign_time=sign_time,
        sign_string=sign_string,
    )
    if not is_valid:
        log.error("click.sign_check_failed", sign_string=sign_string)
        await db.commit()
        return _respond(click_service.CLICK_SIGN_CHECK_FAILED, "SIGN CHECK FAILED!")

    # 4. Handle "test" onboarding transaction for Click verification team
    if str(merchant_trans_id).strip().lower() == "test":
        log.info("click.test_transaction_success", action=action, click_trans_id=click_trans_id)
        await db.commit()
        if action == 0:
            return _respond(
                click_service.CLICK_SUCCESS,
                "Success",
                {"merchant_prepare_id": "test"},
            )
        else:
            return _respond(
                click_service.CLICK_SUCCESS,
                "Success",
                {"merchant_confirm_id": "test"},
            )

    # Find the local transaction
    try:
        tx_uuid = uuid.UUID(merchant_trans_id)
    except (ValueError, TypeError):
        log.error("click.invalid_merchant_trans_id", merchant_trans_id=merchant_trans_id)
        await db.commit()
        return _respond(click_service.CLICK_TRANSACTION_NOT_FOUND, "Transaction not found")

    payment_tx = (
        await db.execute(
            select(PaymentTransaction).where(PaymentTransaction.id == tx_uuid)
        )
    ).scalar_one_or_none()

    if payment_tx is None:
        log.error("click.payment_tx_not_found", tx_id=str(tx_uuid))
        await db.commit()
        return _respond(click_service.CLICK_TRANSACTION_NOT_FOUND, "Transaction not found")

    # Check Amount (allow small float deviation)
    if abs(float(payment_tx.amount) - float(amount)) > 0.01:
        log.error("click.incorrect_amount", expected=payment_tx.amount, received=amount)
        await db.commit()
        return _respond(click_service.CLICK_INCORRECT_AMOUNT, "Incorrect amount")

    user = (
        await db.execute(select(User).where(User.id == payment_tx.user_id))
    ).scalar_one_or_none()
    if user is None:
        log.error("click.user_not_found", user_id=str(payment_tx.user_id))
        await db.commit()
        return _respond(click_service.CLICK_USER_NOT_FOUND, "User not found")

    # 5. Handle Actions
    now = datetime.now(timezone.utc)

    # ACTION 0: PREPARE
    if action == 0:
        if payment_tx.status == "SUCCESS":
            await db.commit()
            return _respond(click_service.CLICK_ALREADY_PAID, "Already paid")
        if payment_tx.status == "CANCELLED":
            await db.commit()
            return _respond(click_service.CLICK_TRANSACTION_CANCELLED, "Transaction cancelled")

        payment_tx.click_trans_id = click_trans_id
        payment_tx.click_paydoc_id = click_paydoc_id
        payment_tx.merchant_prepare_id = str(payment_tx.id)
        await db.commit()

        return _respond(
            click_service.CLICK_SUCCESS,
            "Success",
            {"merchant_prepare_id": str(payment_tx.id)},
        )

    # ACTION 1: COMPLETE
    elif action == 1:
        if payment_tx.status == "SUCCESS":
            await db.commit()
            return _respond(
                click_service.CLICK_SUCCESS,
                "Success (already processed)",
                {"merchant_confirm_id": str(payment_tx.id)},
            )

        # Mark Payment as Success
        payment_tx.status = "SUCCESS"
        payment_tx.click_trans_id = click_trans_id
        payment_tx.click_paydoc_id = click_paydoc_id
        payment_tx.completed_at = now

        # Credit to user wallet balance
        user.balance = float(user.balance) + float(payment_tx.amount)

        # Record wallet transaction
        wallet_tx = WalletTransaction(
            user_id=user.id,
            type="TOPUP",
            amount=payment_tx.amount,
            balance_after=user.balance,
            description=f"Click orqali hisob to‘ldirildi (+{int(payment_tx.amount):,} so'm)",
            reference_id=payment_tx.id,
        )
        db.add(wallet_tx)

        await db.commit()
        log.info(
            "click.payment_completed",
            user_id=str(user.id),
            amount=payment_tx.amount,
            new_balance=user.balance,
        )

        return _respond(
            click_service.CLICK_SUCCESS,
            "Success",
            {"merchant_confirm_id": str(payment_tx.id)},
        )

    else:
        await db.commit()
        return _respond(click_service.CLICK_ACTION_NOT_FOUND, "Action not found")


# ---------------------------------------------------------------------------
# User Wallet & Top-up Endpoints
# ---------------------------------------------------------------------------
@router.post("/topup", response_model=CreateTopUpResponse, summary="Create Click topup payment")
async def create_topup(
    payload: CreateTopUpRequest,
    user: CurrentUser,
    db: DbSession,
) -> CreateTopUpResponse:
    """Create a pending payment transaction and return Click payment URLs."""
    tx = PaymentTransaction(
        user_id=user.id,
        provider="CLICK",
        status="PENDING",
        amount=payload.amount,
        service_type="TOPUP",
    )
    db.add(tx)
    await db.flush()

    return_url = payload.return_url or f"{settings.SITE_URL}/profile"

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

    has_badge_purchase = any(t.type == "PURCHASE_VERIFIED_BADGE" for t in txs)
    is_verified_badge = user.is_verified and has_badge_purchase

    return WalletInfoResponse(
        balance=user.balance,
        is_verified=is_verified_badge,
        transactions=[WalletTransactionOut.model_validate(t) for t in txs],
    )


@router.post("/buy-service", response_model=BuyServiceResponse, summary="Purchase a service using balance")
async def buy_service(
    payload: BuyServiceRequest,
    user: CurrentUser,
    db: DbSession,
) -> BuyServiceResponse:
    """Spend wallet balance to purchase services (Verified badge, Top listing, VIP listing)."""
    cost = PRICES.get(payload.service_type)
    if cost is None:
        raise BadRequest("invalid_service_type")

    if user.balance < cost:
        raise BadRequest("insufficient_balance")

    now = datetime.now(timezone.utc)
    description = ""

    if payload.service_type == "VERIFIED_BADGE":
        if user.is_verified:
            raise BadRequest("already_verified")
        user.is_verified = True
        user.verification_level = max(user.verification_level, 2)
        description = "Tasdiqlanganlik (Galochka) sotib olindi"

    elif payload.service_type in ("TOP_LISTING", "VIP_LISTING"):
        if not payload.listing_id:
            raise BadRequest("listing_id_required")

        listing = (
            await db.execute(
                select(Listing).where(Listing.id == payload.listing_id, Listing.owner_id == user.id)
            )
        ).scalar_one_or_none()
        if not listing:
            raise NotFound("listing_not_found")

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

        elif payload.service_type == "VIP_LISTING":
            listing.is_vip = True
            listing.vip_until = expire_at
            listing.is_featured = True
            listing.featured_until = expire_at
            listing.promotion_weight = max(listing.promotion_weight, 20)
            description = f"VIP e'lon xarid qilindi: '{listing.title[:30]}'"

    # Deduct balance
    user.balance = float(user.balance) - float(cost)

    # Record wallet transaction
    wallet_tx = WalletTransaction(
        user_id=user.id,
        type=f"PURCHASE_{payload.service_type}",
        amount=-cost,
        balance_after=user.balance,
        description=description,
        reference_id=payload.listing_id,
    )
    db.add(wallet_tx)
    await db.commit()

    return BuyServiceResponse(
        status="success",
        message=f"{description}. Balansingizdan {int(cost):,} so'm yechildi.",
        balance_after=user.balance,
    )
