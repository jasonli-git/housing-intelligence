"""Microsoft's building outlines → each building's centre and area (the stories).

The zipped GeoJSON is read in place through GDAL (`/vsizip/`), and only two things are
kept per building: where its centre is, to say which town it stands in, and its area
in square feet, measured on New Jersey's State Plane (EPSG:3424, in feet) rather than on
the degrees it is published in. 2.5M outlines become 2.5M small rows; which buildings
count, and how they are binned, is staging's.
"""

from __future__ import annotations

from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.landing.tabular import needs_landing, parquet_path, record_landed
from hip.sources.base import Release


def land_footprints(
    release: Release, *, parquet_dir: Path, overwrite: bool = False
) -> LandedTable:
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    member = release.path.name.removesuffix(".zip")
    with duckdb_session(spatial=True) as con:
        if needs_landing(release, out, overwrite):
            con.execute(
                f"""
                COPY (
                    SELECT ST_X(ST_Centroid(geom)) AS lon, ST_Y(ST_Centroid(geom)) AS lat,
                           ST_Area(ST_Transform(geom, 'EPSG:4326', 'EPSG:3424',
                                                always_xy := true)) AS sqft
                    FROM ST_Read('/vsizip/{release.path}/{member}')
                ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """
            )
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
