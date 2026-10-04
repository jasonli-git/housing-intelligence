"""HUD assisted contracts (offered XLSX) and its older public LIHTC map inventory.

Only explicitly selected fields land. LIHTC's live service is not the 2024 bulk
release: its coverage through 2020 is disclosed, not inferred from download time.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import ClassVar
from urllib.parse import parse_qs, urlsplit

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
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


class HudLihtcAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "hud_lihtc"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "properties": ArcGisLayer(
            url="https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/"
            "LIHTC/FeatureServer/0",
            fields=(
                "HUD_ID",
                "PROJECT",
                "PROJ_ADD",
                "PROJ_CTY",
                "PROJ_ZIP",
                "N_UNITS",
                "LI_UNITS",
                "N_0BR",
                "N_1BR",
                "N_2BR",
                "N_3BR",
                "N_4BR",
                "YR_PIS",
                "TRGT_ELD",
                "TRGT_DIS",
                "CURCNTY",
                "CURCOSUB",
                "DATANOTE",
            ),
            where="PROJ_ST='NJ'",
            geometry=False,
            minimum=300,
        )
    }
