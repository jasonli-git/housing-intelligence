"""Daily county temperatures since 1951, from NOAA's nClimGrid-Daily (the stories).

NCEI grids each day's station readings across the country at about 5 km and publishes
the grid averaged over every county, one CSV a month for the whole country (about 9 MB)
in its open-data bucket on AWS. Acquisition reads the summer months, May to September,
of each year and keeps New Jersey's 21 counties' rows: a year's release is about 50 KB,
where the national files it came from are 45 MB. Past years are final ("scaled" to the
monthly product), so each is one pinned release, fetched once; the year in progress is
left out until it is complete.

Daily maximum temperature is in degrees Celsius, as published. A county's figure is the
average over its area, so a hot paved block and a shaded one are averaged together;
that is the resolution the story is told at. Public domain (U.S. Government work).
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar

import httpx

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

BUCKET = "https://noaa-nclimgrid-daily-pds.s3.amazonaws.com/EpiNOAA/v1-0-0/csv/cty"
FIRST_YEAR = 1951
SUMMER = (5, 6, 7, 8, 9)


class NClimGridAdapter(SourceAdapter):
    source_id: ClassVar[str] = "noaa_nclimgrid"
    default_vintage: ClassVar[str] = "scaled"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        last = datetime.now(UTC).year - 1
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="tmax",
                vintage=str(year),
                url=f"{BUCKET}/{year}05-scaled.csv",
            )
            for year in range(FIRST_YEAR, last + 1)
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"nj-summer-{ref.vintage}.csv"

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        """Each summer month's national file, streamed, keeping New Jersey's rows."""
        header: str | None = None
        kept: list[str] = []
        with httpx.Client(headers=self.headers, timeout=120, follow_redirects=True) as c:
            for month in SUMMER:
                url = f"{BUCKET}/{ref.vintage}{month:02d}-scaled.csv"
                with c.stream("GET", url) as response:
                    if response.status_code == 404:
                        raise SourceError(f"{ref.source_id}: {url} is not published")
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if header is None:
                            header = line
                        elif line.startswith("cty,34"):
                            kept.append(line)
        if header is None or not kept:
            raise SourceError(f"{ref.source_id}/{ref.vintage}: no New Jersey rows")
        destination.write_text(header + "\n" + "\n".join(kept) + "\n")
        self._last_validators = {}
