"""Geography spine: regions, alternate identifiers, and allocation crosswalks.

Also creates the provenance tables (`sources`, `source_releases`) that every later load
writes to, because regions are the first thing loaded and provenance cannot be
retrofitted onto rows that are already in the warehouse (ARCHITECTURE #9).

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

REGION_LEVELS = ("state", "county", "municipality", "zip", "tract", "parcel")


def upgrade() -> None:
    # Created implicitly by the regions table below. Calling .create() here as well
    # would emit CREATE TYPE twice in one transaction and fail on the second.
    region_level = sa.Enum(*REGION_LEVELS, name="region_level")

    op.create_table(
        "sources",
        sa.Column("source_id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("publisher", sa.Text, nullable=False),
        sa.Column("license", sa.Text, nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("cadence", sa.Text, nullable=False),
    )

    op.create_table(
        "source_releases",
        sa.Column("release_id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "source_id",
            sa.Text,
            sa.ForeignKey("sources.source_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("layer", sa.Text, nullable=False),
        sa.Column("vintage", sa.Text, nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("file_sha256", sa.Text, nullable=False),
        sa.Column("row_count", sa.BigInteger, nullable=False),
        # One row per distinct file. A re-fetch of unchanged bytes hits this constraint
        # instead of creating a duplicate release (ARCHITECTURE #10).
        sa.UniqueConstraint(
            "source_id", "layer", "vintage", "file_sha256", name="uq_source_release"
        ),
    )

    op.create_table(
        "regions",
        sa.Column("region_id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("geoid", sa.String(16), nullable=False),
        sa.Column("level", region_level, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("state_code", sa.String(2), nullable=False),
        sa.Column(
            "parent_id", sa.BigInteger, sa.ForeignKey("regions.region_id"), nullable=True
        ),
        sa.Column(
            "geom",
            Geometry("MULTIPOLYGON", srid=4269, spatial_index=False),
            nullable=False,
        ),
        sa.UniqueConstraint("level", "geoid", name="uq_regions_level_geoid"),
        sa.CheckConstraint(
            "(level = 'zip' AND parent_id IS NULL) "
            "OR (level = 'state' AND parent_id IS NULL) "
            "OR (level NOT IN ('zip', 'state') AND parent_id IS NOT NULL)",
            name="ck_regions_parent_by_level",
        ),
    )
    op.create_index("ix_regions_level_state", "regions", ["level", "state_code"])
    op.create_index("ix_regions_parent", "regions", ["parent_id"])
    op.create_index("ix_regions_geom", "regions", ["geom"], postgresql_using="gist")

    op.create_table(
        "region_identifiers",
        sa.Column(
            "region_id",
            sa.BigInteger,
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("scheme", sa.String(32), primary_key=True),
        sa.Column("identifier", sa.String(32), nullable=False),
    )
    op.create_index(
        "ix_region_identifiers_lookup", "region_identifiers", ["scheme", "identifier"]
    )

    op.create_table(
        "region_crosswalk",
        sa.Column(
            "from_region_id",
            sa.BigInteger,
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "to_region_id",
            sa.BigInteger,
            sa.ForeignKey("regions.region_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("weight", sa.Numeric(9, 8), nullable=False),
        sa.Column("method", sa.String(16), nullable=False),
        sa.CheckConstraint(
            "weight > 0 AND weight <= 1", name="ck_crosswalk_weight_range"
        ),
    )
    op.create_index("ix_crosswalk_to", "region_crosswalk", ["to_region_id"])


def downgrade() -> None:
    op.drop_table("region_crosswalk")
    op.drop_table("region_identifiers")
    op.drop_index("ix_regions_geom", table_name="regions")
    op.drop_table("regions")
    op.drop_table("source_releases")
    op.drop_table("sources")
    sa.Enum(name="region_level").drop(op.get_bind(), checkfirst=True)
