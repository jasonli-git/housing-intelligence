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

# Housing stock (Milestone 21): occupancy (B25002 — all units, vacant) and tenure (B25003
# — occupied units, owner-occupied), from which vacancy and homeownership rates are
# computed in dbt. A separate request under its own layers rather than more variables on
# the one above: the raw cache is keyed by (layer, scope, vintage), not by URL, so a
# widened request under the old key would be answered from the cached file that lacks
# the new columns, silently. Separate layers also give these rows their own release.
HOUSING_VARIABLES = ("B25002_001E", "B25002_003E", "B25003_001E", "B25003_002E")

# How many consecutive 5-year vintages to fetch. Five vintages span nine years of
# sample, because consecutive vintages overlap by four.
VINTAGE_COUNT = 5


def vintages(end_year: int) -> tuple[int, ...]:
    """The five vintages ending at ``end_year``, newest first."""
    return tuple(range(end_year, end_year - VINTAGE_COUNT, -1))

LEVELS = {"county": "county:*", "cousub": "county%20subdivision:*"}


class AcsAdapter(SourceAdapter):
    """Income, rent, population, home value, renter cost burden, occupancy, and tenure."""

    source_id: ClassVar[str] = "census_acs"
    landing_format: ClassVar[str] = "json"

    def __init__(self, states: list[str], *, end_year: int) -> None:
        """``end_year`` is the newest 5-year vintage to fetch.

        Passed in rather than read from the clock, for the same reason
        :class:`~hip.sources.bls.BlsAdapter` takes one: a re-run fetches the vintages
        the first run recorded, so a release is reproducible. It lives as
        ``ACS_END_YEAR`` in :mod:`hip.sources.registry`; bump it when a vintage
        publishes. It was hard-coded here from Milestone 3 until Milestone 24.
        """
        self.states = states
        self.end_year = end_year

    # `SourceAdapter` models `default_vintage` as a ClassVar, which is true of every
    # adapter whose releases share one vintage — BLS is `current`, Zillow is `current`.
    # It is not true here: each ACS vintage is its own release, so the default follows
    # the injected `end_year`. Overriding a writeable class attribute with a read-only
    # property is what the ignore covers. Narrowing the base to suit one adapter would
    # mean re-annotating all twelve, which is not this milestone's trade.
    @property
    def default_vintage(self) -> str:  # type: ignore[override]
        return str(self.end_year)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        key = os.environ.get("CENSUS_API_KEY")
        if not key:
            raise ConfigError(
                "census_acs requires CENSUS_API_KEY. A keyless request returns an HTML "
                "'Missing Key' page with HTTP 200, which would be cached as data. "
                "Get one free at https://api.census.gov/data/key_signup.html"
            )
        requests = {
            "": ",".join(["NAME", *VARIABLES, *BURDEN_PARTS]),
            "housing_": ",".join(["NAME", *HOUSING_VARIABLES]),
        }
        years = [int(vintage)] if vintage else list(vintages(self.end_year))
        refs = []
        for year in years:
            for prefix, variables in requests.items():
                for level, selector in LEVELS.items():
                    for state in self.states:
                        inside = f"state:{fips_for(state)}"
                        if level == "cousub":
                            inside += "%20county:*"
                        refs.append(
                            ReleaseRef(
                                source_id=self.source_id,
                                layer=f"{prefix}{level}",
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
