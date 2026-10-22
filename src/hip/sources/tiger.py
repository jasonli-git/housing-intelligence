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

from datetime import date
from typing import ClassVar, Literal

from hip.config import fips_for
from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

LayerScope = Literal["national", "state"]

BASE_URL = "https://www2.census.gov/geo/tiger"


class TigerAdapter(SourceAdapter):
    """Fetches the five TIGER layers that make up the geography spine."""

    source_id: ClassVar[str] = "census_tiger"
    # Pinned on purpose: a new TIGER vintage redraws the region spine every fact row is
    # keyed to, so moving to it is a decision to take and check by hand, not one a
    # scheduled refresh should make on its own. `discover` reports a newer vintage as
    # waiting and never adopts it (#360). TIGER2026 answered 404 on 2026-09-23 and 200
    # on 2026-10-09.
    default_vintage: ClassVar[str] = "2025"
    landing_format: ClassVar[str] = "shapefile"

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

    def discover(self, today: date) -> Discovery:
        """Whether Census has published a TIGER year after the pinned one.

        The national county file stands for the year: every layer this adapter reads
        is released together. A newer year is `pending`, never `newest`, so the refs
        stay on the pinned vintage until someone moves `default_vintage` by hand.
        """

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(f"{BASE_URL}/TIGER{year}/COUNTY/tl_{year}_us_county.zip")

        pinned = int(self.default_vintage)
        year, published, reached = self._probe_forward(pinned, exists)
        newer = str(year) if year > pinned else None
        return self._discovered(
            self.default_vintage,
            reached=reached,
            published=published,
            pending=newer,
            pending_reason=(
                "A new TIGER year redraws every region; adopting it is reviewed by hand"
                if newer
                else None
            ),
        )


# New Jersey's 21 counties, by FIPS code: every odd number from 001 to 041. TIGER's road
# files come one per county, and the stories read New Jersey's alone.
NJ_COUNTIES = tuple(f"{n:03d}" for n in range(1, 42, 2))


class TigerRoadsAdapter(SourceAdapter):
    """Every road's name and class, county by county (the visual stories).

    TIGER's `ROADS` layer: each edge with its full name ("Maple Ct") and MAF/TIGER
    feature class, S1400 for a local neighbourhood road. A separate source from the
    boundary spine because it serves one story — the share of a town's streets named
    Court, Circle, Lane and the like — and is pinned to the same vintage the spine is.
    """

    source_id: ClassVar[str] = "census_tiger_roads"
    default_vintage: ClassVar[str] = TigerAdapter.default_vintage
    landing_format: ClassVar[str] = "shapefile"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        vintage = vintage or self.default_vintage
        return [
            # A layer per county rather than one layer scoped by county: the fact
            # loader attributes each figure to one release by (source, layer,
            # vintage), and a town's street names come from its own county's file.
            ReleaseRef(
                source_id=self.source_id,
                layer=f"roads_{county}",
                vintage=vintage,
                url=f"{BASE_URL}/TIGER{vintage}/ROADS/tl_{vintage}_{fips_for('NJ')}{county}_roads.zip",
            )
            for county in NJ_COUNTIES
        ]


def shapefile_member(ref: ReleaseRef) -> str:
    """The .shp inside a TIGER zip. Census names it after the archive, always."""
    return ref.url.rsplit("/", 1)[-1].removesuffix(".zip") + ".shp"
