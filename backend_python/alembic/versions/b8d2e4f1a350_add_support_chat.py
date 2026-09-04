"""add support chat tables

Revision ID: b8d2e4f1a350
Revises: a7c14e9d3b60
Create Date: 2026-09-04
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'b8d2e4f1a350'
down_revision = 'a7c14e9d3b60'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'support_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='OPEN', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_support_conversations_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_support_conversations')),
    )
    op.create_index(op.f('ix_support_conversations_user_id'), 'support_conversations', ['user_id'], unique=True)
    op.create_index(op.f('ix_support_conversations_status'), 'support_conversations', ['status'], unique=False)
    op.create_index(op.f('ix_support_conversations_created_at'), 'support_conversations', ['created_at'], unique=False)

    op.create_table(
        'support_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_type', sa.String(length=10), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['support_conversations.id'], name=op.f('fk_support_messages_conversation_id_support_conversations'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_support_messages')),
    )
    op.create_index(op.f('ix_support_messages_conversation_id'), 'support_messages', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_support_messages_sender_id'), 'support_messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_support_messages_created_at'), 'support_messages', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_support_messages_created_at'), table_name='support_messages')
    op.drop_index(op.f('ix_support_messages_sender_id'), table_name='support_messages')
    op.drop_index(op.f('ix_support_messages_conversation_id'), table_name='support_messages')
    op.drop_table('support_messages')

    op.drop_index(op.f('ix_support_conversations_created_at'), table_name='support_conversations')
    op.drop_index(op.f('ix_support_conversations_status'), table_name='support_conversations')
    op.drop_index(op.f('ix_support_conversations_user_id'), table_name='support_conversations')
    op.drop_table('support_conversations')
