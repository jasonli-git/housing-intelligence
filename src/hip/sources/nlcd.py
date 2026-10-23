"""How much of the ground is paved, from the National Land Cover Database (stories).

NLCD's impervious surface layer gives, for every 30 m cell of the lower 48 states, the
percentage covered by roofs, roads, parking and other surfaces water cannot soak into.
MRLC serves it through a public Web Coverage Service, so acquisition asks for New
Jersey's box alone and averages it onto the imagery grid (`hip.sources.imagery`), as
the hand-downloaded rasters are (`hip.sources.manual_rasters`): one raster the landing
stage reads like the canopy. 2021 is the newest year MRLC serves this way. Public
domain (U.S. Government work).
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import ClassVar

import httpx

from hip.sources.base import ReleaseRef, SourceError
from hip.sources.imagery import BOX
from hip.sources.manual_rasters import ManualRasterAdapter

WCS = "https://www.mrlc.gov/geoserver/mrlc_download/wcs"


class ImperviousAdapter(ManualRasterAdapter):
    source_id: ClassVar[str] = "mrlc_nlcd"
    default_vintage: ClassVar[str] = "2021"
    manual: ClassVar[bool] = False
    LAYER: ClassVar[str] = "impervious"
    PATTERN: ClassVar[str] = "impervious.tif"
    # A coarse cell is the average share of its 30 m cells.
    RESAMPLING: ClassVar[str] = "average"
    # The service tags 0 as no data, but 0% paved is a real reading. NLCD's own code
    # for a cell outside the survey (open water beyond the coast) is 127, which an
    # average would otherwise blend into a shore town's share (2026-10-23).
    SOURCE_NODATA: ClassVar[float | None] = 127

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.default_vintage
        xmin, ymin, xmax, ymax = BOX
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=self.LAYER,
                vintage=year,
                url=(
                    f"{WCS}?service=WCS&version=2.0.1&request=GetCoverage"
                    f"&coverageId=mrlc_download__NLCD_{year}_Impervious_L48"
                    f"&subset=Long({xmin},{xmax})&subset=Lat({ymin},{ymax})"
                    "&subsettingCrs=http://www.opengis.net/def/crs/EPSG/0/4326"
                    "&format=image/geotiff"
                ),
            )
        ]

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        with tempfile.TemporaryDirectory(prefix="hip-nlcd-") as tmp:
            tif = Path(tmp) / "impervious.tif"
            with httpx.stream(
                "GET", ref.url, headers=self.headers, timeout=600, follow_redirects=True
            ) as response:
                response.raise_for_status()
                if "tiff" not in response.headers.get("content-type", ""):
                    raise SourceError(f"{ref.source_id}: the service did not send a TIFF")
                with tif.open("wb") as out:
                    for chunk in response.iter_bytes(1 << 20):
                        out.write(chunk)
            header, pixels = self.cut(str(tif))
        with destination.open("wb") as handle:
            handle.write((json.dumps(header) + "\n").encode())
            handle.write(pixels)
        self._last_validators = {}
