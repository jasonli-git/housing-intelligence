"""FHA's county loan limits (Milestone 48, closing a Milestone 33 TODO).

HUD sets the largest mortgage FHA will insure in each county, each calendar year: the
national floor where homes are cheaper, up to a ceiling in high-cost areas. The site's
3.5%-down card prices an FHA loan; in a dear town that loan can be larger than FHA
allows, and the card should say so rather than leave a reader to find out.

HUD publishes the limits as fixed-width files on its CHUMS page, one per year, with the
layout on the same page. A U.S. Government work, in the public domain. The median price
in each record is the one HUD used to set the limit and, HUD says, may not represent
actual home prices; it is not loaded.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://apps.hud.gov/pub/chums"

# (name, one-based start, length), from the CHUMS file description.
FIELDS: tuple[tuple[str, int, int], ...] = (
    ("msa_code", 1, 5),
    ("soa_code", 61, 5),
    ("limit_type", 66, 1),
    ("limit_1_unit", 74, 7),
    ("limit_2_units", 81, 7),
    ("limit_3_units", 88, 7),
    ("limit_4_units", 95, 7),
    ("state", 102, 2),
    ("county_fips", 104, 3),
    ("county_name", 133, 15),
)


class HudFhaLimitsAdapter(SourceAdapter):
    """FHA forward-mortgage limits by county, one release per calendar year."""

    source_id: ClassVar[str] = "hud_fha_limits"
    default_vintage: ClassVar[str] = "2026"
    landing_format: ClassVar[str] = "fixed_width"
    fixed_width_fields: ClassVar[tuple[tuple[str, int, int], ...]] = FIELDS

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.newest or self.default_vintage
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="forward",
                vintage=year,
                url=f"{BASE_URL}/cy{year}-forward-limits.txt",
            )
        ]

    def discover(self, today: date) -> Discovery:
        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(f"{BASE_URL}/cy{year}-forward-limits.txt")

        start = int(self.newest or self.default_vintage)
        year, published, reached = self._probe_forward(start, exists)
        return self._discovered(str(year), reached=reached, published=published)
