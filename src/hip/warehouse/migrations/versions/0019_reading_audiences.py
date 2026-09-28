"""One reading per region and audience, in place of one per model (Milestone 30).

Migration 0010 widened the key to `(region_id, window, model_id)` so a region could
carry every model's reading of one packet side by side. Milestone 30 replaces that
comparison with two readings written for two readers — an analyst reading and a
consumer reading — each from the first model on its own preference list that writes
one fit to publish. So `audience` takes `model_id`'s place in the key, and `model_id`,
`model_label`, `runtime` and `rank` stay on the row as its provenance: which model,
where, and which tier of its list wrote it.

`sections` holds a consumer reading's answers — each fixed question's id, heading, and
where its answer sits in `body` — so a page can lay them out and Milestone 47 can reuse
them by id. Null for an analyst reading, which is prose without sections.

Existing rows become analyst readings, and only each region's preferred one is kept —
the lowest rank, as the singular endpoint already served. The others were alternatives
the site no longer shows; a regeneration would replace them anyway, since packet 1.3's
margins change every figure's content hash.

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Server default so the column can be NOT NULL against existing rows, then dropped:
    # every later insert states its audience.
    op.add_column(
        "region_explanations",
        sa.Column("audience", sa.String(16), nullable=False, server_default="analyst"),
    )
    op.alter_column("region_explanations", "audience", server_default=None)
    op.add_column(
        "region_explanations",
        sa.Column("sections", JSONB(none_as_null=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_region_explanations_audience",
        "region_explanations",
        "audience IN ('analyst', 'consumer')",
    )

    # Before re-keying, so the new key is never asked to hold duplicates it cannot.
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
        "region_explanations_pkey",
        "region_explanations",
        ["region_id", "window", "audience"],
    )


def downgrade() -> None:
    # Lossy by nature: the old key has no audience, so consumer readings are dropped and
    # each region keeps its analyst reading under its model.
    op.execute("DELETE FROM region_explanations WHERE audience = 'consumer'")
    op.drop_constraint("region_explanations_pkey", "region_explanations", type_="primary")
    op.create_primary_key(
        "region_explanations_pkey",
        "region_explanations",
        ["region_id", "window", "model_id"],
    )
    op.create_index(
        "ix_region_explanations_rank",
        "region_explanations",
        ["region_id", "window", "rank"],
    )
    op.drop_constraint(
        "ck_region_explanations_audience", "region_explanations", type_="check"
    )
    op.drop_column("region_explanations", "sections")
    op.drop_column("region_explanations", "audience")
