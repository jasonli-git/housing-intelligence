"""NJ SR1A Sales File — the state's own record of which sales were usable.

Every deed recorded in New Jersey is reported to the Division of Taxation on form
SR-1A and assigned a usability determination for sales-ratio purposes. This is the file
that determination lives in, and it is the reason Milestone 25 does not read MOD-IV's
sale columns.

**Why not MOD-IV.** `SALES_CODE`, landed with every parcel since Milestone 7, is MOD-IV
field 27 `SALES-PRICE-CODE`: it records how a sale was *investigated* — A=Actual,
F=Field, Q=Questionnaire — not whether the price means anything. The usability field is
MOD-IV field 38 `SALE-SR1A-UN-CODE`, and New Jersey's ArcGIS publication does not carry
it. Verified 2026-09-19 by listing all 45 fields of `Parcels_Composite_NJ_WM`, which is
reachable without a token and exposes the same five sale columns as the token-walled
`Parcels_MODIV_NJ_WM`: `DEED_BOOK`, `DEED_PAGE`, `DEED_DATE`, `SALES_CODE`,
`SALE_PRICE`. Re-acquiring MOD-IV could not have obtained the usability code at any
authentication level, so filtering "non-market transfers by sales code" — which is what
ROADMAP Milestone 25 assumed — was never possible from that source. Measured
consequence of having no such filter: 397,155 class-2 parcels carry `SALE_PRICE = 1`,
the nominal-consideration marker MOD-IV field 29 describes.

Here the determination is explicit. `U-N-TYPE` is `U` or `N`, and a non-usable sale
additionally carries `SR-NU-CODE`, one of the 33 categories in the Division's
*Guidelines for Use of 36 Non-Usable Categories*. Measured 2026-09-19 on the
year-to-date 2026 file: 69,135 usable against 100,800 non-usable, and the largest
non-usable category is 25 at 21,938 deeds.

**Grantor and grantee are deliberately not landed.** The published record carries the
names, street addresses and ZIP codes of both parties to every transaction — 178 of the
663 bytes. No metric needs them, and landing them would put named individuals' purchase
histories in the warehouse as a side effect of computing a median. `FIELDS` selects the
13 columns the aggregates use and the lander slices only those, so the Parquet tier
never holds them. The raw tier keeps the published file as published, because a
content-addressed raw copy that has been edited is not a record of what the publisher
served.

Keyed on `COUNTY-CODE || DISTRICT-CODE`, which is New Jersey's CD code — the identifier
`region_identifiers` has held since Milestone 1 and `stg_nj_municipal_codes` populates.
So this resolves to Census GEOIDs with no name matching at all. Measured on the
year-to-date file: 562 distinct CD codes, of which 552 resolve; the 10 that do not are
the MOD-IV name truncations ARCHITECTURE #27 and #28 declined to guess at, covering
2,215 of 169,935 rows.
"""

from __future__ import annotations

from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter

BASE_URL = "https://www.nj.gov/treasury/taxation/lpt/statdata"

# The oldest archive the Division publishes. Older years are not offered at all.
SERIES_START = 2020
# The newest complete year. The year after it is published as a year-to-date file
# under a different name, which `refs` adds separately.
LAST_COMPLETE_YEAR = 2025

# A record is 663 bytes plus a CRLF. Checked against the published layout and against
# the file: 113,006,775 bytes / 665 == 169,935 exactly, with no remainder.
RECORD_BYTES = 663

# (name, start, length), one-based start, exactly as `SR1Afilelayout.pdf` gives them.
# The layout is publisher knowledge and belongs to the adapter, the same way
# `to_records` owns the shape of a JSON payload; the lander does the slicing and knows
# nothing about what the fields mean.
#
# Grantor and grantee — names, streets, city/state and ZIP for both parties, bytes
# 110-297 — are omitted on purpose. See the module docstring.
FIELDS: tuple[tuple[str, int, int], ...] = (
    ("county_code", 1, 2),
    ("district_code", 3, 2),
    ("un_type", 34, 1),
    ("sr_nu_code", 35, 3),
    ("reported_sales_price", 38, 9),
    ("verified_sales_price", 47, 9),
    ("assessed_value_total", 74, 9),
    ("sales_ratio", 83, 5),
    ("serial_number", 99, 7),
    ("deed_date", 339, 6),
    ("date_recorded", 345, 6),
    ("assess_year", 625, 2),
    ("property_class", 627, 3),
    ("year_built", 653, 4),
    ("living_space", 657, 7),
)


def vintages() -> tuple[str, ...]:
    """Every vintage the publisher offers, oldest first.

    The current year is a year-to-date extract rather than a closed year, and its
    vintage says so. A `2026ytd` release is republished as the year fills — the
    2026-08-12 file holds deeds through July — so unlike a closed year it is not
    immutable, and the content-addressed cache will answer from disk until someone
    passes `--force`. That is the same defect as the `@current` refs in TODO.md,
    deferred to Milestone 29; naming the vintage `2026ytd` at least means every
    observation drawn from it says which kind of file it came from.
    """
    closed = tuple(str(y) for y in range(SERIES_START, LAST_COMPLETE_YEAR + 1))
    return (*closed, f"{LAST_COMPLETE_YEAR + 1}ytd")


class Sr1aAdapter(SourceAdapter):
    """One archive per year of recorded New Jersey deeds."""

    source_id: ClassVar[str] = "nj_sr1a"
    default_vintage: ClassVar[str] = f"{LAST_COMPLETE_YEAR + 1}ytd"
    landing_format: ClassVar[str] = "fixed_width"
    fixed_width_fields: ClassVar[tuple[tuple[str, int, int], ...]] = FIELDS

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        """One release per year, or just the one asked for.

        Every year rather than only the newest, because a median sale price per
        municipality is thin at one year: 37,403 usable class-2 deeds dated 2025 spread
        over 564 municipalities is about 66 each, and the smallest municipalities see
        single digits. The window the metric actually uses is a modelling decision in
        `stg_nj_sr1a`, not an acquisition one.
        """
        wanted = (vintage,) if vintage else vintages()
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="sales",
                vintage=v,
                url=f"{BASE_URL}/{self._archive(v)}",
            )
            for v in wanted
        ]

    @staticmethod
    def _archive(vintage: str) -> str:
        """The archive name for a vintage. The year-to-date file is named differently."""
        if vintage.endswith("ytd"):
            return f"YTDSR1A{vintage[:-3]}.zip"
        return f"Sales{vintage}.zip"
