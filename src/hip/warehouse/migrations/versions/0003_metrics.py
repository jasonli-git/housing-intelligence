"""Metric definitions, the observation fact table, and the unresolved-geography record.

`fact_metric_observation` is the one fact table (ARCHITECTURE #8): adding a source that
supplies an existing metric adds rows, never columns.

`source_match_reject` is not an error log. It is the answer to "why does this
municipality have no home value?", which a user will ask the moment they notice a gap —
and without it the only available answer is silence.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "metrics",
        sa.Column("metric_id", sa.Text, primary_key=True),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("unit", sa.Text, nullable=False),
        sa.Column("frequency", sa.Text, nullable=False),
        sa.Column("direction", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column(
            "source_id", sa.Text, sa.ForeignKey("sources.source_id"), nullable=False
        ),
        sa.CheckConstraint(
            "direction IN ('higher_is_better', 'lower_is_better', 'neutral')",
            name="ck_metrics_direction",
        ),
    )

    op.create_table(
        "fact_metric_observation",
        sa.Column(
            "region_id",
            sa.BigInteger,
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "metric_id", sa.Text, sa.ForeignKey("metrics.metric_id"), nullable=False
        ),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("value", sa.Double, nullable=False),
        sa.Column(
            "release_id",
            sa.BigInteger,
            sa.ForeignKey("source_releases.release_id", ondelete="CASCADE"),
            nullable=False,
        ),
        # How this row's geography was resolved. Provenance travels with the value, so
        # a consumer can exclude name-matched rows without re-deriving the join.
        sa.Column("match_method", sa.String(16), nullable=False),
        # Exactly one value per (region, metric, period): a reload upserts rather than
        # appends, so a double run cannot double a county's home value.
        sa.PrimaryKeyConstraint(
            "region_id", "metric_id", "period_start", name="pk_fact_metric_observation"
        ),
        sa.CheckConstraint("period_end >= period_start", name="ck_fact_period_order"),
    )
    op.create_index(
        "ix_fact_metric_period", "fact_metric_observation", ["metric_id", "period_start"]
    )

    op.create_table(
        "source_match_reject",
        sa.Column("reject_id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "source_id",
            sa.Text,
            sa.ForeignKey("sources.source_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("layer", sa.Text, nullable=False),
        sa.Column("region_name", sa.Text, nullable=False),
        sa.Column("county_name", sa.Text, nullable=True),
        sa.Column("observations", sa.BigInteger, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.UniqueConstraint(
            "source_id", "layer", "region_name", "county_name", name="uq_match_reject"
        ),
    )


def downgrade() -> None:
    op.drop_table("source_match_reject")
    op.drop_index("ix_fact_metric_period", table_name="fact_metric_observation")
    op.drop_table("fact_metric_observation")
    op.drop_table("metrics")
