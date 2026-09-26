"""The days this site changed how it computes a figure (Milestone 28).

`fact_revision` records every figure that moves, and `/changes` shows them; until now
every move read as a publisher's revision. Milestone 28 changed how renter cost burden
is computed — renters whose burden the Census could not compute left the denominator —
which moved 3,084 figures from the same Census editions. Shown as revisions they would
have said the Census revised them.

**An explicit record rather than an inference.** A revision's two releases cannot say
why a figure moved: the same dated vintage on both sides looks like a recomputation,
but Building Permits re-issues its annual file under the same label with revised
months, and a stale citation (below) can make one edition look like another. So a
method change is written down here, by the migration that ships it, and the report
labels the matching day and metric. One row per (day, metric); the note is what a
reader is told.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "method_changes",
        sa.Column("changed_on", sa.Date(), primary_key=True),
        sa.Column("metric_id", sa.Text(), primary_key=True),
        sa.Column("note", sa.Text(), nullable=False),
    )
    op.execute(
        """
        INSERT INTO method_changes (changed_on, metric_id, note) VALUES (
            DATE '2026-09-26', 'acs_renter_cost_burden',
            'This site changed how it computes this figure: renters whose housing cost '
            || 'burden the Census could not compute — no or negative income, or no cash '
            || 'rent — no longer count in the denominator, the way HUD''s CHAS tables '
            || 'count them. The Census''s figures did not change.'
        )
        """
    )


def downgrade() -> None:
    op.drop_table("method_changes")
