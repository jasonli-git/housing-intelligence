"""A GTFS zip → the five tables a scheduled travel time needs (the visual stories).

`stops`, `routes`, `trips`, `stop_times` and `calendar_dates` (NJ Transit dates its
service by exception list rather than a weekly calendar), each read as text from the zip
and written as `<layer>_<table>.parquet` beside the others. All columns stay VARCHAR: a
stop id with leading zeros, or a time past 24:00 for a trip running after midnight, is
exactly what type inference gets wrong.
"""

from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.landing.tabular import needs_landing, parquet_path, record_landed
from hip.sources.base import Release

TABLES = ("stops", "routes", "trips", "stop_times", "calendar_dates")


def land_gtfs(
    release: Release, *, parquet_dir: Path, overwrite: bool = False
) -> LandedTable:
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            with (
                tempfile.TemporaryDirectory(prefix="hip-gtfs-") as tmp,
                zipfile.ZipFile(release.path) as archive,
            ):
                names = {Path(n).name: n for n in archive.namelist()}
                for table in TABLES:
                    member = names.get(f"{table}.txt")
                    if member is None:
                        raise ValueError(f"{release.ref.key}: no {table}.txt in the feed")
                    extracted = archive.extract(member, tmp)
                    target = out.with_name(f"{release.ref.layer}_{table}.parquet")
                    con.execute(
                        f"COPY (SELECT * FROM read_csv('{extracted}', header=true, "
                        f"all_varchar=true)) TO '{target}' (FORMAT PARQUET)"
                    )
            # The layer's own file, which the skip test and the row count read: its
            # stop times, the feed's largest table.
            times = out.with_name(f"{release.ref.layer}_stop_times.parquet")
            con.execute(f"COPY (SELECT * FROM '{times}') TO '{out}' (FORMAT PARQUET)")
            record_landed(release, out)
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
