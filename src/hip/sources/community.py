"""Separate, dated community components; no neighbourhood grade or address claims."""

from __future__ import annotations

import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Any, ClassVar
from urllib.parse import urljoin

import httpx

from hip.sources.arcgis import ArcGisAdapter, ArcGisLayer
from hip.sources.base import Discovery, ReleaseRef, SourceAdapter, SourceError
from hip.sources.xlsx import rows, sheets

SCHOOL_HOME = "https://www.nj.gov/education/spr/download/"
CRIME_HOME = "https://nj.gov/njsp/ucr/uniform-crime-reports.shtml"
CRIME_URL = "https://nj.gov/njsp/ucr/pdf/current/20250416_2023_Uniform_Crime_Report.xlsx"
CDC_DATASETS = {"county": "swc5-untb", "tract": "cwsq-ngmh", "zip": "qnzd-25i4"}
HEALTH_MEASURES = {"GHLTH", "MHLTH", "ACCESS2"}


def percent(value: str) -> float | None:
    """Publisher suppression stays missing, never zero or a computed replacement."""
    if (
        value.startswith(("<", ">"))
        or value in {"", "*", "**", "N/A", "NA", "-", "—"}
        or any(
            s in value.lower()
            for s in ("fewer", "suppressed", "not available", "no data")
        )
    ):
        return None
    try:
        result = float(value.rstrip("%"))
    except ValueError as exc:
        raise SourceError(f"Unrecognized community percentage: {value!r}") from exc
    if not math.isfinite(result) or not 0 <= result <= 100:
        raise SourceError("Community percentage outside 0–100")
    return result


def worksheet(path: Path, sheet: str, required: set[str]) -> list[dict[str, str]]:
    header: dict[str, str] | None = None
    result = []
    for _, cells in rows(path, sheet):
        if header is None:
            if required <= set(cells.values()):
                header = cells
            continue
        record = {name: cells.get(column, "") for column, name in header.items()}
        if record.get("CountyCode") == "end of worksheet":
            break
        if record.get("CountyCode"):
            result.append(record)
    if header is None:
        raise SourceError(f"{sheet}: required district columns missing")
    return result


def record(
    kind: str, entity: str, key: str, payload: dict[str, Any], snapshot: str | None
) -> dict[str, object]:
    return dict(
        kind=kind,
        entity_id=entity,
        record_id=key,
        payload=json.dumps(payload, allow_nan=False),
        snapshot=snapshot,
    )


class SchoolPerformanceAdapter(SourceAdapter):
    source_id: ClassVar[str] = "nj_school_performance"
    default_vintage: ClassVar[str] = "2024-2025"
    landing_format: ClassVar[str] = "xlsx_records"
    minimum: ClassVar[int] = 500

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        year = vintage or self.newest or self.default_vintage
        if (
            not re.fullmatch(r"20\d\d-20\d\d", year)
            or int(year[-4:]) != int(year[:4]) + 1
        ):
            raise SourceError("Invalid school-year vintage")
        return [
            ReleaseRef(
                self.source_id,
                "districts",
                year,
                f"https://www.nj.gov/education/sprreports/download/DataFiles/{year}/Database_DistrictStateDetail.xlsx",
            )
        ]

    def discover(self, today: date) -> Discovery:
        response = self._ask(SCHOOL_HOME)
        floor = self.newest or self.default_vintage
        if response is None or not response.is_success:
            return self._discovered(floor, reached=False)
        offered = re.findall(r'<option\s+value="(20\d\d-20\d\d)"', response.text)
        if not offered:
            raise SourceError("School download year selector changed")
        self.newest = max([floor, *offered])
        return self._discovered(self.newest, reached=True)

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        identity = {"CountyCode", "DistrictCode", "DistrictName"}
        districts: dict[str, dict[str, Any]] = {}
        for r in worksheet(path, "HeaderContact", identity):
            key = f"{r['CountyCode']}-{r['DistrictCode']}"
            if r["CountyCode"] == "00":
                continue
            if not re.fullmatch(r"\d{2}-\d{4}", key) or key in districts:
                raise SourceError("Invalid or duplicate school district identity")
            districts[key] = {
                "district_id": key,
                "name": r["DistrictName"],
                "school_year": ref.vintage,
                "indicators": [],
                "notes": [],
                "url": SCHOOL_HOME,
            }
        year = f"{ref.vintage[:4]}-{ref.vintage[-2:]}"
        columns = (
            (
                "ELAParticipationPerformance",
                "MetExceededExpectations_District",
                "English language arts: met or exceeded expectations",
            ),
            (
                "MathParticipationPerformance",
                "MetExceededExpectations_District",
                "Math: met or exceeded expectations",
            ),
            (
                "ChronicAbsenteeismTrends",
                "ChronicAbsenteeismRate_District",
                "Students chronically absent",
            ),
        )
        for sheet, column, label in columns:
            for r in worksheet(
                path, sheet, identity | {"SchoolYear", "StudentGroup", column}
            ):
                key = f"{r['CountyCode']}-{r['DistrictCode']}"
                if (
                    key not in districts
                    or r["SchoolYear"] != year
                    or r["StudentGroup"] != "All Students"
                ):
                    continue
                value = percent(r[column])
                districts[key]["indicators"].append(
                    {
                        "id": sheet,
                        "label": label,
                        "value": value,
                        "suppression": r[column] or "Not reported"
                        if value is None
                        else None,
                        "basis": "All Students; district-wide, across grades",
                    }
                )
        for r in worksheet(path, "Data Quality Notes", identity | {"Data Quailty Note"}):
            key = f"{r['CountyCode']}-{r['DistrictCode']}"
            if key in districts and r["Data Quailty Note"]:
                districts[key]["notes"].append(r["Data Quailty Note"])
        if len(districts) < cls.minimum:
            raise SourceError("School district inventory unexpectedly small")
        if sum(bool(d["indicators"]) for d in districts.values()) < cls.minimum:
            raise SourceError("School-year indicators missing or unexpectedly small")
        for d in districts.values():
            ids = [i["id"] for i in d["indicators"]]
            if len(ids) != len(set(ids)):
                raise SourceError("Duplicate school-year indicator")
        return [
            record(
                "school_performance",
                f"district:{key}",
                key,
                d,
                f"{ref.vintage[-4:]}-06-30",
            )
            for key, d in sorted(districts.items())
        ]


class SchoolBoundariesAdapter(ArcGisAdapter):
    source_id: ClassVar[str] = "nj_school_boundaries"
    LAYERS: ClassVar[dict[str, ArcGisLayer]] = {
        kind: ArcGisLayer(
            url=f"https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/School_Districts___{kind.title()}/FeatureServer/0",
            fields=("OBJECTID", f"NJDOE_ID_{code}", "DIST_NAME", "SD_TYPE", "GEOID"),
            minimum=floor,
        )
        for kind, code, floor in (
            ("unified", "U", 300),
            ("elementary", "E", 150),
            ("secondary", "S", 40),
        )
    }


class CrimeAdapter(SourceAdapter):
    source_id: ClassVar[str] = "nj_crime"
    default_vintage: ClassVar[str] = "2023"
    landing_format: ClassVar[str] = "xlsx_records"
    minimum: ClassVar[int] = 400

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if vintage not in (None, "2023") or self.newest not in (None, "2023"):
            raise SourceError(
                "New crime workbook needs its header and reporting coverage reviewed"
            )
        return [ReleaseRef(self.source_id, "agencies", "2023", CRIME_URL)]

    def discover(self, today: date) -> Discovery:
        response = self._ask(CRIME_HOME)
        if response is None or not response.is_success:
            return self._discovered("2023", reached=False)
        offered = re.findall(
            r'href="([^"]*_(20\d\d)_Uniform_Crime_Report\.xlsx)"', response.text, re.I
        )
        if not offered or not any(
            urljoin(CRIME_HOME, url) == CRIME_URL for url, _ in offered
        ):
            raise SourceError("Reviewed annual crime workbook no longer offered")
        newest = max(year for _, year in offered)
        return self._discovered(
            "2023",
            reached=True,
            pending=newest if newest > "2023" else None,
            pending_reason="New annual workbook requires reporting-coverage review"
            if newest > "2023"
            else None,
        )

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        result = []
        for sheet in sheets(path):
            if sheet in {"DocumentMap", "State Police"}:
                continue
            agency: dict[str, str] | None = None
            checked = False
            year_checked = False
            for n, r in rows(path, sheet):
                if n == 1 and f"JAN - {ref.vintage} TO DEC - {ref.vintage}" not in r.get(
                    "B", ""
                ):
                    raise SourceError("Crime reporting year changed")
                if n == 1:
                    year_checked = True
                if r.get("A") == "ORINumber":
                    if [r.get(c) for c in "DEFGHIJKL"] != [
                        "Murder",
                        "Rape",
                        "Robbery",
                        "Assault",
                        "Burglary",
                        "Larceny",
                        "Auto Theft",
                        "Total",
                        "Months",
                    ]:
                        raise SourceError("Crime offense/reporting columns changed")
                    checked = True
                elif re.fullmatch(r"NJ\d{7}", r.get("A", "")):
                    if agency is not None:
                        raise SourceError("Crime agency without an offense row")
                    agency = r
                elif r.get("B") == "Number of Offenses" and agency is not None:
                    if not checked:
                        raise SourceError("Crime worksheet missing header")
                    try:
                        months = int(r["L"])
                        counts = {
                            label: int(r[col])
                            for col, label in zip(
                                "DEFGHIJ",
                                (
                                    "murder",
                                    "rape",
                                    "robbery",
                                    "assault",
                                    "burglary",
                                    "larceny",
                                    "auto_theft",
                                ),
                                strict=True,
                            )
                        }
                        total = int(r["K"])
                    except (KeyError, ValueError) as exc:
                        raise SourceError(
                            "Crime counts/reporting months missing"
                        ) from exc
                    if (
                        not 0 <= months <= 12
                        or min(counts.values()) < 0
                        or total != sum(counts.values())
                    ):
                        raise SourceError("Invalid crime counts/reporting months")
                    # Cape May is one sheet; use explicit published chapter order,
                    # not ORI geography (NJ022 agencies appear in Mercer's chapter).
                    counties = [
                        "Atlantic",
                        "Bergen",
                        "Burlington",
                        "Camden",
                        "Cape May",
                        "Cumberland",
                        "Essex",
                        "Gloucester",
                        "Hudson",
                        "Hunterdon",
                        "Mercer",
                        "Middlesex",
                        "Monmouth",
                        "Morris",
                        "Ocean",
                        "Passaic",
                        "Salem",
                        "Somerset",
                        "Sussex",
                        "Union",
                        "Warren",
                    ]
                    if sheet not in counties:
                        raise SourceError("Unreviewed crime county chapter")
                    county = counties.index(sheet) + 1
                    payload = {
                        "agency": agency["B"],
                        "ori": agency["A"],
                        "county": sheet,
                        "year": int(ref.vintage),
                        "months_reported": months,
                        "complete": months == 12,
                        "reported_offenses": total,
                        "counts": counts,
                        "url": ref.url,
                    }
                    result.append(
                        record(
                            "crime_agency",
                            f"county:34{2 * county - 1:03d}",
                            agency["A"],
                            payload,
                            f"{ref.vintage}-12-31",
                        )
                    )
                    agency = None
            if agency is not None:
                raise SourceError("Crime agency without an offense row")
            if not checked or not year_checked:
                raise SourceError("Crime worksheet missing year or header")
        if len(result) < cls.minimum or len({r["record_id"] for r in result}) != len(
            result
        ):
            raise SourceError("Crime inventory incomplete or duplicated")
        return result


class PlacesAdapter(SourceAdapter):
    source_id: ClassVar[str] = "cdc_places"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "xlsx_records"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        if vintage not in (None, "current"):
            raise SourceError("CDC endpoints replace their release in place; use current")
        return [
            ReleaseRef(
                self.source_id,
                level,
                "current",
                f"https://data.cdc.gov/resource/{dataset}.json",
            )
            for level, dataset in CDC_DATASETS.items()
        ]

    def _client(self) -> httpx.Client:
        return httpx.Client(headers=self.headers, timeout=60)

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.json"

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        where = (
            "datavaluetypeid='CrdPrv' AND measureid in ('GHLTH','MHLTH','ACCESS2') AND "
            + (
                "(locationid like '07%' OR locationid like '08%')"
                if ref.layer == "zip"
                else "stateabbr='NJ'"
            )
        )
        data: list[dict[str, Any]] = []
        with self._client() as client:
            meta = client.get(
                f"https://data.cdc.gov/api/views/{CDC_DATASETS[ref.layer]}.json"
            )
            meta.raise_for_status()
            name = meta.json()["name"]
            if not re.search(r"20\d\d release$", name):
                raise SourceError("CDC release identity missing")
            response = client.get(
                ref.url, params={"$select": "count(*) as n", "$where": where}
            )
            response.raise_for_status()
            expected = int(response.json()[0]["n"])
            floors = {"county": 60, "tract": 5000, "zip": 1000}
            if not floors[ref.layer] <= expected <= 12000:
                raise SourceError("CDC NJ query unexpectedly small or unbounded")
            for start in range(0, expected, 1000):
                response = client.get(
                    ref.url,
                    params={
                        "$where": where,
                        "$limit": 1000,
                        "$offset": start,
                        "$order": "locationid,measureid",
                    },
                )
                response.raise_for_status()
                data.extend(response.json())
        if (
            len(data) != expected
            or len({(r["locationid"], r["measureid"]) for r in data}) != expected
        ):
            raise SourceError("CDC paged response truncated or duplicated")
        destination.write_text(
            json.dumps({"release_name": name, "data": data}), encoding="utf-8"
        )

    @classmethod
    def xlsx_records(cls, path: Path, ref: ReleaseRef) -> list[dict[str, object]]:
        raw = json.loads(path.read_text())
        name = raw["release_name"]
        release = re.search(r"(20\d\d) release$", name)
        if release is None:
            raise SourceError("CDC release identity missing")
        result = []
        for r in raw["data"]:
            if (
                r["measureid"] not in HEALTH_MEASURES
                or r["datavaluetypeid"] != "CrdPrv"
                or r["data_value_unit"] != "%"
            ):
                raise SourceError("Unexpected CDC measure, basis or unit")
            value = percent(r.get("data_value", ""))
            low, high = (
                percent(r.get("low_confidence_limit", "")),
                percent(r.get("high_confidence_limit", "")),
            )
            if value is not None and (
                low is None or high is None or not low <= value <= high
            ):
                raise SourceError("CDC 95% interval missing or inconsistent")
            geoid = r["locationid"]
            size = {"county": 5, "tract": 11, "zip": 5}[ref.layer]
            if not re.fullmatch(rf"\d{{{size}}}", geoid):
                raise SourceError("CDC geography identity changed")
            year = int(r["year"])
            if not 2000 <= year <= int(release[1]):
                raise SourceError("Invalid CDC measurement year")
            payload = {
                "measure": r["measureid"],
                "label": r["measure"],
                "year": year,
                "release": release[1],
                "value": value,
                "low": low,
                "high": high,
                "confidence": 95,
                "suppression": r.get("data_value_footnote", "Not reported")
                if value is None
                else None,
                "basis": "Crude prevalence; model-based estimate",
                "url": f"https://data.cdc.gov/d/{CDC_DATASETS[ref.layer]}",
            }
            result.append(
                record(
                    "health_estimate",
                    f"{ref.layer}:{geoid}",
                    r["measureid"],
                    payload,
                    f"{year}-12-31",
                )
            )
        return result
