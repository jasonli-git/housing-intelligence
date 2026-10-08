"""Actual reliability figures in a BPU order; not a complete annual report series."""

import json
import re
from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

ORDER_URL = "https://nj.gov/bpu/pdf/boardorders/2025/20250813/2B%20ORDER%20JCP%26L%20Reliability%20Levels.pdf"


class BpuReliabilityAdapter(SourceAdapter):
    source_id: ClassVar[str] = "nj_bpu_reliability"
    default_vintage: ClassVar[str] = "2025"
    landing_format: ClassVar[str] = "pdf"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if vintage not in (None, "2025"):
            raise SourceError("BPU reader supports the verified August 2025 order only")
        return [ReleaseRef(self.source_id, "jcpl_order", "2025", ORDER_URL)]

    @classmethod
    def pdf_records(cls, text: str, ref: ReleaseRef) -> list[dict[str, object]]:
        if ref.layer != "jcpl_order" or ref.vintage != "2025":
            raise SourceError("Unreviewed BPU document")
        if "EO25070453" not in text or "8/13/25" not in text:
            raise SourceError("BPU order identity changed")
        records = []
        for n, year in enumerate((2022, 2023, 2024), start=1):
            sections = re.split(
                rf"Table {n}\s*[–-]\s*JCP&L {year} Reliability Performance", text
            )
            if len(sections) != 2:
                raise SourceError(f"BPU {year} table missing or ambiguous")
            # A page may contain multiple annual tables. Stop at the next
            # heading as well as the page boundary, not at the page alone.
            table = re.split(r"\f|Table\s+\d+\s*[–-]", sections[1], maxsplit=1)[0]
            # Overall actuals only. Northern/Central geography is not a county.
            rows = re.findall(
                r"^\s*JCP&L\s+N/A\s+N/A\s+(\d+(?:\.\d+)?)"
                r"\s+N/A\s+N/A\s+(\d+(?:\.\d+)?)\s*$",
                table,
                re.M,
            )
            if len(rows) != 1 or not re.search(r"CAIDI\s+SAIFI", table):
                raise SourceError(f"BPU {year} actual-performance columns changed")
            caidi, saifi = map(float, rows[0])
            if not (0 < caidi < 10000 and 0 < saifi < 100):
                raise SourceError("BPU reliability figures outside review bounds")
            records.append(
                {
                    "record_id": f"9726:{year}",
                    "utility_id": "9726",
                    "year": year,
                    "payload": json.dumps(
                        {
                            "utility_id": "9726",
                            "year": year,
                            "caidi_minutes": caidi,
                            "saifi": saifi,
                            "published": "2025-08-13",
                            "url": ORDER_URL,
                            "table": n,
                            "page": 3 if year < 2024 else 4,
                            "basis": (
                                "Company-wide actual performance reproduced by NJ BPU; "
                                "event exclusions not specified in this table"
                            ),
                            "document_kind": (
                                "BPU order citing annual system performance reports"
                            ),
                        }
                    ),
                }
            )
        return records


# The four electric utilities' annual system performance reports for 2024 and 2025, as
# BPU sent them in answer to OPRA request C263585 (2026-10-08). They are not published
# where a script could fetch them, so the owner drops them into
# `data/manual/nj_bpu_reports/` under the names BPU gave them (ARCHITECTURE #347).
OPRA_REQUEST = "C263585"
RELIABILITY_PAGE = "https://www.nj.gov/bpu/about/divisions/reliability/"
REPORTS: dict[tuple[str, str], str] = {
    ("ace", "2024"): (
        "ACE - 2024 Annual System Performance Report - PUBLIC - 5-30-2025.pdf"
    ),
    ("ace", "2025"): (
        "ACE - 2025 Annual System Performance Report - PUBLIC - 5-29-2026.pdf"
    ),
    ("jcpl", "2024"): "JCPL ASPR 2024 Report Public.pdf",
    ("jcpl", "2025"): "JCPL ASPR 2025 Report Public.pdf",
    ("pseg", "2024"): "PSE&G - Annual System Performance Report - 2024.pdf",
    ("pseg", "2025"): "PSE&G - Annual System Performance Report - 2025.pdf",
    ("reco", "2024"): "2024 RECO Annual Service Performance Report.pdf",
    ("reco", "2025"): "2025 RECO Annual Service Performance Report.pdf",
}
# EIA utility ids, which the territories carry (`utility_area.eia_id`).
UTILITIES: dict[str, tuple[str, str]] = {
    "ace": ("963", "Atlantic City Electric"),
    "jcpl": ("9726", "Jersey Central Power & Light"),
    "pseg": ("15477", "Public Service Electric and Gas"),
    "reco": ("16213", "Rockland Electric Company"),
}
_NUMBER = r"(\d+(?:\.\d+)?)"


def _ace(text: str, year: int) -> tuple[float, float]:
    """`ACE Overall` in the SAIFI and CAIDI Components tables: actual performance
    against the minimum level, which ACE's charts label major-event exclusive."""
    found = []
    for index in ("SAIFI", "CAIDI"):
        section = text.split(f"{index} Components", 1)
        if len(section) != 2 or f"{year} Actual Performance" not in section[1][:600]:
            raise SourceError(f"ACE {year} {index} components table changed")
        row = re.search(rf"^\s*ACE Overall\s+{_NUMBER}\s+{_NUMBER}\s", section[1], re.M)
        if row is None:
            raise SourceError(f"ACE {year} overall {index} row missing")
        found.append(float(row.group(2)))
    saifi, caidi = found
    return caidi, saifi


def _jcpl(text: str, year: int) -> tuple[float, float]:
    """The service-territory row of the actual-performance table."""
    section = text.split("following table indicates the actual CAIDI and SAIFI", 1)
    if len(section) != 2:
        raise SourceError(f"JCP&L {year} actual-performance table missing")
    table = section[1][:1500]
    if table.count(f"{year}") < 2 or not re.search(r"CAIDI\s+SAIFI", table):
        raise SourceError(f"JCP&L {year} actual-performance columns changed")
    rows = re.findall(
        rf"^\s*JCP&L\s+N/A\s+N/A\s+{_NUMBER}\s+N/A\s+N/A\s+{_NUMBER}\s*$", table, re.M
    )
    if len(rows) != 1:
        raise SourceError(f"JCP&L {year} territory row missing or ambiguous")
    caidi, saifi = rows[0]
    return float(caidi), float(saifi)


def _pseg(text: str, year: int) -> tuple[float, float]:
    """The year's column of the company-wide ten-year CAIDI and SAIFI tables."""
    found = []
    for index in ("CAIDI", "SAIFI"):
        section = text.split(f"Company Wide Ten Year Data - {index}", 1)
        if len(section) != 2:
            raise SourceError(f"PSE&G {year} company-wide {index} table missing")
        head = section[1][:800]
        years = re.search(r"^\s*Year\s+((?:\d{4}\s+)+\d{4})\s*$", head, re.M)
        values = re.search(
            rf"^\s*Actual {index}\s+((?:[\d.]+\s+)+[\d.]+)\s*$", head, re.M
        )
        if years is None or values is None:
            raise SourceError(f"PSE&G {year} company-wide {index} rows changed")
        columns = dict(zip(years.group(1).split(), values.group(1).split(), strict=True))
        if str(year) not in columns:
            raise SourceError(f"PSE&G {index} table does not reach {year}")
        found.append(float(columns[str(year)]))
    caidi, saifi = found
    return caidi, saifi


def _reco(text: str, year: int) -> tuple[float, float]:
    """The summary sentence of the system-performance section."""
    match = re.search(
        rf"Overall, in {year}, the RECO service territory experienced a SAIFI of "
        rf"{_NUMBER} interruptions per customer\s+served and a CAIDI of {_NUMBER} "
        r"minutes",
        text,
    )
    if match is None:
        raise SourceError(f"RECO {year} system-performance summary changed")
    return float(match.group(2)), float(match.group(1))


_READERS = {"ace": _ace, "jcpl": _jcpl, "pseg": _pseg, "reco": _reco}
_TITLES = {
    "ace": "Atlantic City Electric",
    "jcpl": "Annual System Performance Report",
    "pseg": "Annual System Performance Report",
    "reco": "Rockland Electric Company",
}


class BpuAnnualReportsAdapter(SourceAdapter):
    """Company-wide CAIDI and SAIFI from each utility's annual report to BPU.

    Downloaded by hand: BPU sent the eight reports in answer to an OPRA request, and
    they are not posted where a script could fetch them. One figure pair per utility
    and year, read from the report's own company-wide table — never a district, never
    a chart, never the report's signatures or staff names.
    """

    source_id: ClassVar[str] = "nj_bpu_reports"
    default_vintage: ClassVar[str] = "2025"
    landing_format: ClassVar[str] = "pdf"
    manual: ClassVar[bool] = True
    manual_from: ClassVar[str | None] = (
        f"NJ BPU's Records Custodian (OPRA request {OPRA_REQUEST})"
    )

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        years = {"2024", "2025"} if vintage is None else {vintage}
        if not years <= {"2024", "2025"}:
            raise SourceError("BPU annual reports are reviewed for 2024 and 2025 only")
        return [
            ReleaseRef(self.source_id, utility, year, RELIABILITY_PAGE)
            for (utility, year) in REPORTS
            if year in years
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return REPORTS[(ref.layer, ref.vintage)]

    @classmethod
    def pdf_records(cls, text: str, ref: ReleaseRef) -> list[dict[str, object]]:
        if (ref.layer, ref.vintage) not in REPORTS:
            raise SourceError("Unreviewed BPU annual report")
        year = int(ref.vintage)
        if _TITLES[ref.layer] not in text[:20000] or str(year) not in text[:20000]:
            raise SourceError(f"{ref.layer} {year} report identity changed")
        caidi, saifi = _READERS[ref.layer](text, year)
        if not (10 < caidi < 1000 and 0 < saifi < 10):
            raise SourceError("BPU reliability figures outside review bounds")
        utility_id, name = UTILITIES[ref.layer]
        return [
            {
                "record_id": f"{utility_id}:{year}",
                "utility_id": utility_id,
                "year": year,
                "payload": json.dumps(
                    {
                        "utility_id": utility_id,
                        "utility": name,
                        "year": year,
                        "caidi_minutes": caidi,
                        "saifi": saifi,
                        "url": RELIABILITY_PAGE,
                        "document": REPORTS[(ref.layer, ref.vintage)],
                        "opra_request": OPRA_REQUEST,
                        "basis": (
                            "Company-wide actual performance as the utility reported "
                            "it to BPU against its minimum reliability levels "
                            "(N.J.A.C. 14:5-8)"
                            + (", major events excluded" if ref.layer == "ace" else "")
                        ),
                        "document_kind": "Annual system performance report to BPU",
                    }
                ),
            }
        ]
