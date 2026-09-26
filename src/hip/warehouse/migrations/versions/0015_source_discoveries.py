"""Bring `Discovery` (Milestone 26) into the warehouse, for a public freshness page.

`Discovery` has lived only on the acquiring machine's disk since it was written —
`data/raw/<source>/releases.json`, read back by `hip.sources.registry.build_adapter`
so a later pipeline stage never probes for itself (ARCHITECTURE #197). That was
enough while nothing but the pipeline needed it. Milestone 27's freshness page is read
by the API, which may import `warehouse` and `packets` and nothing else from the
pipeline (`tests/test_module_boundaries.py`, ARCHITECTURE #6) — a raw-file read from
`hip.sources.base` is exactly the pipeline access that boundary exists to forbid, so
the record has to cross into Postgres the same way every other pipeline-produced fact
does: loaded, not read around.

One row per source, upserted at `load` time from whatever `data/raw/*/releases.json`
holds — a history of checks was never the point, only "what does a refresh currently
believe about this source." A source `discover()` does not implement (TIGER, pinned
on purpose) simply has no row, which the freshness page reads as its own status
(`not_tracked`) rather than a row of nulls pretending to know something.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "source_discoveries",
        sa.Column("source_id", sa.Text(), primary_key=True),
        sa.Column("newest", sa.Text(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("published", sa.Text(), nullable=True),
        sa.Column("pending", sa.Text(), nullable=True),
        sa.Column("pending_from", sa.Date(), nullable=True),
        sa.Column("pending_reason", sa.Text(), nullable=True),
        # When this row was last written, separate from `checked_at` — which the
        # publisher's own record concerns — so a load that finds nothing to update
        # (the JSON is unchanged) is still visible as "still true as of this run".
        sa.Column(
            "loaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("source_discoveries")
