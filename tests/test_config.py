"""Config loading: env resolution, cross-file checks, and error messages."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from hip.config import (
    REPO_ROOT,
    ConfigError,
    Settings,
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
    monkeypatch.setenv("HUD_API_TOKEN", "x")

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


def test_env_file_is_loaded_into_the_process_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Keys placed in `.env` must reach `os.environ`.

    pydantic-settings reads `.env` only for its own `HIP_`-prefixed fields, so source
    credentials and the judge's key — all resolved with `os.environ.get()` — never saw
    the file. `.env.example` and every error message said to put keys there, and doing
    so had no effect until this loader existed.
    """
    from hip.config import load_env_file

    env = tmp_path / ".env"
    env.write_text("DEMO_API_KEY=from-file\n")
    monkeypatch.delenv("DEMO_API_KEY", raising=False)
    load_env_file.cache_clear()

    assert load_env_file(env) == 1
    assert os.environ["DEMO_API_KEY"] == "from-file"
    load_env_file.cache_clear()


def test_a_real_environment_variable_beats_the_env_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An explicit export still wins, so CI can inject secrets with no `.env` present."""
    from hip.config import load_env_file

    env = tmp_path / ".env"
    env.write_text("DEMO_API_KEY=from-file\n")
    monkeypatch.setenv("DEMO_API_KEY", "from-shell")
    load_env_file.cache_clear()

    load_env_file(env)
    assert os.environ["DEMO_API_KEY"] == "from-shell"
    load_env_file.cache_clear()


def test_a_missing_env_file_is_not_an_error(tmp_path: Path) -> None:
    from hip.config import load_env_file

    load_env_file.cache_clear()
    assert load_env_file(tmp_path / "absent") == 0
    load_env_file.cache_clear()


# --- Path settings (Milestone 10) -------------------------------------------------


def test_reports_dir_does_not_follow_data_dir(tmp_path: Path) -> None:
    """The regression this milestone exists to prevent.

    `reports_dir` used to be `data_dir.parent / "reports"`, so relocating the data root
    to an external volume silently took `reports/` with it — including the 21
    git-tracked county reports the README links to.
    """
    settings = Settings(data_dir=tmp_path / "elsewhere" / "data", _env_file=None)
    assert settings.reports_dir == REPO_ROOT / "reports"
    assert tmp_path not in settings.reports_dir.parents


def test_default_reports_dir_matches_the_expression_it_replaced() -> None:
    """Promoting the property to a field must not move anyone's reports directory."""
    settings = Settings(_env_file=None)
    assert settings.reports_dir == settings.data_dir.parent / "reports"


def test_reports_dir_is_independently_settable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("HIP_REPORTS_DIR", str(tmp_path / "published"))
    settings = Settings(_env_file=None)
    assert settings.reports_dir == tmp_path / "published"


def test_paths_expand_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """`~` in a hand-written .env must not become a directory named `~`."""
    monkeypatch.setenv("HIP_DATA_DIR", "~/hip-data")
    settings = Settings(_env_file=None)
    assert "~" not in str(settings.data_dir)
    assert settings.data_dir == (Path.home() / "hip-data").resolve()


def test_storage_tiers_follow_data_dir(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path / "d", _env_file=None)
    for path in (
        settings.raw_dir,
        settings.parquet_dir,
        settings.duckdb_path,
        settings.packets_dir,
    ):
        assert str(path).startswith(str(tmp_path / "d"))
