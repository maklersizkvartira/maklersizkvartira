"""add top requests

The promotion ("Top") queue: an owner asks, an admin approves, and only the
approval writes listings.is_featured / featured_until / promotion_weight.

The partial unique index is the structural half of the double-approval guard:
without it two moderators can grant two pending rows for the same listing and
the second silently overwrites the first's grant.

Revision ID: b7d3e91af204
Revises: f1a2b3c4d5e6
Create Date: 2026-08-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'b7d3e91af204'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('top_requests',
    sa.Column('listing_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('requested_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('requested_days', sa.Integer(), server_default='7', nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=12), server_default='PENDING', nullable=False),
    sa.Column('reviewed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('granted_days', sa.Integer(), nullable=True),
    sa.Column('granted_weight', sa.Integer(), nullable=True),
    sa.Column('granted_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('requested_days >= 1 AND requested_days <= 365', name=op.f('ck_top_requests_top_days_sane')),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], name=op.f('fk_top_requests_listing_id_listings'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['requested_by_id'], ['users.id'], name=op.f('fk_top_requests_requested_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['reviewed_by_id'], ['admin_users.id'], name=op.f('fk_top_requests_reviewed_by_id_admin_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_top_requests'))
    )
    op.create_index(op.f('ix_top_requests_created_at'), 'top_requests', ['created_at'], unique=False)
    op.create_index(op.f('ix_top_requests_listing_id'), 'top_requests', ['listing_id'], unique=False)
    op.create_index(op.f('ix_top_requests_status'), 'top_requests', ['status'], unique=False)
    op.create_index('ix_top_requests_status_created', 'top_requests', ['status', 'created_at'], unique=False)
    op.create_index(
        'uq_top_requests_listing_pending',
        'top_requests',
        ['listing_id'],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )


def downgrade() -> None:
    op.drop_index('uq_top_requests_listing_pending', table_name='top_requests')
    op.drop_index('ix_top_requests_status_created', table_name='top_requests')
    op.drop_index(op.f('ix_top_requests_status'), table_name='top_requests')
    op.drop_index(op.f('ix_top_requests_listing_id'), table_name='top_requests')
    op.drop_index(op.f('ix_top_requests_created_at'), table_name='top_requests')
    op.drop_table('top_requests')
