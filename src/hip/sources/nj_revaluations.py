"""NJ revaluations and reassessments: which towns brought assessments back to market,
and for which tax year (Milestone 36).

The Division of Taxation publishes, each year, the taxing districts "verified for
compliance with N.J.A.C. 18:12A-1.14(g)" and recognized in that year's Director's Table
of Equalized Valuations "for implementation of a Revaluation or Reassessment": one PDF a
year, 2017 to 2026 on 2026-10-01, each line a CD code, a county and a municipality. Older
years are not published (2008-2016 answer 404; a 2011 list once indexed is gone).

Why a source of its own rather than an inference from the Director's Ratio, which the
platform already holds: the ratio rises toward 100% whenever prices fall, not only after
a revaluation — Absecon's sat above 100% from 2010 to 2013 with no revaluation, because
sale prices fell below assessments — so a date read off it would be a guess. These lists
are the state's own record (ARCHITECTURE #287).

Keyed on the CD code, so the towns resolve through `region_identifiers` with no name
matching. The PDF's text is read by `land_pdf`; what the lines mean is this adapter's.
"""

from __future__ import annotations

import re
from datetime import date
from difflib import SequenceMatcher
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www.nj.gov/treasury/taxation/pdf/lpt/revaluation"

# The oldest list the Division publishes, and the newest known when this was written.
SERIES_START = 2017
NEWEST_FLOOR = 2026

# New Jersey's 21 counties, in CD-code order. A line is a town only if the words after
# its code are close to one of these, which is what tells "2004 Union Elizabeth City"
# (Union County's Elizabeth) from a page heading such as "2024 DIRECTOR'S TABLE ...".
COUNTIES = (
    "Atlantic", "Bergen", "Burlington", "Camden", "Cape May", "Cumberland", "Essex",
    "Gloucester", "Hudson", "Hunterdon", "Mercer", "Middlesex", "Monmouth", "Morris",
    "Ocean", "Passaic", "Salem", "Somerset", "Sussex", "Union", "Warren",
)  # fmt: skip

# A CD code, then the rest of the line: the county and the municipality, as printed.
_LINE = re.compile(r"^\s*(?P<cd>\d{4})\s+(?P<rest>\S.*?)\s*$")


def _printed_county(rest: str) -> tuple[str, str] | None:
    """The county a line prints and the municipality after it, matched loosely.

    The lists are typed by hand: 2025's prints Seaside Heights under "Ocena". A county
    is recognized when the line's first one or two words are close to its name, so a
    typo is still read; a heading such as "2025 Approved ..." or "2024 DIRECTOR'S ..."
    is close to none and is not a town.
    """
    words = rest.split()
    for width in (2, 1):
        if len(words) <= width:
            continue
        printed = " ".join(words[:width])

        def closeness(county: str, printed: str = printed) -> float:
            return SequenceMatcher(None, printed.lower(), county.lower()).ratio()

        best = max(COUNTIES, key=closeness)
        if closeness(best) >= 0.75:
            return best, " ".join(words[width:])
    return None


def towns(text: str, ref: ReleaseRef) -> list[dict[str, object]]:
    """Every town a list's text names, with its CD code.

    A CD code's first two digits are the county's number, 01 to 21 alphabetically, and
    the county is taken from it. A line whose code and printed county disagree is
    refused: it means the layout moved, and a silently misread list would date the
    wrong town's revaluation.
    """
    rows: list[dict[str, object]] = []
    for line in text.splitlines():
        match = _LINE.match(line)
        if not match:
            continue
        found = _printed_county(match["rest"])
        if found is None:
            continue
        printed, municipality = found
        number = int(match["cd"][:2])
        if not 1 <= number <= len(COUNTIES) or COUNTIES[number - 1] != printed:
            raise ValueError(
                f"nj_revaluations/{ref.key}: CD code {match['cd']} is not in {printed} "
                f"County; the list's layout has changed"
            )
        rows.append(
            {
                "cd_code": match["cd"],
                "county": printed,
                "municipality": municipality,
                "tax_year": int(ref.vintage),
            }
        )
    return rows


class NjRevaluationsAdapter(SourceAdapter):
    """One release per year's approval list."""

    source_id: ClassVar[str] = "nj_revaluations"
    default_vintage: ClassVar[str] = str(NEWEST_FLOOR)
    landing_format: ClassVar[str] = "pdf"

    @property
    def latest(self) -> int:
        return int(self.newest) if self.newest else NEWEST_FLOOR

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        years = [int(vintage)] if vintage else range(SERIES_START, self.latest + 1)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="approved",
                vintage=str(year),
                url=f"{BASE_URL}/{year}RevalList.pdf",
            )
            for year in years
        ]

    def discover(self, today: date) -> Discovery:
        """The newest year's list, probed forward; the Division posts it before the
        tax year it names."""

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(f"{BASE_URL}/{year}RevalList.pdf")

        year, published, reached = self._probe_forward(self.latest, exists)
        return self._discovered(str(year), reached=reached, published=published)

    @classmethod
    def pdf_records(cls, text: str, ref: ReleaseRef) -> list[dict[str, object]]:
        """The towns a list names. Empty is an error: every year approves some."""
        rows = towns(text, ref)
        if not rows:
            raise ValueError(f"nj_revaluations/{ref.key}: no towns read from the list")
        return rows
