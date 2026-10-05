"""M42 source conventions and deterministic staging, without publisher requests."""

import csv
import io
import json
from datetime import date
from pathlib import Path
from typing import Any
from zipfile import ZipFile

import duckdb
import httpx
import jinja2
import pytest

from hip.config import REPO_ROOT
from hip.publish import _plan
from hip.sources.base import SourceError
from hip.sources.infrastructure import EiaAdapter, UcmrAdapter, numeric


def test_discovery_ignores_early_eia_releases() -> None:
    adapter = EiaAdapter()
    adapter.probe_transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            text='<a href="zip/f8612024.zip">final</a>'
            '<a href="zip/f8612025er.zip">early</a>',
        )
    )
    assert adapter.discover(date(2026, 10, 4)).newest == "2024"


def test_discovery_recognizes_new_final_without_network() -> None:
    adapter = EiaAdapter()
    adapter.probe_transport = httpx.MockTransport(
        lambda request: httpx.Response(200, text='<a href="zip/f8612025.zip">final</a>')
    )
    assert adapter.discover(date(2026, 10, 4)).newest == "2025"
    assert adapter.refs()[0].vintage == "2025"


@pytest.mark.parametrize("value", ["NaN", "inf", "not a number"])
def test_non_numeric_or_nonfinite_inputs_fail(value: str) -> None:
    with pytest.raises(SourceError):
        numeric(value)


def samples(path: Path, *, units: str = "µg/L", sign: str = "<") -> Path:
    r = dict(
        State="NJ",
        PWSID="NJ000001",
        SampleID="one",
        Contaminant="PFOA",
        CollectionDate="1/21/2026",
        Units=units,
        MRL="0.004",
        AnalyticalResultsSign=sign,
        AnalyticalResultValue="" if sign == "<" else "0.005",
        SamplePointType="EP",
        FacilityID="f",
        SamplePointID="s",
        MethodID="533",
    )
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(r), delimiter="\t")
    writer.writeheader()
    writer.writerow(r)
    with ZipFile(path, "w") as archive:
        archive.writestr("UCMR5_All_MA_WY.txt", buffer.getvalue().encode("cp1252"))
    return path


def test_below_reporting_limit_is_not_zero_and_followup_dates_are_retained(
    tmp_path: Path,
) -> None:
    r = UcmrAdapter.xlsx_records(samples(tmp_path / "a.zip"), UcmrAdapter().refs()[0])[0]
    assert r["detected"] is False
    assert r["ng_l"] is None
    assert r["reporting_limit_ng_l"] == 4
    assert r["collected"] == "2026-01-21"
    assert r["method_id"] == "533"
    assert UcmrAdapter().refs()[0].mutable


def test_detected_results_convert_ppb_to_ppt(tmp_path: Path) -> None:
    r = UcmrAdapter.xlsx_records(
        samples(tmp_path / "a.zip", sign="="), UcmrAdapter().refs()[0]
    )[0]
    assert r["ng_l"] == 5


def test_changed_sample_units_fail_instead_of_mispricing_concentrations(
    tmp_path: Path,
) -> None:
    with pytest.raises(SourceError, match="units"):
        UcmrAdapter.xlsx_records(
            samples(tmp_path / "a.zip", units="ng/L"), UcmrAdapter().refs()[0]
        )


def test_eia_preserves_service_types_and_reliability_basis(
    tmp_path: Path, monkeypatch: Any
) -> None:
    with ZipFile(tmp_path / "a.zip", "w") as archive:
        archive.writestr("Sales_Ult_Cust_2024.xlsx", b"stub")
        archive.writestr("Reliability_2024.xlsx", b"stub")

    def offered(path: Path, sheet: str):  # type: ignore[no-untyped-def]
        if sheet == "States":
            yield 1, {"J": "RESIDENTIAL"}
            yield (
                3,
                {
                    "B": "Utility Number",
                    "C": "Utility Name",
                    "J": "Thousand Dollars",
                    "K": "Megawatthours",
                },
            )
            for kind in ("Bundled", "Delivery", "Energy"):
                yield (
                    4,
                    {
                        "A": "2024",
                        "B": "963",
                        "C": "Utility",
                        "G": "NJ",
                        "E": kind,
                        "F": "O",
                        "J": "200",
                        "K": "1000",
                        "L": "40",
                    },
                )
            yield (
                5,
                {
                    "A": "2024",
                    "B": "99999",
                    "C": "Adjustment 2024",
                    "G": "NJ",
                    "E": "Bundled",
                    "F": "I",
                    "J": "0",
                    "K": "0",
                    "L": "-18",
                },
            )
        else:
            yield (
                2,
                {
                    "F": "All Events (With Major Event Days)",
                    "I": "Without Major Event Days",
                },
            )
            yield (
                3,
                {
                    "B": "Utility Number",
                    "C": "Utility Name",
                    **{k: "SAIDI (minutes per year)" for k in ("F", "I", "R", "U")},
                    **{k: "SAIFI (times per year)" for k in ("G", "J", "S", "V")},
                },
            )
            yield (
                4,
                {
                    "A": "2024",
                    "B": "963",
                    "C": "Utility",
                    "D": "NJ",
                    "F": "120",
                    "G": "1.5",
                    "I": "80",
                    "J": "1",
                },
            )

    monkeypatch.setattr("hip.sources.infrastructure.rows", offered)
    records = EiaAdapter.xlsx_records(tmp_path / "a.zip", EiaAdapter().refs()[0])
    assert len(records) == 1
    assert records[0]["utility_id"] == "963"
    record = json.loads(str(records[0]["payload"]))
    assert [s["service_type"] for s in record["sales"]] == [
        "Bundled",
        "Delivery",
        "Energy",
    ]
    assert record["saidi_all"] == 120
    assert record["saidi_normal"] == 80
    assert record["method"] == "IEEE"


def stage(con: duckdb.DuckDBPyConnection, model: str, parquet: Path) -> None:
    sql = (REPO_ROOT / "dbt/models/staging" / f"{model}.sql").read_text()
    rendered = jinja2.Template(sql).render(
        config=lambda **kwargs: "",
        ref=lambda name: name,
        release_vintage=lambda: (
            "regexp_extract(filename, '/([^/]+)/[^/]+\\.parquet$', 1)"
        ),
        var=lambda name: str(parquet) if name == "parquet_dir" else {"epa_sdwis": 2026},
    )
    con.execute(f"CREATE OR REPLACE TABLE {model} AS {rendered}")


def parquet(
    con: duckdb.DuckDBPyConnection, path: Path, records: list[dict[str, Any]]
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    source = path.with_suffix(".json")
    source.write_text(json.dumps(records))
    con.execute(
        f"COPY (SELECT * FROM read_json_auto('{source}')) TO '{path}' (FORMAT PARQUET)"
    )


def test_pfas_staging_keeps_all_nondetects_missing_not_zero(tmp_path: Path) -> None:
    with duckdb.connect() as con:
        parquet(
            con,
            tmp_path / "epa_ucmr5/current/samples.parquet",
            [
                {
                    "pwsid": "NJ000001",
                    "sample_id": "one",
                    "facility_id": "f",
                    "sample_point": "s",
                    "method_id": "533",
                    "contaminant": "PFOA",
                    "collected": "2026-01-21",
                    "detected": False,
                    "ng_l": None,
                    "reporting_limit_ng_l": 4,
                }
            ],
        )
        stage(con, "stg_epa_ucmr5_records", tmp_path)
        r = json.loads(
            con.execute("SELECT payload FROM stg_epa_ucmr5_records").fetchone()[0]
        )
        assert r["maximum_ng_l"] is None
        assert r["detections"] == 0
        assert r["last_sample"] == "2026-01-21"
        assert r["reference_ng_l"] == 4


def test_latest_lead_submission_does_not_sum_inventory_years(tmp_path: Path) -> None:
    with duckdb.connect() as con:
        records = [
            {
                "PWID": "NJ000001",
                "SYS_NAME": "One",
                "OBJECTID": year,
                "SUBMISSION_YEAR": year,
                "DATE_UPDATED": f"{year}-10-01",
                "LSLI": count,
                "LSGA": 0,
                "LSGO": None,
                "LSUN": 10,
                "LSNL": 90,
                "SLI_ACCESS": None,
            }
            for year, count in [(2022, 10), (2023, 5)]
        ]
        parquet(con, tmp_path / "njdep_lead_lines/current/lines.parquet", records)
        stage(con, "stg_njdep_lead_lines_records", tmp_path)
        r = json.loads(
            con.execute("SELECT payload FROM stg_njdep_lead_lines_records").fetchone()[0]
        )
        assert r["lead"] == 5
        assert r["lead_connectors"] is None
        assert r["submission_year"] == 2023


def test_return_to_compliance_belongs_to_same_latest_violation(tmp_path: Path) -> None:
    with duckdb.connect() as con:
        con.execute(
            "CREATE TABLE stg_block_homes AS SELECT '3400100001' AS municipality_geoid, "
            "'07001' AS zcta_geoid, '34001' AS county_geoid, "
            "'b' AS block_geoid, 100 AS homes"
        )
        con.execute(
            "CREATE TABLE stg_water_blocks AS SELECT 'b' AS block_geoid, "
            "'NJ000001' AS pwsid, 'One' AS system_name, 1.0 AS share"
        )
        parquet(
            con,
            tmp_path / "epa_sdwis/current/codes.parquet",
            [
                {
                    "value_type": "CONTAMINANT_CODE",
                    "value_code": "a",
                    "value_description": "Arsenic",
                }
            ],
        )
        records = [
            {
                "pwsid": "NJ000001",
                "pws_type_code": "CWS",
                "violation_id": str(i),
                "contaminant_code": "a",
                "rule_family_code": "x",
                "compl_per_begin_date": stamp,
                "rtc_date": rtc,
            }
            for i, stamp, rtc in [
                (1, "2022-01-01", "2024-01-01"),
                (2, "2025-01-01", None),
            ]
        ]
        parquet(con, tmp_path / "epa_sdwis/current/violations.parquet", records)
        stage(con, "stg_water_systems", tmp_path)
        rows = con.execute(
            "SELECT level, violations, resolved_violations, latest_return_to_compliance "
            "FROM stg_water_systems ORDER BY level"
        ).fetchall()
        assert len(rows) == 4  # county, municipality, state, ZIP
        assert all(r[1:] == (2, 1, None) for r in rows)


def test_new_endpoint_is_in_static_artifact_plan() -> None:
    assert dict(_plan([12], []))["/regions/12/utilities"] == "regions/12/utilities.json"


def test_territory_pieces_are_unioned_before_home_weighting(tmp_path: Path) -> None:
    with duckdb.connect() as con:
        con.execute("LOAD spatial")
        con.execute("""CREATE TABLE stg_block_homes AS SELECT
            '3400100001' AS municipality_geoid, '07001' AS zcta_geoid,
            '34001' AS county_geoid, 'b' AS block_geoid, 100 AS homes,
            ST_MakeEnvelope(0,0,1,1) AS geom""")
        half = con.execute("SELECT ST_AsGeoJSON(ST_MakeEnvelope(0,0,0.5,1))").fetchone()[
            0
        ]
        full = con.execute("SELECT ST_AsGeoJSON(ST_MakeEnvelope(0,0,1,1))").fetchone()[0]
        parquet(
            con,
            tmp_path / "njdep_utility_areas/current/electric.parquet",
            [
                {"NAME": "Atlantic City Electric", "geometry": half},
                {"NAME": "Atlantic City Electric", "geometry": half},
            ],
        )
        parquet(
            con,
            tmp_path / "njdep_utility_areas/current/gas.parquet",
            [
                {"NAME": "Gas", "geometry": full},
            ],
        )
        stage(con, "stg_njdep_utility_areas_records", tmp_path)
        rows = con.execute(
            "SELECT payload FROM stg_njdep_utility_areas_records"
        ).fetchall()
        assert len(rows) == 8  # two fuels, four explicitly scoped geographies
        electric = [
            json.loads(r[0]) for r in rows if json.loads(r[0])["fuel"] == "electric"
        ]
        assert all(r["approximate_share"] == 0.5 for r in electric)
        assert all(r["eia_id"] == "963" for r in electric)
