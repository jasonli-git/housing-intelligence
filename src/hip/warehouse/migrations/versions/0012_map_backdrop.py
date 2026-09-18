"""Context geometry for the map: every state's outline, with no data attached.

Milestone 16 draws New Jersey on a navigable map of the whole country, so the other 49
states have to be on screen. They are not regions. A region in this warehouse has
observations, a parent chain, identifiers other sources key on, and a place in the
denominators the site quotes — "21 of New Jersey's 21 counties". Ohio has none of that,
and putting its outline in `regions` would put it in `/regions`, in search, and in those
counts, in exchange for one thing the map needs: a shape.

So the shapes live apart, in a table that says what it is. `map_backdrop` is drawn and
never measured; nothing joins to it and nothing counts it.

The geometry is already on disk. TIGER publishes its `state` layer nationally, so
Milestone 1 downloaded all 56 states and territories to reach New Jersey's one, and
`data/parquet/census_tiger/2025/state.parquet` has held them since. No new source, no new
licence, and the site footer already names the Census Bureau.

Simplified on load rather than here: the backdrop is drawn at continental zoom, where a
0.02-degree tolerance (about 2km) is finer than one screen pixel, and carrying survey
detail into the browser would cost 449KB to draw 145KB worth of coastline.

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Matches `regions.geom`: TIGER ships NAD83, and storing in the source CRS avoids a
# lossy reprojection on load (models.GEOM_SRID).
SRID = 4269


def upgrade() -> None:
    op.create_table(
        "map_backdrop",
        # `level` is plain text, not `region_level`: these are not regions, and reusing
        # that enum would invite a join that must never be written.
        sa.Column("level", sa.Text(), nullable=False),
        # The publisher's own code — a two-letter USPS abbreviation for a state. Not
        # `geoid`, for the same reason: a geoid is a join key, and this joins to nothing.
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("geom", Geometry("MULTIPOLYGON", srid=SRID), nullable=False),
        sa.PrimaryKeyConstraint("level", "code", name="pk_map_backdrop"),
    )
    op.execute(
        "COMMENT ON TABLE map_backdrop IS "
        "'Outlines drawn as context on the map. Carries no observations and joins to "
        "nothing; see migration 0012.'"
    )


def downgrade() -> None:
    op.drop_table("map_backdrop")
