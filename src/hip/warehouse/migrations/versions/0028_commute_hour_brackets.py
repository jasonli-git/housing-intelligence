"""Commutes of an hour or more now count both brackets (Milestone 45, #316).

`acs_commute_60plus_share` read only B08303_013, workers taking 90 minutes or more,
under a label and definition saying an hour or more; 60 to 89 minutes (B08303_012) was
never requested. Found 2026-10-06 when Milestone 45 put the figure in a sentence:
Hoboken read 2%. The same Census editions now give larger shares, and `/changes` says
the site changed, not the Census (#284's mechanism, migration 0017).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO method_changes (changed_on, metric_id, note) VALUES (
            DATE '2026-10-06', 'acs_commute_60plus_share',
            'This site corrected how it computes this figure: it counted only commutes '
            || 'of 90 minutes or more, and now counts every commute of an hour or more, '
            || 'adding the Census''s 60-to-89-minute bracket. The Census''s figures did '
            || 'not change.'
        )
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM method_changes WHERE changed_on = DATE '2026-10-06' "
        "AND metric_id = 'acs_commute_60plus_share'"
    )
