"""Carry the legal-status name so a place can be told apart from its namesake.

`regions.name` holds TIGER's `NAME`, which is the bare label: "Washington", "Andover",
"Boonton". That is what a reader wants to see, and it is not enough to identify a place.
New Jersey alone has 30 municipality names used more than once — six Washingtons, five
Franklins, three Greenwiches. `parent_id` resolves most of them, because a municipality
belongs to exactly one county, but not all:

    3403701330  Andover     Sussex      -> Andover borough
    3403701360  Andover     Sussex      -> Andover township
    3402706610  Boonton     Morris      -> Boonton town
    3402706640  Boonton     Morris      -> Boonton township
    3400506670  Bordentown  Burlington  -> Bordentown city
    3400506700  Bordentown  Burlington  -> Bordentown township
    3404177270  Washington  Warren      -> Washington borough
    3404177300  Washington  Warren      -> Washington township

Four pairs share a name *and* a county, so name plus county cannot separate them and a
search would return two identical rows distinguishable only by GEOID. TIGER's `NAMELSAD`
separates all four, and county separates the rest.

Stored rather than derived, because the legal status is not recoverable from anything
else the warehouse holds — it is a property of the place that only the source knows.
`name` is unchanged: it stays the label to display, while `name_lsad` is the label to
disambiguate with.

NOT NULL with a fallback to `name`, so a consumer never branches on absence. TIGER
publishes no `NAMELSAD` for states and no name columns at all for ZCTAs, and in both
cases the bare name already *is* the full name — the fallback is the correct value, not
a placeholder. Tracts were already loading `NAMELSAD` into `name` ("Census Tract 1.01"),
so for them the two columns agree.

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-05
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Added nullable, backfilled from `name`, then constrained: an existing warehouse
    # has rows, and a NOT NULL column with no default would fail against them. The next
    # `hip geocode && hip load` replaces the backfill with the real NAMELSAD.
    op.add_column("regions", sa.Column("name_lsad", sa.Text(), nullable=True))
    op.execute("UPDATE regions SET name_lsad = name WHERE name_lsad IS NULL")
    op.alter_column("regions", "name_lsad", nullable=False)

    # Search filters by level and matches on the disambiguating name; without this the
    # municipality lookup behind Milestone 17 is a sequential scan of every region.
    op.create_index("ix_regions_level_name_lsad", "regions", ["level", "name_lsad"])


def downgrade() -> None:
    op.drop_index("ix_regions_level_name_lsad", table_name="regions")
    op.drop_column("regions", "name_lsad")
