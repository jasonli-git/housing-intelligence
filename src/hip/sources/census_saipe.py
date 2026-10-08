"""Census Small Area Income and Poverty Estimates: median household income by year.

The income side of Milestone 52's long-run price-to-income (ARCHITECTURE #348). The ACS
five-year income the platform shows reaches back only to the 2011–2015 vintage at county
level here, and overlapping five-year windows cannot say when a past episode began or
ended. SAIPE publishes one model-based estimate a year for every county and state, with
a 90% confidence interval, from 1989; 1990 to 1992 and 1994 are not published, nor 1996
for counties, which the fact built on it states rather than fills.
"""

from __future__ import annotations

import os
from typing import ClassVar

from hip.config import fips_for
from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

BASE_URL = "https://api.census.gov/data/timeseries/poverty/saipe"
FIRST_YEAR = 1989
VARIABLES = "NAME,SAEMHI_PT,SAEMHI_LB90,SAEMHI_UB90"


class SaipeAdapter(SourceAdapter):
    """Every year's estimate in one request per state and level: the timeseries API
    answers `time=from 1989` with all of them, so a new year is a new release of the
    same two files rather than another file each."""

    source_id: ClassVar[str] = "census_saipe"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "json"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def _key(self) -> str:
        key = os.environ.get("CENSUS_API_KEY")
        if not key:
            raise SourceError(
                "census_saipe requires CENSUS_API_KEY, as census_acs does. "
                "Get one free at https://api.census.gov/data/key_signup.html"
            )
        return key

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        key = self._key()
        out = []
        for state in self.states:
            fips = fips_for(state)
            for layer, selector, inside in (
                ("county", "county:*", f"&in=state:{fips}"),
                ("state", f"state:{fips}", ""),
            ):
                out.append(
                    ReleaseRef(
                        source_id=self.source_id,
                        layer=layer,
                        vintage=vintage or self.default_vintage,
                        scope=state,
                        url=(
                            f"{BASE_URL}?get={VARIABLES}&for={selector}{inside}"
                            f"&time=from+{FIRST_YEAR}&key={key}"
                        ),
                    )
                )
        return out

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        """A header row, then one row per place and year. A year with no estimate for a
        place arrives as null and is dropped, never read as zero."""
        if not isinstance(payload, list) or len(payload) < 2:
            raise SourceError(f"census_saipe/{ref.key}: expected a header row plus data")
        header = [str(c) for c in payload[0]]
        needed = {"SAEMHI_PT", "SAEMHI_LB90", "SAEMHI_UB90", "time", "state"}
        if not needed <= set(header):
            raise SourceError(f"census_saipe/{ref.key}: columns changed: {header}")
        records = []
        for row in payload[1:]:
            record = dict(zip(header, row, strict=False))
            if record["SAEMHI_PT"] in (None, ""):
                continue
            point, low, high = (
                float(str(record[k])) for k in ("SAEMHI_PT", "SAEMHI_LB90", "SAEMHI_UB90")
            )
            if not (0 < low <= point <= high):
                raise SourceError(f"census_saipe/{ref.key}: interval does not hold point")
            records.append(
                {
                    "geoid": str(record["state"]) + str(record.get("county") or ""),
                    "year": int(str(record["time"])),
                    "name": record.get("NAME"),
                    "median_hh_income": point,
                    "lower_90": low,
                    "upper_90": high,
                }
            )
        return records
