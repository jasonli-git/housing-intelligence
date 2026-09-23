"""NJ General and Effective Tax Rates, and the Director's Ratio behind them.

Three sheets across two workbooks the Division of Taxation publishes, all keyed on the
NJ CD code and all covering every municipality in the state:

| Layer            | Workbook          | Sheet                          | Years     |
|------------------|-------------------|--------------------------------|-----------|
| `general`        | `GTRhistory.xlsx` | `General Tax Rates 1997-<Y>`   | 1997-2025 |
| `effective`      | `GTRhistory.xlsx` | `Effective Tax Rates 1997-<Y>` | 1997-2025 |
| `director_ratio` | `DirRatios.xlsx`  | `Director's Ratio History`     | 2002-2025 |

**Why the published effective rate rather than one computed here.** A general tax rate
applies to *assessed* value, and New Jersey municipalities assess at their own ratios —
so a general rate is not comparable across municipalities, which is the whole reason
ARCHITECTURE #141 rejected an effective rate for lack of "sale prices or equalization
ratios the warehouse does not hold". The effective rate restates the levy against
*market* value and is comparable. The Division computes and publishes it, so the
platform ingests the state's figure instead of deriving its own from a ratio and a
rate — the owner's decision on 2026-09-19. The Director's Ratio is landed beside it as
the check on that figure, not as its input.

That check is worth running because the arithmetic does not close on the obvious
pairing. Absecon 2025: a general rate of 3.517 against the 2024 ratio of 68.62 gives
2.4134, and the published effective rate is 2.4103 — 0.13% apart. Atlantic City on the
same pairing is 1.9% apart. Which year's ratio the Division applies is therefore an
empirical question `stg_nj_tax_rates` answers rather than one this module assumes.

**567 districts, not 564.** Three are dissolved: Pine Valley Borough (0429) merged into
Pine Hill in 2022, and Princeton Borough (1109) and Princeton Township (1110) merged
into Princeton in 2013. Each is present for its historical years and null from its
merger forward. They are not regions and must not be counted as match failures.

The sheet names in `GTRhistory.xlsx` carry the end year, and since Milestone 26 that is
how a new edition is found: the workbook is republished in place under the same name, so
`discover` reads the year out of its sheet names and the vintage moves with it. A stale
year still fails loudly on read — DuckDB's error names the sheet that does exist.
"""

from __future__ import annotations

import io
import re
import zipfile
from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www.nj.gov/treasury/taxation/lpt"

# The first year the rate workbook covers. The Director's Ratio workbook starts at 2002;
# the staging model takes each sheet's own span from its header row rather than assuming
# a shared one.
SERIES_START = 1997

# Both workbooks put three identifier columns before the year columns, under a header
# block that is four rows deep in the rate sheets and two in the ratio sheet. The
# staging model finds the header row by looking for the one whose year cells parse,
# rather than hard-coding a skip that would move with a reformat.
#
# A generous range is mandatory, not defensive. `read_xlsx` without one returned 3 rows
# and 29 columns for the effective-rate sheet on 2026-09-19 — it trimmed the leading
# identifier columns and every data row, and reported no error. Over-wide is padded
# with nulls, which the staging model already filters.
READ_RANGE = "A1:BZ900"


class NjTaxRatesAdapter(SourceAdapter):
    """Municipal tax rates and equalization ratios, as New Jersey publishes them."""

    source_id: ClassVar[str] = "nj_tax_rates"
    landing_format: ClassVar[str] = "xlsx"

    def __init__(self, *, end_year: int) -> None:
        """``end_year`` is the floor; `latest` is the discovered edition once known."""
        self.end_year = end_year

    @property
    def latest(self) -> int:
        """The newest edition: from the workbook's sheet names, else the floor."""
        return int(self.newest) if self.newest else self.end_year

    @property
    def default_vintage(self) -> str:  # type: ignore[override]
        """The vintage follows `latest`, the way `census_acs` follows its end year.

        A `ClassVar` on the base class and a property here, for the same reason PEP and
        ACS do it: the value is per-instance because the registry owns the year, and the
        protocol declares it per-class because most sources have a fixed one.
        """
        return str(self.latest)

    def discover(self, today: date) -> Discovery:
        """The edition named by `GTRhistory.xlsx`'s own sheets.

        The workbook is republished in place under one name, so neither its URL nor a
        HEAD can say which year it holds — and because the vintage is dated, the cached
        copy was never asked about again. The year is in the sheet names
        (`General Tax Rates 1997-2025`), so discovery reads them from the workbook's
        index: 389KB, and no spreadsheet library.
        """
        response = self._ask(f"{BASE_URL}/GTRhistory.xlsx")
        if response is None or not response.is_success:
            return self._discovered(str(self.latest), reached=False)
        try:
            with zipfile.ZipFile(io.BytesIO(response.content)) as book:
                index = book.read("xl/workbook.xml").decode()
        except (zipfile.BadZipFile, KeyError, UnicodeDecodeError):
            return self._discovered(str(self.latest), reached=False)
        # Both rate sheets must carry the year: one landed without the other would
        # publish an effective rate against the previous year's general rate.
        general = set(re.findall(rf"General Tax Rates {SERIES_START}-(\d{{4}})", index))
        effective = set(
            re.findall(rf"Effective Tax Rates {SERIES_START}-(\d{{4}})", index)
        )
        both = {int(y) for y in general & effective}
        if not both:
            # Renamed sheets: nothing in the workbook says which year it holds.
            return self._discovered(str(self.latest), reached=False)
        return self._discovered(
            str(max(both | {self.latest})),
            reached=True,
            published=response.headers.get("last-modified"),
        )

    def landing_sheet(self, ref: ReleaseRef) -> str:
        """The worksheet a layer lives in.

        The rate sheets carry the end year in their name, so this moves with
        `latest` and a stale value fails loudly rather than landing the wrong year.
        """
        if ref.layer == "director_ratio":
            return "Director's Ratio History"
        form = "General" if ref.layer == "general" else "Effective"
        return f"{form} Tax Rates {SERIES_START}-{ref.vintage}"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """One release per sheet, two of them from the same workbook.

        `GTRhistory.xlsx` is fetched twice, once per sheet, because a release maps to
        one landed table and the two sheets are two tables. The second fetch is 389KB
        and content-addresses to the same raw directory as the first, so the cost is one
        redundant request on a cold cache and nothing on a warm one.
        """
        year = vintage or self.default_vintage
        workbook = {
            "general": "GTRhistory.xlsx",
            "effective": "GTRhistory.xlsx",
            "director_ratio": "tev/DirRatios.xlsx",
        }
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=layer,
                vintage=year,
                url=f"{BASE_URL}/{path}",
            )
            for layer, path in workbook.items()
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        """Name the file after its layer, so two sheets of one workbook do not collide.

        Both rate layers come from `GTRhistory.xlsx`. The raw tier is content-addressed
        and would store one copy under one name, which is correct for the bytes and
        ambiguous for the release — so the layer goes in the name.
        """
        return f"{ref.layer}-{ref.url.rsplit('/', 1)[-1]}"
