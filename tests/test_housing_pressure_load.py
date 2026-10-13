"""Load atomicity and source isolation, using temporary tables only."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pytest
from sqlalchemy import text

from hip.warehouse.db import get_engine, probe
from hip.warehouse.housing_pressure import load_housing_pressure
from hip.warehouse.load import ReleaseProvenance


@pytest.fixture
def isolated() -> Iterator[Any]:
    if not probe().migrated:
        pytest.skip("needs migrated Postgres")
    with get_engine().connect() as conn, conn.begin():
        conn.execute(
            text("""CREATE TEMP TABLE source_releases(
            release_id int PRIMARY KEY,source_id text,layer text,vintage text,
            file_sha256 text,fetched_at timestamptz) ON COMMIT DROP;
            INSERT INTO source_releases VALUES(1,'hud_chas_bulk','050','2018-2022',
              'staged','2026-01-01');
            CREATE TEMP TABLE community_records(source_id text,kind text,
              entity_id text,record_id text,payload jsonb,snapshot date,release_id int)
              ON COMMIT DROP;
            INSERT INTO community_records VALUES
              ('hud_chas_bulk','housing_pressure','county:old','old','{}',NULL,1),
              ('cdc_places','health_estimate','county:keep','keep','{}',NULL,1);
        """)
        )

        class Engine:
            @contextmanager
            def begin(self) -> Iterator[Any]:
                with conn.begin_nested():
                    yield conn

        yield Engine(), conn


def stage(path: Path, sha: str = "staged", incomplete: bool = False) -> Path:
    with duckdb.connect(str(path)) as con:
        con.execute("CREATE SCHEMA main_staging")
        con.execute(
            """CREATE TABLE main_staging.stg_housing_pressure AS
          SELECT 'county' AS "level",'34035' AS geoid,t.tenure,b.band,
            '2018-2022' AS vintage,'050' AS release_layer,? AS file_sha256,
            100::double AS total,10::double AS total_moe,
            50::double AS burdened,10::double AS burdened_moe,
            20::double AS severe,5::double AS severe_moe,
            10::double AS "unknown",2::double AS unknown_moe
          FROM (VALUES ('renter'),('owner')) t(tenure),range(5) b(band)""",
            [sha],
        )
        if incomplete:
            con.execute(
                "DELETE FROM main_staging.stg_housing_pressure "
                "WHERE tenure='owner' AND band=4"
            )
    return path


def refs() -> list[ReleaseProvenance]:
    return [
        ReleaseProvenance(
            "hud_chas_bulk",
            "050",
            "2018-2022",
            datetime(2026, 1, 1, tzinfo=UTC),
            "staged",
            21,
        )
    ]


def test_exact_release_replaces_only_its_cohorts(isolated: Any, tmp_path: Path) -> None:
    engine, conn = isolated
    assert (
        load_housing_pressure(engine, stage(tmp_path / "stage.duckdb"), releases=refs())
        == 10
    )
    assert (
        conn.execute(
            text("SELECT count(*) FROM community_records WHERE kind='health_estimate'")
        ).scalar()
        == 1
    )
    assert (
        conn.execute(
            text(
                "SELECT count(*) FROM community_records "
                "WHERE kind='housing_pressure' AND release_id=1"
            )
        ).scalar()
        == 10
    )


@pytest.mark.parametrize("sha,incomplete", [("changed", False), ("staged", True)])
def test_invalid_inventory_rolls_back(
    isolated: Any, tmp_path: Path, sha: str, incomplete: bool
) -> None:
    engine, conn = isolated
    with pytest.raises(ValueError):
        load_housing_pressure(
            engine, stage(tmp_path / "stage.duckdb", sha, incomplete), releases=refs()
        )
    assert (
        conn.execute(
            text("SELECT record_id FROM community_records WHERE kind='housing_pressure'")
        ).scalar()
        == "old"
    )
