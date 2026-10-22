"""The README's figures come from their sources, and its writing does not fall behind
(ARCHITECTURE #417, #420). `hip readme` fixes the first; a person fixes the second."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

import hip.readme as readme
from hip.config import REPO_ROOT
from hip.readme import FIELDS, MARKER, fill, writing_problems


def test_every_marked_figure_in_the_readme_is_current() -> None:
    text = (REPO_ROOT / "README.md").read_text()
    assert fill(text, REPO_ROOT) == text, "a README figure is stale: run `hip readme`"


def test_the_readme_s_writing_has_not_fallen_behind() -> None:
    text = (REPO_ROOT / "README.md").read_text()
    assert writing_problems(text, REPO_ROOT) == []


def test_every_field_is_marked_in_the_readme() -> None:
    """A field nothing marks is a figure someone stopped filling."""
    marked = {m["name"] for m in MARKER.finditer((REPO_ROOT / "README.md").read_text())}
    assert marked == set(FIELDS)


def test_a_marker_is_rewritten_and_the_text_around_it_kept() -> None:
    text = "Built on <!-- fill:python -->2.7<!-- /fill --> today."
    assert fill(text, REPO_ROOT) == (
        f"Built on <!-- fill:python -->{FIELDS['python'](REPO_ROOT)}<!-- /fill --> today."
    )


def test_a_marker_nothing_fills_is_refused() -> None:
    with pytest.raises(ValueError, match="nothing fills"):
        fill("<!-- fill:weather -->sunny<!-- /fill -->", REPO_ROOT)


def test_an_unlinked_evaluation_report_is_named(tmp_path: Path) -> None:
    (tmp_path / "reports/evaluation").mkdir(parents=True)
    (tmp_path / "reports/evaluation/v1.md").write_text("")
    (tmp_path / "reports/evaluation/v2.md").write_text("")
    text = "updated 2026-10-21. [v1](reports/evaluation/v1.md)"
    assert writing_problems(text, tmp_path) == [
        "v2.md is not linked under Model evaluation"
    ]


def test_a_status_older_than_the_changelog_is_stale(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "reports/evaluation").mkdir(parents=True)
    monkeypatch.setattr(readme, "_last_changed", lambda root, path: date(2026, 10, 22))
    (problem,) = writing_problems("> **Status — x, updated\n> 2026-10-21.**", tmp_path)
    assert "CHANGELOG.md changed on 2026-10-22" in problem
    assert writing_problems("updated 2026-10-22", tmp_path) == []
