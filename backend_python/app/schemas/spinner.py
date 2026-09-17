"""Pydantic schemas for Omad Spinner, Leaderboard, and Coin Rewards."""

from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import Field

from app.schemas.base import CamelModel, ORMCamelModel


class SpinnerSector(CamelModel):
    index: int
    label: str
    coins: int
    color: str
    text_color: str = "#ffffff"


class SpinnerStatusOut(CamelModel):
    coins: int
    can_free_spin: bool
    seconds_until_next_free_spin: int
    paid_spins_available: int
    balance_uzs: float
    user_rank: int
    sectors: list[SpinnerSector]
    spin_cost_uzs: int = 1000
    spins_per_purchase: int = 2
    min_withdrawal_uzs: float = 1000.0
    max_withdrawal_uzs: float = 10000.0
    coin_to_uzs_rate: float = 10.0  # 100 coins = 1,000 UZS


class SpinRequest(CamelModel):
    use_paid: bool = False


class SpinResultOut(CamelModel):
    sector_index: int
    prize_type: str
    coins_won: int
    new_coins_total: int
    can_free_spin: bool
    paid_spins_available: int
    message: str


class BuySpinsResponse(CamelModel):
    status: str
    paid_spins_available: int
    new_balance: float
    message: str


class LeaderboardItem(CamelModel):
    rank: int
    user_id: str
    name: str
    avatar: str | None = None
    coins: int
    is_current_user: bool = False


class LeaderboardOut(CamelModel):
    top_users: list[LeaderboardItem]
    my_rank: int
    my_coins: int
    total_participants: int


class WithdrawRequest(CamelModel):
    card_number: str = Field(..., min_length=16, max_length=20)
    card_holder: str | None = Field(default=None, max_length=120)
    amount_uzs: float = Field(..., ge=1000.0, le=10000.0)


class WithdrawResponse(CamelModel):
    status: str
    request_id: str
    amount_uzs: float
    coins_deducted: int
    remaining_coins: int
    message: str


class RedeemBalanceRequest(CamelModel):
    coins: int = Field(..., ge=50)


class RedeemListingRequest(CamelModel):
    listing_id: uuid.UUID
    service_type: str  # "TOP_7_DAYS" (500 coins) or "VIP_7_DAYS" (1000 coins)


class WithdrawalAdminRow(ORMCamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_phone: str
    card_number: str
    card_holder: str | None = None
    amount_uzs: float
    coins_spent: int
    status: str
    admin_note: str | None = None
    created_at: datetime
    processed_at: datetime | None = None
