"""Every survey figure the site shows carries its margin (Milestone 28, SPEC v1.3).

Migration 0016 stored a margin on each observation and on each change, which covered a
region's latest values and its changes. It left two figures a page shows with nowhere to
read theirs from: the two ends of a change — "538 in 2019, 2,256 in 2024" — and the
ranked value in `/rankings`, which the New Jersey page's county table and its map read.

`fact_metric_change.start_margin`/`end_margin` are the margins of `start_value` and
`end_value`, taken from the same observations the change compares, so they can never
belong to a different period than the figures beside them. `region_rankings.
margin_of_error` is the margin of the ranked `value` — the change's under
`basis=change`, the latest observation's under `basis=value` — the same margin
`_rank_ranges` tests differences with. All three are NULL where the metric has no
margins.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table, column in (
        ("fact_metric_change", "start_margin"),
        ("fact_metric_change", "end_margin"),
        ("region_rankings", "margin_of_error"),
    ):
        op.add_column(table, sa.Column(column, sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("region_rankings", "margin_of_error")
    op.drop_column("fact_metric_change", "end_margin")
    op.drop_column("fact_metric_change", "start_margin")
