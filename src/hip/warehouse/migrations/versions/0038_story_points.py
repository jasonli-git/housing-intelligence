"""Rows a visual story draws that are not a region's measure (2026-10-23, #438).

Most stories read published metrics. A few draw shapes a metric cannot hold: a
statewide count for every day since 1978, a distribution across bins, a name to label
a dot with. One table for all of them rather than one per story, keyed by the story and
a series within it; `x` is text so a day, a bin or a rank all fit, and the story says
how to read it. Every row cites the release it was counted from, as every fact does.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "story_points",
        sa.Column("story_id", sa.Text(), nullable=False),
        sa.Column("series", sa.Text(), nullable=False),
        # The region a row describes; null for a statewide count.
        sa.Column(
            "region_id",
            sa.Integer(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("x", sa.Text(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("story_points_story", "story_points", ["story_id", "series"])


def downgrade() -> None:
    op.drop_index("story_points_story", table_name="story_points")
    op.drop_table("story_points")
