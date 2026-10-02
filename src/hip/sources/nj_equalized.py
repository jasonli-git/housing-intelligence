"""NJ Table of Equalized Valuations: what each town's taxable property is worth at market
value, by the state's reckoning (Milestone 37).

The Director of the Division of Taxation certifies it each October: per taxing district,
the aggregate assessed value of real property, the average ratio of assessed to true
value, the aggregate true value, and the equalized valuation every county and school
apportionment is built on. One PDF a year, 2018 on, at URLs that change shape between
years (`2023/allcounties.pdf`, `2024/2024TEV.pdf`, and 2025's under the 2024 folder), so
they are listed as published rather than generated.

It is here for one job: the weights a county tax rate needs. A town's effective rate is
its levy over its equalized value, so a county's is the towns' rates weighted by
equalized value — never their plain average, which would count Walpack's handful of
parcels as heavily as Newark's (ARCHITECTURE #290). The PDF's text is read by
`land_pdf`; what the lines mean is this adapter's.
"""

from __future__ import annotations

import re
from datetime import date
from typing import ClassVar

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter

BASE_URL = "https://www.nj.gov/treasury/taxation/pdf/lptval"

# Each tax year's table, as the Division's statistics page links it on 2026-10-02.
PUBLISHED: dict[int, str] = {
    2018: "2018/AllCounties.pdf",
    2019: "2019/AllCounties.pdf",
    2020: "2020/AllCounties.pdf",
    2021: "2021/allcounties.pdf",
    2022: "2022/allcounties.pdf",
    2023: "2023/allcounties.pdf",
    2024: "2024/2024TEV.pdf",
    2025: "2024/2025TEV.pdf",
    2026: "2026/2026TEV.pdf",
}

# A district's line: CD code, name, then the columns — aggregate assessed value, the
# average ratio, aggregate true value, Class II railroad property, personal property of
# telephone and other utilities, and the equalized valuation last. Some years leave one
# of the two middle columns blank rather than printing 0 (eight districts in 2019), so
# the equalized valuation is read as the line's last number.
_LINE = re.compile(
    r"^\s*(?P<cd>\d{4})\s+(?P<name>.+?)\s+(?P<assessed>[\d,]+)\s+(?P<ratio>\d+\.\d+)"
    r"\s+(?P<true>[\d,]+)(?P<rest>(?:\s+[\d,]+){1,3})\s*$"
)


def district_count(tax_year: int) -> int:
    """New Jersey's taxing districts in a year's table: 565 until Pine Valley borough
    (0429) merged into Pine Hill, 564 from the 2021 table on, where Pine Hill is marked as
    the merged district."""
    return 565 if tax_year < 2021 else 564


def _number(text: str) -> int:
    return int(text.replace(",", ""))


def districts(text: str, ref: ReleaseRef) -> list[dict[str, object]]:
    """Every district the table's text lists.

    Refused unless every district of that year appears once (`district_count`): a short
    read means the layout moved, and a county rate weighted by a partial table would be
    wrong without looking it.
    """
    rows: list[dict[str, object]] = []
    for line in text.splitlines():
        match = _LINE.match(line)
        if not match:
            continue
        true_value = _number(match["true"])
        equalized = _number(match["rest"].split()[-1])
        # Equalized valuation is true value plus the two smaller columns, so it cannot be
        # less: a smaller one means a column was read as another.
        if equalized < true_value:
            raise ValueError(
                f"nj_equalized/{ref.key}: {match['cd']} equalized {equalized:,} is below "
                f"its true value {true_value:,}; the table's layout has changed"
            )
        rows.append(
            {
                "cd_code": match["cd"],
                "district": match["name"].strip(),
                "assessed_value": _number(match["assessed"]),
                "average_ratio": float(match["ratio"]),
                "true_value": true_value,
                "equalized_value": equalized,
                "tax_year": int(ref.vintage),
            }
        )
    codes = [row["cd_code"] for row in rows]
    expected = district_count(int(ref.vintage))
    if len(set(codes)) != expected or len(codes) != expected:
        raise ValueError(
            f"nj_equalized/{ref.key}: read {len(set(codes))} districts "
            f"({len(codes)} lines), not New Jersey's {expected}; the table's layout has "
            f"changed"
        )
    return rows


class NjEqualizedAdapter(SourceAdapter):
    """One release per year's certified table."""

    source_id: ClassVar[str] = "nj_equalized"
    default_vintage: ClassVar[str] = str(max(PUBLISHED))
    landing_format: ClassVar[str] = "pdf"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        years = [int(vintage)] if vintage else sorted(PUBLISHED)
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="tev",
                vintage=str(year),
                url=f"{BASE_URL}/{PUBLISHED[year]}",
            )
            for year in years
            if year in PUBLISHED
        ]

    def discover(self, today: date) -> Discovery:
        """Whether a newer table is published, guessing the newest pattern's URL.

        The Division has used three URL shapes in nine years, so a miss here does not
        prove absence: a newer year at an unguessed URL is found by reading the
        statistics page and adding it to `PUBLISHED`.
        """
        newest = max(PUBLISHED)

        def exists(year: int) -> tuple[bool | None, str | None]:
            return self._probe(f"{BASE_URL}/{year}/{year}TEV.pdf")

        year, published, reached = self._probe_forward(newest, exists)
        return self._discovered(str(year), reached=reached, published=published)

    @classmethod
    def pdf_records(cls, text: str, ref: ReleaseRef) -> list[dict[str, object]]:
        return districts(text, ref)
