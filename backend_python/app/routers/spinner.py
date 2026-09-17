"""Router for Omad Spinner, Leaderboard, and Coin Rewards."""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession, OptionalUser
from app.models.chat import SupportConversation, SupportMessage
from app.models.listing import Listing
from app.models.payment import WalletTransaction
from app.models.spinner import CoinExchangeTransaction, CoinWithdrawalRequest, SpinHistory
from app.models.user import User
from app.schemas.spinner import (
    BuySpinsResponse,
    LeaderboardItem,
    LeaderboardOut,
    RedeemBalanceRequest,
    RedeemListingRequest,
    SpinnerSector,
    SpinnerStatusOut,
    SpinRequest,
    SpinResultOut,
    WithdrawRequest,
    WithdrawResponse,
)
from app.services.telegram import send_message

router = APIRouter(prefix="/spinner", tags=["spinner"])

# Default 8 sectors on the wheel
SECTORS: list[dict] = [
    {"index": 0, "label": "50 Coin", "coins": 50, "color": "#3B82F6", "weight": 26},
    {"index": 1, "label": "100 Coin", "coins": 100, "color": "#8B5CF6", "weight": 24},
    {"index": 2, "label": "250 Coin", "coins": 250, "color": "#10B981", "weight": 16},
    {"index": 3, "label": "500 Coin", "coins": 500, "color": "#F59E0B", "weight": 7},
    {"index": 4, "label": "150 Coin", "coins": 150, "color": "#06B6D4", "weight": 16},
    {"index": 5, "label": "350 Coin", "coins": 350, "color": "#EC4899", "weight": 8},
    {"index": 6, "label": "1,000 Coin", "coins": 1000, "color": "#F97316", "weight": 2.5},
    {"index": 7, "label": "🔥 2,500 JEКPOT", "coins": 2500, "color": "#EAB308", "weight": 0.5},
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _can_free_spin(user: User) -> tuple[bool, int]:
    if not user.last_free_spin_at:
        return True, 0
    next_spin = user.last_free_spin_at + timedelta(hours=24)
    now = _now()
    if now >= next_spin:
        return True, 0
    diff = int((next_spin - now).total_seconds())
    return False, max(0, diff)


async def _get_user_rank(db: AsyncSession, user_id: uuid.UUID, user_coins: int) -> int:
    higher_count = await db.scalar(
        select(func.count(User.id)).where(User.coins > user_coins)
    )
    return int(higher_count or 0) + 1


@router.get("/status", response_model=SpinnerStatusOut, summary="Get spinner status for user")
async def get_spinner_status(user: OptionalUser, db: DbSession) -> SpinnerStatusOut:
    if user:
        can_free, seconds_left = _can_free_spin(user)
        rank = await _get_user_rank(db, user.id, user.coins)
        coins = user.coins
        paid_spins = user.paid_spins_available
        balance = float(user.balance)
    else:
        can_free = True
        seconds_left = 0
        rank = 1
        coins = 0
        paid_spins = 0
        balance = 0.0

    sectors_out = [
        SpinnerSector(
            index=s["index"],
            label=s["label"],
            coins=s["coins"],
            color=s["color"],
        )
        for s in SECTORS
    ]

    return SpinnerStatusOut(
        coins=coins,
        can_free_spin=can_free,
        seconds_until_next_free_spin=seconds_left,
        paid_spins_available=paid_spins,
        balance_uzs=balance,
        user_rank=rank,
        sectors=sectors_out,
        spin_cost_uzs=1000,
        spins_per_purchase=2,
        min_withdrawal_uzs=1000.0,
        max_withdrawal_uzs=10000.0,
        coin_to_uzs_rate=10.0,
    )


@router.post("/spin", response_model=SpinResultOut, summary="Spin the fortune wheel")
async def spin_wheel(payload: SpinRequest, user: CurrentUser, db: DbSession) -> SpinResultOut:
    can_free, seconds_left = _can_free_spin(user)
    spin_type = "FREE"

    if payload.use_paid:
        if user.paid_spins_available <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sizda pullik aylanmalar qolmagan. Iltimos, hisobingizdan 1,000 so'm evaziga 2 ta aylanma sotib oling.",
            )
        user.paid_spins_available -= 1
        spin_type = "PAID"
    else:
        if not can_free:
            if user.paid_spins_available > 0:
                user.paid_spins_available -= 1
                spin_type = "PAID"
            else:
                hours = seconds_left // 3600
                minutes = (seconds_left % 3600) // 60
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bugungi bepul aylanma ishlatilgan. Keyingi bepul aylanmaga {hours} soat {minutes} daqiqa qoldi yoki 1,000 so'mga 2 ta aylanma olishingiz mumkin.",
                )
        else:
            user.last_free_spin_at = _now()
            spin_type = "FREE"

    # Weighted random selection of prize
    weights = [s["weight"] for s in SECTORS]
    chosen = random.choices(SECTORS, weights=weights, k=1)[0]
    coins_won = chosen["coins"]

    user.coins += coins_won
    db.add(
        SpinHistory(
            user_id=user.id,
            spin_type=spin_type,
            sector_index=chosen["index"],
            prize_type="COINS",
            coins_won=coins_won,
            meta_info=chosen["label"],
        )
    )
    await db.commit()
    await db.refresh(user)

    can_free_after, _ = _can_free_spin(user)

    return SpinResultOut(
        sector_index=chosen["index"],
        prize_type="COINS",
        coins_won=coins_won,
        new_coins_total=user.coins,
        can_free_spin=can_free_after,
        paid_spins_available=user.paid_spins_available,
        message=f"Tabriklaymiz! Siz {coins_won} coin yutib oldingiz!",
    )


@router.post("/buy-spins", response_model=BuySpinsResponse, summary="Buy 2 spins for 1,000 UZS")
async def buy_spins(user: CurrentUser, db: DbSession) -> BuySpinsResponse:
    COST = 1000.0
    SPINS_GRANTED = 2

    if user.balance < COST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Balansingizda mablag' yetarli emas. Narxi: 1,000 so'm. Hozirgi balansingiz: {int(user.balance):,} so'm. Iltimos, hisobingizni Click yoki Payme orqali to'ldiring.",
        )

    user.balance -= COST
    user.paid_spins_available += SPINS_GRANTED

    db.add(
        WalletTransaction(
            user_id=user.id,
            type="PURCHASE_SPINNER_SPINS",
            amount=-COST,
            balance_after=float(user.balance),
            description="Omad barabani: 2 ta qo'shimcha aylanma xarid qilindi",
        )
    )
    await db.commit()
    await db.refresh(user)

    return BuySpinsResponse(
        status="success",
        paid_spins_available=user.paid_spins_available,
        new_balance=float(user.balance),
        message="2 ta qo'shimcha aylanma muvaffaqiyatli qo'shildi!",
    )


@router.get("/leaderboard", response_model=LeaderboardOut, summary="Get coin leaderboard")
async def get_leaderboard(user: OptionalUser, db: DbSession) -> LeaderboardOut:
    # Fetch top 50 users by coins
    stmt = (
        select(User)
        .where(User.coins > 0)
        .order_by(User.coins.desc(), User.created_at.asc())
        .limit(50)
    )
    res = await db.execute(stmt)
    top_rows = res.scalars().all()

    items: list[LeaderboardItem] = []
    for idx, u in enumerate(top_rows, start=1):
        items.append(
            LeaderboardItem(
                rank=idx,
                user_id=str(u.id),
                name=u.name,
                avatar=u.avatar,
                coins=u.coins,
                is_current_user=(user is not None and u.id == user.id),
            )
        )

    # Total participants
    total = await db.scalar(select(func.count(User.id)).where(User.coins > 0)) or 0
    if user:
        my_rank = await _get_user_rank(db, user.id, user.coins)
        my_coins = user.coins
    else:
        my_rank = 0
        my_coins = 0

    return LeaderboardOut(
        top_users=items,
        my_rank=my_rank,
        my_coins=my_coins,
        total_participants=int(total),
    )


@router.post("/withdraw", response_model=WithdrawResponse, summary="Withdraw coins to Uzcard / Humo")
async def withdraw_cash(
    payload: WithdrawRequest, user: CurrentUser, db: DbSession
) -> WithdrawResponse:
    # 100 coins = 1,000 UZS (1 coin = 10 UZS)
    RATE = 10.0
    required_coins = int(payload.amount_uzs / RATE)

    if user.coins < required_coins:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sizda yetarli coin mavjud emas. {int(payload.amount_uzs):,} so'm yechish uchun {required_coins} coin kerak. Sizda {user.coins} coin bor.",
        )

    clean_card = payload.card_number.replace(" ", "").replace("-", "")
    if len(clean_card) != 16 or not clean_card.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Karta raqami 16 ta raqamdan iborat bo'lishi kerak (Uzcard yoki Humo).",
        )

    user.coins -= required_coins

    req = CoinWithdrawalRequest(
        user_id=user.id,
        card_number=clean_card,
        card_holder=payload.card_holder,
        amount_uzs=payload.amount_uzs,
        coins_spent=required_coins,
        status="PENDING",
    )
    db.add(req)

    # 1. Post message to Support Chat so user & admins see it in support
    stmt_conv = select(SupportConversation).where(SupportConversation.user_id == user.id)
    conv = (await db.execute(stmt_conv)).scalars().first()
    if not conv:
        conv = SupportConversation(user_id=user.id, status="OPEN")
        db.add(conv)
        await db.flush()

    card_masked = f"{clean_card[:4]} **** **** {clean_card[-4:]}"
    support_msg = (
        f"🎰 Yangi Omad Barabani keshbek so'rovi!\n"
        f"Mablag': {int(payload.amount_uzs):,} so'm ({required_coins} coin evaziga).\n"
        f"Plastik karta: {card_masked}\n"
        f"Status: Kutilmoqda. Adminlarimiz tekshirib, tez orada kartangizga pul o'tkazib berishadi."
    )
    db.add(
        SupportMessage(
            conversation_id=conv.id,
            sender_type="SYSTEM",
            text=support_msg,
        )
    )

    await db.commit()

    # 2. Send Telegram alert to operations channel via @Uyiz_ai_chat_bot
    telegram_text = (
        f"🎰 <b>Yangi Omad Barabani Pul Yechish So'rovi!</b>\n\n"
        f"👤 <b>Foydalanuvchi:</b> {user.name} ({user.phone})\n"
        f"💳 <b>Karta:</b> <code>{clean_card}</code>\n"
        f"💰 <b>Miqdor:</b> {int(payload.amount_uzs):,} so'm\n"
        f"🪙 <b>Yechilgan Coin:</b> {required_coins} coin\n"
        f"📅 <b>Vaqt:</b> {_now().strftime('%Y-%m-%d %H:%M')}\n\n"
        f"<i>Iltimos, admin panelga o'tib karta egasiga pul tashlab bering.</i>"
    )
    await send_message(db, telegram_text, context="spinner_cash_withdrawal")

    return WithdrawResponse(
        status="success",
        request_id=str(req.id),
        amount_uzs=payload.amount_uzs,
        coins_deducted=required_coins,
        remaining_coins=user.coins,
        message=f"{int(payload.amount_uzs):,} so'm yechish so'rovi qabul qilindi. Tez orada kartangizga pul o'tkazib beriladi!",
    )


@router.post("/redeem-balance", summary="Exchange coins for on-site Uyiz balance")
async def redeem_balance(
    payload: RedeemBalanceRequest, user: CurrentUser, db: DbSession
) -> dict:
    # 1 coin = 10 UZS
    RATE = 10.0
    if user.coins < payload.coins:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sizda yetarli coin mavjud emas. Hozirgi balansingiz: {user.coins} coin.",
        )

    added_uzs = float(payload.coins * RATE)
    user.coins -= payload.coins
    user.balance += added_uzs

    db.add(
        CoinExchangeTransaction(
            user_id=user.id,
            exchange_type="BALANCE",
            coins_spent=payload.coins,
            amount_uzs=added_uzs,
            description=f"{payload.coins} coin hisobiga {int(added_uzs):,} so'm Uyiz balansi qo'shildi",
        )
    )
    db.add(
        WalletTransaction(
            user_id=user.id,
            type="DEPOSIT_COIN_REDEEM",
            amount=added_uzs,
            balance_after=float(user.balance),
            description=f"Omad barabani: {payload.coins} coin balansga o'tkazildi",
        )
    )
    await db.commit()

    return {
        "status": "success",
        "added_uzs": added_uzs,
        "new_balance": float(user.balance),
        "remaining_coins": user.coins,
        "message": f"Tabriklaymiz! {int(added_uzs):,} so'm Uyiz balansingizga muvaffaqiyatli qo'shildi.",
    }


@router.post("/redeem-listing", summary="Exchange coins to make a listing VIP or TOP")
async def redeem_listing(
    payload: RedeemListingRequest, user: CurrentUser, db: DbSession
) -> dict:
    listing = await db.get(Listing, payload.listing_id)
    if not listing or listing.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="E'lon topilmadi yoki bu e'lon sizga tegishli emas.",
        )

    # Costs: TOP = 500 coins, VIP = 1000 coins (both for 7 days)
    if payload.service_type == "VIP_7_DAYS":
        COST_COINS = 1000
        service_label = "VIP (7 kun)"
        is_vip = True
    else:
        COST_COINS = 500
        service_label = "TOP (7 kun)"
        is_vip = False

    if user.coins < COST_COINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{service_label} xizmati uchun {COST_COINS} coin kerak. Sizda {user.coins} coin bor.",
        )

    user.coins -= COST_COINS
    expire_at = _now() + timedelta(days=7)

    if is_vip:
        listing.is_vip = True
        listing.vip_until = expire_at
        listing.is_featured = True
        listing.featured_until = expire_at
        listing.promotion_weight = max(listing.promotion_weight, 20)
    else:
        listing.is_featured = True
        listing.featured_until = expire_at
        listing.promotion_weight = max(listing.promotion_weight, 10)

    db.add(
        CoinExchangeTransaction(
            user_id=user.id,
            exchange_type="VIP_LISTING" if is_vip else "TOP_LISTING",
            coins_spent=COST_COINS,
            listing_id=listing.id,
            description=f"'{listing.title[:30]}' e'loni {service_label} qilindi",
        )
    )
    await db.commit()

    return {
        "status": "success",
        "service": service_label,
        "remaining_coins": user.coins,
        "message": f"'{listing.title}' e'loningiz 7 kunga {service_label} qilindi!",
    }
