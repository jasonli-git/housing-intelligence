"""Mortgages actually made, from the Home Mortgage Disclosure Act (Milestone 48).

Lenders covered by HMDA report every application they act on: its loan type, amount,
rate, costs, loan-to-value, the applicant's income, what was decided, and why a denial
was denied. The CFPB publishes the records each spring for the year before, located by
census tract and modified for privacy (loan amounts rounded to the midpoint of a
$10,000 interval, ages binned, some fields withheld). Information the CFPB creates is in
the public domain; it asks for citation.

Read from the FFIEC's data browser, one file per year filtered to New Jersey (140MB and
370,769 applications for 2025). Its CSV endpoint answers with a redirect to a snapshot
file, which the fetch follows. Five years: enough to show the rise from about 3% to
about 7% without storing the whole decade.

**What HMDA leaves out**, which the page says: lenders below its reporting thresholds,
mostly small banks and credit unions; and credit scores and full underwriting, so a
denial rate is not a measure of who could have qualified.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

API = "https://ffiec.cfpb.gov/v2/data-browser-api/view"

# Years read. The first year the newest is published, the oldest drops out.
YEARS = 5


class HmdaAdapter(SourceAdapter):
    """New Jersey's HMDA records, one release per year."""

    source_id: ClassVar[str] = "ffiec_hmda"
    # The floor: 2025's records were published by 2026-10-07.
    default_vintage: ClassVar[str] = "2025"
    landing_format: ClassVar[str] = "csv"
    # Codes like "1" and tract ids with leading digits stay text; staging casts.
    csv_read_options: ClassVar[str] = ", all_varchar=true"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        newest = int(vintage or self.newest or self.default_vintage)
        years = [newest] if vintage else range(newest - YEARS + 1, newest + 1)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=f"nj_{year}",
                vintage=str(year),
                url=f"{API}/csv?states=NJ&years={year}",
            )
            for year in years
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"hmda_nj_{ref.vintage}.csv"

    def discover(self, today: date) -> Discovery:
        """The newest year the data browser counts New Jersey applications for."""

        def exists(year: int) -> tuple[bool | None, str | None]:
            response = self._ask(f"{API}/aggregations?states=NJ&years={year}")
            if response is None:
                return None, None
            if response.status_code != 200:
                return False, None
            rows = response.json().get("aggregations") or []
            return bool(rows and rows[0].get("count")), None

        start = int(self.newest or self.default_vintage)
        year, published, reached = self._probe_forward(start, exists)
        return self._discovered(str(year), reached=reached, published=published)
