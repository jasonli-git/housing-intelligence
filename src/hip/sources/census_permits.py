"""Census Building Permits Survey — residential units authorized, by county.

The annual county files live at a path encoding the last month of coverage:
`co{YY}{MM}y.txt`, so the 2024 annual file is `co2412y.txt`. There is no "latest"
alias, so the adapter walks back from a starting year until it finds files that exist —
the current year's file does not appear until well after the year ends.

The format is genuinely awkward: two header rows, and FIPS split across two columns that
must be concatenated to make a county GEOID. Both are handled in dbt, not here.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://www2.census.gov/econ/bps/County"

# How many annual files to request. Ten years is enough for the change metrics at
# Milestone 4 without pulling the entire 1990s.
YEARS = 10


class PermitsAdapter(SourceAdapter):
    """New privately-owned housing units authorized, all structure sizes."""

    source_id: ClassVar[str] = "census_permits"
    default_vintage: ClassVar[str] = "2024"
    landing_format: ClassVar[str] = "csv"
    # Two header rows ("Survey,FIPS,FIPS,..." then "Date,State,County,...") followed by
    # a whitespace-only line. Skipping only the two headers leaves that blank line as
    # the first row, and DuckDB then sniffs a single unusable column from it. Columns
    # are positional afterwards; dbt names them. See stg_census_permits.
    csv_read_options: ClassVar[str] = ", header=false, skip=3"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """One ref per year, newest first.

        A year whose file does not exist yet fails its own fetch and leaves the others
        alone — `fetch_all` processes refs independently, which is why a missing latest
        year is not a pipeline failure.
        """
        latest = int(vintage or self.default_vintage)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=str(year),
                vintage=str(year),
                url=f"{BASE_URL}/co{str(year)[2:]}12y.txt",
            )
            for year in range(latest, latest - YEARS, -1)
        ]
