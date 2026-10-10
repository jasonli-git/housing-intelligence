"""FHFA House Price Index.

`hpi_master.csv` is FHFA's combined file: every index flavor, frequency, and geography
level in one 17MB CSV. State quarterly indexes and the national monthly purchase-only
series are selected downstream in dbt rather than here, because landing stays dumb.

County-level HPI is a separate annual "developmental" workbook, read by
`HpiCountyAdapter` below since Milestone 52.
"""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

MASTER_URL = "https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv"


class HpiAdapter(SourceAdapter):
    """Repeat-sales index of conforming mortgage transactions."""

    source_id: ClassVar[str] = "fhfa_hpi"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "csv"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="master",
                vintage=vintage or self.default_vintage,
                url=MASTER_URL,
            )
        ]


COUNTY_URL = "https://www.fhfa.gov/hpi/download/annual/hpi_at_county.xlsx"


class HpiCountyAdapter(SourceAdapter):
    """FHFA's annual all-transactions index for every county, from 1975 (Milestone 52,
    ARCHITECTURE #348).

    Published in a separate "developmental" workbook rather than `hpi_master.csv`; the
    path this module's docstring found dead in August answered on 2026-09-23 under the
    name `hpi_at_county.xlsx` (#210). The column used is FHFA's own index with a base
    of 100 in the county's first recorded year, so it compares a county with itself,
    never with another: levels are not comparable across counties, only changes.
    FHFA marks a year it could not estimate with "."; that year is dropped, not zeroed.
    """

    source_id: ClassVar[str] = "fhfa_hpi_county"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "xlsx_records"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="county",
                vintage=vintage or self.default_vintage,
                url=COUNTY_URL,
            )
        ]

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        from hip.sources.xlsx import rows, sheets

        names = sheets(path)
        if names != ["county"]:
            raise SourceError(f"fhfa_hpi_county: sheets changed: {names}")
        header = {"A": "State", "C": "FIPS code", "D": "Year", "F": "HPI"}
        seen_header = False
        records: list[dict[str, object]] = []
        for _, cells in rows(path, "county"):
            if not seen_header:
                seen_header = all(cells.get(k) == v for k, v in header.items())
                continue
            fips, year, index = cells.get("C", ""), cells.get("D", ""), cells.get("F", "")
            if not (len(fips) == 5 and fips.isdigit() and year.isdigit()):
                continue
            if index in ("", "."):
                continue
            records.append(
                {
                    "state": cells.get("A"),
                    "geoid": fips,
                    "year": int(year),
                    "hpi": float(index),
                    "annual_change": (
                        float(cells["E"])
                        if cells.get("E") not in (None, "", ".")
                        else None
                    ),
                }
            )
        if not seen_header or not records:
            raise SourceError("fhfa_hpi_county: header or rows not found")
        return records
