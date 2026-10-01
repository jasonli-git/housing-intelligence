"""Each figure's kind, each source's licence, and the notices its terms require
(Milestone 31, ARCHITECTURE #269).

`metrics.record_type` is what kind of figure a metric is — survey estimate,
administrative records, official determination, published benchmark, calculated, or
modelled (SPEC principle 11, v1.4). `metrics.licence_class` is the licence its figures
carry: its source's, or for a calculated metric the most restrictive of its inputs', so
the restriction on Zillow's home value reaches the price-to-income ratio built from it.
`metrics.originator` names who owns a series its source redistributes (Freddie Mac's
mortgage rate, served by FRED).

`sources` gains the licence class, the page its terms were read on and when (or a note
saying why they could not be), and `notices`, the statements its terms require the site
to display word for word.

All nullable: the config is where each is required (`hip check-config`), and a source or
metric that has left the config keeps its row without one. Schema only: the values are
written by `hip sync-registry`, and again by every `hip analyze`, from the config as it
then stands. A migration that called the application's upsert would replay today's code
against a later schema, and fail the first time a later milestone added a column the
upsert writes.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sources", sa.Column("licence_class", sa.Text(), nullable=True))
    op.add_column("sources", sa.Column("terms_url", sa.Text(), nullable=True))
    op.add_column("sources", sa.Column("terms_checked", sa.Date(), nullable=True))
    op.add_column("sources", sa.Column("terms_note", sa.Text(), nullable=True))
    op.add_column(
        "sources",
        sa.Column(
            "notices",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
    )
    op.add_column("metrics", sa.Column("record_type", sa.Text(), nullable=True))
    op.add_column("metrics", sa.Column("licence_class", sa.Text(), nullable=True))
    op.add_column("metrics", sa.Column("originator", sa.Text(), nullable=True))


def downgrade() -> None:
    for column in ("originator", "licence_class", "record_type"):
        op.drop_column("metrics", column)
    for column in (
        "notices",
        "terms_note",
        "terms_checked",
        "terms_url",
        "licence_class",
    ):
        op.drop_column("sources", column)
