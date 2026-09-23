"""Census Population Estimates Program — headline population, as of a date.

A different program from ACS, deliberately loaded beside it rather than instead of it.
ACS 5-year estimates average five years of sample, so an "ACS 2024" population is the
2020-2024 average; PEP carries births, deaths and migration forward from the 2020 census
to produce a July-1 estimate for a single year. Measured 2026-09-19, Mercer County reads
385,864 from ACS 2020-2024 and 399,289 from PEP Vintage 2025 — the same county, two
honest answers to two different questions.

**ACS stays the denominator of every ratio.** A ratio mixing a five-year average with a
point-in-time estimate would be neither, so PEP supplies the headline figure a reader
sees and nothing else. `tests/test_sources.py` pins that.

Two keyless files, both plain CSV over HTTPS:

* the national county file, which carries `state` (SUMLEV 040) and `county` (050);
* one sub-county file per state, whose SUMLEV 061 rows are county subdivisions —
  564 of them for New Jersey, which is exactly the municipality count TIGER gives.

Geography resolves by exact GEOID, as ACS does: `STATE || COUNTY || COUSUB` is the same
10-digit key `regions` holds. Verified 2026-09-19 against the loaded spine — 564 of 564
municipalities and 21 of 21 counties matched, none left over. No name matching, so none
of the ambiguity that caps Zillow's municipal coverage at 71% (ARCHITECTURE #27).

The vintage is dated, never `current`. A PEP vintage is immutable once published — the
2025 vintage does not change when the 2026 one appears, it is superseded by it — so the
content-addressed cache is correct to answer from disk. Sources whose vintage is
literally `current` have the opposite problem, which is the open conditional-request
item in TODO.md.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from hip.config import fips_for
from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www2.census.gov/programs-surveys/popest/datasets"

# The first year of the estimates series, fixed by the decennial census the vintage
# counts forward from. A 2030-census vintage would start at 2030, which is a bump of
# this constant rather than a change of shape.
SERIES_START = 2020

# Summary levels. The national county file carries the first two; the sub-county file
# carries 061 alongside places (162) and "balance of" records (071, 157) that would
# double-count a municipality if they were read.
SUMLEV_STATE = "040"
SUMLEV_COUNTY = "050"
SUMLEV_COUSUB = "061"


class PepAdapter(SourceAdapter):
    """Headline population at state, county and municipal level."""

    source_id: ClassVar[str] = "census_pep"
    # The floor: the newest vintage known to exist when this was written. A newer one
    # is discovered — Census publishes the next vintage each winter.
    default_vintage: ClassVar[str] = "2025"
    landing_format: ClassVar[str] = "csv"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """One national county file, plus one sub-county file per state.

        The county file is national rather than per-state because Census publishes it
        that way — 2.1MB for all 3,144 counties, against no per-state cut at all. The
        sub-county files are published per state and fetched per state.
        """
        year = vintage or self.newest or self.default_vintage
        span = f"{SERIES_START}-{year}"
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer="county",
                vintage=year,
                url=f"{BASE_URL}/{span}/counties/totals/co-est{year}-alldata.csv",
            )
        ]
        refs.extend(
            ReleaseRef(
                source_id=self.source_id,
                layer="cousub",
                vintage=year,
                scope=state,
                url=(
                    f"{BASE_URL}/{span}/cities/totals/sub-est{year}_{fips_for(state)}.csv"
                ),
            )
            for state in self.states
        )
        return refs

    def discover(self, today: date) -> Discovery:
        """The newest vintage whose national county file exists.

        Each vintage lives in a folder named for its own span (`2020-2025`), so the
        next one is a new path, not a replaced file.
        """

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(
                f"{BASE_URL}/{SERIES_START}-{year}/counties/totals/co-est{year}-alldata.csv"
            )

        start = int(self.newest or self.default_vintage)
        year, published, reached = self._probe_forward(start, exists)
        return self._discovered(str(year), reached=reached, published=published)
