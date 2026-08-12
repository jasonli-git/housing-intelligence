"""Derived analytics: change over time and rankings.

Both tables are **derived and disposable** — rebuilt in full by `hip analyze`, never
incrementally updated. If either disagrees with `fact_metric_observation`, it is wrong
and gets rebuilt (ARCHITECTURE, Warehouse Schema).

Also registers `hip_derived`, a synthetic source. Computed metrics such as
price-to-income are written to `fact_metric_observation` like any other metric (#8), and
that table requires every fact to name a release (#9). Giving each `analyze` run its own
release keeps both invariants true for values the platform computed itself, and makes a
derived figure traceable to the run that produced it.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO sources (source_id, name, publisher, license, url, cadence)
        VALUES ('hip_derived', 'Computed by the platform',
                'Housing Intelligence Platform', 'Derived from cited sources',
                'https://github.com/jasonli-git/housing-intelligence', 'irregular')
        ON CONFLICT (source_id) DO NOTHING
        """
    )

    op.create_table(
        "fact_metric_change",
        sa.Column(
            "region_id",
            sa.BigInteger,
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "metric_id", sa.Text, sa.ForeignKey("metrics.metric_id"), nullable=False
        ),
        # A label such as '5y' or 'since_2019'. Stored rather than derived from the
        # dates so a caller can ask for "the 5-year change" without knowing which
        # period the metric happens to end on — sources have different frequencies.
        sa.Column("window", sa.String(16), nullable=False),
        sa.Column("window_start", sa.Date, nullable=False),
        sa.Column("window_end", sa.Date, nullable=False),
        sa.Column("start_value", sa.Double, nullable=False),
        sa.Column("end_value", sa.Double, nullable=False),
        sa.Column("pct_change", sa.Double, nullable=False),
        # Undefined for windows shorter than a year and for sign changes.
        sa.Column("cagr", sa.Double, nullable=True),
        sa.PrimaryKeyConstraint(
            "region_id", "metric_id", "window", name="pk_fact_metric_change"
        ),
        sa.CheckConstraint("window_end > window_start", name="ck_change_window_order"),
    )
    op.create_index(
        "ix_change_metric_window", "fact_metric_change", ["metric_id", "window"]
    )

    op.create_table(
        "region_rankings",
        sa.Column(
            "metric_id", sa.Text, sa.ForeignKey("metrics.metric_id"), nullable=False
        ),
        sa.Column("level", sa.Text, nullable=False),
        sa.Column("window", sa.String(16), nullable=False),
        sa.Column(
            "region_id",
            sa.BigInteger,
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("value", sa.Double, nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("of", sa.Integer, nullable=False),
        sa.Column("percentile", sa.Double, nullable=False),
        sa.PrimaryKeyConstraint(
            "metric_id", "level", "window", "region_id", name="pk_region_rankings"
        ),
        sa.CheckConstraint("rank >= 1 AND rank <= of", name="ck_rank_in_range"),
    )
    op.create_index(
        "ix_rankings_lookup", "region_rankings", ["metric_id", "level", "window", "rank"]
    )


def downgrade() -> None:
    op.drop_table("region_rankings")
    op.drop_index("ix_change_metric_window", table_name="fact_metric_change")
    op.drop_table("fact_metric_change")
    op.execute("DELETE FROM sources WHERE source_id = 'hip_derived'")
