"""Census TIGER/Line boundary files — the geometry behind every region.

TIGER is the geometry source (ARCHITECTURE #22) because its GEOIDs are the same
identifiers ACS, Building Permits, and the Zillow crosswalks key on, so the largest
sources need no geographic reconciliation at all. The cost is generalized boundaries:
TIGER is a statistical product, not a survey-grade cadastre.

Layer scope is not our choice. Census publishes `state`, `county`, and `zcta520`
nationally and `cousub`/`tract` per state, so a single-state load still downloads three
national files — including the 529MB ZCTA file, which has had no state partition since
2020.
"""

from __future__ import annotations

from typing import ClassVar, Literal

from hip.config import fips_for
from hip.sources.base import ReleaseRef, SourceAdapter

LayerScope = Literal["national", "state"]

BASE_URL = "https://www2.census.gov/geo/tiger"


class TigerAdapter(SourceAdapter):
    """Fetches the five TIGER layers that make up the geography spine."""

    source_id: ClassVar[str] = "census_tiger"
    default_vintage: ClassVar[str] = "2025"

    # layer -> (TIGER directory, filename stem template, scope)
    LAYERS: ClassVar[dict[str, tuple[str, str, LayerScope]]] = {
        "state": ("STATE", "tl_{vintage}_us_state", "national"),
        "county": ("COUNTY", "tl_{vintage}_us_county", "national"),
        "cousub": ("COUSUB", "tl_{vintage}_{fips}_cousub", "state"),
        "tract": ("TRACT", "tl_{vintage}_{fips}_tract", "state"),
        "zcta": ("ZCTA520", "tl_{vintage}_us_zcta520", "national"),
    }

    def __init__(self, states: list[str]) -> None:
        """``states`` comes from config/geography.yml — never hard-coded (#14)."""
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        vintage = vintage or self.default_vintage
        refs: list[ReleaseRef] = []
        for layer, (directory, stem, scope) in self.LAYERS.items():
            if scope == "national":
                filename = stem.format(vintage=vintage, fips="")
                refs.append(
                    ReleaseRef(
                        source_id=self.source_id,
                        layer=layer,
                        vintage=vintage,
                        url=f"{BASE_URL}/TIGER{vintage}/{directory}/{filename}.zip",
                    )
                )
                continue
            for state in self.states:
                filename = stem.format(vintage=vintage, fips=fips_for(state))
                refs.append(
                    ReleaseRef(
                        source_id=self.source_id,
                        layer=layer,
                        vintage=vintage,
                        url=f"{BASE_URL}/TIGER{vintage}/{directory}/{filename}.zip",
                        scope=state,
                    )
                )
        return refs


def shapefile_member(ref: ReleaseRef) -> str:
    """The .shp inside a TIGER zip. Census names it after the archive, always."""
    return ref.url.rsplit("/", 1)[-1].removesuffix(".zip") + ".shp"
