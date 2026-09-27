"""A loaded fact must cite the file for its exact source, layer, and vintage."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import duckdb
import pytest

from hip.warehouse.load import (
    ReleaseAttributionError,
    ReleaseProvenance,
    _historical_release_candidates,
    _release_ids,
    _resolve_fact_release_ids,
    load_facts,
)


def test_current_release_wins_over_an_older_version_of_the_same_key() -> None:
    key = ("census_acs", "county", "2024")
    assert (
        _resolve_fact_release_ids(
            {key: 22},
            {key: 15},
            [("census_acs", "county", "2024", 11)],
        )[key]
        == 22
    )


def test_unique_historical_release_keeps_older_staged_vintages_loadable() -> None:
    old = ("census_permits", "place", "2015")
    current = ("census_permits", "place", "2016")
    assert _resolve_fact_release_ids(
        {current: 16},
        {old: 563, current: 563},
        [("census_permits", "place", "2015", 15)],
    ) == {old: 15, current: 16}


def test_missing_vintage_fails_instead_of_citing_another_year_or_layer() -> None:
    missing = ("census_acs", "county", "2019")
    with pytest.raises(ReleaseAttributionError) as error:
        _resolve_fact_release_ids(
            {("census_acs", "county", "2024"): 24},
            {missing: 72},
            [("census_acs", "state", "2019", 19)],
        )

    assert "Cannot load 72 observations" in str(error.value)
    assert "census_acs/county/2019: 72 rows, 0 releases" in str(error.value)
    assert "No facts were written" in str(error.value)


def test_ambiguous_historical_release_fails_instead_of_guessing() -> None:
    key = ("hud", "il_34001", "2020")
    with pytest.raises(ReleaseAttributionError, match="2 releases"):
        _resolve_fact_release_ids(
            {},
            {key: 2},
            [("hud", "il_34001", "2020", 101), ("hud", "il_34001", "2020", 102)],
        )


def test_historical_query_only_returns_exact_missing_keys() -> None:
    class Result:
        def fetchall(self) -> list[tuple[str, str, str, int]]:
            return [
                ("hud", "il_34001", "2020", 10),
                ("hud", "il_34001", "2021", 11),
                ("census_acs", "county", "2020", 12),
            ]

    class Connection:
        params: dict[str, Any] | None = None

        def execute(self, statement: Any, params: dict[str, Any]) -> Result:
            assert "source_releases" in str(statement)
            self.params = params
            return Result()

    conn = Connection()
    assert _historical_release_candidates(conn, {("hud", "il_34001", "2020")}) == [
        ("hud", "il_34001", "2020", 10)
    ]
    assert conn.params == {"source_ids": ["hud"]}


def test_two_current_files_with_one_key_fail_before_lookup() -> None:
    fetched_at = datetime(2026, 9, 27, tzinfo=UTC)
    releases = [
        ReleaseProvenance("zillow_zhvi", "county", "current", fetched_at, sha, 1)
        for sha in ("old", "new")
    ]
    with pytest.raises(ReleaseAttributionError, match="More than one cached release"):
        _release_ids(None, releases)


def test_fact_load_aborts_before_upserting_any_fact_without_exact_release(
    tmp_path: Path,
) -> None:
    stage_path = tmp_path / "staged.duckdb"
    with duckdb.connect(str(stage_path)) as stage:
        stage.execute(
            "CREATE TABLE stg_metric_observation ("
            "geoid VARCHAR, level VARCHAR, metric_id VARCHAR, period_start DATE, "
            "period_end DATE, value DOUBLE, source_id VARCHAR, layer VARCHAR, "
            "match_method VARCHAR, release_vintage VARCHAR, margin_of_error DOUBLE)"
        )
        stage.execute(
            "INSERT INTO stg_metric_observation VALUES "
            "('34001', 'county', 'acs_income', '2019-01-01', '2019-12-31', "
            "100.0, 'census_acs', 'county', 'fips', '2019', NULL)"
        )
        stage.execute(
            "CREATE TABLE stg_match_reject (source_id VARCHAR, layer VARCHAR, "
            "region_name VARCHAR, county_name VARCHAR, observations INTEGER, "
            "reason VARCHAR)"
        )

    class Result:
        def fetchall(self) -> list[tuple[Any, ...]]:
            return []

    class Connection:
        writes: list[str]

        def __init__(self) -> None:
            self.writes = []

        def execute(self, statement: Any, params: Any = None) -> Result:
            if str(statement).startswith("SELECT source_id, layer, vintage, release_id"):
                return Result()
            self.writes.append(str(statement))
            return Result()

    class Engine:
        def __init__(self) -> None:
            self.conn = Connection()
            self.rolled_back = False

        @contextmanager
        def begin(self):  # type: ignore[no-untyped-def]
            try:
                yield self.conn
            except ReleaseAttributionError:
                self.rolled_back = True
                raise

    engine = Engine()
    with pytest.raises(ReleaseAttributionError, match="census_acs/county/2019"):
        load_facts(engine, stage_path, metrics=[], sources=[], releases=[])  # type: ignore[arg-type]

    assert engine.rolled_back
    assert not engine.conn.writes
