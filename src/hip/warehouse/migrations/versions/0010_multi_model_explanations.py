"""Let a region carry one explanation per model, ordered by preference-list position.

Until now `region_explanations` held exactly one row per `(region_id, window)`, which
was right while the platform ran one model. Milestone 12 made model choice a preference
list resolved at generation time, and the natural next question from a reader — *what
would a different model have said about these same numbers?* — cannot be answered by a
table that can only store one answer.

`model_id` joins the primary key. `rank` carries the model's position in
`generation.preference` at the moment the row was written, and exists because the API
cannot look it up: `API_MAY_IMPORT` is `{warehouse, packets}`, so ordering five
explanations has to be data rather than configuration read at request time. It is also
honest provenance in the same way `model_id` and `runtime` already are — the row records
which tier produced it, not merely that some model did.

Existing rows take rank 0. They were written by whichever model the evaluation selected,
which is by definition the head of the list at that time.

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Server default so the column can be NOT NULL against existing rows, then dropped:
    # every later insert states its own rank, and a lingering default would silently
    # make an unranked row look like the preferred one.
    op.add_column(
        "region_explanations",
        sa.Column("rank", sa.SmallInteger(), nullable=False, server_default="0"),
    )
    op.alter_column("region_explanations", "rank", server_default=None)

    op.drop_constraint("region_explanations_pkey", "region_explanations", type_="primary")
    op.create_primary_key(
        "region_explanations_pkey",
        "region_explanations",
        ["region_id", "window", "model_id"],
    )

    # Reading a region's explanations in rank order is the plural endpoint's only query.
    op.create_index(
        "ix_region_explanations_rank",
        "region_explanations",
        ["region_id", "window", "rank"],
    )


def downgrade() -> None:
    # Lossy by nature: the old key admits one row per (region, window), so everything
    # but the preferred explanation is dropped. Deleting before re-keying rather than
    # after, so the primary key is never asked to hold duplicates it cannot.
    op.execute(
        """
        DELETE FROM region_explanations a
        USING region_explanations b
        WHERE a.region_id = b.region_id
          AND a.window = b.window
          AND (a.rank > b.rank OR (a.rank = b.rank AND a.model_id > b.model_id))
        """
    )
    op.drop_index("ix_region_explanations_rank", table_name="region_explanations")
    op.drop_constraint("region_explanations_pkey", "region_explanations", type_="primary")
    op.create_primary_key(
        "region_explanations_pkey", "region_explanations", ["region_id", "window"]
    )
    op.drop_column("region_explanations", "rank")
