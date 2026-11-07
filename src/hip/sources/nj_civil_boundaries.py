"""When each New Jersey municipality took its present form, from John P. Snyder's The
Story of New Jersey's Civil Boundaries, 1606-1968 (NJ Geological Survey Bulletin 67).

Boroughitis read Wikidata's inception, which for many towns is a settlement date:
Runnemede 1625 where Snyder has its borough formed in 1926, Chatham 1709 for 1897
(review of 2026-11-06). Wikidata records almost no incorporation date apart from it
(1 of 997 New Jersey places carried a start time on its type, 2026-11-06), so this book,
the reference the state's own boundary records and most secondary lists cite, is the
source; Wikidata stays the fallback for a town the book does not name.

The book's chapter III lists every municipality county by county, each heading
("Oaklyn borough", an asterisk for one since gone) followed by dated events, the first of
which made it: "1905 Mar. 13 Formed from Haddon twp." The New Jersey State Library's
scan is read with `pdftotext`, so the text carries the scan's OCR slips ("Avalon
borougb", "19{t3"): a heading is matched loosely, and a year that is not four digits
leaves the town to the fallback rather than guessing.

A town's year is when it became the kind of municipality it is now. "Replaced Riverside
bor." on River Edge borough is a rename, so the year is Riverside's (1894); "Replaced
Eatontown twp." on Eatontown borough is a change of form, so the year is 1926, when the
borough began. The book stops in 1968, so the names given since (Toms River was Dover
township until 1992) are mapped to the names it uses (`RENAMED_SINCE`).
"""

from __future__ import annotations

import re
from datetime import timedelta
from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

# The NJ State Library's scan of the 1969 edition (handle 10929/21587).
PDF_URL = (
    "https://dspace.njstatelib.org/server/api/core/bitstreams/"
    "2c5a6247-e7ee-4ca5-9e9d-7bafa56c4a4d/content"
)

COUNTY_FIPS = {
    "Atlantic": "001",
    "Bergen": "003",
    "Burlington": "005",
    "Camden": "007",
    "Cape May": "009",
    "Cumberland": "011",
    "Essex": "013",
    "Gloucester": "015",
    "Hudson": "017",
    "Hunterdon": "019",
    "Mercer": "021",
    "Middlesex": "023",
    "Monmouth": "025",
    "Morris": "027",
    "Ocean": "029",
    "Passaic": "031",
    "Salem": "033",
    "Somerset": "035",
    "Sussex": "037",
    "Union": "039",
    "Warren": "041",
}

# Today's name -> the name the 1969 book lists, for towns renamed since. Each is a rename
# of the same municipality, so its year carries over.
RENAMED_SINCE: dict[tuple[str, str], str] = {
    ("Bergen", "Elmwood Park borough"): "East Paterson borough",
    ("Passaic", "Woodland Park borough"): "West Paterson borough",
    ("Monmouth", "Lake Como borough"): "South Belmar borough",
    ("Monmouth", "Tinton Falls borough"): "New Shrewsbury borough",
    ("Monmouth", "Aberdeen township"): "Matawan township",
    ("Ocean", "Toms River township"): "Dover township",
    ("Ocean", "Barnegat township"): "Union township",
    ("Morris", "Long Hill township"): "Passaic township",
    ("Middlesex", "Old Bridge township"): "Madison township",
    ("Mercer", "Robbinsville township"): "Washington township",
    # Not renamed, but spelled with a hyphen in the book.
    ("Somerset", "Peapack and Gladstone borough"): "Peapack-Gladstone borough",
}

TYPES = {
    "borough": "borough",
    "township": "township",
    "city": "city",
    "town": "town",
    "village": "village",
}
# OCR slips seen in the scan's headings.
TYPE_SLIPS = {
    "borougb": "borough",
    "boroug": "borough",
    "borongh": "borough",
    "towuship": "township",
    "townsbip": "township",
}
ABBREVIATED = {
    "bor": "borough",
    "twp": "township",
    "city": "city",
    "town": "town",
    "village": "village",
    "vil": "village",
}

_HEAD = re.compile(
    r"^([A-Z][A-Za-z.' -]+?) (" + "|".join([*TYPES, *TYPE_SLIPS]) + r")\b"
    r"(?P<tail>[^A-Za-z]{0,8})$"
)
_COUNTY = re.compile(r"^([A-Z][A-Z ]+?) COUNTY$")
_EVENT = re.compile(r"^(?P<year>\d{4})\b")
_RENAMED = re.compile(r"Replaced (.+?) (bor|twp|city|town|village|vil)\b")


def _norm(name: str) -> str:
    return re.sub(r"[^a-z]", "", name.lower())


def parse_entries(text: str) -> list[dict[str, object]]:
    """Every municipality heading in chapter III with its first dated event."""
    entries: list[dict[str, object]] = []
    county: str | None = None
    current: dict[str, object] | None = None
    started = False
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not started:
            started = line == "ATLANTIC COUNTY"
            if started:
                county = "Atlantic"
            continue
        if "MISCELLANEOUS TABLES" in line:
            break
        county_heading = _COUNTY.match(line)
        if county_heading and county_heading.group(1).title() in COUNTY_FIPS:
            county = county_heading.group(1).title()
            continue
        head = _HEAD.match(line)
        if head and county:
            word = head.group(2)
            current = {
                "county": county,
                "name": head.group(1).strip(),
                "type": TYPES.get(word) or TYPE_SLIPS[word],
                "defunct": "*" in head.group("tail"),
                "year": None,
                "event": None,
            }
            entries.append(current)
            continue
        if current is not None and current["event"] is None:
            event = _EVENT.match(line)
            if event:
                year = int(event.group("year"))
                current["year"] = year if 1600 <= year <= 1968 else None
                current["event"] = line[:120]
    return entries


def resolve(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    """Each entry's year as a municipality of its type, following renames back."""
    index: dict[tuple[object, str, object], dict[str, object]] = {}
    for e in entries:
        index.setdefault((e["county"], _norm(str(e["name"])), e["type"]), e)

    def year_of(e: dict[str, object], depth: int = 0) -> object:
        renamed = _RENAMED.search(str(e["event"] or ""))
        if renamed and ABBREVIATED[renamed.group(2)] == e["type"] and depth < 5:
            before = index.get((e["county"], _norm(renamed.group(1)), e["type"]))
            if before is not None:
                return year_of(before, depth + 1)
        return e["year"]

    rows = []
    for e in entries:
        rows.append(
            {
                "county_fips": "34" + COUNTY_FIPS[str(e["county"])],
                "county": e["county"],
                "name": f"{e['name']} {e['type']}",
                "defunct": e["defunct"],
                "year": year_of(e),
                "event": e["event"],
            }
        )
    # Today's names for towns renamed since 1968, each a copy of its 1969 entry.
    by_name = {(r["county"], _norm(str(r["name"]))): r for r in rows if not r["defunct"]}
    for (county, today), then in RENAMED_SINCE.items():
        found = by_name.get((county, _norm(then)))
        if found is not None:
            event = f"(as {then}) {found['event']}"
            rows.append({**found, "name": today, "event": event})
    return rows


class NjCivilBoundariesAdapter(SourceAdapter):
    source_id: ClassVar[str] = "nj_civil_boundaries"
    default_vintage: ClassVar[str] = "1969"
    landing_format: ClassVar[str] = "pdf"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    # A book: the scan does not change, so a year between checks is plenty.
    revalidate_after: ClassVar[timedelta] = timedelta(days=365)
    headers: dict[str, str] = {  # noqa: RUF012 - the base class's instance attribute
        "User-Agent": "housing-intelligence/0.2 (public data research; "
        "https://github.com/jasonli-git/housing-intelligence)",
    }

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="municipalities",
                vintage=vintage or self.default_vintage,
                url=PDF_URL,
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "bulletin67.pdf"

    @classmethod
    def pdf_records(cls, text: str, ref: ReleaseRef) -> list[dict[str, object]]:
        return resolve(parse_entries(text))
