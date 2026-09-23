"""Bureau of Labor Statistics — Local Area Unemployment Statistics.

Uses the public API, one GET per county series. The bulk flat files at
`download.bls.gov` would be the obvious choice and return HTTP 403 to programmatic
clients regardless of User-Agent, so the API is the only open door.

With `BLS_API_KEY` set the adapter uses **v2**: 20 years of history and 500 queries per
day. Without it, v2 is unavailable and v1 caps history at three years and 25 queries per
day — enough for New Jersey's 21 counties exactly once. Three years is too short for the
change metrics at Milestone 4, so the key is close to required rather than optional, and
the adapter says so when it falls back.
"""

from __future__ import annotations

import os
from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_V1 = "https://api.bls.gov/publicAPI/v1/timeseries/data"
BASE_V2 = "https://api.bls.gov/publicAPI/v2/timeseries/data"

# BLS caps a single v2 request at 20 years.
HISTORY_YEARS = 20

# LAUS series id: LAU + area type (CN = county) + a 13-character area code + a
# 2-character measure. The area code is the 5-digit FIPS right-padded with zeros, so a
# county is FIPS + 8 zeros — getting that padding wrong returns HTTP 200 with
# "Series does not exist" and an empty data array, not an error status.
MEASURE_UNEMPLOYMENT_RATE = "03"
_AREA_CODE_PAD = 8


def series_id(county_fips: str) -> str:
    return f"LAUCN{county_fips}{'0' * _AREA_CODE_PAD}{MEASURE_UNEMPLOYMENT_RATE}"


class BlsAdapter(SourceAdapter):
    """County unemployment rate, monthly."""

    source_id: ClassVar[str] = "bls"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "json"

    def __init__(self, county_fips: list[str], *, end_year: int) -> None:
        """``county_fips`` comes from the loaded regions, never hard-coded.

        ``end_year`` is the floor — a year known to have data — passed in rather than
        read from the clock, so tests are not time-dependent. The year actually fetched
        through is `latest`: the discovered one once acquisition has asked.
        """
        self.county_fips = county_fips
        self.end_year = end_year

    @property
    def latest(self) -> int:
        """The newest year to request: discovered, else the floor."""
        return int(self.newest) if self.newest else self.end_year

    def discover(self, today: date) -> Discovery:
        """The newest year BLS has data for, asked of the first county's series.

        Without this the request stopped at `BLS_END_YEAR`: on 2026-09-23 BLS held
        county unemployment through July 2026 and the platform asked for none of it.
        One query of the 500 a day a key allows.
        """
        key = os.environ.get("BLS_API_KEY")
        if not key:
            # v1 without a key covers three years ending now; there is no range to
            # choose, so nothing to discover.
            return self._discovered(str(self.latest), reached=True)
        response = self._ask(
            f"{BASE_V2}/{series_id(self.county_fips[0])}?registrationkey={key}"
            f"&startyear={today.year - 1}&endyear={today.year}"
        )
        if response is None or not response.is_success:
            return self._discovered(str(self.latest), reached=False)
        try:
            payload = response.json()
            years = {
                int(point["year"])
                for series in payload["Results"]["series"]
                for point in series["data"]
            }
        except (ValueError, KeyError, TypeError):
            return self._discovered(str(self.latest), reached=False)
        newest = max(years | {self.latest})
        return self._discovered(str(newest), reached=True)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        key = os.environ.get("BLS_API_KEY")
        base = BASE_V2 if key else BASE_V1
        query = ""
        if key:
            query = (
                f"?registrationkey={key}"
                f"&startyear={self.latest - HISTORY_YEARS + 1}"
                f"&endyear={self.latest}"
            )
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=fips,
                vintage=vintage or self.default_vintage,
                url=f"{base}/{series_id(fips)}{query}",
            )
            for fips in self.county_fips
        ]

    @classmethod
    def to_records(cls, payload: object, ref: ReleaseRef) -> list[dict[str, object]]:
        """BLS nests data two levels down, under Results.series[].data[]."""
        if not isinstance(payload, dict) or payload.get("status") != "REQUEST_SUCCEEDED":
            status = payload.get("status") if isinstance(payload, dict) else "?"
            raise ValueError(f"bls/{ref.key}: request not successful ({status})")
        results = payload.get("Results", {})
        assert isinstance(results, dict)
        # BLS reports an unknown series as a successful request carrying an empty
        # series and an explanatory `message`. Surfacing that beats "no rows".
        if messages := payload.get("message"):
            raise ValueError(f"bls/{ref.key}: {'; '.join(messages)}")
        rows: list[dict[str, object]] = []
        for series in results.get("series", []):
            for point in series.get("data", []):
                # M13 is BLS's annual-average pseudo-month; not a real observation.
                if point.get("period") == "M13":
                    continue
                rows.append(
                    {
                        "county_fips": ref.layer,
                        "year": point["year"],
                        "period": point["period"],
                        "value": point["value"],
                    }
                )
        return rows
