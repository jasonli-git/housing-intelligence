"""An OpenStreetMap extract → the named places in it, as points (the visual stories).

DuckDB's spatial extension reads the `.osm.pbf` itself (`ST_ReadOSM`): one row per node,
way or relation, its tags a map. Not GDAL's OSM driver, which the extension ships
without the configuration file it needs. A shop is mapped either as a node or as its
building's outline, a way; a way is placed at the mean of its nodes, near enough to its
centre to say which town it is in. Relations — a mall drawn as several outlines — are
left out: none of the chains the stories count is mapped that way in New Jersey.

Kept: places with a name and a shop, an amenity or a brand, with the tags the stories
read as columns (name, brand, amenity, shop, cuisine). Which chains count, and in which
town, is staging's.
"""

from __future__ import annotations

from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.landing.tabular import needs_landing, parquet_path, record_landed
from hip.sources.base import Release

_WANTED = (
    "tags['name'] IS NOT NULL AND (tags['brand'] IS NOT NULL"
    " OR tags['amenity'] IS NOT NULL OR tags['shop'] IS NOT NULL)"
)


def land_osm(
    release: Release, *, parquet_dir: Path, overwrite: bool = False
) -> LandedTable:
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            con.execute("INSTALL spatial; LOAD spatial;")
            con.execute(
                f"""
                COPY (
                    WITH osm AS (SELECT * FROM ST_ReadOSM('{release.path}')),
                    ways AS (
                        SELECT id, tags, refs FROM osm WHERE kind = 'way' AND {_WANTED}
                    ),
                    way_points AS (
                        SELECT w.id, avg(n.lon) AS lon, avg(n.lat) AS lat
                        FROM (SELECT id, unnest(refs) AS ref FROM ways) w
                        JOIN osm n ON n.kind = 'node' AND n.id = w.ref
                        GROUP BY w.id
                    ),
                    places AS (
                        SELECT 'node/' || id AS osm_id, tags, lon, lat
                        FROM osm WHERE kind = 'node' AND {_WANTED}
                        UNION ALL
                        SELECT 'way/' || w.id, w.tags, p.lon, p.lat
                        FROM ways w JOIN way_points p USING (id)
                    )
                    SELECT osm_id, tags['name'] AS name, tags['brand'] AS brand,
                           tags['amenity'] AS amenity, tags['shop'] AS shop,
                           tags['cuisine'] AS cuisine, lon, lat
                    FROM places
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
