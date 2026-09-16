"""add payment and push tables

Revision ID: d7e8f9a0b1c2
Revises: c2d3e4f5a6b7
Create Date: 2026-09-16

The wallet (users.balance), the VIP columns on listings, the three payment
tables and the two push tables reached production on 2026-09-13 through a
block of raw SQL in `app.main`'s lifespan — never through a migration. That
worked on the one database that already existed, and on nothing else: on a
fresh database `alembic upgrade head` stopped at the two reset migrations,
which UPDATE tables that did not exist yet, so the test suite could not
even start.

Every statement here is idempotent (`IF NOT EXISTS`), because on production
these objects already exist. The two reset migrations before this one are
guarded the same way, so the chain now runs clean from an empty database.
"""
from __future__ import annotations

from alembic import op


revision = 'd7e8f9a0b1c2'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DOUBLE PRECISION NOT NULL DEFAULT 0.0;
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS vip_until TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS ix_listings_is_vip ON listings(is_vip);

        CREATE TABLE IF NOT EXISTS payment_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(32) NOT NULL DEFAULT 'CLICK',
            status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
            amount DOUBLE PRECISION NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'UZS',
            service_type VARCHAR(64) NOT NULL DEFAULT 'TOPUP',
            listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
            click_trans_id VARCHAR(64),
            click_paydoc_id VARCHAR(64),
            merchant_prepare_id VARCHAR(64),
            payme_trans_id VARCHAR(64),
            payme_time BIGINT,
            payme_perform_time BIGINT,
            payme_cancel_time BIGINT,
            payme_state INTEGER,
            payme_reason INTEGER,
            error_code INTEGER NOT NULL DEFAULT 0,
            error_note TEXT,
            card_pan VARCHAR(32),
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payme_trans_id VARCHAR(64);
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payme_time BIGINT;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payme_perform_time BIGINT;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payme_cancel_time BIGINT;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payme_state INTEGER;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payme_reason INTEGER;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS card_pan VARCHAR(32);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_user_id ON payment_transactions(user_id);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_status ON payment_transactions(status);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_created_at ON payment_transactions(created_at);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_click_trans_id ON payment_transactions(click_trans_id);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_payme_trans_id ON payment_transactions(payme_trans_id);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_user_status ON payment_transactions(user_id, status);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_provider_click ON payment_transactions(provider, click_trans_id);
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_provider_payme ON payment_transactions(provider, payme_trans_id);

        CREATE TABLE IF NOT EXISTS click_payment_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            action VARCHAR(32) NOT NULL,
            click_trans_id VARCHAR(64),
            service_id VARCHAR(64),
            merchant_trans_id VARCHAR(64),
            amount DOUBLE PRECISION,
            error_code INTEGER NOT NULL DEFAULT 0,
            error_note TEXT,
            raw_request JSONB,
            raw_response JSONB,
            client_ip VARCHAR(64),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_click_payment_logs_click_trans_id ON click_payment_logs(click_trans_id);
        CREATE INDEX IF NOT EXISTS ix_click_payment_logs_created_at ON click_payment_logs(created_at);

        CREATE TABLE IF NOT EXISTS payme_payment_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            method VARCHAR(64) NOT NULL,
            payme_trans_id VARCHAR(64),
            account_param VARCHAR(128),
            amount DOUBLE PRECISION,
            error_code INTEGER,
            error_message TEXT,
            raw_request JSONB,
            raw_response JSONB,
            client_ip VARCHAR(64),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_payme_payment_logs_payme_trans_id ON payme_payment_logs(payme_trans_id);
        CREATE INDEX IF NOT EXISTS ix_payme_payment_logs_created_at ON payme_payment_logs(created_at);

        CREATE TABLE IF NOT EXISTS wallet_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(32) NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            balance_after DOUBLE PRECISION NOT NULL,
            description VARCHAR(255) NOT NULL,
            reference_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_wallet_transactions_user_id ON wallet_transactions(user_id);
        CREATE INDEX IF NOT EXISTS ix_wallet_transactions_type ON wallet_transactions(type);
        CREATE INDEX IF NOT EXISTS ix_wallet_transactions_created_at ON wallet_transactions(created_at);
        CREATE INDEX IF NOT EXISTS ix_wallet_transactions_user_created ON wallet_transactions(user_id, created_at);

        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            endpoint TEXT NOT NULL,
            p256dh TEXT,
            auth TEXT,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            guest_id VARCHAR(64),
            user_agent TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id ON push_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS ix_push_subscriptions_guest_id ON push_subscriptions(guest_id);
        -- The model declares `endpoint` unique THROUGH its index. The lifespan
        -- SQL made a UNIQUE constraint plus a plain index instead; converge.
        ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;
        DROP INDEX IF EXISTS ix_push_subscriptions_endpoint;
        CREATE UNIQUE INDEX ix_push_subscriptions_endpoint ON push_subscriptions(endpoint);
        CREATE INDEX IF NOT EXISTS ix_push_subscriptions_created_at ON push_subscriptions(created_at);

        CREATE TABLE IF NOT EXISTS push_notification_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            url TEXT,
            image TEXT,
            target_audience VARCHAR(64) NOT NULL,
            target_user_id VARCHAR(64),
            sent_count INTEGER NOT NULL DEFAULT 0,
            sent_by VARCHAR(128),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        -- The lifespan SQL created this table without updated_at, which the
        -- model's TimestampMixin writes on every insert.
        ALTER TABLE push_notification_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        CREATE INDEX IF NOT EXISTS ix_push_notification_history_created_at ON push_notification_history(created_at);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS push_notification_history;
        DROP TABLE IF EXISTS push_subscriptions;
        DROP TABLE IF EXISTS wallet_transactions;
        DROP TABLE IF EXISTS payme_payment_logs;
        DROP TABLE IF EXISTS click_payment_logs;
        DROP TABLE IF EXISTS payment_transactions;
        ALTER TABLE listings DROP COLUMN IF EXISTS vip_until;
        ALTER TABLE listings DROP COLUMN IF EXISTS is_vip;
        ALTER TABLE users DROP COLUMN IF EXISTS balance;
    """)
