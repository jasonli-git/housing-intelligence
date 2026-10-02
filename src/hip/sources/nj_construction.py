"""NJ Construction Reporter: homes finished and homes demolished, per town and year
(Milestone 39).

The Department of Community Affairs collects, every month, what each town's construction
official reports: building permits, certificates of occupancy — a building complete and
ready to live in — and demolition permits. Its yearly summaries give, per municipality,
the housing units certified and the dwelling units lost to demolition, each as a total
and split into one- and two-family, multifamily and mixed-use. Permits are already held
from the Census Bureau (`census_permits`); this source adds the two ends of the pipeline
permits cannot see: what got built, and what came down.

**What the files are.** One legacy `.xls` workbook per year and measure, 2014 to 2024 on
2026-10-02, at `<year>yearly/` with names that changed in 2015 (`certs_2014.xls`,
`certs_15.xls`). A year's summary posts around the following July; 2025's had not by
2026-10-02, so 2025 is read from December's monthly report, whose right-hand block is the
year to date. That release's vintage is `2025-ytd`, and it is preliminary: the 2024
yearly file came in 0.5% above December 2024's year to date, with 19 towns changed.
Monthly reports stop at January 2026 while DCA overhauls the program (its own notice).

**Missing is not zero.** Only towns whose officials reported appear: 527 of 564 in 2024's
certificates, 465 in its demolitions. A town absent from a year's file has no observation
that year, never a zero, and county and state totals say how many towns they sum.

Keyed on the state's CD code, so towns resolve through `region_identifiers` with no name
matching. The workbook's cells are read by `land_xls`; what the rows mean is this
adapter's. Terms: New Jersey's legal statement, as for the other NJ sources.

The server answers a missing file with HTTP 200 and an HTML page, so a probe checks the
first bytes for a workbook rather than trusting the status.
"""

from __future__ import annotations

import re
from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www.nj.gov/dca/codes/reporter"

# Each yearly summary as DCA's pages link it on 2026-10-02 (`co.shtml`,
# `demo_permits.shtml`): the names changed shape in 2015, so they are listed.
CERTIFIED: dict[int, str] = {
    2014: "2014yearly/certs_2014.xls",
    **{y: f"{y}yearly/certs_{y % 100:02d}.xls" for y in range(2015, 2025)},
}
DEMOLISHED: dict[int, str] = {
    2014: "2014yearly/demos_2014.xls",
    **{y: f"{y}yearly/demo_{y % 100:02d}.xls" for y in range(2015, 2025)},
}
# A year with no yearly summary yet, read from December's monthly report.
YEAR_TO_DATE: dict[int, dict[str, str]] = {
    2025: {
        "certified": "2025m/certs_12_2025.xls",
        "demolished": "2025m/demo_12_2025.xls",
    },
}
LAYERS = {"certified": CERTIFIED, "demolished": DEMOLISHED}

# An OLE2 compound file, which every legacy `.xls` is.
_XLS_MAGIC = bytes.fromhex("d0cf11e0a1b11ae1")


def _number(cell: str) -> float | None:
    """A count cell: a number, or None where the official reported no figure."""
    text = cell.strip().replace(",", "")
    if not text:
        return None
    return float(text)


def rows_of(cells: list[list[str]], ref: ReleaseRef) -> list[dict[str, object]]:
    """Every town a summary lists, with its total and the three building types.

    A yearly summary has one block: CD code, municipality, total, one- and two-family,
    multifamily, mixed-use. December's monthly report has two side by side, the month
    and the year to date; a `-ytd` vintage reads the second, found by its title.
    """
    ytd = ref.vintage.endswith("-ytd")
    start = 7 if ytd else 0
    if ytd:
        # The year-to-date block is titled `certs2` or `demo2` (the month is `1`); the
        # two blocks list different towns, so they are not matched row by row.
        title = cells[0][start] if cells and len(cells[0]) > start else ""
        if not re.search(r"(certs|demo)2", title.lower()):
            raise ValueError(
                f"nj_construction/{ref.key}: no year-to-date block where expected "
                f"({title!r}); the report's layout has changed"
            )
    rows: list[dict[str, object]] = []
    for row in cells:
        if len(row) < start + 6:
            continue
        code = row[start].strip()
        if len(code) != 4 or not code.isdigit():
            continue
        # A merged town's old code points to its successor ("See Princeton (1114)"):
        # it reports nothing of its own. Any other text where a count belongs is
        # refused by `_number`.
        if row[start + 2].strip().lower().startswith("see "):
            continue
        total = _number(row[start + 2])
        if total is None:
            continue
        rows.append(
            {
                "cd_code": code,
                "municipality": row[start + 1].strip(),
                "total": total,
                "one_two_family": _number(row[start + 3]),
                "multifamily": _number(row[start + 4]),
                "mixed_use": _number(row[start + 5]),
                "year": int(ref.vintage[:4]),
                "preliminary": ytd,
            }
        )
    # Every year lists hundreds of towns; a short read means the layout moved.
    if len(rows) < 300:
        raise ValueError(
            f"nj_construction/{ref.key}: read {len(rows)} towns; the layout has changed"
        )
    return rows


class NjConstructionAdapter(SourceAdapter):
    """One release per measure per year: `certified` and `demolished`."""

    source_id: ClassVar[str] = "nj_construction"
    default_vintage: ClassVar[str] = "2025-ytd"
    landing_format: ClassVar[str] = "xls"

    @property
    def latest(self) -> int:
        """The newest yearly summary: discovery's answer, never below the listed ones."""
        found = int(self.newest) if self.newest and self.newest.isdigit() else 0
        return max(found, max(CERTIFIED))

    def _published(self, layer: str) -> dict[int, str]:
        """The listed summaries, and any newer one discovery found, named as 2015-2024
        were, so a posted 2025 summary is fetched without an edit here."""
        listed = LAYERS[layer]
        stem = "certs" if layer == "certified" else "demo"
        newer = {
            y: f"{y}yearly/{stem}_{y % 100:02d}.xls"
            for y in range(max(listed) + 1, self.latest + 1)
        }
        return {**listed, **newer}

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        refs: list[ReleaseRef] = []
        for layer in LAYERS:
            published = self._published(layer)
            for year, path in sorted(published.items()):
                if vintage in (None, str(year)):
                    refs.append(self._ref(layer, str(year), path))
            for year, paths in sorted(YEAR_TO_DATE.items()):
                # A year whose summary is listed above is read from the summary.
                if year in published:
                    continue
                if vintage in (None, f"{year}-ytd"):
                    refs.append(self._ref(layer, f"{year}-ytd", paths[layer]))
        return refs

    def _ref(self, layer: str, vintage: str, path: str) -> ReleaseRef:
        return ReleaseRef(
            source_id=self.source_id,
            layer=layer,
            vintage=vintage,
            url=f"{BASE_URL}/{path}",
        )

    def discover(self, today: date) -> Discovery:
        """Whether the next yearly summary of certificates is out, at the name 2015 to
        2024 used. A workbook, not merely a 200: missing files answer with a page."""
        newest = self.latest

        def exists(year: int) -> tuple[bool | None, str | None]:
            response = self._ask(
                f"{BASE_URL}/{year}yearly/certs_{year % 100:02d}.xls", method="GET"
            )
            if response is None:
                return None, None
            if response.is_success and response.content[:8] == _XLS_MAGIC:
                return True, response.headers.get("last-modified")
            if response.is_success or response.status_code in (400, 404, 410):
                return False, None
            return None, None

        year, published, reached = self._probe_forward(newest, exists)
        return self._discovered(str(year), reached=reached, published=published)

    @classmethod
    def xls_records(
        cls, cells: list[list[str]], ref: ReleaseRef
    ) -> list[dict[str, object]]:
        return rows_of(cells, ref)
