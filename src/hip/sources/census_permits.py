"""Census Building Permits Survey — residential units authorized, by county and by place.

The annual county files live at a path encoding the last month of coverage:
`co{YY}{MM}y.txt`, so the 2024 annual file is `co2412y.txt`. There is no "latest"
alias, so the newest year is found by asking: `discover` probes for the next year's
county and place files and moves forward only when both exist (Milestone 26). The 2025
files appeared on 2026-02-20; the platform went on requesting 2024 until 2026-09-23.

**Place-level files** (Milestone 21) are published per Census region rather than per
state: `Place/Northeast Region/ne{YY}12y.txt` holds every permit-issuing place in the
nine Northeast states. In New Jersey every such place is a municipality, and the file
carries its county and county-subdivision FIPS codes, so a row becomes a municipal GEOID
exactly — no name matching, which the source list had assumed it would need.

The format is genuinely awkward: two header rows, and FIPS split across columns that
must be concatenated to make a GEOID. Both are handled in dbt, not here.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from hip.config import ConfigError, fips_for
from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www2.census.gov/econ/bps/County"
PLACE_URL = "https://www2.census.gov/econ/bps/Place"

# How many annual files to request. Ten years is enough for the change metrics at
# Milestone 4 without pulling the entire 1990s.
YEARS = 10

# Census region -> (folder, file prefix, state FIPS codes). Only the Northeast is listed:
# it is the region whose file has been read (the 2024 file holds exactly these nine
# states), and a guessed folder for another would fail as a 404 inside a run. A state
# outside it is refused at `refs()` with the fix named.
PLACE_REGIONS: dict[str, tuple[str, str, frozenset[str]]] = {
    "northeast": (
        "Northeast Region",
        "ne",
        frozenset({"09", "23", "25", "33", "34", "36", "42", "44", "50"}),
    ),
}


def _place_region(state: str) -> tuple[str, str]:
    code = fips_for(state)
    for folder, prefix, members in PLACE_REGIONS.values():
        if code in members:
            return folder, prefix
    raise ConfigError(
        f"census_permits: no place-level region file is mapped for '{state}'. Add its "
        "Census region to PLACE_REGIONS after checking the folder on www2.census.gov."
    )


class PermitsAdapter(SourceAdapter):
    """New privately-owned housing units authorized, all structure sizes."""

    source_id: ClassVar[str] = "census_permits"
    # The floor: the newest year known to exist when this was written. Discovery moves
    # forward from the recorded year, never below this.
    default_vintage: ClassVar[str] = "2024"
    landing_format: ClassVar[str] = "csv"
    # Two header rows ("Survey,FIPS,FIPS,..." then "Date,State,County,...") followed by
    # a whitespace-only line. Skipping only the two headers leaves that blank line as
    # the first row, and DuckDB then sniffs a single unusable column from it. Columns
    # are positional afterwards; dbt names them. See stg_census_permits. The place files
    # share the layout, with more columns.
    csv_read_options: ClassVar[str] = ", header=false, skip=3"

    def __init__(self, states: list[str]) -> None:
        self.states = states

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """One county ref per year, and one place ref per year per region, newest first.

        Every year must exist: a missing file fails its fetch and stops the run, so the
        starting year is the one discovery recorded — or the floor before it has run —
        rather than guessed from the date.
        """
        latest = int(vintage or self.newest or self.default_vintage)
        years = range(latest, latest - YEARS, -1)
        regions = sorted({_place_region(state) for state in self.states})
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer=str(year),
                vintage=str(year),
                url=f"{BASE_URL}/co{str(year)[2:]}12y.txt",
            )
            for year in years
        ]
        refs += [
            ReleaseRef(
                source_id=self.source_id,
                layer="place",
                vintage=str(year),
                scope=prefix,
                url=(
                    f"{PLACE_URL}/{folder.replace(' ', '%20')}/"
                    f"{prefix}{str(year)[2:]}12y.txt"
                ),
            )
            for year in years
            for folder, prefix in regions
        ]
        return refs

    def discover(self, today: date) -> Discovery:
        """The newest year whose county file and every place file exist.

        Both, because a year is only usable whole: the county file alone would load
        county permits for a year whose municipal permits are missing, and the two are
        summed against each other.
        """
        regions = sorted({_place_region(state) for state in self.states})

        def exists(year: int) -> tuple[bool | None, str | None]:
            found, modified = self._probe(f"{BASE_URL}/co{str(year)[2:]}12y.txt")
            for folder, prefix in regions:
                if not found:
                    break
                folder_path = folder.replace(" ", "%20")
                found, _ = self._probe(
                    f"{PLACE_URL}/{folder_path}/{prefix}{str(year)[2:]}12y.txt"
                )
            return found, modified

        start = int(self.newest or self.default_vintage)
        year, published, reached = self._probe_forward(start, exists)
        return self._discovered(str(year), reached=reached, published=published)
