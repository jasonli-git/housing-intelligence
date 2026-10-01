"""American Community Survey 5-year estimates.

The one source in the warehouse whose municipal geography is **exact**. ACS publishes at
county subdivision level with full GEOIDs, so municipal income and population join to
`regions` on the same key TIGER uses — no name matching, none of the ambiguity that caps
Zillow's municipal coverage at 71% (ARCHITECTURE #27).

Consecutive 5-year vintages overlap by four years of sample, so year-over-year change
from ACS is not an independent measurement. That caveat lives on the metric, not here.

ZCTAs since Milestone 34. Since the 2020 edition the ACS no longer nests ZCTAs within
states, which is why Milestone 3 left them out: a state's ZCTAs could only be had by
downloading all ~33,000 nationally. Instead the 2020 Census names New Jersey's 598 —
the ZCTAs that cover any part of the state — in one small request (`zctas`), and each
edition is asked for exactly those by code. The 2019 edition is not asked: it is
tabulated on the 2010 ZCTAs, so a change from it to a later edition would set two
different shapes side by side under one code (ARCHITECTURE #282).
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable
from datetime import date
from typing import ClassVar

from hip.config import ConfigError, fips_for
from hip.sources.base import Discovery, Release, ReleaseRef, SourceAdapter

BASE_URL = "https://api.census.gov/data"

# Census variable -> the metric_id it becomes. Cost burden needs several variables
# combined, so its parts are fetched and the ratio is computed in dbt.
VARIABLES: dict[str, str] = {
    "B19013_001E": "acs_median_hh_income",
    "B25064_001E": "acs_median_gross_rent",
    "B01003_001E": "acs_population",
    "B25077_001E": "acs_median_home_value",
}
# Renter cost burden: households paying 30%+ of income on housing, over the renters
# whose burden the Census could compute. `B25070_011E` counts the rest — no or negative
# income, or no cash rent — and leaves the denominator in Milestone 28, the universe
# HUD's CHAS tables already use.
BURDEN_PARTS = (
    "B25070_001E",
    "B25070_007E",
    "B25070_008E",
    "B25070_009E",
    "B25070_010E",
    "B25070_011E",
)

# Housing stock (Milestone 21): occupancy (B25002 — all units, vacant) and tenure (B25003
# — occupied units, owner-occupied), from which vacancy and homeownership rates are
# computed in dbt. A separate request under its own layers rather than more variables on
# the one above: the raw cache is keyed by (layer, scope, vintage), not by URL, so a
# widened request under the old key would be answered from the cached file that lacks
# the new columns, silently. Separate layers also give these rows their own release.
HOUSING_VARIABLES = ("B25002_001E", "B25002_003E", "B25003_001E", "B25003_002E")

# The costs of a home beyond its mortgage and tax (Milestone 33), as the Census publishes
# them: in brackets, with no median, so `stg_census_acs_costs` interpolates one. Each
# table's brackets are requested whole, without margins — no published margin applies to
# a median worked out here. Two layers, each under the Census API's 50-variable limit,
# fetched only from the first edition that carries its tables: B25141 from 2023, the
# utility bills and B25069 from 2021. Asking an older edition for them is an error.
COST_LAYERS: dict[str, tuple[int, tuple[str, ...]]] = {
    # Homeowners insurance a year, by mortgage status: the total, then each status's
    # total and its twelve brackets.
    "insurance_": (2023, tuple(f"B25141_{n:03d}E" for n in range(1, 28))),
    # Electricity and gas a month, water and sewer and other fuels a year — each table's
    # total, those not charged, those charged and their brackets — and whether renters
    # pay utilities on top of rent.
    "utilities_": (
        2021,
        (
            *(f"B25132_{n:03d}E" for n in range(1, 10)),
            *(f"B25133_{n:03d}E" for n in range(1, 10)),
            *(f"B25134_{n:03d}E" for n in range(1, 10)),
            *(f"B25135_{n:03d}E" for n in range(1, 7)),
            "B25069_001E",
            "B25069_002E",
            "B25069_003E",
        ),
    ),
}


def _cells(table: str, *cells: int) -> tuple[str, ...]:
    return tuple(f"{table}_{n:03d}E" for n in cells)


# The ACS in depth (Milestone 34), each estimate with its margin of error, in layers kept
# under the API's 50-variable limit — a margin doubles each estimate's count. Every
# table here is published in all six editions fetched.
DEPTH_LAYERS: dict[str, tuple[str, ...]] = {
    # Gross rent by bedrooms (B25031, studio to four); the lower and upper quartiles of
    # contract rent (B25057, B25059 — the Census publishes quartiles only for rent paid to
    # the landlord); owner costs with and without a mortgage (B25088); and the households
    # paying half their income or more: renters (B25070) and owners (B25091).
    "rent_": (
        *_cells("B25031", 2, 3, 4, 5, 6),
        "B25057_001E",
        "B25059_001E",
        *_cells("B25088", 2, 3),
        *_cells("B25070", 1, 10, 11),
        *_cells("B25091", 1, 11, 12, 22, 23),
    ),
    # Units in structure (B25024, the boat-and-RV line left out), year built (B25034) and
    # its median (B25035).
    "stock_": (
        *_cells("B25024", *range(1, 11)),
        *_cells("B25034", *range(1, 12)),
        "B25035_001E",
    ),
    # Bedrooms (B25041), occupants per room (B25014), complete plumbing (B25047) and
    # kitchens (B25051), household size (B25010) and vehicles available (B25044).
    "rooms_": (
        *_cells("B25041", *range(1, 8)),
        *_cells("B25014", 1, 5, 6, 7, 11, 12, 13),
        *_cells("B25047", 1, 3),
        *_cells("B25051", 1, 3),
        "B25010_001E",
        *_cells("B25044", 1, 3, 10),
    ),
    # Vacant homes by reason (B25004), with tenure (B25003) for the rental and homeowner
    # vacancy rates; and heating fuel (B25040).
    "vacancy_": (
        *_cells("B25004", *range(1, 9)),
        *_cells("B25003", 1, 2, 3),
        *_cells("B25040", *range(1, 11)),
    ),
    # How workers get to work (B08301) and how long it takes (B08013 aggregate minutes,
    # B08303 brackets); household types (B11001) and households with children (B11005).
    "people_": (
        *_cells("B08301", 1, 3, 10, 19, 21),
        "B08013_001E",
        *_cells("B08303", 1, 13),
        *_cells("B11001", 1, 3, 8),
        *_cells("B11005", 1, 2),
    ),
    # Disability (B18101): the population counted, and those with a disability in each
    # sex-and-age cell.
    "disability_": (
        "B18101_001E",
        *_cells("B18101", 4, 7, 10, 13, 16, 19, 23, 26, 29, 32, 35, 38),
    ),
}

# The first edition tabulated on the 2020 ZCTAs, and so the first asked for them.
ZCTA_FIRST = 2020


def with_margins(estimates: Iterable[str]) -> list[str]:
    """Each estimate beside its margin of error: `B19013_001E` and `B19013_001M`.

    The Census publishes a 90% margin with every ACS estimate, and Milestone 28 shows
    it. Asked for in the same request as its estimate, so the two can never come from
    different files. Widening a request is safe since ARCHITECTURE #214: a cached copy
    answers only the request it was fetched with, so the wider one is fetched afresh.
    """
    return [v for estimate in estimates for v in (estimate, estimate[:-1] + "M")]


# How many consecutive 5-year vintages to fetch: six, so the newest edition and the one
# five years before it — the pair the default five-year change compares, whose samples
# do not overlap — are both fetched, with the four between. Until Milestone 28 this was
# five, and the start of every five-year change was an edition fetched under an older
# end year and kept only because nothing deleted it: a clean rebuild would have lost
# the five-year change, and re-fetching for margins of error passed it by.
VINTAGE_COUNT = 6


def vintages(end_year: int) -> tuple[int, ...]:
    """The six vintages ending at ``end_year``, newest first."""
    return tuple(range(end_year, end_year - VINTAGE_COUNT, -1))


LEVELS = {"county": "county:*", "cousub": "county%20subdivision:*"}

# Where New Jersey's ZCTAs are named: the 2020 Census, which tabulates every ZCTA by the
# part of it inside each state. 598 for New Jersey on 2026-10-01 — the ZIP regions TIGER
# gives, ZCTA for ZCTA.
ZCTA_DIRECTORY = (
    f"{BASE_URL}/2020/dec/dhc?get=NAME"
    "&for=zip%20code%20tabulation%20area%20(or%20part):*&in=state:{fips}"
)


class AcsAdapter(SourceAdapter):
    """The ACS at county, municipality and ZCTA: income, rent, home value, population,
    cost burden, occupancy and tenure, running costs, and the tables of Milestone 34."""

    source_id: ClassVar[str] = "census_acs"
    landing_format: ClassVar[str] = "json"

    def __init__(self, states: list[str], *, end_year: int) -> None:
        """``end_year`` is the floor: the newest 5-year vintage known to exist.

        Passed in rather than read from the clock, so a re-run fetches the vintages the
        first run recorded. It lives as ``ACS_END_YEAR`` in :mod:`hip.sources.registry`.
        Since Milestone 26 a newer vintage is *discovered* — `newest` — rather than
        waiting for someone to bump the constant; the floor is what answers before
        discovery has ever run. It was hard-coded here from Milestone 3 until 24.
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
        return str(self.latest)

    @property
    def latest(self) -> int:
        """The newest vintage to fetch: the discovered one, else the floor."""
        return int(self.newest) if self.newest else self.end_year

    def discover(self, today: date) -> Discovery:
        """The newest 5-year vintage the API serves.

        The dataset's metadata document answers 404 until Census releases the vintage
        (2025 answered 404 on 2026-09-23), so no key is spent asking.
        """

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(f"{BASE_URL}/{year}/acs/acs5.json", method="GET")

        year, published, reached = self._probe_forward(self.latest, exists)
        return self._discovered(str(year), reached=reached, published=published)

    def _key(self) -> str:
        key = os.environ.get("CENSUS_API_KEY")
        if not key:
            raise ConfigError(
                "census_acs requires CENSUS_API_KEY. A keyless request returns an HTML "
                "'Missing Key' page with HTTP 200, which would be cached as data. "
                "Get one free at https://api.census.gov/data/key_signup.html"
            )
        return key

    @staticmethod
    def requests() -> dict[str, tuple[int, str]]:
        """Each layer prefix: the first edition it is asked of, and its variables."""
        return {
            "": (0, ",".join(["NAME", *with_margins([*VARIABLES, *BURDEN_PARTS])])),
            "housing_": (0, ",".join(["NAME", *with_margins(HOUSING_VARIABLES)])),
            **{
                prefix: (first, ",".join(["NAME", *variables]))
                for prefix, (first, variables) in COST_LAYERS.items()
            },
            **{
                prefix: (0, ",".join(["NAME", *with_margins(variables)]))
                for prefix, variables in DEPTH_LAYERS.items()
            },
        }

    def _years(self, vintage: str | None) -> list[int]:
        return [int(vintage)] if vintage else list(vintages(self.latest))

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        key = self._key()
        refs = []
        for year in self._years(vintage):
            for prefix, (first, variables) in self.requests().items():
                if year < first:
                    continue
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
        # The directory of each state's ZCTAs, from which `child_refs` names the ZCTA
        # requests. Asked only when some edition wanted is tabulated on 2020 ZCTAs.
        if any(year >= ZCTA_FIRST for year in self._years(vintage)):
            refs += [
                ReleaseRef(
                    source_id=self.source_id,
                    layer="zctas",
                    vintage=str(ZCTA_FIRST),
                    scope=state,
                    url=ZCTA_DIRECTORY.format(fips=fips_for(state)) + f"&key={key}",
                )
                for state in self.states
            ]
        return refs

    def child_refs(
        self, release: Release, vintage: str | None = None
    ) -> list[ReleaseRef]:
        """Every layer of every edition from 2020, for the ZCTAs a directory names.

        Asked by code because no edition from 2020 answers `in=state:` for a ZCTA, and
        the alternative is every ZCTA in the country — about 1GB a year of raw files for
        the 598 that matter.
        """
        if release.ref.layer != "zctas":
            return []
        rows = json.loads(release.path.read_text())
        if not isinstance(rows, list) or len(rows) < 2:
            raise ValueError(f"census_acs/{release.ref.key}: directory is not a matrix")
        column = rows[0].index("zip code tabulation area (or part)")
        codes = sorted({str(row[column]) for row in rows[1:]})
        selector = "zip%20code%20tabulation%20area:" + ",".join(codes)
        key = self._key()
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"{prefix}zcta",
                vintage=str(year),
                scope=release.ref.scope,
                url=f"{BASE_URL}/{year}/acs/acs5?get={variables}&for={selector}&key={key}",
            )
            for year in self._years(vintage)
            if year >= ZCTA_FIRST
            for prefix, (first, variables) in self.requests().items()
            if year >= first
        ]

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
