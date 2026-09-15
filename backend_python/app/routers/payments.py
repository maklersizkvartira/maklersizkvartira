"""Payment router for Click Webhook (Prepare & Complete) and user wallet management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy import String, cast, desc, func, or_, select

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.errors import BadRequest, NotFound
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
from app.services import payme as payme_service

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
@router.get("/click/prepare-or-complete", summary="Click webhook health check")
@router.get("/click/prepare", summary="Click prepare health check")
@router.get("/click/complete", summary="Click complete health check")
async def click_webhook_health() -> dict[str, Any]:
    """Health check for Click webhook endpoints when checked via GET in a browser."""
    return {
        "status": "ok",
        "service": "Click Payment Webhook",
        "message": "Click Webhook endpoint is active and waiting for Click POST requests.",
        "service_id": settings.CLICK_SERVICE_ID,
        "supported_actions": ["PREPARE (action=0)", "COMPLETE (action=1)"],
    }


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

    # Find the local transaction or user for direct Click app payment
    payment_tx: PaymentTransaction | None = None
    user: User | None = None

    # A) Try to find existing transaction by merchant_prepare_id (if Complete) or merchant_trans_id (if Web checkout)
    lookup_id = merchant_prepare_id or merchant_trans_id
    try:
        tx_uuid = uuid.UUID(str(lookup_id).strip())
        payment_tx = (
            await db.execute(
                select(PaymentTransaction).where(PaymentTransaction.id == tx_uuid)
            )
        ).scalar_one_or_none()
    except (ValueError, TypeError):
        payment_tx = None

    # B) If no existing transaction was found, check if merchant_trans_id is a User identifier (Phone / User ID / Referral code)
    # This happens when users pay directly via Click App's search (Katalog: Uyiz.uz)
    if payment_tx is None:
        target_param = str(merchant_trans_id).strip()

        # Check 1: User UUID (full or prefix)
        try:
            u_uuid = uuid.UUID(target_param)
            user = (await db.execute(select(User).where(User.id == u_uuid))).scalar_one_or_none()
        except (ValueError, TypeError):
            user = None

        # Check 2: User UUID prefix (e.g. 8-character ID)
        if user is None and len(target_param) >= 8 and not target_param.isdigit():
            user = (
                await db.execute(
                    select(User).where(cast(User.id, String).ilike(f"{target_param}%"))
                )
            ).scalar_one_or_none()

        # Check 3: Phone number (+99890..., 99890..., 90..., 890...)
        if user is None:
            clean_digits = "".join(c for c in target_param if c.isdigit())
            candidate_phones = {target_param}
            if len(clean_digits) == 9:
                candidate_phones.add(f"+998{clean_digits}")
            elif len(clean_digits) == 12 and clean_digits.startswith("998"):
                candidate_phones.add(f"+{clean_digits}")
            elif len(clean_digits) == 10 and clean_digits.startswith("8"):
                candidate_phones.add(f"+998{clean_digits[1:]}")

            user = (
                await db.execute(
                    select(User).where(User.phone.in_(list(candidate_phones)))
                )
            ).scalar_one_or_none()

        # Check 4: Referral code / Payment ID (with or without prefix)
        if user is None and len(target_param) <= 20:
            clean_code = (
                target_param.replace("UYIZ-", "")
                .replace("UYIZ", "")
                .replace("ID-", "")
                .replace("ID:", "")
                .replace("ID", "")
                .strip()
            )
            user = (
                await db.execute(
                    select(User).where(
                        or_(
                            User.referral_code == target_param.upper(),
                            User.referral_code == clean_code.upper(),
                        )
                    )
                )
            ).scalar_one_or_none()

        if user is None:
            log.error("click.user_or_tx_not_found", merchant_trans_id=merchant_trans_id)
            await db.commit()
            return _respond(click_service.CLICK_USER_NOT_FOUND, "User or transaction not found")

        # In Prepare (action 0): create a pending transaction for this direct Click App payment
        if action == 0:
            payment_tx = PaymentTransaction(
                user_id=user.id,
                provider="CLICK",
                status="PENDING",
                amount=amount,
                service_type="TOPUP_DIRECT_CLICK",
            )
            db.add(payment_tx)
            await db.flush()
        else:
            log.error("click.direct_complete_without_prepare", merchant_trans_id=merchant_trans_id)
            await db.commit()
            return _respond(click_service.CLICK_TRANSACTION_NOT_FOUND, "Transaction not found")

    # If transaction exists, load associated user
    if user is None and payment_tx is not None:
        user = (
            await db.execute(select(User).where(User.id == payment_tx.user_id))
        ).scalar_one_or_none()
        if user is None:
            log.error("click.user_not_found", user_id=str(payment_tx.user_id))
            await db.commit()
            return _respond(click_service.CLICK_USER_NOT_FOUND, "User not found")

    # Check Amount (allow small float deviation)
    if payment_tx is not None and abs(float(payment_tx.amount) - float(amount)) > 0.01:
        log.error("click.incorrect_amount", expected=payment_tx.amount, received=amount)
        await db.commit()
        return _respond(click_service.CLICK_INCORRECT_AMOUNT, "Incorrect amount")

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
@router.post("/topup", response_model=CreateTopUpResponse, summary="Create topup payment (Click or Payme)")
async def create_topup(
    payload: CreateTopUpRequest,
    user: CurrentUser,
    db: DbSession,
) -> CreateTopUpResponse:
    """Create a pending payment transaction and return gateway payment URLs."""
    gateway = (payload.gateway or "click").lower()
    provider = "PAYME" if gateway == "payme" else "CLICK"

    tx = PaymentTransaction(
        user_id=user.id,
        provider=provider,
        status="PENDING",
        amount=payload.amount,
        service_type="TOPUP",
    )
    db.add(tx)
    await db.flush()

    return_url = payload.return_url or f"{settings.SITE_URL}/profile"

    click_url: str | None = None
    click_card_url: str | None = None
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
        click_card_url = click_url

    await db.commit()

    return CreateTopUpResponse(
        transaction_id=tx.id,
        amount=tx.amount,
        click_url=click_url,
        click_card_url=click_card_url,
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


# ---------------------------------------------------------------------------
# Payme Merchant API (JSON-RPC 2.0 Webhook)
# ---------------------------------------------------------------------------
@router.get("/payme", summary="Payme webhook health check")
async def payme_webhook_health() -> dict[str, Any]:
    """Health check for Payme webhook endpoint when checked via GET."""
    return {
        "status": "ok",
        "service": "Payme Merchant API Webhook (JSON-RPC 2.0)",
        "merchant_id": settings.PAYME_MERCHANT_ID,
        "supported_methods": [
            "CheckPerformTransaction",
            "CreateTransaction",
            "PerformTransaction",
            "CancelTransaction",
            "CheckTransaction",
            "GetStatement",
        ],
    }


@router.post("/payme", summary="Payme Merchant API JSON-RPC 2.0 endpoint")
async def payme_webhook(
    request: Request,
    db: DbSession,
) -> dict[str, Any]:
    """Handle Payme JSON-RPC 2.0 requests with full audit logging and soliq fiscalization."""
    client_ip = request.client.host if request.client else None
    auth_header = request.headers.get("Authorization")

    # Read raw JSON body
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return payme_service.payme_error_response(
            None,
            payme_service.PAYME_ERROR_PARSE,
            "JSON parsing xatosi",
            "Ошибка парсинга JSON",
        )

    req_id = body.get("id")
    method = body.get("method")
    params = body.get("params") or {}

    log.info(
        "payme.webhook_received",
        method=method,
        req_id=req_id,
        params=params,
        client_ip=client_ip,
    )

    # 1. Verify Basic Auth
    if not payme_service.verify_payme_auth(auth_header):
        log.warning("payme.auth_failed", auth_header=auth_header, client_ip=client_ip)
        return payme_service.payme_error_response(
            req_id,
            payme_service.PAYME_ERROR_INSUFFICIENT_PRIVILEGE,
            "Avtorizatsiya xatosi",
            "Недостаточно привилегий для выполнения метода",
        )

    # 2. Audit log entry (will be saved at completion)
    audit_log = PaymePaymentLog(
        method=str(method or "UNKNOWN"),
        payme_trans_id=params.get("id"),
        account_param=str(params.get("account", {}).get("order_id", "")) if isinstance(params.get("account"), dict) else None,
        amount=float(params.get("amount") / 100) if params.get("amount") else None,
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

    # -----------------------------------------------------------------------
    # METHOD: CheckPerformTransaction
    # -----------------------------------------------------------------------
    if method == "CheckPerformTransaction":
        account = params.get("account") or {}
        order_id_str = account.get("order_id")
        amount_tiyin = params.get("amount")

        if not order_id_str:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ORDER_NOT_FOUND,
                    "account.order_id ko'rsatilmadi",
                    "Не указан параметр order_id",
                    data="account",
                )
            )

        try:
            order_uuid = uuid.UUID(order_id_str)
        except Exception:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ORDER_NOT_FOUND,
                    "Buyurtma topilmadi",
                    "Заказ не найден",
                    data="order_id",
                )
            )

        tx = await db.get(PaymentTransaction, order_uuid)
        if not tx:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ORDER_NOT_FOUND,
                    "Buyurtma topilmadi",
                    "Заказ не найден",
                    data="order_id",
                )
            )

        expected_tiyin = int(round(tx.amount * 100))
        if amount_tiyin is None or int(amount_tiyin) != expected_tiyin:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_INCORRECT_AMOUNT,
                    "Noto'g'ri summa",
                    "Неверная сумма",
                    data="amount",
                )
            )

        if tx.status == "SUCCESS" or tx.payme_state == payme_service.STATE_DONE:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ALREADY_PAID,
                    "Tranzaksiya allaqachon bajarilgan",
                    "Транзакция уже выполнена",
                )
            )

        return await _send_response(
            payme_service.payme_success_response(
                req_id,
                {
                    "allow": True,
                    "detail": payme_service.get_payme_fiscal_detail(expected_tiyin),
                },
            )
        )

    # -----------------------------------------------------------------------
    # METHOD: CreateTransaction
    # -----------------------------------------------------------------------
    elif method == "CreateTransaction":
        payme_trans_id = params.get("id")
        trans_time = params.get("time")
        amount_tiyin = params.get("amount")
        account = params.get("account") or {}
        order_id_str = account.get("order_id")

        if not payme_trans_id or not trans_time or amount_tiyin is None:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_INVALID_JSON_RPC,
                    "Kerakli parametrlar yetarli emas",
                    "Недостаточно параметров",
                )
            )

        # Check if transaction with payme_trans_id already exists
        stmt = select(PaymentTransaction).where(PaymentTransaction.payme_trans_id == str(payme_trans_id))
        existing_tx = (await db.execute(stmt)).scalars().first()

        now_ms = payme_service.current_time_ms()

        if existing_tx:
            if existing_tx.payme_state == payme_service.STATE_IN_PROGRESS:
                # Check 12 hour expiration timeout
                if (now_ms - (existing_tx.payme_time or 0)) > 12 * 3600 * 1000:
                    existing_tx.payme_state = payme_service.STATE_CANCELED
                    existing_tx.payme_reason = payme_service.REASON_CANCELLED_BY_TIMEOUT
                    existing_tx.status = "CANCELLED"
                    return await _send_response(
                        payme_service.payme_error_response(
                            req_id,
                            payme_service.PAYME_ERROR_COULD_NOT_PERFORM,
                            "Tranzaksiya muddati tugagan",
                            "Срок транзакции истек",
                        )
                    )
                return await _send_response(
                    payme_service.payme_success_response(
                        req_id,
                        {
                            "create_time": existing_tx.payme_time,
                            "transaction": str(existing_tx.id),
                            "state": existing_tx.payme_state,
                            "receivers": None,
                        },
                    )
                )
            elif existing_tx.payme_state == payme_service.STATE_DONE:
                return await _send_response(
                    payme_service.payme_error_response(
                        req_id,
                        payme_service.PAYME_ERROR_COULD_NOT_PERFORM,
                        "Tranzaksiya allaqachon bajarilgan",
                        "Транзакция уже выполнена",
                    )
                )
            else:
                return await _send_response(
                    payme_service.payme_error_response(
                        req_id,
                        payme_service.PAYME_ERROR_COULD_NOT_PERFORM,
                        "Tranzaksiya bekor qilingan",
                        "Транзакция отменена",
                    )
                )

        # New transaction by order_id
        if not order_id_str:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ORDER_NOT_FOUND,
                    "order_id ko'rsatilmadi",
                    "Не указан order_id",
                    data="account",
                )
            )

        try:
            order_uuid = uuid.UUID(order_id_str)
        except Exception:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ORDER_NOT_FOUND,
                    "Buyurtma topilmadi",
                    "Заказ не найден",
                    data="order_id",
                )
            )

        tx = await db.get(PaymentTransaction, order_uuid)
        if not tx:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_ORDER_NOT_FOUND,
                    "Buyurtma topilmadi",
                    "Заказ не найден",
                    data="order_id",
                )
            )

        expected_tiyin = int(round(tx.amount * 100))
        if int(amount_tiyin) != expected_tiyin:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_INCORRECT_AMOUNT,
                    "Noto'g'ri summa",
                    "Неверная сумма",
                    data="amount",
                )
            )

        if tx.status == "SUCCESS" or (tx.payme_trans_id and tx.payme_trans_id != str(payme_trans_id)):
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_COULD_NOT_PERFORM,
                    "Buyurtma allaqachon to'langan",
                    "Заказ уже оплачен",
                )
            )

        tx.payme_trans_id = str(payme_trans_id)
        tx.payme_time = int(trans_time)
        tx.payme_state = payme_service.STATE_IN_PROGRESS
        tx.provider = "PAYME"
        await db.commit()

        return await _send_response(
            payme_service.payme_success_response(
                req_id,
                {
                    "create_time": tx.payme_time,
                    "transaction": str(tx.id),
                    "state": tx.payme_state,
                    "receivers": None,
                },
            )
        )

    # -----------------------------------------------------------------------
    # METHOD: PerformTransaction
    # -----------------------------------------------------------------------
    elif method == "PerformTransaction":
        payme_trans_id = params.get("id")
        if not payme_trans_id:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_INVALID_JSON_RPC,
                    "id ko'rsatilmadi",
                    "Не указан id транзакции",
                )
            )

        stmt = select(PaymentTransaction).where(PaymentTransaction.payme_trans_id == str(payme_trans_id))
        tx = (await db.execute(stmt)).scalars().first()

        if not tx:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_TRANSACTION_NOT_FOUND,
                    "Tranzaksiya topilmadi",
                    "Транзакция не найдена",
                )
            )

        now_ms = payme_service.current_time_ms()

        if tx.payme_state == payme_service.STATE_IN_PROGRESS:
            # Check 12 hours timeout
            if (now_ms - (tx.payme_time or 0)) > 12 * 3600 * 1000:
                tx.payme_state = payme_service.STATE_CANCELED
                tx.payme_reason = payme_service.REASON_CANCELLED_BY_TIMEOUT
                tx.status = "CANCELLED"
                return await _send_response(
                    payme_service.payme_error_response(
                        req_id,
                        payme_service.PAYME_ERROR_COULD_NOT_PERFORM,
                        "Tranzaksiya muddati tugagan",
                        "Срок транзакции истек",
                    )
                )

            # Success execution
            tx.payme_state = payme_service.STATE_DONE
            tx.payme_perform_time = now_ms
            tx.status = "SUCCESS"
            tx.completed_at = datetime.now(timezone.utc)

            # Credit user wallet balance
            user = await db.get(User, tx.user_id)
            if user:
                user.balance = float(user.balance) + float(tx.amount)
                wallet_tx = WalletTransaction(
                    user_id=user.id,
                    type="TOPUP",
                    amount=tx.amount,
                    balance_after=user.balance,
                    description=f"Payme orqali hisob to‘ldirildi (+{int(tx.amount):,} so'm)",
                    reference_id=tx.id,
                )
                db.add(wallet_tx)

            await db.commit()
            log.info(
                "payme.payment_completed",
                user_id=str(tx.user_id),
                amount=tx.amount,
                payme_trans_id=payme_trans_id,
            )

            return await _send_response(
                payme_service.payme_success_response(
                    req_id,
                    {
                        "transaction": str(tx.id),
                        "perform_time": now_ms,
                        "state": payme_service.STATE_DONE,
                    },
                )
            )

        elif tx.payme_state == payme_service.STATE_DONE:
            # Already performed (idempotent response)
            return await _send_response(
                payme_service.payme_success_response(
                    req_id,
                    {
                        "transaction": str(tx.id),
                        "perform_time": tx.payme_perform_time or tx.payme_time or now_ms,
                        "state": payme_service.STATE_DONE,
                    },
                )
            )

        else:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_COULD_NOT_PERFORM,
                    "Tranzaksiya bekor qilingan",
                    "Транзакция отменена",
                )
            )

    # -----------------------------------------------------------------------
    # METHOD: CancelTransaction
    # -----------------------------------------------------------------------
    elif method == "CancelTransaction":
        payme_trans_id = params.get("id")
        reason = params.get("reason", payme_service.REASON_UNKNOWN)

        if not payme_trans_id:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_INVALID_JSON_RPC,
                    "id ko'rsatilmadi",
                    "Не указан id транзакции",
                )
            )

        stmt = select(PaymentTransaction).where(PaymentTransaction.payme_trans_id == str(payme_trans_id))
        tx = (await db.execute(stmt)).scalars().first()

        if not tx:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_TRANSACTION_NOT_FOUND,
                    "Tranzaksiya topilmadi",
                    "Транзакция не найдена",
                )
            )

        now_ms = payme_service.current_time_ms()

        if tx.payme_state == payme_service.STATE_IN_PROGRESS:
            tx.payme_state = payme_service.STATE_CANCELED
            tx.payme_cancel_time = now_ms
            tx.payme_reason = int(reason)
            tx.status = "CANCELLED"
            await db.commit()

            return await _send_response(
                payme_service.payme_success_response(
                    req_id,
                    {
                        "transaction": str(tx.id),
                        "cancel_time": now_ms,
                        "state": payme_service.STATE_CANCELED,
                    },
                )
            )

        elif tx.payme_state == payme_service.STATE_DONE:
            # Transaction was performed, refund if possible
            tx.payme_state = payme_service.STATE_POST_CANCELED
            tx.payme_cancel_time = now_ms
            tx.payme_reason = int(reason)
            tx.status = "REFUNDED"

            user = await db.get(User, tx.user_id)
            if user:
                user.balance = max(0.0, float(user.balance) - float(tx.amount))
                wallet_tx = WalletTransaction(
                    user_id=user.id,
                    type="REFUND",
                    amount=-tx.amount,
                    balance_after=user.balance,
                    description=f"Payme to'lovi bekor qilindi (-{int(tx.amount):,} so'm)",
                    reference_id=tx.id,
                )
                db.add(wallet_tx)

            await db.commit()

            return await _send_response(
                payme_service.payme_success_response(
                    req_id,
                    {
                        "transaction": str(tx.id),
                        "cancel_time": now_ms,
                        "state": payme_service.STATE_POST_CANCELED,
                    },
                )
            )

        else:
            # Already cancelled
            return await _send_response(
                payme_service.payme_success_response(
                    req_id,
                    {
                        "transaction": str(tx.id),
                        "cancel_time": tx.payme_cancel_time or now_ms,
                        "state": tx.payme_state,
                    },
                )
            )

    # -----------------------------------------------------------------------
    # METHOD: CheckTransaction
    # -----------------------------------------------------------------------
    elif method == "CheckTransaction":
        payme_trans_id = params.get("id")
        if not payme_trans_id:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_INVALID_JSON_RPC,
                    "id ko'rsatilmadi",
                    "Не указан id транзакции",
                )
            )

        stmt = select(PaymentTransaction).where(PaymentTransaction.payme_trans_id == str(payme_trans_id))
        tx = (await db.execute(stmt)).scalars().first()

        if not tx:
            return await _send_response(
                payme_service.payme_error_response(
                    req_id,
                    payme_service.PAYME_ERROR_TRANSACTION_NOT_FOUND,
                    "Tranzaksiya topilmadi",
                    "Транзакция не найдена",
                )
            )

        return await _send_response(
            payme_service.payme_success_response(
                req_id,
                {
                    "create_time": tx.payme_time or 0,
                    "perform_time": tx.payme_perform_time or 0,
                    "cancel_time": tx.payme_cancel_time or 0,
                    "transaction": str(tx.id),
                    "state": tx.payme_state or 0,
                    "reason": tx.payme_reason,
                },
            )
        )

    # -----------------------------------------------------------------------
    # METHOD: GetStatement
    # -----------------------------------------------------------------------
    elif method == "GetStatement":
        from_time = params.get("from", 0)
        to_time = params.get("to", payme_service.current_time_ms())

        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.provider == "PAYME",
                PaymentTransaction.payme_time >= int(from_time),
                PaymentTransaction.payme_time <= int(to_time),
            )
            .order_by(PaymentTransaction.payme_time.asc())
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
            if t.payme_trans_id
        ]

        return await _send_response(
            payme_service.payme_success_response(
                req_id,
                {"transactions": transactions},
            )
        )

    # -----------------------------------------------------------------------
    # UNKNOWN METHOD
    # -----------------------------------------------------------------------
    else:
        return await _send_response(
            payme_service.payme_error_response(
                req_id,
                payme_service.PAYME_ERROR_METHOD_NOT_FOUND,
                f"Noma'lum usul: {method}",
                f"Метод не найден: {method}",
            )
        )
