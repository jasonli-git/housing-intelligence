"""Shapefile → Parquet. Pure transcoding, no business logic.

Landing deliberately makes no decisions: it reads what the publisher shipped and writes
it as Parquet with the attribute names untouched. That is what makes the stage
re-runnable from ``data/raw/`` without network access when a downstream bug is found —
if landing filtered or renamed, a filtering bug would mean re-downloading 529MB.

The one transformation is geometry: TIGER mixes POLYGON and MULTIPOLYGON in the same
layer, so everything goes through ``ST_Multi`` to give the warehouse column a single
uniform type. Geometry is stored as WKB because Parquet has no native geometry type.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from hip.duck import duckdb_session, vsizip
from hip.sources.base import Release

# TIGER ships NAD83. Recorded here rather than assumed downstream.
SRID = 4269


@dataclass(frozen=True)
class LandedTable:
    """One Parquet file produced from one release."""

    source_id: str
    layer: str
    vintage: str
    scope: str | None
    path: Path
    row_count: int


def parquet_path(release: Release, parquet_dir: Path) -> Path:
    ref = release.ref
    name = f"{ref.layer}_{ref.scope}" if ref.scope else ref.layer
    return parquet_dir / ref.source_id / ref.vintage / f"{name}.parquet"


def land_shapefile(
    release: Release, member: str, *, parquet_dir: Path, overwrite: bool = False
) -> LandedTable:
    """Transcode one zipped shapefile to Parquet, reading it in place inside the zip."""
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session(spatial=True) as con:
        if out.exists() and not overwrite:
            row_count = con.execute(
                "SELECT count(*) FROM read_parquet(?)", [str(out)]
            ).fetchone()
            return LandedTable(
                source_id=release.ref.source_id,
                layer=release.ref.layer,
                vintage=release.ref.vintage,
                scope=release.ref.scope,
                path=out,
                row_count=int(row_count[0]) if row_count else 0,
            )

        source = vsizip(release.path, member)
        con.execute(
            f"""
            COPY (
                SELECT * EXCLUDE (geom),
                       ST_AsWKB(ST_Multi(geom)) AS geom_wkb
                FROM ST_Read('{source}')
            ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
            """
        )
        result = con.execute(
            "SELECT count(*) FROM read_parquet(?)", [str(out)]
        ).fetchone()

    return LandedTable(
        source_id=release.ref.source_id,
        layer=release.ref.layer,
        vintage=release.ref.vintage,
        scope=release.ref.scope,
        path=out,
        row_count=int(result[0]) if result else 0,
    )
