"""Inventory replacement must roll back, and credit the exact fetched file.

Postgres tests use transaction-local TEMP tables, never the live warehouse tables.
"""

from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pytest
from sqlalchemy import text

from hip.warehouse.db import get_engine, probe
from hip.warehouse.load import ReleaseProvenance, load_affordable_housing


def stage(path: Path, *, geoid: str | None = "34001", units: int = 4) -> Path:
    with duckdb.connect(str(path)) as con:
        con.execute("CREATE SCHEMA main_staging")
        con.execute(
            "CREATE TABLE main_staging.stg_hud_assisted_records ("
            "source_id VARCHAR, record_id VARCHAR, geoid VARCHAR, level VARCHAR, "
            "kind VARCHAR, payload JSON, snapshot DATE, "
            "release_layer VARCHAR, release_vintage VARCHAR)"
        )
        con.execute(
            "INSERT INTO main_staging.stg_hud_assisted_records VALUES "
            "('hud_assisted', 'new', ?, 'county', 'hud_property', ?, "
            "'2026-08-07', 'properties', 'current')",
            [geoid, f'{{"units":{units}}}'],
        )
    return path


@pytest.fixture
def isolated_engine():  # type: ignore[no-untyped-def]
    if not probe().migrated:
        pytest.skip("needs migrated Postgres for temporary-table integration test")
    with get_engine().connect() as conn, conn.begin():
        conn.execute(
            text("""
            CREATE TEMP TABLE regions (
                region_id integer PRIMARY KEY, geoid text, level region_level
            ) ON COMMIT DROP;
            CREATE TEMP TABLE source_releases (
                release_id integer PRIMARY KEY, source_id text, layer text,
                vintage text, file_sha256 text, fetched_at timestamptz
            ) ON COMMIT DROP;
            CREATE TEMP TABLE affordable_housing_records (
                region_id integer, source_id text, kind text, record_id text,
                payload jsonb, snapshot date, release_id integer,
                PRIMARY KEY (source_id, kind, record_id)
            ) ON COMMIT DROP;
            INSERT INTO regions VALUES (1, '34001', 'county');
            INSERT INTO source_releases VALUES
                (10, 'hud_assisted', 'properties', 'current', 'staged', '2026-08-08'),
                (20, 'hud_assisted', 'properties', 'current', 'newer', '2026-09-09');
            INSERT INTO affordable_housing_records VALUES
                (1, 'hud_assisted', 'hud_property', 'old', '{}', '2026-08-07', 10),
                (1, 'hud_lihtc', 'lihtc_property', 'keep', '{}', '2020-12-31', 10);
        """)
        )

        class Engine:
            @contextmanager
            def begin(self):  # type: ignore[no-untyped-def]
                with conn.begin_nested():
                    yield conn

        yield Engine(), conn


def releases() -> list[ReleaseProvenance]:
    return [
        ReleaseProvenance(
            "hud_assisted",
            "properties",
            "current",
            datetime(2026, 8, 8, tzinfo=UTC),
            "staged",
            1,
        )
    ]


def test_exact_file_wins_and_unstaged_inventory_is_retained(
    tmp_path: Path,
    isolated_engine: Any,
) -> None:
    engine, conn = isolated_engine
    result = load_affordable_housing(
        engine, stage(tmp_path / "stage.duckdb"), releases=releases()
    )
    assert result == 1
    rows = conn.execute(
        text(
            "SELECT record_id, release_id FROM affordable_housing_records "
            "ORDER BY record_id"
        )
    ).all()
    assert rows == [("keep", 10), ("new", 10)]  # Never credit the newer file (20).


@pytest.mark.parametrize(
    "geoid, message", [("34999", "missing region"), (None, "unmapped")]
)
def test_unresolved_location_retains_previous_inventory(
    tmp_path: Path,
    isolated_engine: Any,
    geoid: str | None,
    message: str,
) -> None:
    engine, conn = isolated_engine
    with pytest.raises(ValueError, match=message):
        load_affordable_housing(
            engine,
            stage(tmp_path / "stage.duckdb", geoid=geoid),
            releases=releases(),
        )
    assert (
        conn.execute(
            text(
                "SELECT record_id FROM affordable_housing_records "
                "WHERE source_id='hud_assisted'"
            )
        ).scalar_one()
        == "old"
    )


def test_missing_exact_release_fails_without_replacing_previous_inventory(
    tmp_path: Path,
    isolated_engine: Any,
) -> None:
    engine, conn = isolated_engine
    with pytest.raises(ValueError, match="missing exact release"):
        load_affordable_housing(engine, stage(tmp_path / "stage.duckdb"), releases=[])
    assert (
        conn.execute(
            text(
                "SELECT record_id FROM affordable_housing_records "
                "WHERE source_id='hud_assisted'"
            )
        ).scalar_one()
        == "old"
    )


def test_invalid_units_are_refused_before_opening_a_transaction(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="invalid units"):
        load_affordable_housing(
            None, stage(tmp_path / "stage.duckdb", units=-1), releases=[]
        )  # type: ignore[arg-type]
