"""Declarative models for the curated warehouse.

These mirror the schema section of ARCHITECTURE.md. The migration is authoritative for
DDL; these exist so the API can query with types rather than strings, and so Alembic
autogenerate has something to diff against.
"""

from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
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


class RegionExplanation(Base):
    """A local model's prose about one region, precomputed and attributed.

    The only place generated text enters the warehouse, and it enters as a leaf: nothing
    reads this to compute anything. `hip explain` writes it, `/regions/{id}/explanation`
    serves it, and the dashboard labels it as interpretation (migration 0007).

    `packet_sha256` is what makes staleness detectable rather than invisible — the text
    is pinned to the packet bytes it was written from, so a later pipeline run leaves a
    mismatch the API can report instead of quietly serving prose about old numbers.
    """

    __tablename__ = "region_explanations"

    region_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("regions.region_id", ondelete="CASCADE"), primary_key=True
    )
    window: Mapped[str] = mapped_column(String(16), primary_key=True)
    model_id: Mapped[str] = mapped_column(String(64), nullable=False)
    model_label: Mapped[str] = mapped_column(Text, nullable=False)
    runtime: Mapped[str] = mapped_column(String(16), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    packet_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("length(body) > 0", name="ck_explanation_body_not_empty"),
        Index("ix_region_explanations_model", "model_id"),
    )


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
