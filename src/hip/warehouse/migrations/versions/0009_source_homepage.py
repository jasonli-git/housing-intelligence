"""Separate the page a reader should visit from the root a fetcher should call.

`sources.url` is the canonical root and is what every analysis packet carries. For a
source ingested over an API that root is the API itself, which is correct provenance and
useless to a person: `https://api.census.gov/data` returns raw JSON, and
`https://api.bls.gov/publicAPI/v2` returns a 404 in a browser. The site-wide attribution
footer added on 2026-09-05 (#71) linked `url` directly, so five of twelve source links
led somewhere broken or machine-facing.

`homepage` is where a reader is sent instead. Nullable, because for most sources the two
are the same page and duplicating it would invite them to drift; consumers resolve
`COALESCE(homepage, url)`.

`url` is deliberately unchanged. It is part of the published packet contract, and
repointing it at a landing page would silently alter the provenance every packet
records.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-05
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sources", sa.Column("homepage", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("sources", "homepage")
