"""DCA's non-binding fourth-round calculations and municipal self-reports.

Three releases, never a completion/obligation ratio: the projects span multiple
rounds and include rehabilitation. A blank submission is not a report of zero.
"""

from __future__ import annotations

import json
import math
import re
from datetime import date, timedelta
from pathlib import Path
from typing import ClassVar
from urllib.parse import unquote

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter, SourceError
from hip.sources.xlsx import rows

STATUS_PAGE = "https://www.nj.gov/dca/dlps/hss/MuniStatusReporting.shtml"
ROUND_URL = "https://www.nj.gov/dca/dlps/pdf/FourthRoundCalculation_Workbook.xlsx"


def number(value: str | None) -> float | None:
    if not value or value.strip() in ("--", "N/A", "NA"):
        return None
    try:
        result = float(value.replace(",", "").replace("$", ""))
    except ValueError as exc:
        raise SourceError(f"Unexpected numeric cell: {value!r}") from exc
    if not math.isfinite(result):
        raise SourceError(f"Non-finite numeric cell: {value!r}")
    return result


def excel_date(value: str | None) -> str | None:
    serial = number(value)
    if serial is None:
        return None
    return (date(1899, 12, 30) + timedelta(days=int(serial))).isoformat()


def record(
    record_id: str, geoid: str, kind: str, payload: dict[str, object], snapshot: str
) -> dict[str, object]:
    return {
        "record_id": record_id,
        "geoid": geoid,
        "level": {10: "municipality", 5: "county", 2: "state"}.get(len(geoid), "county"),
        "kind": kind,
        "payload": json.dumps(payload),
        "snapshot": snapshot,
    }


class NjAffordableAdapter(SourceAdapter):
    source_id: ClassVar[str] = "nj_affordable"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "xlsx_records"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        stamp = self.newest or "2026-07-01"
        parsed = date.fromisoformat(stamp)
        suffix = f"{parsed.month}-{parsed.day}-{parsed.year % 100:02d}"
        status = (
            "https://www.nj.gov/dca/dlps/hss/annualreporting/"
            f"Affordable%20Housing%20Municipal%20Status%20Report%20{suffix}.xlsx"
        )
        return [
            ReleaseRef(self.source_id, layer, vintage or "current", url)
            for layer, url in (
                ("need", ROUND_URL),
                ("projects", status),
                ("trust_funds", status),
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.xlsx"

    def discover(self, today: date) -> Discovery:
        response = self._ask(STATUS_PAGE)
        if response is None or not response.is_success:
            return self._discovered(self.newest or "2026-07-01", reached=False)
        stamps = re.findall(
            r"Affordable Housing Municipal Status Report (\d+)-(\d+)-(\d+)\.xlsx",
            unquote(response.text),
            re.IGNORECASE,
        )
        candidates = [date(2000 + int(y), int(m), int(d)) for m, d, y in stamps]
        if not candidates:
            return self._discovered(self.newest or "2026-07-01", reached=False)
        latest = max([date.fromisoformat(self.newest or "2026-07-01"), *candidates])
        return self._discovered(latest.isoformat(), reached=True)

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        output: list[dict[str, object]] = []
        if ref.layer == "need":
            sheet, code_column = "Final Summary", "B"
            snapshot = "2024-10-18"
        else:
            sheet = (
                " Data Summary - All Projects"
                if ref.layer == "projects"
                else "Data Summary - AHTF Data"
            )
            code_column = "D" if ref.layer == "projects" else "B"
            match = re.search(r"(\d+)-(\d+)-(\d+)\.xlsx", unquote(ref.url))
            if not match:
                raise SourceError("Municipal reporting release date missing from URL")
            m, d, y = map(int, match.groups())
            snapshot = date(2000 + y, m, d).isoformat()
        header_seen = False
        fund_table_as_of: str | None = None
        fund_metadata_cutoff: str | None = None
        for index, c in rows(path, sheet):
            if index == (3 if ref.layer == "need" else 4):
                expected = "DCA Municode" if ref.layer == "need" else "DCA Muni Code"
                if c.get(code_column) != expected:
                    raise SourceError(f"DCA {ref.layer}: municipal-code header changed")
                if ref.layer == "need" and "1,000/20% Cap" not in c.get("Q", ""):
                    raise SourceError("DCA capped prospective-need column changed")
                header_seen = True
                if ref.layer == "trust_funds":
                    caption = re.search(r"(\d+)/(\d+)/(\d+)", c.get("K", ""))
                    if caption:
                        cm, cd, cy = map(int, caption.groups())
                        fund_table_as_of = date(
                            cy + 2000 if cy < 100 else cy, cm, cd
                        ).isoformat()
                    fund_metadata_cutoff = excel_date(c.get("BC"))
                continue
            code = c.get(code_column, "")
            if not header_seen or not code.isdigit():
                continue
            code = code.zfill(4)
            if ref.layer == "need":
                payload: dict[str, object] = {
                    "name": c.get("C"),
                    "present_need": number(c.get("F")),
                    "prospective_need": number(c.get("Q")),
                    "round": "2025–2035",
                    "non_binding": True,
                }
                output.append(record(code, c["A"], "need", payload, snapshot))
            elif ref.layer == "trust_funds":
                # Missing submission markers override the workbook's numeric zeros.
                reported = c.get("G") == "Y" and c.get("H") != "X"
                payload = {
                    "name": c.get("C"),
                    "reported": reported,
                    "balance": number(c.get("K")) if reported else None,
                    "income": number(c.get("I")) if reported else None,
                    "expenditure": number(c.get("J")) if reported else None,
                    "table_as_of": fund_table_as_of,
                    "metadata_cutoff": fund_metadata_cutoff,
                }
                output.append(
                    {**record(code, "", "trust_fund", payload, snapshot), "cd_code": code}
                )
            else:
                completion_date = excel_date(c.get("J"))
                payload = {
                    "name": c.get("C"),
                    "units": number(c.get("K")),
                    "completed": (
                        True
                        if c.get("I") == "Y"
                        else False
                        if c.get("I") == "N"
                        else None
                    ),
                    "completion_date": completion_date,
                    "completed_for_summary": c.get("I") == "Y"
                    and (completion_date is None or completion_date <= snapshot),
                    "bedrooms": {
                        str(i): number(c.get(col))
                        for i, col in enumerate(("AE", "AF", "AG", "AH"))
                    },
                    "special_needs_units": number(c.get("AB")),
                    "senior_units": number(c.get("AD")),
                    "earliest_controls_end": excel_date(c.get("AQ")),
                }
                output.append(
                    {
                        **record(c["A"], "", "municipal_project", payload, snapshot),
                        "cd_code": code,
                    }
                )
        if not header_seen or not output:
            raise SourceError(f"DCA {ref.layer}: no usable records")
        ids = [str(r["record_id"]) for r in output]
        if len(ids) != len(set(ids)):
            raise SourceError(f"DCA {ref.layer}: duplicate identifiers")
        return output
