"""reset listing reliability

Publication no longer runs an automated check, so every trust_score,
risk_score and ai_risk_reasons value currently in the table was written by a
scanner that no longer exists and means nothing under the new rule. This
revision makes the data agree with the rule:

  * trust_score starts at 100 for every listing, and is then reduced only by
    the reports an admin has already CONFIRMED (ReportStatus.RESOLVED), using
    the same penalty table the application uses:
    CRITICAL 25 / HIGH 15 / MEDIUM 10 / LOW 5, floored at 10.
  * risk_score becomes 100 - trust_score, which is what the admin queue's
    filter and its "most complained about first" sort now read.
  * ai_risk_reasons is emptied. The strings in it are the old scanner's own
    prose ("Maklerlik belgisi topildi: ...") and the public detail page prints
    them verbatim - leaving them would keep the retired positioning on the
    site after the rebrand.
  * Listings the machine left dark (PENDING or WARNING) are published, but
    ONLY where moderated_by_id IS NULL. That column is the exact
    discriminator: a row a human admin acted on always carries it, a row the
    scanner judged never does. So deliberate takedowns survive and only
    machine verdicts are reversed. Rows at REJECTED are left alone.

downgrade() puts the schema back (the server default on trust_score) but
cannot restore the old numbers or the old statuses - they were verdicts from
a module that has been deleted. Take a snapshot of
``SELECT id, status, trust_score, risk_score, ai_risk_reasons FROM listings``
before running this if the old values are wanted for anything.

Revision ID: c8e4f0a1b2c3
Revises: b7d3e91af204
Create Date: 2026-08-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'c8e4f0a1b2c3'
down_revision = 'b7d3e91af204'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A fresh listing reads 100%, at both layers.
    op.alter_column(
        'listings', 'trust_score', existing_type=sa.Integer(), server_default='100'
    )

    # 1. Wipe the machine-written scores and the machine-written prose.
    op.execute(
        "UPDATE listings SET trust_score = 100, risk_score = 0, ai_risk_reasons = '{}'"
    )

    # 2. Drop the three badges that can never be awarded again: AI_CHECKED is a
    #    claim that is no longer true, NO_COMMISSION is retired positioning and
    #    STUDENT_FRIENDLY was never re-awarded after the create form was
    #    simplified. Only VERIFIED_OWNER and PROPERTY_VERIFIED are written now,
    #    and the admin sheet is the one surface that renders the raw array, so
    #    a value it has no label for would simply disappear from the row.
    op.execute(
        "UPDATE listings SET safety_badges = array_remove(array_remove("
        "array_remove(safety_badges, 'AI_CHECKED'), 'NO_COMMISSION'), "
        "'STUDENT_FRIENDLY')"
    )

    # 3. Publish what the scanner held back, but never what an admin decided.
    op.execute(
        "UPDATE listings SET status = 'APPROVED', "
        "published_at = COALESCE(published_at, created_at) "
        "WHERE deleted_at IS NULL AND moderated_by_id IS NULL "
        "AND status IN ('PENDING', 'WARNING')"
    )

    # 4. Re-apply the penalties of every already-confirmed complaint, so an
    #    admin's past decisions survive the reset.
    op.execute(
        """
        WITH penalties AS (
            SELECT listing_id,
                   SUM(CASE priority
                           WHEN 'CRITICAL' THEN 25
                           WHEN 'HIGH' THEN 15
                           WHEN 'LOW' THEN 5
                           ELSE 10
                       END) AS penalty
            FROM reports
            WHERE status = 'RESOLVED'
            GROUP BY listing_id
        )
        UPDATE listings AS l
           SET trust_score = GREATEST(10, 100 - p.penalty),
               risk_score = 100 - GREATEST(10, 100 - p.penalty)
          FROM penalties AS p
         WHERE p.listing_id = l.id
        """
    )


def downgrade() -> None:
    # The column default goes back to "no server default", which is how the
    # initial schema created it. The data cannot be restored - see the module
    # docstring.
    op.alter_column(
        'listings', 'trust_score', existing_type=sa.Integer(), server_default=None
    )
