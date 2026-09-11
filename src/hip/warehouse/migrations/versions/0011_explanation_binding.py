"""Store each explanation's citation binding, and the content hash staleness uses.

Milestone 13 binds every figure in generated prose to the packet field, source release,
period and match method that licensed it, and `hip explain` refuses prose with a figure
the packet does not carry. The binding is stored with the row, so the API can serve it
and the dashboard can show where each figure came from without re-deriving anything.

`content_sha256` is the hash of what the packet said, leaving out where it said it from
(`hip.packets.packet_content_hash`). `packet_sha256` changes whenever a source is
downloaded again and returns different bytes, even if no figure moved; deciding
staleness on it would have a monthly refresh paying a model to rewrite prose that is
still accurate. Staleness is now decided on the content hash, and a change that moves
only `packet_sha256` is repaired by re-binding the stored prose.

Both nullable, and existing rows keep null: their figures were never checked, and
filling a binding in here would mean binding against today's packet, which is not the
one they were written from. `hip explain` binds a row whose packet has not changed at
all — the only case where that is exact — and regenerates the rest.

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "region_explanations",
        sa.Column("content_sha256", sa.String(64), nullable=True),
    )
    op.add_column(
        "region_explanations",
        sa.Column("binding", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("region_explanations", "binding")
    op.drop_column("region_explanations", "content_sha256")
