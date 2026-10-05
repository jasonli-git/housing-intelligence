"""Entity-keyed infrastructure inventories, never address-level diagnoses."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "infrastructure_records",
        sa.Column("source_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("record_id", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("snapshot", sa.Date()),
        sa.Column(
            "release_id",
            sa.Integer(),
            sa.ForeignKey("source_releases.release_id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("source_id", "kind", "entity_id", "record_id"),
    )
    op.create_index("ix_infrastructure_entity", "infrastructure_records", ["entity_id"])


def downgrade() -> None:
    op.drop_table("infrastructure_records")
