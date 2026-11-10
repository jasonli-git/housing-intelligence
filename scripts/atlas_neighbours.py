"""Write web/lib/nj-neighbours.json: the land around New Jersey, for the atlas's backdrop.

The atlas draws New Jersey's towns on water, with the neighbouring land faint beside them
(owner, 2026-11-09). TIGER's state and county outlines run out into the bays and the
harbour, so the land is the union of the ZIP Code Tabulation Areas near New Jersey, which
follow the shore. Built once from the landed TIGER Parquet; nothing is downloaded.

    .venv/bin/python scripts/atlas_neighbours.py
"""

import json
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/parquet/census_tiger/2025/zcta.parquet"
TARGET = ROOT / "web/lib/nj-neighbours.json"
# Far enough round New Jersey to fill any frame the atlas fits it in.
BOX = (-79.0, 37.4, -70.0, 43.2)
SIMPLIFY = 0.0015  # degrees, about 150m: finer than a pixel at the state's whole view
UNIT = 0.0001  # the map's packed precision (lib/mapdata.ts PRECISION)

con = duckdb.connect()
con.execute("INSTALL spatial; LOAD spatial")
rows = con.execute(
    """
    WITH near AS (
      SELECT ST_GeomFromWKB(geom_wkb) AS g FROM read_parquet(?)
      WHERE ST_Intersects(ST_GeomFromWKB(geom_wkb), ST_MakeEnvelope(?, ?, ?, ?))
    )
    SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Intersection(
      ST_Union_Agg(ST_Buffer(g, 0.0004)), ST_MakeEnvelope(?, ?, ?, ?)), ?))
    FROM near
    """,
    [str(SOURCE), *BOX, *BOX, SIMPLIFY],
).fetchone()
geometry = json.loads(rows[0])
polygons = geometry["coordinates"]
if geometry["type"] != "MultiPolygon":
    polygons = [polygons]


def pack(ring):
    out, px, py = [], 0, 0
    for i, (x, y) in enumerate(ring):
        qx, qy = round(x / UNIT), round(y / UNIT)
        out += [qx, qy] if i == 0 else [qx - px, qy - py]
        px, py = qx, qy
    return out


# Holes are dropped: inside the land they are lakes and gaps between ZIP areas, too small
# to read as water here. Specks under a few hundred metres across are dropped too.
outlines = [
    {"id": i, "name": "land", "rings": [pack(poly[0])]}
    for i, poly in enumerate(polygons)
    if len(poly[0]) > 8
]
TARGET.write_text(json.dumps({"outlines": outlines}, separators=(",", ":")))
print(f"{len(outlines)} outlines, {TARGET.stat().st_size // 1024}KB")
