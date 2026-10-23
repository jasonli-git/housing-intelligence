"""The visual stories' sources (2026-10-22): an image service cut, OpenStreetMap, roads.

What is tested is what would be wrong silently: a TIFF read with its tiles in the wrong
places or the box off by a pixel, a raster landed without its georeferencing, the road
files sharing one release key (which stopped the fact load on 2026-10-22), and the
OpenStreetMap places losing a tag on the way to Parquet.
"""

from __future__ import annotations

import hashlib
import json
import struct
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from hip.landing.raster import land_raster, read_raster
from hip.sources.base import Release, ReleaseRef
from hip.sources.imagery import read_tiff
from hip.sources.osm import OsmAdapter
from hip.sources.tiger import NJ_COUNTIES, TigerRoadsAdapter


def _tiff(
    width: int,
    height: int,
    tile: int,
    pixels: bytes,
    scale: float,
    origin: tuple[float, float],
) -> bytes:
    """A little-endian, uncompressed, tiled, 8-bit GeoTIFF of `pixels` (row by row)."""
    across, down = -(-width // tile), -(-height // tile)
    tiles = []
    for ty in range(down):
        for tx in range(across):
            body = bytearray(tile * tile)
            for r in range(tile):
                for c in range(tile):
                    y, x = ty * tile + r, tx * tile + c
                    if y < height and x < width:
                        body[r * tile + c] = pixels[y * width + x]
            tiles.append(bytes(body))
    entries = [
        (256, 3, 1, width),
        (257, 3, 1, height),
        (258, 3, 1, 8),
        (259, 3, 1, 1),
        (277, 3, 1, 1),
        (322, 3, 1, tile),
        (323, 3, 1, tile),
    ]
    count = len(entries) + 4  # tile offsets, tile byte counts, pixel scale, tie point
    ifd = 8
    extra = ifd + 2 + 12 * count + 4
    offsets_at = extra
    counts_at = offsets_at + 4 * len(tiles)
    scale_at = counts_at + 4 * len(tiles)
    tie_at = scale_at + 24
    data_at = tie_at + 48
    tile_offsets = [data_at + i * tile * tile for i in range(len(tiles))]
    out = bytearray(b"II*\x00" + struct.pack("<I", ifd) + struct.pack("<H", count))
    for tag, kind, n, value in entries:
        out += struct.pack("<HHIHH", tag, kind, n, value, 0)
    out += struct.pack("<HHII", 324, 4, len(tiles), offsets_at)
    out += struct.pack("<HHII", 325, 4, len(tiles), counts_at)
    out += struct.pack("<HHII", 33550, 12, 3, scale_at)
    out += struct.pack("<HHII", 33922, 12, 6, tie_at)
    out += struct.pack("<I", 0)
    out += struct.pack(f"<{len(tiles)}I", *tile_offsets)
    out += struct.pack(f"<{len(tiles)}I", *[tile * tile] * len(tiles))
    out += struct.pack("<3d", scale, scale, 0)
    out += struct.pack("<6d", 0, 0, 0, origin[0], origin[1], 0)
    for body in tiles:
        out += body
    return bytes(out)


def test_read_tiff_puts_every_tile_back_in_place() -> None:
    # 5 x 3 pixels in 2 x 2 tiles: the right and bottom tiles hang over the edge.
    pixels = bytes(range(15))
    header, out = read_tiff(_tiff(5, 3, 2, pixels, 0.5, (-75.0, 41.0)))
    assert out == pixels
    assert (header["width"], header["height"]) == (5, 3)
    assert (header["xmin"], header["ymax"], header["xmax"], header["ymin"]) == (
        -75.0,
        41.0,
        -72.5,
        39.5,
    )


def _release(path: Path, source: str, layer: str, vintage: str) -> Release:
    data = path.read_bytes()
    return Release(
        ref=ReleaseRef(
            source_id=source, layer=layer, vintage=vintage, url="https://example.invalid/"
        ),
        path=path,
        sha256=hashlib.sha256(data).hexdigest(),
        size_bytes=len(data),
        fetched_at=datetime.now(UTC),
    )


def test_land_raster_keeps_the_box_and_drops_no_data(tmp_path: Path) -> None:
    raw = tmp_path / "canopy.raster"
    header = {
        "width": 2,
        "height": 2,
        "pixel_type": "U8",
        "xmin": -75.0,
        "ymin": 40.0,
        "xmax": -74.0,
        "ymax": 41.0,
    }
    raw.write_bytes((json.dumps(header) + "\n").encode() + bytes([10, 255, 30, 40]))
    assert read_raster(raw)[1].tolist() == [10, 255, 30, 40]
    table = land_raster(
        _release(raw, "usfs_tcc", "canopy", "2025"), parquet_dir=tmp_path / "parquet"
    )
    assert table.row_count == 3  # 255 is the publisher's no data
    rows = (
        duckdb.connect()
        .execute(
            "SELECT col, row, value, xmin, ymax, dx, dy"
            f" FROM read_parquet('{table.path}') ORDER BY row, col"
        )
        .fetchall()
    )
    assert rows[0] == (0, 0, 10.0, -75.0, 41.0, 0.5, 0.5)
    assert [(r[0], r[1]) for r in rows] == [(0, 0), (0, 1), (1, 1)]


def test_road_files_are_one_release_each() -> None:
    refs = TigerRoadsAdapter().refs()
    assert len(NJ_COUNTIES) == 21
    assert len({(r.source_id, r.layer, r.vintage) for r in refs}) == 21
    assert refs[0].url.endswith("tl_2025_34001_roads.zip")


def test_osm_reads_one_extract() -> None:
    # Landing itself (`ST_ReadOSM`) needs a real extract and is checked in staging,
    # where the counts are compared with the chains' own store counts.
    refs = OsmAdapter().refs()
    assert [(r.layer, r.vintage) for r in refs] == [("places", "current")]
    assert OsmAdapter.filename(refs[0]).endswith(".osm.pbf")


def test_a_downloaded_raster_is_cut_to_new_jersey(tmp_path: Path) -> None:
    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds

    from hip.sources.imagery import BOX, HEIGHT, WIDTH
    from hip.sources.manual_rasters import NoiseAdapter

    # A coarse 50 dB square over New Jersey's north, empty (quieter than BTS models)
    # elsewhere, in a zip as BTS ships it.
    tif = tmp_path / "noise.tif"
    data = np.full((40, 40), -9999, dtype="float32")
    data[:20, :] = 50.0
    with rasterio.open(
        tif,
        "w",
        driver="GTiff",
        width=40,
        height=40,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(*BOX, 40, 40),
        nodata=-9999,
    ) as out:
        out.write(data, 1)
    archive = tmp_path / "CONUS_road_rail_and_aviation_noise_2022_2023.zip"
    with zipfile.ZipFile(archive, "w") as z:
        z.write(tif, "noise/noise.tif")

    adapter = NoiseAdapter()
    header, pixels = adapter.cut(adapter._open_path(archive))
    values = np.frombuffer(pixels, dtype="<f4").reshape(HEIGHT, WIDTH)
    assert (header["width"], header["height"]) == (WIDTH, HEIGHT)
    assert values[0, 0] == 50.0  # the north
    assert values[-1, -1] == 0.0  # empty is kept as quiet, not unknown
