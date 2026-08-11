"""Config loading: env resolution, cross-file checks, and error messages."""

from __future__ import annotations

from pathlib import Path

import pytest

from hip.config import (
    ConfigError,
    check_config,
    load_geography,
    load_metrics,
    load_sources,
)

REPO_CONFIG = Path(__file__).resolve().parents[1] / "config"

MINIMAL_SOURCES = """
sources:
  demo:
    name: Demo
    publisher: Nobody
    license: Public domain
    url: ${DEMO_URL:-https://example.invalid}
    cadence: annual
    adapter: hip.sources.demo:Adapter
"""

MINIMAL_METRICS = """
metrics:
  demo_metric:
    label: Demo
    unit: usd
    frequency: annual
    direction: neutral
    description: Demo metric.
    source_id: demo
"""

MINIMAL_GEOGRAPHY = """
scope:
  states: [NJ]
  levels: [county]
  municipality_id_system: census_mcd
"""


def _write(dir_: Path, sources: str, metrics: str, geography: str) -> Path:
    (dir_ / "sources.yml").write_text(sources)
    (dir_ / "metrics.yml").write_text(metrics)
    (dir_ / "geography.yml").write_text(geography)
    return dir_


def test_repo_config_loads(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CENSUS_API_KEY", "x")
    monkeypatch.setenv("FRED_API_KEY", "x")
    monkeypatch.setenv("BLS_API_KEY", "x")

    sources = load_sources(REPO_CONFIG)
    metrics = load_metrics(REPO_CONFIG)
    geography = load_geography(REPO_CONFIG)

    assert sources and metrics
    assert geography.states == ["NJ"]
    # parcel stays out of Postgres (ARCHITECTURE #16)
    assert "parcel" not in geography.levels
    assert check_config(REPO_CONFIG) == []


def test_every_metric_names_a_real_source(tmp_path: Path) -> None:
    bad_metrics = MINIMAL_METRICS.replace("source_id: demo", "source_id: nonexistent")
    config_dir = _write(tmp_path, MINIMAL_SOURCES, bad_metrics, MINIMAL_GEOGRAPHY)

    problems = check_config(config_dir)

    assert len(problems) == 1
    assert "nonexistent" in problems[0]
    assert "demo_metric" in problems[0]


def test_missing_api_key_is_reported_not_raised(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DEMO_KEY", raising=False)
    sources = MINIMAL_SOURCES + "    api_key_env: DEMO_KEY\n"
    config_dir = _write(tmp_path, sources, MINIMAL_METRICS, MINIMAL_GEOGRAPHY)

    problems = check_config(config_dir)

    assert any("DEMO_KEY" in p for p in problems)


def test_env_var_default_is_used_when_unset(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DEMO_URL", raising=False)
    config_dir = _write(tmp_path, MINIMAL_SOURCES, MINIMAL_METRICS, MINIMAL_GEOGRAPHY)

    assert load_sources(config_dir)["demo"].url == "https://example.invalid"


def test_env_var_overrides_default(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DEMO_URL", "https://real.example")
    config_dir = _write(tmp_path, MINIMAL_SOURCES, MINIMAL_METRICS, MINIMAL_GEOGRAPHY)

    assert load_sources(config_dir)["demo"].url == "https://real.example"


def test_unset_env_var_without_default_names_the_key(tmp_path: Path) -> None:
    sources = MINIMAL_SOURCES.replace(
        "${DEMO_URL:-https://example.invalid}", "${DEMO_MISSING_VAR}"
    )
    config_dir = _write(tmp_path, sources, MINIMAL_METRICS, MINIMAL_GEOGRAPHY)

    with pytest.raises(ConfigError) as exc:
        load_sources(config_dir)

    assert "DEMO_MISSING_VAR" in str(exc.value)
    assert "sources.demo.url" in str(exc.value)


def test_validation_error_names_file_and_key(tmp_path: Path) -> None:
    bad = MINIMAL_METRICS.replace("direction: neutral", "direction: sideways")
    config_dir = _write(tmp_path, MINIMAL_SOURCES, bad, MINIMAL_GEOGRAPHY)

    with pytest.raises(ConfigError) as exc:
        load_metrics(config_dir)

    message = str(exc.value)
    assert "metrics.yml" in message
    assert "demo_metric" in message
    assert "direction" in message


def test_unknown_key_is_rejected(tmp_path: Path) -> None:
    """extra='forbid' — a typo must fail loudly, not be silently ignored."""
    bad = MINIMAL_SOURCES + "    cadance: annual\n"
    config_dir = _write(tmp_path, bad, MINIMAL_METRICS, MINIMAL_GEOGRAPHY)

    with pytest.raises(ConfigError) as exc:
        load_sources(config_dir)

    assert "cadance" in str(exc.value)


def test_missing_file_names_the_path(tmp_path: Path) -> None:
    with pytest.raises(ConfigError) as exc:
        load_sources(tmp_path)

    assert "sources.yml" in str(exc.value)
