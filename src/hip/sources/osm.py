"""Shops, cafés and diners from OpenStreetMap (the visual stories).

Geofabrik republishes OpenStreetMap cut to each U.S. state, daily, as one `.osm.pbf`
file: New Jersey's was 164 MB on 2026-10-22. The stories count a few named chains and
one kind of restaurant per town — Wawa and QuickChek, Starbucks and Dunkin', Trader
Joe's and Whole Foods, and diners — so landing keeps only places that have a name and
a shop, an amenity or a brand, as points (`hip.landing.osm`).

**Licence.** OpenStreetMap is © its contributors under the Open Database License. Its
attribution must be shown, and a database derived from it and made public — the
per-town counts this platform publishes are one — must be offered under the ODbL too.
The owner accepted that for these counts on 2026-10-22; the notice every page and
download carries says both (`config/sources.yml`).

Volunteer-mapped: a chain's every branch is usually there, but a diner nobody tagged as
one is not, so counts are a floor, and the pages say so.
"""

from __future__ import annotations

from datetime import timedelta
from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

PBF_URL = "https://download.geofabrik.de/north-america/us/new-jersey-latest.osm.pbf"


class OsmAdapter(SourceAdapter):
    source_id: ClassVar[str] = "osm_nj"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "osm"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    # Rebuilt daily; the stories need nothing fresher than a month.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="places",
                vintage=vintage or self.default_vintage,
                url=PBF_URL,
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "new-jersey-latest.osm.pbf"
