"""ai session agent state

Holds the agent loop's between-turn working memory: which listings are
currently on screen (so "the second one" resolves server-side) and any tool
call waiting for the visitor to confirm it.

Revision ID: a1c7e4d9b2f0
Revises: 78a976b5bfdc
Create Date: 2026-08-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'a1c7e4d9b2f0'
down_revision = '78a976b5bfdc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'ai_sessions',
        sa.Column('agent_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('ai_sessions', 'agent_state')
