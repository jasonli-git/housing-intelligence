"""New Jersey cut from a national image service, pixel by pixel (the visual stories).

Two federal rasters the stories read are published as ArcGIS image services: the USDA
Forest Service's tree canopy cover (NLCD TCC) and the USGS 3D Elevation Program. Each
national file runs to gigabytes; the service's `exportImage` cuts a box around New
Jersey at about 100 metres a pixel and returns the raw values (`format=bip`), 5 MB of
canopy and 17 MB of elevation, in one request.

**How it is read.** One `exportImage` request for an uncompressed GeoTIFF, read here
(`read_tiff`) rather than with a raster library the platform does not otherwise need.
The release is one file: the image's size and extent as a line of JSON, then its pixels
row by row from the north-west corner — one file, because the raw cache is
content-addressed per file and the pixels mean nothing without the box they were cut
from. Values are the publisher's: canopy is percent cover, 0 to 100, with 255 for no
data; elevation is metres above sea level.

Staging places each 2020 census block's interior point in a pixel and weighs blocks by
their homes, so a town's figure is the canopy or the height where its people live, not
across its fields and marsh.
"""

from __future__ import annotations

import json
import logging
import struct
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, ClassVar

import httpx

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter, SourceError

logger = logging.getLogger(__name__)

# New Jersey's extent, about 10 km wider each way, in degrees (EPSG:4326).
BOX = (-75.6, 38.9, -73.88, 41.36)
# About 0.001 degrees a pixel: 85 m east-west, 111 m north-south at New Jersey's latitude.
WIDTH, HEIGHT = 1720, 2460


@dataclass(frozen=True)
class ImageLayer:
    url: str
    # "U8" or "F32", the type the service is asked to return.
    pixel_type: str
    interpolation: str


class ImageExportAdapter(SourceAdapter):
    """A source read as one raw image of New Jersey from an ArcGIS image service."""

    landing_format: ClassVar[str] = "raster"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    LAYERS: ClassVar[dict[str, ImageLayer]]

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        vintage = vintage or self.default_vintage
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=name,
                vintage=vintage,
                # The vintage is part of the request (it picks the raster), so it is
                # part of the URL the raw cache compares (#214).
                url=f"{layer.url}/exportImage?bbox={','.join(map(str, BOX))}"
                f"&size={WIDTH},{HEIGHT}&format=bip&pixelType={layer.pixel_type}"
                f"&vintage={vintage}",
            )
            for name, layer in self.LAYERS.items()
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.raster"

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=httpx.Timeout(30.0, read=300.0), headers=self.headers)

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        layer = self.LAYERS[ref.layer]
        params: dict[str, Any] = {
            "bbox": ",".join(map(str, BOX)),
            "bboxSR": "4326",
            "imageSR": "4326",
            "size": f"{WIDTH},{HEIGHT}",
            # An uncompressed TIFF, not `bip`: on 2026-10-22 the service's raw `bip`
            # answer came back 1,935 pixels wide while its JSON said 1,720. A TIFF
            # states its own size and georeferencing.
            "format": "tiff",
            "compression": "None",
            "pixelType": layer.pixel_type,
            "interpolation": layer.interpolation,
            "f": "image",
        }
        rule = self._mosaic_rule(layer, ref.vintage)
        if rule:
            params["mosaicRule"] = rule
        with self._client() as client:
            response = client.get(f"{layer.url}/exportImage", params=params)
            response.raise_for_status()
        if not response.content.startswith((b"II*\x00", b"MM\x00*")):
            raise SourceError(
                f"{ref.source_id}/{ref.layer}: the service did not answer with a TIFF"
            )
        header, pixels = read_tiff(response.content)
        header["pixel_type"] = layer.pixel_type
        with destination.open("wb") as handle:
            handle.write((json.dumps(header) + "\n").encode())
            handle.write(pixels)
        logger.info(
            "%s/%s: %sx%s pixels",
            ref.source_id,
            ref.layer,
            header["width"],
            header["height"],
        )
        self._last_validators = {}

    def _mosaic_rule(self, layer: ImageLayer, vintage: str) -> str | None:
        """The mosaic rule pinning `vintage`'s raster; None for the default mosaic."""
        return None


TCC_URL = (
    "https://imagery.geoplatform.gov/iipp/rest/services/Vegetation"
    "/USFS_EDW_NLCD_TCC_CONUS/ImageServer"
)


class TreeCanopyAdapter(ImageExportAdapter):
    """Percent tree canopy cover, one year, from the Forest Service's NLCD product."""

    source_id: ClassVar[str] = "usfs_tcc"
    # The year the newest raster covers; discovery moves it on, never below.
    default_vintage: ClassVar[str] = "2025"
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)
    LAYERS: ClassVar[dict[str, ImageLayer]] = {
        "canopy": ImageLayer(
            url=TCC_URL, pixel_type="U8", interpolation="RSP_NearestNeighbor"
        )
    }

    def _raster_id(self, year: str) -> int:
        """The catalog item holding `year`'s canopy: the service mosaics every year."""
        with self._client() as client:
            response = client.get(
                f"{TCC_URL}/query",
                params={
                    "where": f"name LIKE '%_{int(year)}0101_%'",
                    "outFields": "objectid,name",
                    "returnGeometry": "false",
                    "f": "json",
                },
            )
            response.raise_for_status()
            features = response.json().get("features") or []
        ids = [
            f["attributes"]["objectid"]
            for f in features
            if f"_{int(year)}0101_" in f["attributes"]["name"]
        ]
        if not ids:
            raise SourceError(f"usfs_tcc: no {year} raster in the service's catalog")
        return int(ids[0])

    def _mosaic_rule(self, layer: ImageLayer, vintage: str) -> str | None:
        return json.dumps(
            {
                "mosaicMethod": "esriMosaicLockRaster",
                "lockRasterIds": [self._raster_id(vintage)],
            }
        )

    def discover(self, today: date) -> Discovery:
        """The newest year the catalog holds, from raster names (`..._YYYY0101_...`)."""
        with self._client() as client:
            response = client.get(
                f"{TCC_URL}/query",
                params={
                    "where": "1=1",
                    "outFields": "name",
                    "returnGeometry": "false",
                    "f": "json",
                },
            )
            response.raise_for_status()
            names = [
                f["attributes"]["name"] for f in response.json().get("features") or []
            ]
        years = sorted(
            {
                n.rsplit("_", 2)[-2][:4]
                for n in names
                if n.count("_") >= 2 and n.rsplit("_", 2)[-2][:4].isdigit()
            }
        )
        newest = max(
            [y for y in years if y >= self.default_vintage] or [self.default_vintage]
        )
        return Discovery(source_id=self.source_id, newest=newest, checked_at=_now())


ELEVATION_URL = (
    "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
)


class ElevationAdapter(ImageExportAdapter):
    """Bare-earth elevation from USGS 3DEP's best available DEM, resampled."""

    source_id: ClassVar[str] = "usgs_3dep"
    # The ground does not move between reads, but 3DEP's sources are improved in place.
    default_vintage: ClassVar[str] = "current"
    revalidate_after: ClassVar[timedelta] = timedelta(days=180)
    LAYERS: ClassVar[dict[str, ImageLayer]] = {
        "elevation": ImageLayer(
            url=ELEVATION_URL, pixel_type="F32", interpolation="RSP_BilinearInterpolation"
        )
    }


def _now():  # pragma: no cover - a seam for tests
    from datetime import UTC, datetime

    return datetime.now(UTC)


def read_tiff(data: bytes) -> tuple[dict[str, Any], bytes]:
    """An uncompressed, single-band GeoTIFF's size, extent and pixels, row by row.

    Enough of TIFF for what `exportImage` sends with `compression=None`: strips or
    tiles, 8-bit or 32-bit samples, georeferenced by a pixel scale and one tie point.
    Anything else is refused rather than misread.
    """
    order = "<" if data[:2] == b"II" else ">"
    (ifd,) = struct.unpack(order + "I", data[4:8])
    (count,) = struct.unpack(order + "H", data[ifd : ifd + 2])
    sizes = {1: 1, 2: 1, 3: 2, 4: 4, 12: 8}
    kinds = {1: "B", 2: "c", 3: "H", 4: "I", 12: "d"}
    tags: dict[int, tuple[Any, ...]] = {}
    for n in range(count):
        entry = data[ifd + 2 + 12 * n : ifd + 14 + 12 * n]
        tag, kind, number = struct.unpack(order + "HHI", entry[:8])
        if kind not in sizes:
            continue
        length = sizes[kind] * number
        if length <= 4:
            raw = entry[8 : 8 + length]
        else:
            (offset,) = struct.unpack(order + "I", entry[8:12])
            raw = data[offset : offset + length]
        tags[tag] = struct.unpack(f"{order}{number}{kinds[kind]}", raw)
    width, height = tags[256][0], tags[257][0]
    bits = tags[258][0]
    if tags.get(259, (1,))[0] != 1 or tags.get(277, (1,))[0] != 1 or bits not in (8, 32):
        raise SourceError("exportImage sent a compressed or multi-band TIFF")
    size = bits // 8
    out = bytearray(width * height * size)
    if 322 in tags:  # tiled
        tile_w, tile_h = tags[322][0], tags[323][0]
        across = -(-width // tile_w)
        for t, offset in enumerate(tags[324]):
            ty, tx = divmod(t, across)
            for r in range(tile_h):
                y = ty * tile_h + r
                if y >= height:
                    break
                run = min(tile_w, width - tx * tile_w) * size
                start = offset + r * tile_w * size
                dest = (y * width + tx * tile_w) * size
                out[dest : dest + run] = data[start : start + run]
    else:  # strips, rows in order
        position = 0
        for offset, length in zip(tags[273], tags[279], strict=True):
            out[position : position + length] = data[offset : offset + length]
            position += length
    scale, tie = tags[33550], tags[33922]
    header = {
        "width": width,
        "height": height,
        "xmin": tie[3] - tie[0] * scale[0],
        "ymax": tie[4] + tie[1] * scale[1],
        "xmax": tie[3] - tie[0] * scale[0] + width * scale[0],
        "ymin": tie[4] + tie[1] * scale[1] - height * scale[1],
    }
    if order == ">" and size == 4:
        # The lander reads native little-endian floats; swap a big-endian file's.
        words = struct.unpack(f">{width * height}f", out)
        out = bytearray(struct.pack(f"<{width * height}f", *words))
    return header, bytes(out)
