"""American Community Survey 5-year estimates.

The one source in the warehouse whose municipal geography is **exact**. ACS publishes at
county subdivision level with full GEOIDs, so municipal income and population join to
`regions` on the same key TIGER uses — no name matching, none of the ambiguity that caps
Zillow's municipal coverage at 71% (ARCHITECTURE #27).

Consecutive 5-year vintages overlap by four years of sample, so year-over-year change
from ACS is not an independent measurement. That caveat lives on the metric, not here.

ZCTA level is deliberately not fetched: since 2020 ACS no longer nests ZCTAs within
states, so a ZIP-level pull means downloading all ~33,000 nationally per year for the
598 that matter. Deferred, not forgotten — see TODO.md.
"""

from __future__ import annotations

import os
from typing import ClassVar

from hip.config import ConfigError, fips_for
from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://api.census.gov/data"

# Census variable -> the metric_id it becomes. Cost burden needs several variables
# combined, so its parts are fetched and the ratio is computed in dbt.
VARIABLES: dict[str, str] = {
    "B19013_001E": "acs_median_hh_income",
    "B25064_001E": "acs_median_gross_rent",
    "B01003_001E": "acs_population",
    "B25077_001E": "acs_median_home_value",
}
# Renter cost burden: households paying 30%+ of income on housing, over all renters.
BURDEN_PARTS = ("B25070_001E", "B25070_007E", "B25070_008E", "B25070_009E", "B25070_010E")

# Five ACS vintages. Each covers five years, so this spans 2015-2023 of sample.
YEARS = (2023, 2022, 2021, 2020, 2019)

LEVELS = {"county": "county:*", "cousub": "county%20subdivision:*"}


class AcsAdapter(SourceAdapter):
    """Income, rent, population, home value, and renter cost burden."""

    source_id: ClassVar[str] = "census_acs"
    default_vintage: ClassVar[str] = "2023"
    landing_format: ClassVar[str] = "json"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        key = os.environ.get("CENSUS_API_KEY")
        if not key:
            raise ConfigError(
                "census_acs requires CENSUS_API_KEY. A keyless request returns an HTML "
                "'Missing Key' page with HTTP 200, which would be cached as data. "
                "Get one free at https://api.census.gov/data/key_signup.html"
            )
        variables = ",".join(["NAME", *VARIABLES, *BURDEN_PARTS])
        years = [int(vintage)] if vintage else list(YEARS)
        refs = []
        for year in years:
            for level, selector in LEVELS.items():
                for state in self.states:
                    inside = f"state:{fips_for(state)}"
                    if level == "cousub":
                        inside += "%20county:*"
                    refs.append(
                        ReleaseRef(
                            source_id=self.source_id,
                            layer=level,
                            vintage=str(year),
                            scope=state,
                            url=(
                                f"{BASE_URL}/{year}/acs/acs5?get={variables}"
                                f"&for={selector}&in={inside}&key={key}"
                            ),
                        )
                    )
        return refs

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        """Census returns a matrix: row 0 is the header, the rest are values."""
        if not isinstance(payload, list) or len(payload) < 2:
            raise ValueError(
                f"census_acs/{ref.key}: expected a header row plus data, got "
                f"{type(payload).__name__}. A 'Missing Key' HTML page arrives as "
                f"HTTP 200 and looks like this."
            )
        header = [str(c) for c in payload[0]]
        return [dict(zip(header, row, strict=False)) for row in payload[1:]]
