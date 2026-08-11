"""CSV → Parquet. Pure transcoding, like the shapefile lander.

Column names are preserved verbatim, including Zillow's ~318 date columns. Reshaping is
dbt's job at the `stage` stage; keeping landing dumb is what makes it re-runnable from
`data/raw/` when a modelling bug is found, without re-downloading 245MB.
"""

from __future__ import annotations

from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.sources.base import Release


def parquet_path(release: Release, parquet_dir: Path) -> Path:
    ref = release.ref
    name = f"{ref.layer}_{ref.scope}" if ref.scope else ref.layer
    return parquet_dir / ref.source_id / ref.vintage / f"{name}.parquet"


def land_csv(
    release: Release, *, parquet_dir: Path, overwrite: bool = False
) -> LandedTable:
    """Transcode one CSV to Parquet, letting DuckDB infer types over the whole file."""
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if not out.exists() or overwrite:
            # sample_size=-1: Zillow's leading rows are frequently empty for newer
            # geographies, and a sampled inference reads those columns as VARCHAR and
            # then silently drops every value that will not cast.
            con.execute(
                f"""
                COPY (
                    SELECT * FROM read_csv('{release.path}',
                                           header=true, sample_size=-1)
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
