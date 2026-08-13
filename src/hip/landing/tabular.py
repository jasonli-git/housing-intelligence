"""CSV → Parquet. Pure transcoding, like the shapefile lander.

Column names are preserved verbatim, including Zillow's ~318 date columns. Reshaping is
dbt's job at the `stage` stage; keeping landing dumb is what makes it re-runnable from
`data/raw/` when a modelling bug is found, without re-downloading 245MB.
"""

from __future__ import annotations

import json
from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.sources.base import Release, SourceAdapter


def parquet_path(release: Release, parquet_dir: Path) -> Path:
    ref = release.ref
    name = f"{ref.layer}_{ref.scope}" if ref.scope else ref.layer
    return parquet_dir / ref.source_id / ref.vintage / f"{name}.parquet"


def land_csv(
    release: Release,
    *,
    parquet_dir: Path,
    overwrite: bool = False,
    csv_options: str = "",
) -> LandedTable:
    """Transcode one CSV to Parquet, letting DuckDB infer types over the whole file."""
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if not out.exists() or overwrite:
            # sample_size=-1: Zillow's leading rows are frequently empty for newer
            # geographies, and a sampled inference reads those columns as VARCHAR and
            # then silently drops every value that will not cast.
            # encoding='latin-1': IRS SOI files carry non-UTF-8 bytes in county names
            # (line 2333 of countyinflow2122.csv), which aborts a UTF-8 read outright.
            # latin-1 decodes every byte, so no row is dropped.
            con.execute(
                f"""
                COPY (
                    SELECT * FROM read_csv('{release.path}',
                                           header=true, sample_size=-1,
                                           encoding='latin-1'{csv_options})
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


def land_ndjson(
    release: Release,
    *,
    parquet_dir: Path,
    overwrite: bool = False,
) -> LandedTable:
    """Transcode newline-delimited JSON to Parquet without going through Python.

    `land_json` parses the whole payload into Python objects, which is fine for the
    hundred-row responses HUD and FRED return and impossible for 3.48M parcels. DuckDB
    streams NDJSON straight to Parquet, so peak memory is a scan buffer rather than the
    file. The adapter has already flattened each line to one object, so there is no
    `to_records` step to run.
    """
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if not out.exists() or overwrite:
            # sample_size=-1 for the same reason as the CSV lander: MOD-IV leaves
            # numeric columns null for long runs of unmatched parcels, and a sampled
            # inference types them as VARCHAR and then drops every value that will
            # not cast.
            con.execute(
                f"""
                COPY (
                    SELECT * FROM read_json_auto('{release.path}',
                                                 format='newline_delimited',
                                                 sample_size=-1)
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


def land_json(
    release: Release,
    adapter: type[SourceAdapter],
    *,
    parquet_dir: Path,
    overwrite: bool = False,
) -> LandedTable:
    """Transcode a JSON API response to Parquet via the adapter's row shape.

    The adapter owns the flattening (`to_records`), because every JSON API nests its
    data differently and that is publisher knowledge. Landing still adds no business
    logic: it writes exactly the rows the adapter reports, with the keys it reports.
    """
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)

    with duckdb_session() as con:
        if not out.exists() or overwrite:
            payload = json.loads(release.path.read_text())
            records = adapter.to_records(payload, release.ref)
            if not records:
                raise ValueError(f"{release.ref.source_id}/{release.ref.key}: no rows")
            # Register the records as a DuckDB relation via a temporary JSON file
            # rather than building a giant INSERT: types are inferred once, and the
            # column set follows the adapter without being declared twice.
            staging = out.with_suffix(".ndjson")
            staging.write_text("\n".join(json.dumps(r) for r in records))
            con.execute(
                f"COPY (SELECT * FROM read_json_auto('{staging}')) "
                f"TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)"
            )
            staging.unlink()
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
