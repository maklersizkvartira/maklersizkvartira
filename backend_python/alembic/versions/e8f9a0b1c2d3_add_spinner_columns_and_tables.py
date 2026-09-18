"""add spinner columns and tables

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-09-18

The coin/spinner feature put three columns on `users` and two tables into
production the same way the wallet did — raw SQL in `app.main`'s lifespan,
no migration. The ORM model reads `users.coins` on every user lookup, so
on any database the lifespan has not touched (the test suite's, a fresh
one) every sign-in and registration was a 500. Idempotent, like d7e8f9a0b1c2,
because production already has all of it.
"""
from __future__ import annotations

from alembic import op


revision = 'e8f9a0b1c2d3'
down_revision = 'd7e8f9a0b1c2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_free_spin_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_spins_available INTEGER NOT NULL DEFAULT 0;

        CREATE TABLE IF NOT EXISTS spin_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            spin_type VARCHAR(20) NOT NULL DEFAULT 'FREE',
            sector_index INTEGER NOT NULL,
            prize_type VARCHAR(30) NOT NULL DEFAULT 'COINS',
            coins_won INTEGER NOT NULL DEFAULT 0,
            meta_info VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_spin_history_user_id ON spin_history(user_id);
        CREATE INDEX IF NOT EXISTS ix_spin_history_created_at ON spin_history(created_at);

        CREATE TABLE IF NOT EXISTS coin_withdrawal_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            card_number VARCHAR(32) NOT NULL,
            card_holder VARCHAR(120),
            amount_uzs DOUBLE PRECISION NOT NULL,
            coins_spent INTEGER NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            admin_note TEXT,
            processed_by_id UUID,
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_coin_withdrawal_requests_user_id ON coin_withdrawal_requests(user_id);
        CREATE INDEX IF NOT EXISTS ix_coin_withdrawal_requests_status ON coin_withdrawal_requests(status);
        CREATE INDEX IF NOT EXISTS ix_coin_withdrawal_requests_created_at ON coin_withdrawal_requests(created_at);

        CREATE TABLE IF NOT EXISTS coin_exchange_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            exchange_type VARCHAR(30) NOT NULL,
            coins_spent INTEGER NOT NULL,
            amount_uzs DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            listing_id UUID,
            description VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_coin_exchange_transactions_user_id ON coin_exchange_transactions(user_id);
        CREATE INDEX IF NOT EXISTS ix_coin_exchange_transactions_created_at ON coin_exchange_transactions(created_at);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS coin_exchange_transactions;
        DROP TABLE IF EXISTS coin_withdrawal_requests;
        DROP TABLE IF EXISTS spin_history;
        ALTER TABLE users DROP COLUMN IF EXISTS paid_spins_available;
        ALTER TABLE users DROP COLUMN IF EXISTS last_free_spin_at;
        ALTER TABLE users DROP COLUMN IF EXISTS coins;
    """)
