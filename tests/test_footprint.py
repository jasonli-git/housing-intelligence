"""Footprint measurement: tier sizes, formatting, and degradation without Postgres."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.exc import OperationalError

from hip.config import Settings
from hip.footprint import (
    as_dict,
    directory_bytes,
    human_bytes,
    measure,
)


def _file(path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\0" * size)


def test_directory_bytes_sums_nested_files(tmp_path: Path) -> None:
    _file(tmp_path / "a.bin", 100)
    _file(tmp_path / "nested" / "b.bin", 250)
    assert directory_bytes(tmp_path) == 350


def test_directory_bytes_is_zero_for_a_missing_directory(tmp_path: Path) -> None:
    assert directory_bytes(tmp_path / "never-created") == 0


def test_directory_bytes_ignores_symlinks(tmp_path: Path) -> None:
    """A link between tiers must not have its target counted in both."""
    _file(tmp_path / "real.bin", 500)
    (tmp_path / "link.bin").symlink_to(tmp_path / "real.bin")
    assert directory_bytes(tmp_path) == 500


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, "0 B"),
        (999, "999 B"),
        (1_000, "1.0 kB"),
        (1_500_000, "1.5 MB"),
        (2_400_000_000, "2.4 GB"),
    ],
)
def test_human_bytes(value: int, expected: str) -> None:
    assert human_bytes(value) == expected


def test_measure_reports_tiers_without_a_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Postgres being down is not an error — the filesystem half is still the answer."""

    def _unreachable() -> None:
        raise OperationalError("SELECT 1", {}, Exception("refused"))

    monkeypatch.setattr("hip.footprint.get_engine", _unreachable)
    _file(tmp_path / "raw" / "x.zip", 1_000)
    _file(tmp_path / "parquet" / "y.parquet", 2_000)

    result = measure(Settings(data_dir=tmp_path, _env_file=None))

    assert result.database_error == "OperationalError"
    assert result.database_bytes is None
    assert result.filesystem_bytes == 3_000
    assert result.total_bytes == 3_000
    assert {t.name for t in result.tiers} == {"raw", "parquet", "duckdb", "packets"}
    assert [t.name for t in result.tiers if t.exists] == ["raw", "parquet"]


def test_measure_does_not_count_the_reports_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Reports are human output beside the data, not a storage tier inside it."""

    def _unreachable() -> None:
        raise OperationalError("SELECT 1", {}, Exception("refused"))

    monkeypatch.setattr("hip.footprint.get_engine", _unreachable)
    _file(tmp_path / "raw" / "x.zip", 1_000)
    _file(tmp_path / "reports" / "big.md", 9_999)

    result = measure(
        Settings(data_dir=tmp_path, reports_dir=tmp_path / "reports", _env_file=None)
    )
    assert result.filesystem_bytes == 1_000


def test_as_dict_is_json_shaped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def _unreachable() -> None:
        raise OperationalError("SELECT 1", {}, Exception("refused"))

    monkeypatch.setattr("hip.footprint.get_engine", _unreachable)
    _file(tmp_path / "raw" / "x.zip", 42)

    payload = as_dict(measure(Settings(data_dir=tmp_path, _env_file=None)))

    assert payload["filesystem_bytes"] == 42
    assert payload["database_bytes"] is None
    assert payload["database_error"] == "OperationalError"
    assert payload["tables"] == []
    assert payload["states"] == []
    assert {t["name"] for t in payload["tiers"]} == {  # type: ignore[union-attr]
        "raw",
        "parquet",
        "duckdb",
        "packets",
    }
