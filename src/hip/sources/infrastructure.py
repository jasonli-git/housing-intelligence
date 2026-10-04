"""Dated utility and water records. No addresses or household bill predictions."""

from __future__ import annotations

import csv
import io
import json
import math
import re
import tempfile
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import ClassVar
from zipfile import ZipFile

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
from hip.sources.base import Discovery, ReleaseRef, SourceAdapter, SourceError
from hip.sources.xlsx import rows


def numeric(value: object) -> float | None:
    if value is None or str(value).strip() in {"", ".", "NA", "N/A"}:
        return None
    try:
        result = float(str(value))
    except ValueError as exc:
        raise SourceError(f"Invalid infrastructure number: {value!r}") from exc
    if not math.isfinite(result):
        raise SourceError("Non-finite infrastructure value")
    return result


class UtilityAreasAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "njdep_utility_areas"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        kind: ArcGisLayer(
            url=f"https://mapsdep.nj.gov/arcgis/rest/services/Features/Utilities/MapServer/{n}",
            fields=("OBJECTID", "NAME"),
            minimum=4,
            batch=20,
        )
        for kind, n in (("electric", 10), ("gas", 11))
    }


class LeadLinesAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "njdep_lead_lines"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        "lines": ArcGisLayer(
            url="https://services1.arcgis.com/QWdNfRs7lkPq4g4Q/arcgis/rest/services/Public_Community_Water_Purveyor_Service_Line_Inventory_for_New_Jersey/FeatureServer/37",
            fields=(
                "OBJECTID",
                "PWID",
                "SYS_NAME",
                "LSLI",
                "LSGA",
                "LSGO",
                "LSUN",
                "LSNL",
                "DATE_UPDATED",
                "SUBMISSION_YEAR",
                "SLI_ACCESS",
            ),
            minimum=500,
            geometry=False,
        )
    }


class UcmrAdapter(SourceAdapter):
    source_id: ClassVar[str] = "epa_ucmr5"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "xlsx_records"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if vintage not in (None, self.default_vintage):
            raise SourceError("UCMR 5 uses the current bulk occurrence file")
        return [
            ReleaseRef(
                self.source_id,
                "samples",
                self.default_vintage,
                "https://www.epa.gov/system/files/other-files/2023-08/ucmr5-occurrence-data-by-state.zip",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "ucmr5.zip"

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        result: list[dict[str, object]] = []
        with ZipFile(path) as archive, archive.open("UCMR5_All_MA_WY.txt") as handle:
            reader = csv.DictReader(
                io.TextIOWrapper(handle, encoding="cp1252"), delimiter="\t"
            )
            required = {
                "State",
                "PWSID",
                "SampleID",
                "Contaminant",
                "CollectionDate",
                "Units",
                "MRL",
                "AnalyticalResultsSign",
                "AnalyticalResultValue",
                "SamplePointType",
                "FacilityID",
                "SamplePointID",
                "MethodID",
            }
            if not required <= set(reader.fieldnames or []):
                raise SourceError("UCMR 5 headers changed")
            for r in reader:
                if (
                    r["State"] != "NJ"
                    or r["SamplePointType"] != "EP"
                    or r["Contaminant"].casefold() == "lithium"
                ):
                    continue
                if r["Units"] != "µg/L" or r["AnalyticalResultsSign"] not in {
                    "<",
                    "=",
                }:
                    raise SourceError("UCMR 5 units or censoring changed")
                m, d, y = map(int, r["CollectionDate"].split("/"))
                stamp = date(y, m, d)
                # The final cycle includes follow-up collections in 2026. Keep
                # their actual dates, never label them as a 2025 measurement.
                if not 2023 <= y <= 2026:
                    raise SourceError("UCMR 5 unexpected collection year")
                detected = r["AnalyticalResultsSign"] == "="
                value = numeric(r["AnalyticalResultValue"]) if detected else None
                limit = numeric(r["MRL"])
                if (
                    limit is None
                    or limit <= 0
                    or (detected and (value is None or value < 0))
                ):
                    raise SourceError("UCMR 5 invalid result or reporting limit")
                result.append(
                    {
                        "pwsid": r["PWSID"],
                        "sample_id": r["SampleID"],
                        "facility_id": r["FacilityID"],
                        "sample_point": r["SamplePointID"],
                        "method_id": r["MethodID"],
                        "contaminant": r["Contaminant"],
                        "collected": stamp.isoformat(),
                        "detected": detected,
                        "ng_l": None if value is None else value * 1000,
                        "reporting_limit_ng_l": limit * 1000,
                    }
                )
        if not result:
            raise SourceError("UCMR 5 has no NJ entry-point samples")
        return result


class EiaAdapter(SourceAdapter):
    source_id: ClassVar[str] = "eia861"
    default_vintage: ClassVar[str] = "2024"
    landing_format: ClassVar[str] = "xlsx_records"

    def discover(self, today: date) -> Discovery:
        response = self._ask("https://www.eia.gov/electricity/data/eia861/")
        floor = self.newest or self.default_vintage
        if response is None or not response.is_success:
            return self._discovered(floor, reached=False)
        # Early releases end in 'er.zip': never call them validated annual data.
        years = re.findall(r"(?:zip/|archive/zip/)f861(\d{4})\.zip", response.text)
        if not years:
            return self._discovered(floor, reached=False)
        newest = max([floor, *years], key=int)
        self.newest = newest
        return self._discovered(newest, reached=True)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.newest or self.default_vintage
        if not str(year).isdigit():
            raise SourceError("EIA 861 needs a calendar year")
        return [
            ReleaseRef(
                self.source_id,
                "utilities",
                str(year),
                f"https://www.eia.gov/electricity/data/eia861/zip/f861{year}.zip",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"eia861-{ref.vintage}.zip"

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        records: dict[str, dict[str, object]] = {}
        with ZipFile(path) as archive, tempfile.TemporaryDirectory() as folder:
            for prefix, sheet in (
                ("Sales_Ult_Cust", "States"),
                ("Reliability", "Reliability_States"),
            ):
                member = f"{prefix}_{ref.vintage}.xlsx"
                target = Path(folder) / member
                target.write_bytes(archive.read(member))
                header_seen = False
                for n, r in rows(target, sheet):
                    if (
                        n == 1
                        and prefix == "Sales_Ult_Cust"
                        and r.get("J") != "RESIDENTIAL"
                    ):
                        raise SourceError("EIA residential columns changed")
                    if (
                        n == 2
                        and prefix == "Reliability"
                        and (
                            r.get("F") != "All Events (With Major Event Days)"
                            or r.get("I") != "Without Major Event Days"
                        )
                    ):
                        raise SourceError("EIA reliability event basis changed")
                    if n == 3:
                        expected = {"B": "Utility Number", "C": "Utility Name"}
                        expected.update(
                            {"J": "Thousand Dollars", "K": "Megawatthours"}
                            if prefix == "Sales_Ult_Cust"
                            else {
                                "F": "SAIDI (minutes per year)",
                                "G": "SAIFI (times per year)",
                                "I": "SAIDI (minutes per year)",
                                "J": "SAIFI (times per year)",
                                "R": "SAIDI (minutes per year)",
                                "S": "SAIFI (times per year)",
                                "U": "SAIDI (minutes per year)",
                                "V": "SAIFI (times per year)",
                            }
                        )
                        if any(r.get(k) != v for k, v in expected.items()):
                            raise SourceError("EIA utility headers or units changed")
                        header_seen = True
                    if n < 4 or r.get("G" if prefix == "Sales_Ult_Cust" else "D") != "NJ":
                        continue
                    if r.get("A") != ref.vintage:
                        raise SourceError("EIA utility year differs from release")
                    key = r["B"]
                    # EIA's statewide balancing adjustment is not a supplier;
                    # its signed corrections must not become company statistics.
                    if key == "99999":
                        if r["C"] != f"Adjustment {ref.vintage}":
                            raise SourceError("EIA adjustment identity changed")
                        continue
                    record = records.setdefault(
                        key,
                        {
                            "utility_id": key,
                            "name": r["C"],
                            "year": int(ref.vintage),
                            "sales": [],
                        },
                    )
                    if prefix == "Sales_Ult_Cust":
                        if r["E"] not in {"Bundled", "Delivery", "Energy"} or r[
                            "F"
                        ] not in {"O", "I"}:
                            raise SourceError("EIA service or data type changed")
                        sales = record["sales"]
                        assert isinstance(sales, list)
                        sales.append(
                            {
                                "service_type": r["E"],
                                "data_type": r["F"],
                                "revenue_thousand": numeric(r.get("J")),
                                "mwh": numeric(r.get("K")),
                                "customers": numeric(r.get("L")),
                            }
                        )
                    else:
                        for method, a, b, c, d in (
                            ("IEEE", "F", "G", "I", "J"),
                            ("Other", "R", "S", "U", "V"),
                        ):
                            if numeric(r.get(a)) is not None:
                                if "method" in record:
                                    raise SourceError(
                                        "EIA multiple reliability methods require review"
                                    )
                                record.update(
                                    {
                                        "method": method,
                                        "saidi_all": numeric(r.get(a)),
                                        "saifi_all": numeric(r.get(b)),
                                        "saidi_normal": numeric(r.get(c)),
                                        "saifi_normal": numeric(r.get(d)),
                                    }
                                )
                if not header_seen:
                    raise SourceError("EIA utility header row missing")
        if not records:
            raise SourceError("EIA has no New Jersey utilities")
        return [{"utility_id": k, "payload": json.dumps(r)} for k, r in records.items()]


class EnergyBurdenAdapter(SourceAdapter):
    """One disjoint AMI partition, not four overlapping income classifications.

    Preserve numerator and reporting weights separately for each expenditure type.
    Derived county means use each field's own denominator, not all housing units.
    The dataset is released in 2024 but its underlying ACS/EIA vintage is 2022.
    """

    source_id: ClassVar[str] = "doe_lead"
    default_vintage: ClassVar[str] = "2022"
    landing_format: ClassVar[str] = "xlsx_records"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if vintage not in (None, self.default_vintage):
            raise SourceError("LEAD adapter supports the verified 2022 NJ bulk file")
        return [
            ReleaseRef(
                self.source_id,
                "counties",
                "2022",
                "https://data.openei.org/files/6219/NJ-2022-LEAD-data.zip",
            )
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return "NJ-2022-LEAD-data.zip"

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        sums: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        names: dict[str, str] = {}
        questionable: set[str] = set()
        bands = {"0-30%", "30-60%", "60-80%", "80-100%", "100-150%", "150%+"}
        with ZipFile(path) as archive, archive.open("NJ AMI Counties 2022.csv") as handle:
            reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig"))
            columns = [
                "UNITS",
                *[
                    f"{f}{suffix}"
                    for f in ("HINCP", "ELEP", "GASP", "FULP")
                    for suffix in ("*UNITS", " UNITS")
                ],
            ]
            required = {"ABV", "FIP", "NAME", "AMI150", "TEN", *columns}
            if not required <= set(reader.fieldnames or []):
                raise SourceError("LEAD county headers changed")
            for r in reader:
                if (
                    r["ABV"] != "NJ"
                    or r["AMI150"] not in bands
                    or r["TEN"] not in {"OWN", "REN"}
                ):
                    raise SourceError(
                        "LEAD geography or disjoint income partition changed"
                    )
                if not re.fullmatch(r"34\d{3}", r["FIP"]):
                    raise SourceError("LEAD county identifier changed")
                names[r["FIP"]] = r["NAME"]
                for field in columns:
                    value = numeric(r[field])
                    if value is None:
                        raise SourceError(f"LEAD missing {field}")
                    if value < 0 and field != "HINCP*UNITS":
                        questionable.add(r["FIP"])
                    sums[r["FIP"]][field] += value
        if len(sums) != 21:
            raise SourceError("LEAD must contain all 21 NJ counties")
        records: list[dict[str, object]] = []
        for geoid, fields in sorted(sums.items()):
            means = {
                f: fields[f + "*UNITS"] / fields[f + " UNITS"]
                if fields[f + " UNITS"] > 0
                else None
                for f in ("HINCP", "ELEP", "GASP", "FULP")
            }
            income = means["HINCP"]
            energy = (
                None
                if any(means[f] is None for f in ("ELEP", "GASP", "FULP"))
                else sum(means[f] or 0 for f in ("ELEP", "GASP", "FULP"))
            )
            # The real county file contains signed reporting weights/expenditures.
            # Keep them auditable, but do not invent a repair or publish a household
            # cost from that county until the publisher explains the convention.
            if geoid in questionable:
                income = energy = None
            records.append(
                {
                    "geoid": geoid,
                    "payload": json.dumps(
                        {
                            "name": names[geoid],
                            "year": 2022,
                            "acs_window": "2018–2022",
                            "annual_energy": energy,
                            "mean_annual_income": income,
                            "burden": energy / income
                            if energy is not None and income is not None and income > 0
                            else None,
                            "weights": dict(fields),
                            "components": means,
                            "method": "ratio of derived county means",
                            "quality_note": "signed weights/costs; estimate withheld"
                            if geoid in questionable
                            else None,
                        }
                    ),
                }
            )
        return records
