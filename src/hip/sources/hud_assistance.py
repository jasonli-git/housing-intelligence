"""HUD assisted contracts and owner-downloaded, dated LIHTC bulk releases."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import ClassVar
from urllib.parse import parse_qs, urlsplit

from hip.sources.base import Discovery, ReleaseRef, SourceAdapter, SourceError
from hip.sources.nj_affordable import excel_date, number, record
from hip.sources.xlsx import rows, sheets

MF_BASE = "https://www.hud.gov/sites/dfiles/Housing/documents"


class HudAssistedAdapter(SourceAdapter):
    source_id: ClassVar[str] = "hud_assisted"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "xlsx_records"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                self.source_id,
                layer,
                vintage or "current",
                f"{MF_BASE}/{f}?as_of={self.newest or '2026-08-07'}",
            )
            for layer, f in (
                ("properties", "MF-Properties-with-Assistance-Sec8-Contracts1.xlsx"),
                ("contracts", "MF-Assistance-Sec8-Contracts1.xlsx"),
            )
        ]

    def discover(self, today: date) -> Discovery:
        response = self._ask(
            "https://www.hud.gov/hud-partners/multifamily-assist-section8-database"
        )
        stamp = self.newest or "2026-08-07"
        if response is None or not response.is_success:
            return self._discovered(stamp, reached=False)
        content = re.sub(r"<[^>]+>", " ", response.text)
        match = re.search(
            r"Current\s+as\s+of\s+(\d{2})/(\d{2})/(\d{4})", content, re.IGNORECASE
        )
        if not match:
            return self._discovered(stamp, reached=False)
        m, d, y = map(int, match.groups())
        newest = max(date.fromisoformat(stamp), date(y, m, d)).isoformat()
        return self._discovered(newest, reached=True)

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.xlsx"

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        iterator = rows(path, sheets(path)[0])
        _, headers = next(iterator)
        required = (
            {"property_id", "state_code", "county_code", "property_name_text"}
            if ref.layer == "properties"
            else {
                "property_id",
                "contract_number",
                "tracs_status_name",
                "assisted_units_count",
                "tracs_current_expiration_date",
            }
        )
        if not required.issubset(headers.values()):
            raise SourceError(f"HUD assisted {ref.layer}: header changed")
        output: list[dict[str, object]] = []
        stamp = parse_qs(urlsplit(ref.url).query).get("as_of", [""])[0]
        date.fromisoformat(stamp)  # A release without a declared snapshot is refused.
        for _, cells in iterator:
            c = {field: cells.get(col, "") for col, field in headers.items()}
            if ref.layer == "properties":
                if c["state_code"] != "NJ":
                    continue
                county = c["county_code"].zfill(3)
                if not county.isdigit() or len(county) != 3:
                    raise SourceError("HUD assisted: county code missing")
                located = int(county) in range(1, 42, 2)
                payload: dict[str, object] = {
                    "name": c["property_name_text"],
                    "address": c["address_line1_text"],
                    "city": c["city_name_text"],
                    "zip": c["zip_code"],
                    "units": number(c["property_total_unit_count"]),
                    "phone": c["property_phone_number"],
                    "category": c["property_category_name"],
                    "location_scope": "county"
                    if located
                    else "state only; county not located",
                }
                output.append(
                    record(
                        c["property_id"],
                        f"34{county}" if located else "34",
                        "hud_property",
                        payload,
                        stamp,
                    )
                )
            else:
                # Contracts have no state field: retain the program records; staging
                # joins exact property_id to the NJ property table, never a city name.
                payload = {
                    "property_id": c["property_id"],
                    "status": c["tracs_status_name"],
                    "program": c["program_type_name"],
                    "units": number(c["assisted_units_count"]),
                    "contract_end": excel_date(c["tracs_current_expiration_date"]),
                    "bedrooms": {str(i): number(c[f"{i}BR_count"]) for i in range(5)},
                    "bedrooms_5plus": number(c["5plusBR_count"]),
                }
                output.append(
                    record(c["contract_number"], "", "hud_contract", payload, stamp)
                )
        if not output:
            raise SourceError(f"HUD assisted {ref.layer}: no records")
        ids = [str(r["record_id"]) for r in output]
        if len(set(ids)) != len(ids):
            raise SourceError(f"HUD assisted {ref.layer}: duplicate identifiers")
        return output


LIHTC_PAGE = "https://www.huduser.gov/portal/datasets/lihtc/property.html"


class HudLihtcAdapter(SourceAdapter):
    """Handed in without bypassing HUD User's bot check.

    The filename declares coverage verified against the accompanying dictionary.
    A newer discovery requests a different filename, so old bytes cannot silently
    be relabelled as a new release. Workbook dates are not release dates.
    """

    source_id: ClassVar[str] = "hud_lihtc"
    default_vintage: ClassVar[str] = "2024"
    landing_format: ClassVar[str] = "xlsx_records"
    manual: ClassVar[bool] = True
    manual_from: ClassVar[str] = LIHTC_PAGE
    FIELDS: ClassVar[tuple[str, ...]] = (
        "hud_id",
        "project",
        "proj_add",
        "proj_cty",
        "proj_st",
        "proj_zip",
        "cnty2020",
        "place2020",
        "n_units",
        "li_units",
        "n_0br",
        "n_1br",
        "n_2br",
        "n_3br",
        "n_4br",
        "yr_pis",
        "trgt_eld",
        "trgt_dis",
        "aff_period",
        "aff_yrs",
        "nonprog",
        "resyndication_cd",
        "datanote",
    )

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.newest or self.default_vintage
        if not year.isdigit() or not 2024 <= int(year) <= 2100:
            raise SourceError("LIHTC bulk coverage year must be 2024–2100")
        return [
            ReleaseRef(
                self.source_id,
                "properties",
                year,
                f"https://www.huduser.gov/lihtc/lihtcpub.zip?coverage_through={year}",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"LIHTCPUB_{ref.vintage}.xlsx"

    def use_cached_vintage(self, raw_dir: Path) -> None:
        """A verified manual acquisition can advance while discovery is blocked.

        Only files already in the immutable acquisition cache count, not an untested
        file in Downloads. This also lets `acquire --vintage 2025` flow into ordinary
        land/stage/load without changing the default year in code or forging a
        successful publisher check. A discovered but missing newer release still wins.
        """
        path = raw_dir / self.source_id / "index.json"
        if not path.exists():
            return
        try:
            index = json.loads(path.read_text())
        except json.JSONDecodeError:
            return
        if not isinstance(index, dict):
            return
        years = [int(self.newest or self.default_vintage)]
        for key, sha in index.items():
            match = re.fullmatch(r"properties@(\d{4})", key)
            if not match or not isinstance(sha, str):
                continue
            year = int(match[1])
            if not 2024 <= year <= 2100:
                continue
            ref = self.refs(str(year))[0]
            release = self._from_cache(ref, raw_dir, sha)
            if release is not None and release.path.name == self.filename(ref):
                years.append(year)
        self.newest = str(max(years))

    def discover(self, today: date) -> Discovery:
        floor = self.newest or self.default_vintage
        response = self._ask(LIHTC_PAGE)
        if response is None or not response.is_success:
            return self._discovered(floor, reached=False)
        content = re.sub(r"<[^>]+>", " ", response.text)
        # Completed database coverage, not the paragraph announcing next spring.
        match = re.search(
            r"placed\s+in\s+service\s+between\s+1987\s+and\s+(\d{4})",
            content,
            re.IGNORECASE,
        )
        if not match or not 2024 <= int(match[1]) <= today.year:
            return self._discovered(floor, reached=False)
        return self._discovered(str(max(int(floor), int(match[1]))), reached=True)

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        iterator = rows(path, sheets(path)[0])
        _, original = next(iterator)
        headers = {col: name.lower() for col, name in original.items()}
        if not set(cls.FIELDS).issubset(headers.values()):
            raise SourceError("LIHTC bulk: header changed; verify the data dictionary")
        output: list[dict[str, object]] = []
        numeric = {
            "n_units",
            "li_units",
            "n_0br",
            "n_1br",
            "n_2br",
            "n_3br",
            "n_4br",
            "aff_yrs",
        }
        for _, cells in iterator:
            c = {field: cells.get(col, "") for col, field in headers.items()}
            if c.get("proj_st") != "NJ":
                continue
            if not c["hud_id"]:
                raise SourceError("LIHTC bulk: missing project identifier")
            item: dict[str, object] = {}
            for field in cls.FIELDS:
                value = c[field]
                # Access exports use '.' for missing numeric data.
                item[field] = (
                    number(value if value != "." else "") if field in numeric else value
                )
            item["coverage_through"] = int(ref.vintage)
            output.append(item)
        ids = [r["hud_id"] for r in output]
        if not ids or len(ids) != len(set(ids)):
            raise SourceError("LIHTC bulk: empty NJ inventory or duplicate identifiers")
        return output
