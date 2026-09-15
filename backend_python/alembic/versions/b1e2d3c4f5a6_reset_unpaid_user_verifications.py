"""reset unpaid user verifications and safety badges

Revision ID: b1e2d3c4f5a6
Revises: a3c92f7e5d18
Create Date: 2026-09-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'b1e2d3c4f5a6'
down_revision = 'a3c92f7e5d18'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reset is_verified on all users who never actually bought the VERIFIED_BADGE
    # This cleans up the 17 users who automatically received is_verified=True on registration.
    # Verification level (tasdiqlash darajasi) is kept completely intact.
    op.execute("""
        UPDATE users 
        SET is_verified = false 
        WHERE id NOT IN (
            SELECT user_id FROM wallet_transactions WHERE type = 'PURCHASE_VERIFIED_BADGE'
        );
    """)
    # Also remove VERIFIED_OWNER badge from listings whose owners have not purchased the verified badge
    op.execute("""
        UPDATE listings 
        SET safety_badges = array_remove(safety_badges, 'VERIFIED_OWNER')
        WHERE owner_id NOT IN (
            SELECT user_id FROM wallet_transactions WHERE type = 'PURCHASE_VERIFIED_BADGE'
        );
    """)


def downgrade() -> None:
    pass
