"""Where New Jersey's residents work: the Census Bureau's LODES (Milestone 45).

LEHD Origin-Destination Employment Statistics pair every job covered by unemployment
insurance with the census block its holder lives in and the block it is in. Version 8
is on 2020 blocks, the same blocks the flood and transit shares weigh homes by.

**Which files.** A state's `od_main` file holds the jobs in that state held by its own
residents; its `od_aux` file holds the jobs in it held by residents of other states. So
New Jersey's residents are New Jersey's main file plus every *other* state's auxiliary
file, read for the rows whose home block is in New Jersey (FIPS 34). Reading only New
York's and Pennsylvania's would leave the denominator short by every New Jerseyan who
works in Delaware, Connecticut or further; the auxiliary files are 0.6 to 5.6MB each,
so all of them are read. `JT00` is all jobs, so a person with two jobs counts twice.

New Jersey's crosswalk names each of its blocks' county subdivision and ZCTA, so a
job's home and workplace in the state are placed without a spatial join. A workplace
out of state is placed by its block's first five digits, its county.

**What the files leave out**, which the page says: the self-employed and others outside
unemployment insurance; federal civilian jobs are in, military jobs are not. Counts carry
deliberate noise for privacy, so a small place's figure is approximate. A workplace is
where the employer reports the job, which for a firm with many sites can be its office.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://lehd.ces.census.gov/data/lodes/LODES8"

# Every state and DC with a LODES file, by postal code.
_CODES = (
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO "
    "MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
)
STATES = tuple(_CODES.split())

# States a LODES year has no file for, from each release's notes: their workers'
# records were not supplied. A New Jerseyan working in one is not counted, and the page
# says which. A year not listed fetches every state, and a missing file fails the fetch
# loudly rather than shrinking the denominator unseen: add the year here.
MISSING: dict[str, tuple[str, ...]] = {
    "2022": ("AK", "MI", "MS"),
    "2023": ("AK", "MI"),
}


class LodesAdapter(SourceAdapter):
    """New Jersey's residents' jobs by home and workplace block, all jobs (`JT00`)."""

    source_id: ClassVar[str] = "census_lodes"
    # The floor: LODES 8.4, released 2025-12-18, adds 2023.
    default_vintage: ClassVar[str] = "2023"
    landing_format: ClassVar[str] = "csv"
    # Block codes are fifteen digits with leading zeros (Alabama is 01), which a typed
    # read would make integers; staging casts the counts.
    csv_read_options: ClassVar[str] = ", all_varchar=true"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.newest or self.default_vintage
        missing = MISSING.get(year, ())
        refs = [
            ReleaseRef(
                source_id=self.source_id,
                layer="od_main",
                vintage=year,
                url=f"{BASE_URL}/nj/od/nj_od_main_JT00_{year}.csv.gz",
            ),
            ReleaseRef(
                source_id=self.source_id,
                layer="xwalk",
                vintage=year,
                url=f"{BASE_URL}/nj/nj_xwalk.csv.gz",
            ),
        ]
        refs += [
            ReleaseRef(
                source_id=self.source_id,
                # A layer per state rather than a scope: the warehouse keys a release by
                # (source, layer, vintage), and fifty scopes of one layer would collide.
                layer=f"od_aux_{state}",
                vintage=year,
                url=f"{BASE_URL}/{state.lower()}/od/{state.lower()}_od_aux_JT00_{year}.csv.gz",
            )
            for state in STATES
            if state != "NJ" and state not in missing
        ]
        return refs

    def discover(self, today: date) -> Discovery:
        """The newest year New Jersey's main file exists for."""

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(f"{BASE_URL}/nj/od/nj_od_main_JT00_{year}.csv.gz")

        start = int(self.newest or self.default_vintage)
        year, published, reached = self._probe_forward(start, exists)
        return self._discovered(str(year), reached=reached, published=published)
