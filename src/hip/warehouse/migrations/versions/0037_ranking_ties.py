"""Each ranking records how many regions share its rank (2026-10-19).

`rank()` gives every tied region the same rank, so 152 of New Jersey's 392 municipalities
with no homes in the tidal flood area are all "1st". A region at the end of its cohort
stood out by rank alone, and every one of the 152 did. `ties` lets the stand-out rule ask
whether the whole tied group sits at that end, not only its first place. Filled by
`hip analyze`; rows written before it are NULL until the next run, and a NULL is read as
untied.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: str | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("region_rankings", sa.Column("ties", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("region_rankings", "ties")
