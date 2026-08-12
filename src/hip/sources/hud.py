"""HUD USPS crosswalk and income limits.

Two datasets behind one token, serving affordability specifically (SPEC principle 4).

**The crosswalk** publishes residential, business, and total address ratios for
allocating ZIP-level data. `res_ratio` is the share of a ZIP's *residential addresses*
falling in each target geography, which is the right basis for housing measures — area
weighting treats a golf course like a subdivision. `type=11` (zip-countysub) reaches
municipalities directly, which is what supersedes the area weighting from Milestone 1.

**Income limits** publish HUD's area median income and the 30/50/80% thresholds every
housing agency uses. They let an affordability figure cite a published standard instead
of one the platform invented.
"""

from __future__ import annotations

import os
from typing import ClassVar

from hip.config import ConfigError
from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://www.huduser.gov/hudapi/public"

# HUD crosswalk type codes. Only the two that reach our region levels are used.
CROSSWALK_TYPES = {"zip_county": 2, "zip_countysub": 11}

# Income limit vintages. HUD revises annually; five covers the change windows.
IL_YEARS = (2024, 2023, 2022, 2021, 2020)

# HUD publishes limits for 1-8 person households. Four-person is the conventional
# reference figure and the one policy documents quote.
HOUSEHOLD_SIZE = "p4"


def _token() -> str:
    token = os.environ.get("HUD_API_TOKEN")
    if not token:
        raise ConfigError(
            "hud requires HUD_API_TOKEN. Free at "
            "https://www.huduser.gov/portal/dataset/uspszip-api.html"
        )
    return token


class HudAdapter(SourceAdapter):
    """Crosswalk and income limits, one release per dataset slice."""

    source_id: ClassVar[str] = "hud"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "json"

    def __init__(self, states: list[str], county_fips: list[str]) -> None:
        self.states = states
        self.county_fips = county_fips
        # Instance attribute shadows the class default so the bearer token is not
        # baked into a ClassVar shared by every adapter.
        self.headers = {**SourceAdapter.headers, "Authorization": f"Bearer {_token()}"}

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
