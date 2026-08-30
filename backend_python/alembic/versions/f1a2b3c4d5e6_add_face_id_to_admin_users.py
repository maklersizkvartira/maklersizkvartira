"""add face id to admin users

Revision ID: f1a2b3c4d5e6
Revises: a1c7e4d9b2f0
Create Date: 2026-08-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'f1a2b3c4d5e6'
down_revision = 'a1c7e4d9b2f0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'admin_users',
        sa.Column('face_image', sa.Text(), nullable=True),
    )
    op.add_column(
        'admin_users',
        sa.Column('face_encoding', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('admin_users', 'face_encoding')
    op.drop_column('admin_users', 'face_image')
