"""reset mock balances and promotions

Revision ID: c2d3e4f5a6b7
Revises: b1e2d3c4f5a6
Create Date: 2026-09-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'c2d3e4f5a6b7'
down_revision = 'b1e2d3c4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Data clean-up only. Guarded so a fresh database, where the wallet
    # tables are created by a later migration, passes straight through.
    # 1. Clean up any wallet_transactions created by SANDBOX_TEST transactions
    op.execute("""
        DO $$ BEGIN
        IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
            DELETE FROM wallet_transactions
            WHERE reference_id IN (
                SELECT id FROM payment_transactions WHERE service_type = 'SANDBOX_TEST'
            );
        END IF;
        END $$;
    """)

    # 2. Reset user balances to strictly reflect real successful payment transactions minus real service purchases
    op.execute("""
        DO $$ BEGIN
        IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
            UPDATE users
            SET balance = GREATEST(0.0,
                COALESCE((
                    SELECT SUM(pt.amount)
                    FROM payment_transactions pt
                    WHERE pt.user_id = users.id
                      AND pt.status = 'SUCCESS'
                      AND (pt.service_type IS NULL OR pt.service_type != 'SANDBOX_TEST')
                ), 0.0)
                -
                COALESCE((
                    SELECT SUM(ABS(wt.amount))
                    FROM wallet_transactions wt
                    WHERE wt.user_id = users.id
                      AND wt.type LIKE 'PURCHASE_%'
                ), 0.0)
            );
        END IF;
        END $$;
    """)

    # 3. Clean up mock TOP and VIP promotions on listings that were not actually purchased
    op.execute("""
        DO $$ BEGIN
        IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
            UPDATE listings
            SET is_featured = false,
                featured_until = NULL,
                is_vip = false,
                vip_until = NULL,
                promotion_weight = 0
            WHERE id NOT IN (
                SELECT reference_id FROM wallet_transactions 
                WHERE reference_id IS NOT NULL AND type IN ('PURCHASE_TOP_LISTING', 'PURCHASE_VIP_LISTING', 'PURCHASE_TOP', 'PURCHASE_VIP')
            )
            AND id NOT IN (
                SELECT listing_id FROM top_requests 
                WHERE status = 'APPROVED' AND granted_until > NOW()
            )
            AND (featured_until IS NULL OR featured_until <= NOW())
            AND (vip_until IS NULL OR vip_until <= NOW());
        END IF;
        END $$;
    """)


def downgrade() -> None:
    pass
