"""Rank regions by current value, not only by change.

Until now `region_rankings` answered exactly one question: who rose fastest over a
window. That question needs two observations, and MOD-IV publishes a single composite —
so every assessment metric would have entered the warehouse unrankable and invisible to
`/rankings`, `/summary`, and the analysis packet.

`basis` distinguishes the two questions a ranking can answer:

- `change` — ordered by `fact_metric_change.pct_change` over `window` ('5y', 'since_2019')
- `value`  — ordered by the region's most recent `fact_metric_observation`, with
  `window` holding the literal 'latest', because a level has no span

Both live in one table on purpose (ARCHITECTURE #8): a second rankings table would split
every ranking query in two and force `/rankings` to branch before it knew what it was
asked for. Also closes the Milestone 4 note that "most expensive municipality" was a
question the tables could not answer.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows are all change rankings, so the default backfills them correctly.
    # It is dropped immediately afterwards: every future writer states its basis, and a
    # default would let a caller omit the thing that gives the row meaning.
    op.add_column(
        "region_rankings",
        sa.Column("basis", sa.String(8), nullable=False, server_default="change"),
    )
    op.alter_column("region_rankings", "basis", server_default=None)

    op.drop_constraint("pk_region_rankings", "region_rankings", type_="primary")
    op.create_primary_key(
        "pk_region_rankings",
        "region_rankings",
        ["metric_id", "level", "basis", "window", "region_id"],
    )
    op.create_check_constraint(
        "ck_rankings_basis", "region_rankings", "basis IN ('change', 'value')"
    )

    # The lookup index leads with the columns every ranking query filters on.
    op.drop_index("ix_rankings_lookup", table_name="region_rankings")
    op.create_index(
        "ix_rankings_lookup",
        "region_rankings",
        ["metric_id", "level", "basis", "window", "rank"],
    )


def downgrade() -> None:
    op.drop_index("ix_rankings_lookup", table_name="region_rankings")
    op.execute("DELETE FROM region_rankings WHERE basis = 'value'")
    op.drop_constraint("ck_rankings_basis", "region_rankings", type_="check")
    op.drop_constraint("pk_region_rankings", "region_rankings", type_="primary")
    op.create_primary_key(
        "pk_region_rankings",
        "region_rankings",
        ["metric_id", "level", "window", "region_id"],
    )
    op.drop_column("region_rankings", "basis")
    op.create_index(
        "ix_rankings_lookup", "region_rankings", ["metric_id", "level", "window", "rank"]
    )
