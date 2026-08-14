"""Store model-written explanations as precomputed, attributed text.

The AI layer's first and only runtime surface. Three properties are enforced here rather
than left to the reader:

- **Precomputed.** `hip explain` writes; the API only reads (ARCHITECTURE #6). Generating
  at request time would put a multi-gigabyte model load in the path of a page view, and
  on 16GB of unified memory a second resident model means swap.
- **Attributed.** `model_id` and `model_label` are not null. An explanation that cannot
  say which model wrote it is indistinguishable from a computed figure, which is exactly
  the confusion SPEC forbids.
- **Falsifiable.** `packet_sha256` pins the explanation to the bytes it was generated
  from, so a stale explanation is detectable rather than merely old. A pipeline re-run
  that changes the packet leaves the hash mismatched and the API can say so.

The text is interpretation, never measurement. Nothing in this table feeds an analytic,
a ranking, or a packet — the arrow points one way, out to the reader.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "region_explanations",
        sa.Column(
            "region_id",
            sa.BigInteger(),
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        # One explanation per region per window: a 5y narrative and a since-2019 one
        # describe different things and must not overwrite each other.
        sa.Column("window", sa.String(length=16), primary_key=True),
        sa.Column("model_id", sa.String(length=64), nullable=False),
        sa.Column("model_label", sa.Text(), nullable=False),
        sa.Column("runtime", sa.String(length=16), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        # The packet these sentences were written from. A mismatch against the current
        # packet means the warehouse moved on and the text should not be trusted.
        sa.Column("packet_sha256", sa.String(length=64), nullable=False),
        # Wall clock belongs here, unlike in a packet (ARCHITECTURE #44): generated text
        # is not reproducible from the warehouse, so when it was written is a property
        # of the row rather than noise that defeats a diff.
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("length(body) > 0", name="ck_explanation_body_not_empty"),
    )
    op.create_index("ix_region_explanations_model", "region_explanations", ["model_id"])


def downgrade() -> None:
    op.drop_index("ix_region_explanations_model", table_name="region_explanations")
    op.drop_table("region_explanations")
