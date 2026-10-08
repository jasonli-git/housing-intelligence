"""Historical persistence facts (Milestone 52, #348).

One row per region and fact: where a measure sits against its own long-run range, and
how long past spells at today's level lasted, computed by `hip analyze` from
observations already held. Descriptive only — nothing here says what happens next.
`series` holds each year's distance from the median for the page's chart; `episodes`
the earlier spells; `validation` the check against the dollar ratio the platform shows,
and a fact that fails it is kept with `withheld` set rather than deleted, so the page
can say why it is absent.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "region_persistence",
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # "price_to_income_history".
        sa.Column("fact_id", sa.Text(), nullable=False),
        sa.Column("first_year", sa.Integer(), nullable=False),
        sa.Column("last_year", sa.Integer(), nullable=False),
        sa.Column("years", sa.Integer(), nullable=False),
        sa.Column("missing_years", postgresql.JSONB(), nullable=False),
        # The latest year against the median of every year, in percent, with the range
        # the latest income's 90% margin allows.
        sa.Column("vs_median", sa.Numeric(), nullable=False),
        sa.Column("vs_median_low", sa.Numeric(), nullable=False),
        sa.Column("vs_median_high", sa.Numeric(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("rank_best", sa.Integer(), nullable=False),
        sa.Column("rank_worst", sa.Integer(), nullable=False),
        sa.Column("peak_year", sa.Integer(), nullable=False),
        sa.Column("peak_vs_median", sa.Numeric(), nullable=False),
        # First year of the unbroken run above the median that reaches the latest
        # year; null when the latest year is at or below it.
        sa.Column("above_median_since", sa.Integer(), nullable=True),
        sa.Column("episodes", postgresql.JSONB(), nullable=False),
        sa.Column("series", postgresql.JSONB(), nullable=False),
        sa.Column("validation", postgresql.JSONB(), nullable=True),
        sa.Column("withheld", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("region_id", "fact_id"),
    )


def downgrade() -> None:
    op.drop_table("region_persistence")
