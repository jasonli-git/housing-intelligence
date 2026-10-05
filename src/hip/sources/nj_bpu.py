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
