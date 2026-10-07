"""Exact provenance and rollback exercised in temporary tables, not live data."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pytest
from sqlalchemy import text

from hip.warehouse.community import load_community
from hip.warehouse.db import get_engine, probe
from hip.warehouse.load import ReleaseProvenance


@pytest.fixture
def isolated() -> Iterator[Any]:
    if not probe().migrated:
        pytest.skip("needs migrated Postgres")
    with get_engine().connect() as conn, conn.begin():
        conn.execute(
            text("""
            CREATE TEMP TABLE source_releases (
              release_id int PRIMARY KEY,source_id text,layer text,vintage text,
              file_sha256 text,fetched_at timestamptz) ON COMMIT DROP;
            INSERT INTO source_releases VALUES
              (10,'nj_school_performance','districts','2024-2025','staged','2026-08-08'),
              (20,'nj_school_performance','districts','2024-2025','newer','2026-09-09');
            CREATE TEMP TABLE community_records (
              source_id text,kind text,entity_id text,record_id text,payload jsonb,
              snapshot date,release_id int,
              PRIMARY KEY(source_id,kind,entity_id,record_id)) ON COMMIT DROP;
            INSERT INTO community_records VALUES
              ('nj_school_performance','school_performance','district:01-0010','old','{}',NULL,10),
              ('cdc_places','health_estimate','county:34001','keep','{}',NULL,10);
        """)
        )

        class Engine:
            @contextmanager
            def begin(self) -> Iterator[Any]:
                with conn.begin_nested():
                    yield conn

        yield Engine(), conn


def stage(
    path: Path, *, payload: str = '{"indicators": []}', duplicate: bool = False
) -> Path:
    with duckdb.connect(str(path)) as c:
        c.execute("CREATE SCHEMA main_staging")
        c.execute(
            """CREATE TABLE main_staging.stg_nj_school_performance_records AS
            SELECT 'nj_school_performance' AS source_id,'school_performance' AS kind,
              'district:01-0010' AS entity_id,'01-0010' AS record_id,? AS payload,
              date '2025-06-30' AS snapshot,'districts' AS release_layer,
              '2024-2025' AS release_vintage,'staged' AS file_sha256""",
            [payload],
        )
        if duplicate:
            c.execute(
                "INSERT INTO main_staging.stg_nj_school_performance_records "
                "SELECT * FROM main_staging.stg_nj_school_performance_records"
            )
    return path


def provenance(sha: str = "staged") -> list[ReleaseProvenance]:
    return [
        ReleaseProvenance(
            "nj_school_performance",
            "districts",
            "2024-2025",
            datetime(2026, 8, 8, tzinfo=UTC),
            sha,
            1,
        )
    ]


def test_exact_staged_file_not_newest_and_unstaged_survives(
    tmp_path: Path, isolated: Any
) -> None:
    engine, conn = isolated
    assert (
        load_community(engine, stage(tmp_path / "stage.db"), releases=provenance()) == 1
    )
    assert conn.execute(
        text("SELECT record_id,release_id FROM community_records ORDER BY record_id")
    ).all() == [("01-0010", 10), ("keep", 10)]


@pytest.mark.parametrize(
    "scenario", ["wrong_sha", "newer_cache", "invalid", "duplicate", "empty"]
)
def test_bad_inventory_preserves_previous_copy(
    tmp_path: Path, isolated: Any, scenario: str
) -> None:
    engine, conn = isolated
    path = stage(
        tmp_path / "stage.db",
        payload='{"indicators": [{"value": -1}]}'
        if scenario == "invalid"
        else '{"indicators": []}',
        duplicate=scenario == "duplicate",
    )
    if scenario == "empty":
        with duckdb.connect(str(path)) as c:
            c.execute("DELETE FROM main_staging.stg_nj_school_performance_records")
    with pytest.raises(ValueError):
        load_community(
            engine,
            path,
            releases=provenance(
                "missing"
                if scenario == "wrong_sha"
                else "newer"
                if scenario == "newer_cache"
                else "staged"
            ),
        )
    assert conn.execute(
        text("SELECT record_id FROM community_records ORDER BY record_id")
    ).all() == [("keep",), ("old",)]
