"""Manual CSV -> real landing -> real dbt models, in a disposable local project.

No publisher bytes, warehouse, extension downloads, or dbt telemetry. The project
copies the production models and macro verbatim, not a handwritten unpivot query.
"""

import csv
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

import duckdb
import httpx
import pytest

from hip.config import REPO_ROOT
from hip.landing.tabular import land_csv
from hip.sources.zillow import ZhviAdapter, ZoriAdapter

FIXTURES = Path(__file__).parent / "fixtures" / "data_guards"


@pytest.fixture(autouse=True)
def no_http(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("Zillow is manual: HTTP is forbidden")

    monkeypatch.setattr(httpx, "stream", refuse)
    monkeypatch.setattr(httpx, "get", refuse)
    monkeypatch.setattr(httpx, "head", refuse)


def build(tmp_path: Path, variant: str = "normal"):
    parquet = tmp_path / "parquet"
    for cls in (ZhviAdapter, ZoriAdapter):
        adapter = cls()
        assert adapter.manual
        for ref in adapter.refs():
            assert ref.url == (
                f"https://files.zillowstatic.com/research/public_csvs/{adapter.product}/"
                f"{adapter.LAYER_PREFIX[ref.layer]}_{adapter.file_stem}.csv"
            )
            dropped = adapter.manual_path(ref, tmp_path / "raw")
            dropped.parent.mkdir(parents=True, exist_ok=True)
            with (FIXTURES / f"{ref.layer}.csv").open() as handle:
                rows = list(csv.reader(handle))
            if variant == "extra_metadata":
                rows = [
                    row + ["revision" if i == 0 else "synthetic"]
                    for i, row in enumerate(rows)
                ]
            elif variant == "renamed_metadata":
                rows[0][rows[0].index("StateName")] = "PublisherStateName"
            elif variant == "missing_required_metadata":
                rows[0][rows[0].index("State")] = "Jurisdiction"
            elif variant == "renamed_month":
                rows[0][rows[0].index("2025-03-31")] = "2025/03/31"
            elif variant == "missing_month":
                gone = rows[0].index("2025-02-28")
                rows = [row[:gone] + row[gone + 1 :] for row in rows]
            with dropped.open("w", newline="") as handle:
                csv.writer(handle).writerows(rows)
            release = adapter.fetch(ref, raw_dir=tmp_path / "raw")
            land_csv(release, parquet_dir=parquet)

    project = tmp_path / "project"
    for directory in ("models", "macros"):
        (project / directory).mkdir(parents=True)
    for product in ("zhvi", "zori"):
        shutil.copy2(
            REPO_ROOT / f"dbt/models/staging/stg_zillow_{product}.sql",
            project / f"models/stg_zillow_{product}.sql",
        )
    shutil.copy2(
        REPO_ROOT / "dbt/macros/zillow_observations.sql",
        project / "macros/zillow_observations.sql",
    )
    (project / "dbt_project.yml").write_text(
        "name: guard_fixture\nversion: '1.0'\nconfig-version: 2\nprofile: fixture\n"
        f"vars:\n  parquet_dir: '{parquet}'\n  zillow_vintage: current\n"
        "  states: \"'NJ'\"\n"
    )
    database = tmp_path / "fixture.duckdb"
    (project / "profiles.yml").write_text(
        "fixture:\n  target: local\n  outputs:\n    local:\n      type: duckdb\n"
        f"      path: '{database}'\n      threads: 1\n"
    )
    result = subprocess.run(
        [
            str(Path(sys.executable).with_name("dbt")),
            "run",
            "--project-dir",
            str(project),
            "--profiles-dir",
            str(project),
        ],
        env={
            **os.environ,
            "DBT_SEND_ANONYMOUS_USAGE_STATS": "false",
            "DBT_LOG_PATH": str(tmp_path / "logs"),
        },
        capture_output=True,
        text=True,
        timeout=90,
    )
    return result, database


@pytest.mark.parametrize("variant", ["normal", "extra_metadata", "renamed_metadata"])
def test_both_real_models_preserve_every_month_and_layer(tmp_path: Path, variant: str):
    result, database = build(tmp_path, variant)
    assert result.returncode == 0, result.stdout + result.stderr
    with duckdb.connect(str(database), read_only=True) as con:
        for product in ("zhvi", "zori"):
            rows = con.execute(f"SELECT * FROM stg_zillow_{product}").fetchall()
            assert len(rows) == 11
            assert {row[0] for row in rows} == {f"zillow_{product}"}
            assert {row[1] for row in rows} == {"county", "city", "zip"}
            assert {row[5] for row in rows} == {"NJ"}, "out-of-scope rows excluded"
            assert {row[6] for row in rows} == {
                date(2025, 1, 31),
                date(2025, 2, 28),
                date(2025, 3, 31),
            }
            assert len({(row[1], row[2], row[6]) for row in rows}) == len(rows)
            assert all(row[7] is not None for row in rows)
            assert sum(row[7] == 0 for row in rows) == 1, "real zero stays, blanks drop"
            actual = {(r[1], r[2], r[6].isoformat(), r[7]) for r in rows}
            expected = set()
            for layer in ("county", "city", "zip"):
                with (FIXTURES / f"{layer}.csv").open() as handle:
                    for row in csv.DictReader(handle):
                        if row["State"] != "NJ":
                            continue
                        for month in ("2025-01-31", "2025-02-28", "2025-03-31"):
                            if row[month] != "":
                                expected.add(
                                    (layer, row["RegionName"], month, float(row[month]))
                                )
            assert actual == expected, "no region, month or numeric cell skipped"
            assert {r[3] for r in rows if r[1] == "county"} == {"34001"}
            assert {r[2] for r in rows if r[1] == "zip"} == {"01234", "01235"}


def test_renamed_required_metadata_fails_loudly(tmp_path: Path):
    result, _ = build(tmp_path, "missing_required_metadata")
    assert result.returncode != 0
    assert "State" in result.stdout and "not found" in result.stdout


def test_renamed_month_must_not_silently_disappear(tmp_path: Path):
    # Fixed 2026-10-21: the macro's layout guard refuses a date-like column.
    result, _ = build(tmp_path, "renamed_month")
    assert result.returncode != 0, "2025/03/31 silently dropped by both real models"
    assert "unrecognised month column(s) 2025/03/31" in result.stdout


def test_a_missing_month_is_refused_as_a_gap(tmp_path: Path):
    result, _ = build(tmp_path, "missing_month")
    assert result.returncode != 0, "a dropped month column must not load as a gap"
    assert "the month columns have a gap" in result.stdout
