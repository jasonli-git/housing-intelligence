"""Two national rasters downloaded by hand, cut to New Jersey (the visual stories).

BTS's National Transportation Noise Map and the Earth Observation Group's annual VIIRS
night lights are each published as one national or global raster, gigabytes in size,
behind a site that refuses scripts (bts.gov) or a login (eogdata.mines.edu). The owner
downloads each into `data/manual/<source_id>/` (the manual-source path, ARCHITECTURE
#272), and acquisition cuts it to the same box and grid `hip.sources.imagery` uses, so
the raw cache keeps megabytes rather than the download and landing reads it as it reads
the canopy (`hip.landing.raster`).

GDAL does the reading, through rasterio, in the `rasters` dependency group: the noise
map ships as a zipped mosaic, the night lights as a gzipped GeoTIFF, and both are read
in place (`/vsizip/`, `/vsigzip/`) without unpacking. The import is deferred so nothing
but these two adapters needs it.
"""

from __future__ import annotations

import json
import logging
import zipfile
from datetime import timedelta
from pathlib import Path
from typing import Any, ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError
from hip.sources.imagery import BOX, HEIGHT, WIDTH

logger = logging.getLogger(__name__)


class ManualRasterAdapter(SourceAdapter):
    """A hand-downloaded raster, cut to New Jersey on the imagery grid at acquisition."""

    manual: ClassVar[bool] = True
    landing_format: ClassVar[str] = "raster"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)
    LAYER: ClassVar[str]
    # Which downloaded file is this source's, by name; the publisher's names carry
    # dates and processing codes, so the adapter matches rather than spells them.
    PATTERN: ClassVar[str]
    # How pixels are combined onto the coarser grid, by rasterio's name.
    RESAMPLING: ClassVar[str]
    # What a pixel the publisher left empty means here (None: no data).
    EMPTY_AS: ClassVar[float | None] = None

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=self.LAYER,
                vintage=vintage or self.default_vintage,
                url=self.manual_from or "",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.raster"

    def manual_path(self, ref: ReleaseRef, raw_dir: Path) -> Path:
        folder = raw_dir.parent / "manual" / ref.source_id
        found = sorted(folder.glob(self.PATTERN)) if folder.exists() else []
        # The newest by name if several are handed in: the names sort by date.
        return found[-1] if found else folder / self.PATTERN.replace("*", "")

    def _open_path(self, dropped: Path) -> str:
        """The GDAL path to read: the file itself, or the raster inside its archive."""
        if dropped.suffix == ".gz":
            return f"/vsigzip/{dropped}"
        if dropped.suffix == ".zip":
            with zipfile.ZipFile(dropped) as archive:
                names = archive.namelist()
            tifs = [n for n in names if n.lower().endswith((".tif", ".tiff"))]
            if tifs:
                # The largest is the raster; the others are overviews or masks.
                with zipfile.ZipFile(dropped) as archive:
                    biggest = max(tifs, key=lambda n: archive.getinfo(n).file_size)
                return f"/vsizip/{dropped}/{biggest}"
            gdbs = sorted({n.split(".gdb/")[0] + ".gdb" for n in names if ".gdb/" in n})
            if gdbs:
                return f"/vsizip/{dropped}/{gdbs[0]}"
            raise SourceError(f"{dropped.name}: no GeoTIFF or geodatabase inside")
        return str(dropped)

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        # `fetch` found the download and set its folder. What is stored is the cut, so
        # the download's hash never matches the cache's and every acquisition cuts it
        # again: a minute's work a year, against keeping gigabytes in the raw tier.
        if self._manual_dir is None:
            raise SourceError(f"{ref.source_id}: no downloaded file was found")
        found = sorted(self._manual_dir.glob(self.PATTERN))
        if not found:
            raise SourceError(f"{ref.source_id}: nothing matching {self.PATTERN}")
        header, pixels = self.cut(self._open_path(found[-1]))
        with destination.open("wb") as handle:
            handle.write((json.dumps(header) + "\n").encode())
            handle.write(pixels)
        self._last_validators = {}

    def cut(self, path: str) -> tuple[dict[str, Any], bytes]:
        """The raster at `path` on New Jersey's grid: header and float32 pixels."""
        try:
            import numpy as np
            import rasterio
            from rasterio.enums import Resampling
            from rasterio.transform import from_bounds
            from rasterio.warp import reproject
        except ImportError as exc:  # pragma: no cover - depends on install profile
            raise SourceError(
                f"{self.source_id}: rasterio is not installed; it is in the 'rasters' "
                "dependency group (`uv sync`)."
            ) from exc
        xmin, ymin, xmax, ymax = BOX
        grid = from_bounds(xmin, ymin, xmax, ymax, WIDTH, HEIGHT)
        out = np.full((HEIGHT, WIDTH), np.nan, dtype="float32")
        with rasterio.open(path) as source:
            nodata = source.nodata
            reproject(
                source=rasterio.band(source, 1),
                destination=out,
                src_nodata=nodata,
                dst_transform=grid,
                dst_crs="EPSG:4326",
                dst_nodata=np.nan,
                resampling=getattr(Resampling, self.RESAMPLING),
            )
        if self.EMPTY_AS is not None:
            out[np.isnan(out)] = self.EMPTY_AS
        logger.info("%s: cut to %sx%s", self.source_id, WIDTH, HEIGHT)
        header = {
            "width": WIDTH,
            "height": HEIGHT,
            "pixel_type": "F32",
            "xmin": xmin,
            "ymin": ymin,
            "xmax": xmax,
            "ymax": ymax,
        }
        return header, out.astype("<f4").tobytes()


NOISE_PAGE = "https://www.bts.gov/geospatial/national-transportation-noise-map"


class NoiseAdapter(ManualRasterAdapter):
    """Road, rail and aviation noise, 2020: the modelled 24-hour level, LAeq, in dB(A)."""

    source_id: ClassVar[str] = "bts_noise"
    default_vintage: ClassVar[str] = "2020"
    manual_from: ClassVar[str] = NOISE_PAGE
    LAYER: ClassVar[str] = "noise"
    PATTERN: ClassVar[str] = "CONUS_rail_road_and_aviation_noise_2020*.zip"
    # Several 30 m cells to one ~100 m pixel: the loudest stands, as an ear would hear.
    RESAMPLING: ClassVar[str] = "max"
    # BTS models nothing quieter than 45 dB; an empty cell is quieter than that, not
    # unknown, and is kept as 0 so a quiet block counts as quiet.
    EMPTY_AS: ClassVar[float | None] = 0.0


LIGHTS_PAGE = "https://eogdata.mines.edu/nighttime_light/annual/v22/"


class NightLightsAdapter(ManualRasterAdapter):
    """Average night-time radiance for a year, VIIRS, masked for background and fire."""

    source_id: ClassVar[str] = "eog_vnl"
    default_vintage: ClassVar[str] = "2024"
    manual_from: ClassVar[str] = LIGHTS_PAGE
    LAYER: ClassVar[str] = "lights"
    PATTERN: ClassVar[str] = "VNL_*average_masked*.tif*"
    # One ~460 m pixel spread over the finer grid: the nearest is the honest value.
    RESAMPLING: ClassVar[str] = "nearest"
