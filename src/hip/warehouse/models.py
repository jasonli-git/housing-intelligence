"""Declarative models for the curated warehouse.

These mirror the schema section of ARCHITECTURE.md. The migration is authoritative for
DDL; these exist so the API can query with types rather than strings, and so Alembic
autogenerate has something to diff against.
"""

from __future__ import annotations

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

REGION_LEVELS = ("state", "county", "municipality", "zip", "tract", "parcel")

# TIGER ships NAD83. Storing in the source CRS avoids a lossy reprojection on load;
# equal-area work reprojects at query time instead.
GEOM_SRID = 4269

region_level_enum = Enum(*REGION_LEVELS, name="region_level")


class Base(DeclarativeBase):
    pass


class Region(Base):
    """One geography at one level. All levels share this table (ARCHITECTURE #7)."""

    __tablename__ = "regions"

    region_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    geoid: Mapped[str] = mapped_column(String(16), nullable=False)
    level: Mapped[str] = mapped_column(region_level_enum, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    state_code: Mapped[str] = mapped_column(String(2), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("regions.region_id"), nullable=True
    )
    geom: Mapped[object] = mapped_column(
        Geometry("MULTIPOLYGON", srid=GEOM_SRID), nullable=False
    )

    parent: Mapped[Region | None] = relationship(remote_side=[region_id])

    __table_args__ = (
        UniqueConstraint("level", "geoid", name="uq_regions_level_geoid"),
        Index("ix_regions_level_state", "level", "state_code"),
        Index("ix_regions_parent", "parent_id"),
        # ZIPs nest in nothing, so they must not claim a parent; every other level
        # except state must have one. Encoding it here stops a loader bug from
        # silently producing an orphaned tract.
        CheckConstraint(
            "(level = 'zip' AND parent_id IS NULL) "
            "OR (level = 'state' AND parent_id IS NULL) "
            "OR (level NOT IN ('zip', 'state') AND parent_id IS NOT NULL)",
            name="ck_regions_parent_by_level",
        ),
    )


class RegionIdentifier(Base):
    """Alternate identifiers for a region, one row per scheme.

    Census MCD FIPS is `regions.geoid` at the municipality level; NJ's own municipal
    code lives here so MOD-IV can join without a second geography table. Empty until
    Milestone 7 supplies the NJ codes.
    """

    __tablename__ = "region_identifiers"

    region_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("regions.region_id", ondelete="CASCADE"), primary_key=True
    )
    scheme: Mapped[str] = mapped_column(String(32), primary_key=True)
    identifier: Mapped[str] = mapped_column(String(32), nullable=False)

    __table_args__ = (Index("ix_region_identifiers_lookup", "scheme", "identifier"),)


class RegionCrosswalk(Base):
    """Allocation weights between geographies that do not nest (ZIP → anything)."""

    __tablename__ = "region_crosswalk"

    from_region_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("regions.region_id", ondelete="CASCADE"), primary_key=True
    )
    to_region_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("regions.region_id", ondelete="CASCADE"), primary_key=True
    )
    weight: Mapped[float] = mapped_column(Numeric(9, 8), nullable=False)
    method: Mapped[str] = mapped_column(String(16), nullable=False)

    __table_args__ = (
        CheckConstraint("weight > 0 AND weight <= 1", name="ck_crosswalk_weight_range"),
        Index("ix_crosswalk_to", "to_region_id"),
    )
