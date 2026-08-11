"""CLI surface: version, config check, and honest stage stubs."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from hip import __version__
from hip.cli import _STAGE_MILESTONE, app

runner = CliRunner()

# The pipeline stages, in the order ARCHITECTURE.md runs them.
STAGES = ["acquire", "land", "stage", "geocode", "validate", "load", "analyze", "pack"]


def test_version_flag() -> None:
    result = runner.invoke(app, ["--version"])

    assert result.exit_code == 0
    assert __version__ in result.stdout


def test_every_pipeline_stage_has_a_command() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    for stage in STAGES:
        assert stage in result.stdout


@pytest.mark.parametrize("stage", STAGES)
def test_stage_stub_fails_loudly_and_names_its_milestone(stage: str) -> None:
    """A stub must never look like a successful run."""
    result = runner.invoke(app, [stage])

    assert result.exit_code == 1
    assert f"Milestone {_STAGE_MILESTONE[stage]}" in result.output


def test_stage_milestone_map_covers_exactly_the_stages() -> None:
    assert set(_STAGE_MILESTONE) == set(STAGES)


def test_check_config_reports_the_repo_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CENSUS_API_KEY", "x")
    monkeypatch.setenv("FRED_API_KEY", "x")
    monkeypatch.setenv("BLS_API_KEY", "x")

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
