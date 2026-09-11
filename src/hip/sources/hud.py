"""HUD User datasets: the USPS crosswalk and income limits, Fair Market Rents, and CHAS.

Four datasets behind one token, serving affordability specifically (SPEC principle 4).
Three sources rather than one, because a source is what a reader sees credited beside a
figure: a Fair Market Rent labelled "USPS ZIP crosswalk and income limits" would be a
wrong citation on a correct number.

**The crosswalk** publishes residential, business, and total address ratios for
allocating ZIP-level data. `res_ratio` is the share of a ZIP's *residential addresses*
falling in each target geography, which is the right basis for housing measures — area
weighting treats a golf course like a subdivision. `type=11` (zip-countysub) reaches
municipalities directly, which is what supersedes the area weighting from Milestone 1.

**Income limits** publish HUD's area median income and the 30/50/80% thresholds every
housing agency uses. They let an affordability figure cite a published standard instead
of one the platform invented.

**Fair Market Rents** (Milestone 21) are HUD's rent standard, per FMR area and federal
fiscal year: the rent the voucher program pays against, and the benchmark rent burden
can cite in place of a survey median.

**CHAS** (Milestone 21) is HUD's custom tabulation of ACS microdata by tenure, income
band, and cost burden — published burden tables in place of the ratio the platform
derives from B25070.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import ClassVar

from hip.config import ConfigError, fips_for
from hip.sources.base import Release, ReleaseRef, SourceAdapter

BASE_URL = "https://www.huduser.gov/hudapi/public"

# HUD crosswalk type codes. Only the two that reach our region levels are used.
CROSSWALK_TYPES = {"zip_county": 2, "zip_countysub": 11}

# Income limit vintages. HUD revises annually; five covers the change windows.
IL_YEARS = (2024, 2023, 2022, 2021, 2020)

# HUD publishes limits for 1-8 person households. Four-person is the conventional
# reference figure and the one policy documents quote.
HOUSEHOLD_SIZE = "p4"

# Fair Market Rent fiscal years, newest first. The API refuses FY2016 ("Invalid year"),
# and FY2027 — published, but in force only from 2026-10-01 — is added once it starts,
# the same explicit bump `BLS_END_YEAR` gets. Ten years covers every change window.
FMR_YEARS = tuple(range(2026, 2016, -1))

# The CHAS vintage: HUD's tabulation of ACS 2018-2022, the latest it has published as of
# 2026-09-11 — 2019-2023 answers empty. Pinned rather than left to the API's default, so
# a re-run fetches the release it recorded. CHAS vintages overlap by four years as ACS
# ones do, and the ACS burden ratio already carries the trend, so one is loaded.
CHAS_VINTAGE = "2018-2022"

# HUD User allows 60 requests a minute per token (`x-ratelimit-limit: 60`); a little
# under that pace, for every HUD adapter, since the three share one token.
HUD_REQUEST_INTERVAL_S = 1.1

# CHAS summary levels (`type`): 3 is county, 4 is MCD. HUD's own list; a third-party
# mirror has 4 and 5 the other way round.
CHAS_COUNTY = 3
CHAS_MCD = 4


def _token() -> str:
    token = os.environ.get("HUD_API_TOKEN")
    if not token:
        raise ConfigError(
            "hud requires HUD_API_TOKEN. Free at "
            "https://www.huduser.gov/portal/dataset/uspszip-api.html"
        )
    return token


def _headers() -> dict[str, str]:
    """Bearer auth, built per instance so the token is never baked into a ClassVar
    shared by every adapter."""
    return {**SourceAdapter.headers, "Authorization": f"Bearer {_token()}"}


class HudAdapter(SourceAdapter):
    """Crosswalk and income limits, one release per dataset slice."""

    source_id: ClassVar[str] = "hud"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "json"
    request_interval_s: ClassVar[float] = HUD_REQUEST_INTERVAL_S

    def __init__(self, states: list[str], county_fips: list[str]) -> None:
        self.states = states
        self.county_fips = county_fips
        self.headers = _headers()

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        _token()
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer=name,
                vintage=vintage or self.default_vintage,
                scope=state,
                url=f"{BASE_URL}/usps?type={code}&query={state}",
            )
            for name, code in CROSSWALK_TYPES.items()
            for state in self.states
        ]
        refs += [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"il_{fips}",
                vintage=str(year),
                url=f"{BASE_URL}/il/data/{fips}99999?year={year}",
            )
            for year in IL_YEARS
            for fips in self.county_fips
        ]
        return refs

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        if not isinstance(payload, dict) or "data" not in payload:
            raise ValueError(f"hud/{ref.key}: no 'data' key in response")
        data = payload["data"]
        assert isinstance(data, dict)

        if ref.layer.startswith("il_"):
            return _income_limit_rows(data, ref)
        return _crosswalk_rows(data, ref)


def _crosswalk_rows(data: dict[str, object], ref: ReleaseRef) -> list[dict[str, object]]:
    results = data.get("results", [])
    assert isinstance(results, list)
    return [
        {
            "crosswalk_type": data.get("crosswalk_type"),
            # For zip-* types HUD puts the ZIP in `zip` and the target in `geoid`.
            "from_geoid": row["zip"],
            "to_geoid": row["geoid"],
            "res_ratio": row["res_ratio"],
            "tot_ratio": row["tot_ratio"],
        }
        for row in results
        if isinstance(row, dict) and row.get("res_ratio")
    ]


def _income_limit_rows(
    data: dict[str, object], ref: ReleaseRef
) -> list[dict[str, object]]:
    """One row per county-year, flattening the nested band structure."""
    low = data.get("low")
    limit_80 = low.get(f"il80_{HOUSEHOLD_SIZE}") if isinstance(low, dict) else None
    return [
        {
            # layer is 'il_<fips>'; the county FIPS is what joins to regions.
            "county_fips": ref.layer.removeprefix("il_"),
            "year": ref.vintage,
            "median_income": data.get("median_income"),
            "income_limit_80": limit_80,
        }
    ]


class HudFmrAdapter(SourceAdapter):
    """Fair Market Rents, one release per state per fiscal year.

    `/fmr/statedata/{state}` answers every county in a state in one call — 21 NJ
    counties in about 9KB — where the per-county endpoint the source list was sized on
    would take 21. Its metro-area block is not kept: every county entry already names its
    FMR area and carries the area's rents.
    """

    source_id: ClassVar[str] = "hud_fmr"
    default_vintage: ClassVar[str] = str(FMR_YEARS[0])
    landing_format: ClassVar[str] = "json"
    request_interval_s: ClassVar[float] = HUD_REQUEST_INTERVAL_S

    def __init__(self, states: list[str]) -> None:
        self.states = states
        self.headers = _headers()

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        years = [int(vintage)] if vintage else list(FMR_YEARS)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="fmr",
                vintage=str(year),
                scope=state,
                url=f"{BASE_URL}/fmr/statedata/{state}?year={year}",
            )
            for year in years
            for state in self.states
        ]

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        data = payload.get("data") if isinstance(payload, dict) else None
        counties = data.get("counties") if isinstance(data, dict) else None
        if not isinstance(counties, list):
            raise ValueError(f"hud_fmr/{ref.key}: no 'data.counties' in response")
        return [
            {
                # Ten digits: county FIPS then 99999 for a whole county. New England
                # entries carry a town code there instead; dbt keeps whole counties.
                "fips_code": entry.get("fips_code"),
                "county_name": entry.get("county_name"),
                "fmr_area": entry.get("metro_name"),
                "small_area": entry.get("smallarea_status"),
                "fmr_percentile": entry.get("FMR Percentile"),
                "efficiency": entry.get("Efficiency"),
                "one_bedroom": entry.get("One-Bedroom"),
                "two_bedroom": entry.get("Two-Bedroom"),
                "three_bedroom": entry.get("Three-Bedroom"),
                "four_bedroom": entry.get("Four-Bedroom"),
                "fiscal_year": ref.vintage,
            }
            for entry in counties
            if isinstance(entry, dict)
        ]


class HudChasAdapter(SourceAdapter):
    """CHAS tables, one release per county and one per municipality.

    Municipal refs cannot be listed from config: they are HUD's MCD codes, and HUD
    publishes the list. So the directory (`chas/listMCDs/{state}`) is fetched as a
    release like any other, cached like any other, and the municipal refs are derived
    from its content — which keeps a re-run, and `hip load` rebuilding provenance, off
    the network once it is cached.
    """

    source_id: ClassVar[str] = "hud_chas"
    default_vintage: ClassVar[str] = CHAS_VINTAGE
    landing_format: ClassVar[str] = "json"
    request_interval_s: ClassVar[float] = HUD_REQUEST_INTERVAL_S

    def __init__(self, states: list[str], county_fips: list[str]) -> None:
        self.states = states
        self.county_fips = county_fips
        self.headers = _headers()

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """County refs and each state's MCD directory; municipal refs follow from it."""
        year = vintage or self.default_vintage
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"county_{fips}",
                vintage=year,
                url=(
                    f"{BASE_URL}/chas?type={CHAS_COUNTY}&year={year}"
                    f"&stateId={int(fips[:2])}&entityId={int(fips[2:])}"
                ),
            )
            for fips in self.county_fips
        ]
        refs += [
            ReleaseRef(
                source_id=self.source_id,
                layer="mcds",
                # The directory lists what exists now, not a vintage of the data.
                vintage="current",
                scope=state,
                url=f"{BASE_URL}/chas/listMCDs/{int(fips_for(state))}",
            )
            for state in self.states
        ]
        return refs

    def fetch_all(
        self, *, raw_dir: Path, vintage: str | None = None, force: bool = False
    ) -> Iterator[Release]:
        for release in super().fetch_all(raw_dir=raw_dir, vintage=vintage, force=force):
            yield release
            if release.ref.layer == "mcds":
                for ref in self.municipal_refs(release, vintage):
                    yield self.fetch(ref, raw_dir=raw_dir, force=force)

    def municipal_refs(self, directory: Release, vintage: str | None) -> list[ReleaseRef]:
        """One ref per MCD in a fetched directory."""
        year = vintage or self.default_vintage
        entries = json.loads(directory.path.read_text())
        if not isinstance(entries, list):
            raise ValueError(f"hud_chas/{directory.ref.key}: directory is not a list")
        state = fips_for(directory.ref.scope or "")
        return [
            ReleaseRef(
                source_id=self.source_id,
                # State FIPS and the five-digit MCD code: the key dbt resolves to a
                # municipal GEOID through TIGER, since a CHAS row names no county code.
                layer=f"mcd_{state}{int(entry['entityId']):05d}",
                vintage=year,
                url=(
                    f"{BASE_URL}/chas?type={CHAS_MCD}&year={year}"
                    f"&stateId={int(state)}&entityId={int(entry['entityId'])}"
                ),
            )
            for entry in entries
            if isinstance(entry, dict)
            and str(entry.get("statecode")) == state
            # Code 0 is "County subdivisions not defined" — the water areas, listed once
            # per coastal county (five times for NJ). Not a municipality, and TIGER's
            # 00000 is filtered for the same reason.
            and int(entry["entityId"]) != 0
        ]

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        if ref.layer == "mcds":
            if not isinstance(payload, list):
                raise ValueError(f"hud_chas/{ref.key}: directory is not a list")
            return [
                {
                    "statecode": entry.get("statecode"),
                    "entity_id": entry.get("entityId"),
                    "mcd_name": entry.get("mcdname"),
                }
                for entry in payload
                if isinstance(entry, dict)
            ]
        if not isinstance(payload, list):
            raise ValueError(f"hud_chas/{ref.key}: expected a list of rows")
        level, geo_key = ref.layer.split("_", 1)
        if not payload:
            # HUD answers `[]` for a listed MCD it tabulated nothing for. One keyed row
            # with no values lands it honestly — landing refuses an empty table, and
            # dropping the release would lose the record that HUD was asked.
            return [{"level": level, "geo_key": geo_key, "chas_year": None}]
        # Every field kept, as HUD sends it: the dictionary has 132 and the burden
        # metrics use a handful, so a later metric needs a dbt column, not a re-fetch.
        return [
            {"level": level, "geo_key": geo_key, "chas_year": row.get("year"), **row}
            for row in payload
            if isinstance(row, dict)
        ]
