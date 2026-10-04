"""Atomic replacement against temporary Postgres tables, never production inventory."""

from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pytest
from sqlalchemy import text

from hip.warehouse.db import get_engine, probe
from hip.warehouse.infrastructure import _validate_payload, load_infrastructure
from hip.warehouse.load import ReleaseProvenance, load_water_systems


@pytest.mark.parametrize(
    "payload",
    [
        {"saidi_all": -1},
        {"saifi_normal": -1},
        {"sales": [{"mwh": -1}]},
        {"sales": [{"revenue_thousand": -1}]},
        {"sales": [{"customers": -1}]},
    ],
)
def test_negative_electricity_values_fail(payload: dict[str, object]) -> None:
    with pytest.raises(ValueError, match="invalid"):
        _validate_payload("electric_utility", payload)


@pytest.fixture
def isolated():  # type: ignore[no-untyped-def]
    if not probe().migrated:
        pytest.skip("needs migrated Postgres")
    with get_engine().connect() as conn, conn.begin():
        conn.execute(
            text("""
            CREATE TEMP TABLE source_releases (
                release_id int PRIMARY KEY, source_id text, layer text,
                vintage text, file_sha256 text, fetched_at timestamptz
            ) ON COMMIT DROP;
            INSERT INTO source_releases VALUES
                (10,'eia861','utilities','2024','staged','2026-08-08'),
                (20,'eia861','utilities','2024','newer','2026-09-09'),
                (30,'epa_sdwis','violations','current','staged','2026-08-08'),
                (40,'epa_sdwis','violations','current','newer','2026-09-09');
            CREATE TEMP TABLE infrastructure_records (
                source_id text, kind text, entity_id text, record_id text,
                payload jsonb, snapshot date, release_id int,
                PRIMARY KEY (source_id,kind,entity_id,record_id)
            ) ON COMMIT DROP;
            INSERT INTO infrastructure_records VALUES
                ('eia861','electric_utility','utility:963','old','{}','2024-12-31',10),
                ('doe_lead','energy_burden','county:34001','keep','{}','2022-12-31',10);
            CREATE TEMP TABLE regions (
                region_id int, geoid text, level region_level
            ) ON COMMIT DROP;
            INSERT INTO regions VALUES (1,'34001','county');
            CREATE TEMP TABLE water_systems (
                region_id int, pwsid text, name text, homes float,
                share_of_homes float, violations int, first_year int, last_year int,
                latest_violation date, latest_violation_what text, violation_kinds text,
                release_id int, resolved_violations int, latest_return_to_compliance date
            ) ON COMMIT DROP;
            INSERT INTO water_systems VALUES
                (1,'old','Old',1,1,0,2021,2025,NULL,NULL,NULL,30,0,NULL);
        """)
        )

        class Engine:
            @contextmanager
            def begin(self):  # type: ignore[no-untyped-def]
                with conn.begin_nested():
                    yield conn

        yield Engine(), conn


def provenance() -> list[ReleaseProvenance]:
    return [
        ReleaseProvenance(
            s, layer, vintage, datetime(2026, 8, 8, tzinfo=UTC), "staged", 1
        )
        for s, layer, vintage in [
            ("eia861", "utilities", "2024"),
            ("epa_sdwis", "violations", "current"),
        ]
    ]


def inventory(path: Path) -> Path:
    with duckdb.connect(str(path)) as con:
        con.execute("CREATE SCHEMA main_staging")
        con.execute("""CREATE TABLE main_staging.stg_eia861_records AS
            SELECT 'eia861' AS source_id, 'electric_utility' AS kind,
                   'utility:963' AS entity_id, '963' AS record_id, '{}' AS payload,
                   date '2024-12-31' AS snapshot, 'utilities' AS release_layer,
                   '2024' AS release_vintage""")
    return path


def water(path: Path, *, geoid: str = "34001") -> Path:
    with duckdb.connect(str(path)) as con:
        con.execute("CREATE SCHEMA main_staging")
        con.execute(
            """CREATE TABLE main_staging.stg_water_systems AS
            SELECT ? AS geoid, 'county' AS level, 'new' AS pwsid, 'New' AS system_name,
                100 AS homes, 1.0 AS share_of_homes, 2 AS violations,
                2021 AS first_year, 2025 AS last_year,
                date '2025-01-01' AS latest_violation,
                'Arsenic' AS latest_violation_what, 'Arsenic' AS violation_kinds,
                'current' AS release_vintage, 1 AS resolved_violations,
                NULL::date AS latest_return_to_compliance""",
            [geoid],
        )
    return path


def test_inventory_exact_file_wins_and_unstaged_source_survives(
    tmp_path: Path, isolated: Any
) -> None:
    engine, conn = isolated
    assert (
        load_infrastructure(
            engine, inventory(tmp_path / "stage.db"), releases=provenance()
        )
        == 1
    )
    assert conn.execute(
        text("SELECT record_id,release_id FROM infrastructure_records ORDER BY record_id")
    ).all() == [("963", 10), ("keep", 10)]


def test_missing_file_preserves_previous_inventory(tmp_path: Path, isolated: Any) -> None:
    engine, conn = isolated
    with pytest.raises(ValueError, match="missing exact release"):
        load_infrastructure(engine, inventory(tmp_path / "stage.db"), releases=[])
    assert (
        conn.execute(
            text("SELECT record_id FROM infrastructure_records WHERE source_id='eia861'")
        ).scalar_one()
        == "old"
    )


def test_water_exact_file_wins(tmp_path: Path, isolated: Any) -> None:
    engine, conn = isolated
    assert (
        load_water_systems(engine, water(tmp_path / "stage.db"), releases=provenance())
        == 1
    )
    assert conn.execute(
        text("SELECT pwsid,release_id,resolved_violations FROM water_systems")
    ).one() == ("new", 30, 1)


@pytest.mark.parametrize("missing", ["release", "region"])
def test_invalid_water_load_rolls_back(
    tmp_path: Path, isolated: Any, missing: str
) -> None:
    engine, conn = isolated
    with pytest.raises(ValueError, match="missing"):
        load_water_systems(
            engine,
            water(
                tmp_path / "stage.db", geoid="34999" if missing == "region" else "34001"
            ),
            releases=[] if missing == "release" else provenance(),
        )
    assert conn.execute(text("SELECT pwsid FROM water_systems")).scalar_one() == "old"
