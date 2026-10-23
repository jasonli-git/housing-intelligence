"""Every building's outline in New Jersey, from Microsoft's footprints (the stories).

Microsoft traced building outlines from aerial imagery with a neural network and
published them by state: New Jersey's 2,550,308 as one zipped GeoJSON of 682 MiB.
Landing keeps each building's centre and its area in square feet, not the outline
(`hip.landing.footprints`), and the story reads the size of the buildings standing on
homes' land. An outline is the roof seen from above, so a porch or a garage joined to
the house is part of it, and two attached houses may be one shape.

Licence: ODbL 1.0, as OpenStreetMap is (`hip.sources.osm`), so the per-town figures
derived from it carry the same notice and are offered under the same licence.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

URL = (
    "https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/"
    "NewJersey.geojson.zip"
)


class FootprintsAdapter(SourceAdapter):
    source_id: ClassVar[str] = "msft_buildings"
    # The 2018 release, revised in place once (v2); a story needs no newer one.
    default_vintage: ClassVar[str] = "v2"
    landing_format: ClassVar[str] = "footprints"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="buildings",
                vintage=vintage or self.default_vintage,
                url=URL,
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "NewJersey.geojson.zip"
