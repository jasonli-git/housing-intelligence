"""Margins of error, on the figures, their changes and their ranks (Milestone 28).

The Census publishes a 90% margin of error with every ACS estimate, and until now the
platform dropped it: "$100,645" read as exact when the Census itself says "± $2,565",
and "9th of 21" read as a place when the error could not tell ninth from fifth.

**A column on the observation, not a metric of its own or a side table.** A margin is a
property of one estimate — same region, metric and period — so it sits on that row. As
`*_moe` metrics it would have entered every catalog, ranking and completeness count as
a figure in its own right; in a side table every reader of a value would need a join to
learn how far to trust it. Nullable, because only a survey has one: Zillow's index,
MOD-IV's records and a mortgage rate carry no sampling error to report.

**Margins are not revisions.** `record_fact_revision` fires on a changed `value` and
stays that way: the first load of margins would otherwise record some 20,000
"revisions" of figures whose values never moved.

`fact_metric_change.pct_change_margin` carries the margin through a change, and
`region_rankings.rank_best`/`rank_worst` the ranks a region could plausibly hold given
everyone's margins. All three are NULL where the metric has no margins.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fact_metric_observation",
        sa.Column("margin_of_error", sa.Float(), nullable=True),
    )
    op.add_column(
        "fact_metric_change",
        sa.Column("pct_change_margin", sa.Float(), nullable=True),
    )
    op.add_column("region_rankings", sa.Column("rank_best", sa.Integer(), nullable=True))
    op.add_column("region_rankings", sa.Column("rank_worst", sa.Integer(), nullable=True))
    # A range that does not contain the rank itself is a bug, not a finding.
    op.create_check_constraint(
        "ck_region_rankings_rank_range",
        "region_rankings",
        "(rank_best IS NULL AND rank_worst IS NULL) OR "
        "(rank_best >= 1 AND rank_best <= rank "
        ' AND rank <= rank_worst AND rank_worst <= "of")',
    )


def downgrade() -> None:
    op.drop_constraint("ck_region_rankings_rank_range", "region_rankings")
    op.drop_column("region_rankings", "rank_worst")
    op.drop_column("region_rankings", "rank_best")
    op.drop_column("fact_metric_change", "pct_change_margin")
    op.drop_column("fact_metric_observation", "margin_of_error")
