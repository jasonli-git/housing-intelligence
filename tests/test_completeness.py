"""The completeness standing check: judgments fixed as data, measured from the warehouse.

The check is only comparable run to run if its judgments stay put, so the tests below
make each one impossible to skip: a new metric without a subject, a licence nobody has
classified, or a question said to be answered on a page that does not exist all fail
here rather than quietly changing the next run's numbers.
"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.orm import Session

from hip import completeness
from hip.completeness import (
    LICENCE_RIGHTS,
    METRIC_SUBJECTS,
    QUESTIONS,
    SUBJECTS,
    measure_coverage,
)
from hip.config import REPO_ROOT, load_metrics, load_sources
from hip.warehouse.db import get_engine, probe

needs_warehouse = pytest.mark.skipif(
    not probe().migrated, reason="needs a migrated warehouse"
)


def test_every_configured_metric_has_a_subject() -> None:
    configured = set(load_metrics())

    assert configured - set(METRIC_SUBJECTS) == set(), "classify the new metric"
    assert set(METRIC_SUBJECTS) - configured == set(), "remove the retired metric"
    assert set(METRIC_SUBJECTS.values()) <= {*SUBJECTS, "context"}


def test_every_configured_licence_is_classified() -> None:
    licences = {source.license for source in load_sources().values()}

    assert licences - set(LICENCE_RIGHTS) == set()


def test_every_answered_question_names_a_page_that_exists() -> None:
    app = REPO_ROOT / "web" / "app"
    for question in QUESTIONS:
        if question.status == "answered":
            page = app / question.where.strip("/") / "page.tsx"
            assert page.exists(), f"{question.text!r} names {question.where}"


def test_an_unclassified_metric_stops_the_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        completeness, "load_metrics", lambda: {**load_metrics(), "a_new_metric": None}
    )

    with pytest.raises(ValueError, match="a_new_metric"):
        completeness.run(None, {}, date(2026, 9, 26))  # type: ignore[arg-type]


@needs_warehouse
def test_coverage_is_measured_at_each_metric_s_newest_period() -> None:
    with Session(get_engine()) as session:
        totals, coverage = measure_coverage(session)
    if not coverage:
        pytest.skip("no observations loaded")
    by_id = {c.metric_id: c for c in coverage}

    assert (totals.municipalities, totals.counties) == (564, 21)
    for c in coverage:
        assert c.municipalities <= totals.municipalities
        assert c.population_share is None or 0 < c.population_share <= 1.0001
        assert sum(c.match_methods.values()) == pytest.approx(1)
    # A national figure is not counted as covering New Jersey's people.
    assert by_id["mortgage_rate_30y"].national
    assert by_id["mortgage_rate_30y"].population_share is None
    # PEP covers every municipality, and so all of the state's population.
    assert by_id["pep_population"].population_share == pytest.approx(1)


@needs_warehouse
def test_the_report_covers_all_six_dimensions() -> None:
    with Session(get_engine()) as session:
        report = completeness.run(session, load_sources(), date(2026, 9, 26))

    for heading in (
        "## Geographic",
        "## Temporal",
        "## Subject",
        "## Statistical quality",
        "## Usability",
        "## Reuse rights",
    ):
        assert heading in report
    # The newest vintage held, not the one fetched last: HUD's FMR history is
    # backfilled from 2017, which a fetched-last rule reported as what was acquired.
    fmr = next(line for line in report.splitlines() if line.startswith("| `hud_fmr` |"))
    assert "2017" not in fmr
