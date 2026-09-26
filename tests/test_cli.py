"""CLI surface: version, config check, and honest stage stubs."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from hip import __version__
from hip.cli import _STAGE_MILESTONE, app
from hip.config import Settings

runner = CliRunner()

# The pipeline stages, in the order ARCHITECTURE.md runs them.
STAGES = ["acquire", "land", "stage", "geocode", "validate", "load", "analyze", "pack"]

# Stages with a real implementation — all eight since Milestone 6. These must never be
# invoked bare in a test: acquire would download 635MB of TIGER data, and load would
# write to whatever database the environment points at. Their behavior is covered by
# tests/test_sources.py, tests/test_geography.py, and tests/test_packets.py, which
# exercise the same code without I/O.
IMPLEMENTED = [s for s in STAGES if s not in _STAGE_MILESTONE]


def test_version_flag() -> None:
    result = runner.invoke(app, ["--version"])

    assert result.exit_code == 0
    assert __version__ in result.stdout


def test_every_pipeline_stage_has_a_command() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    for stage in STAGES:
        assert stage in result.stdout


def test_stage_milestone_map_only_lists_unimplemented_stages() -> None:
    """The map doubles as the remaining-work list, so a stale entry is a lie.

    Empty since Milestone 6: every stage in the pipeline has a real implementation.
    A future stage added as a stub belongs here, and this assertion is what forces it
    to be removed again once it works.
    """
    assert set(_STAGE_MILESTONE) <= set(STAGES)
    assert set(IMPLEMENTED) == set(STAGES)
    assert _STAGE_MILESTONE == {}


def test_schema_command_prints_the_published_contract() -> None:
    """`hip schema` is how a consumer gets the packet contract without reading code."""
    result = runner.invoke(app, ["schema"])

    assert result.exit_code == 0
    assert '"$id": "packet-v1.json"' in result.stdout
    assert "packet_version" in result.stdout


def test_acquire_rejects_a_source_without_an_adapter_before_any_io() -> None:
    """Guards the network: a source with no adapter must fail on argument handling.

    Must name a source that is still unimplemented — pointing this at an implemented
    one would download hundreds of megabytes on every test run, which is exactly what
    happened once already. `nj_modiv` held this role until Milestone 7 implemented it;
    pointing it there now would start a 32-minute parcel fetch.
    """
    result = runner.invoke(app, ["acquire", "--source", "njgin_parcels"])

    assert result.exit_code == 1
    assert "Milestone 8" in result.output


def test_acquire_rejects_an_unknown_source() -> None:
    result = runner.invoke(app, ["acquire", "--source", "not_a_source"])

    assert result.exit_code == 1
    assert "not a known source" in result.output


def test_check_config_reports_the_repo_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CENSUS_API_KEY", "x")
    monkeypatch.setenv("FRED_API_KEY", "x")
    monkeypatch.setenv("BLS_API_KEY", "x")
    monkeypatch.setenv("HUD_API_TOKEN", "x")

    result = runner.invoke(app, ["check-config"])

    assert result.exit_code == 0
    assert "config OK" in result.output


def test_check_config_exits_nonzero_when_a_key_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CENSUS_API_KEY", raising=False)
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    monkeypatch.delenv("BLS_API_KEY", raising=False)

    result = runner.invoke(app, ["check-config"])

    assert result.exit_code == 1
    assert "CENSUS_API_KEY" in result.output


def _settings_at(gate_dir: Path) -> Settings:
    """`get_settings()` is `@lru_cache(maxsize=1)`, so an env var set after the first
    call in this process is invisible to it — the standard fix elsewhere in this suite
    (`tests/test_eval_hosted.py`) is replacing the name the command module looked up,
    not the environment."""
    return Settings(gate_dir=gate_dir)


def test_refresh_mode_defaults_to_ask_and_round_trips(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Milestone 27: the file a Mac command and an iPhone Shortcut share."""
    monkeypatch.setattr("hip.cli.get_settings", lambda: _settings_at(tmp_path))

    assert runner.invoke(app, ["refresh-mode"]).output.strip() == "ask"

    set_auto = runner.invoke(app, ["refresh-mode", "auto"])
    assert set_auto.exit_code == 0
    assert runner.invoke(app, ["refresh-mode"]).output.strip() == "auto"

    set_ask = runner.invoke(app, ["refresh-mode", "ask"])
    assert set_ask.exit_code == 0
    assert runner.invoke(app, ["refresh-mode"]).output.strip() == "ask"


def test_refresh_mode_rejects_an_unknown_value(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("hip.cli.get_settings", lambda: _settings_at(tmp_path))

    result = runner.invoke(app, ["refresh-mode", "sometimes"])

    assert result.exit_code == 1
    assert "ask" in result.output and "auto" in result.output
    # Rejected before anything was written — the file must not exist at all.
    assert not (tmp_path / "mode.json").exists()


def test_regenerate_now_touches_the_same_trigger_a_shortcut_would(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("hip.cli.get_settings", lambda: _settings_at(tmp_path))

    result = runner.invoke(app, ["regenerate-now"])

    assert result.exit_code == 0
    assert (tmp_path / "regenerate-now.trigger").exists()


def test_notify_exits_clean_even_with_no_keys_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing Pushover key must not fail whatever script called this."""
    monkeypatch.delenv("PUSHOVER_USER_KEY", raising=False)
    monkeypatch.delenv("PUSHOVER_API_TOKEN", raising=False)

    result = runner.invoke(app, ["notify", "--title", "t", "--message", "m"])

    assert result.exit_code == 0
