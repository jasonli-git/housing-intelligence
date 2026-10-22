"""A raw image of New Jersey → one Parquet row per pixel (the visual stories).

`hip.sources.imagery` stores each release as a line of JSON (the image's width, height,
pixel type and extent) followed by its raw pixels. This writes the pixels with a value as
`(col, row, value)`, with the extent and pixel size beside them, so staging can place a
point in its pixel with arithmetic and an equality join rather than a raster library:
`col = floor((lon - xmin) / dx)`, `row = floor((ymax - lat) / dy)`.

Pure transcoding, like every lander: nothing is averaged or dropped but the publisher's
own no-data values (255 for canopy, anything below -1,000 metres for elevation).
"""

from __future__ import annotations

import json
import math
import tempfile
from array import array
from pathlib import Path

from hip.duck import duckdb_session
from hip.landing.shapefile import LandedTable
from hip.landing.tabular import needs_landing, parquet_path, record_landed
from hip.sources.base import Release


def read_raster(path: Path) -> tuple[dict[str, object], array]:
    """The header and the pixels of a stored release."""
    with path.open("rb") as handle:
        header = json.loads(handle.readline())
        body = handle.read()
    pixels = array("B" if header["pixel_type"] == "U8" else "f")
    pixels.frombytes(body)
    if len(pixels) != header["width"] * header["height"]:
        raise ValueError(
            f"{path}: {len(pixels):,} pixels for {header['width']}x{header['height']}"
        )
    return header, pixels


def _valid(value: float, pixel_type: str) -> bool:
    if pixel_type == "U8":
        return value != 255
    return not math.isnan(value) and value > -1000


def land_raster(
    release: Release, *, parquet_dir: Path, overwrite: bool = False
) -> LandedTable:
    out = parquet_path(release, parquet_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    with duckdb_session() as con:
        if needs_landing(release, out, overwrite):
            header, pixels = read_raster(release.path)
            width, height = int(header["width"]), int(header["height"])
            dx = (float(header["xmax"]) - float(header["xmin"])) / width
            dy = (float(header["ymax"]) - float(header["ymin"])) / height
            kind = str(header["pixel_type"])
            with tempfile.TemporaryDirectory(prefix="hip-raster-") as tmp:
                csv = Path(tmp) / "pixels.csv"
                with csv.open("w") as handle:
                    handle.write("col,row,value\n")
                    for i, value in enumerate(pixels):
                        if _valid(value, kind):
                            handle.write(f"{i % width},{i // width},{value}\n")
                con.execute(
                    f"""
                    COPY (
                        SELECT col::INTEGER AS col, row::INTEGER AS row,
                               value::DOUBLE AS value,
                               {float(header["xmin"])}::DOUBLE AS xmin,
                               {float(header["ymax"])}::DOUBLE AS ymax,
                               {dx}::DOUBLE AS dx, {dy}::DOUBLE AS dy
                        FROM read_csv('{csv}', header=true)
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
