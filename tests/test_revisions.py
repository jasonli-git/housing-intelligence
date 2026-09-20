"""A published figure that changes must leave a record that it did.

`fact_metric_observation` is keyed on `(region_id, metric_id, period_start)` and the
loader upserts, so a publisher restating a month it has already published replaced the
old value with nothing saying so. Zillow does exactly this as sales settle. The only
trace was the superseded file under `data/raw/`, which nothing read and Milestone 29's
own retention rule would eventually delete.

Enforced by a trigger rather than loader code, so the guarantee does not depend on which
path wrote the row — which is what these tests check, by writing rows the loader never
would.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.warehouse.db import get_engine, probe

pytestmark = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@pytest.fixture
def figure() -> tuple[int, str, object]:
    """One real observation to revise. Every test rolls back, so nothing persists."""
    with Session(get_engine()) as session:
        row = session.execute(
            text(
                "SELECT region_id, metric_id, period_start "
                "FROM fact_metric_observation LIMIT 1"
            )
        ).one_or_none()
    if row is None:
        pytest.skip("no observations loaded; run the pipeline")
    return (row[0], row[1], row[2])


def _revisions(session: Session, key: tuple[int, str, object]) -> list[tuple]:
    """Every revision recorded for one figure, oldest first.

    Tests compare *before and after* rather than against an empty table: a real refresh
    has already written 313,536 rows here, and whichever figure the fixture picks may
    well be one of the 294,469 Zillow restated. Asserting an absolute count passed only
    on a warehouse this feature had never run against.
    """
    return list(
        session.execute(
            text(
                "SELECT old_value, new_value, old_release_id, new_release_id "
                "FROM fact_revision "
                "WHERE region_id = :r AND metric_id = :m AND period_start = :p "
                "ORDER BY revision_id"
            ),
            {"r": key[0], "m": key[1], "p": key[2]},
        ).all()
    )


def test_a_changed_value_is_recorded_with_both_sides(figure) -> None:  # type: ignore[no-untyped-def]
    with Session(get_engine()) as session:
        before = session.execute(
            text(
                "SELECT value FROM fact_metric_observation "
                "WHERE region_id = :r AND metric_id = :m AND period_start = :p"
            ),
            {"r": figure[0], "m": figure[1], "p": figure[2]},
        ).scalar_one()
        existing = len(_revisions(session, figure))

        session.execute(
            text(
                "UPDATE fact_metric_observation SET value = :v "
                "WHERE region_id = :r AND metric_id = :m AND period_start = :p"
            ),
            {"v": before + 1234.5, "r": figure[0], "m": figure[1], "p": figure[2]},
        )

        recorded = _revisions(session, figure)
        assert len(recorded) == existing + 1
        assert recorded[-1][0] == pytest.approx(before)
        assert recorded[-1][1] == pytest.approx(before + 1234.5)
        session.rollback()


def test_an_unchanged_re_run_records_nothing(figure) -> None:  # type: ignore[no-untyped-def]
    """The common case, and it has to stay cheap: a refresh over data that has not moved
    upserts every row and must write no revisions at all."""
    with Session(get_engine()) as session:
        before = _revisions(session, figure)
        session.execute(
            text(
                "UPDATE fact_metric_observation SET value = value, "
                "match_method = match_method "
                "WHERE region_id = :r AND metric_id = :m AND period_start = :p"
            ),
            {"r": figure[0], "m": figure[1], "p": figure[2]},
        )
        assert _revisions(session, figure) == before, "an unchanged upsert wrote a row"
        session.rollback()


def test_a_figure_cannot_be_withdrawn_today(figure) -> None:  # type: ignore[no-untyped-def]
    """Why the trigger uses `IS DISTINCT FROM` even though `<>` would do right now.

    `fact_metric_observation.value` is NOT NULL, so a figure cannot be revised to
    nothing and `<>` and `IS DISTINCT FROM` agree on every value the column can hold.
    The operator is still the right one: `<>` is null against null, which would silently
    skip a withdrawal the day the column becomes nullable — and it costs nothing to be
    correct in advance. This test pins the constraint that makes the difference moot, so
    that if it is ever relaxed, the reason to check the trigger is written down here.
    """
    with Session(get_engine()) as session:
        nullable = session.execute(
            text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'fact_metric_observation' AND column_name = 'value'"
            )
        ).scalar_one()
    assert nullable == "NO"


def test_every_revision_names_the_release_on_both_sides(figure) -> None:  # type: ignore[no-untyped-def]
    """A revision that cannot say which release said what is not provenance."""
    with Session(get_engine()) as session:
        session.execute(
            text(
                "UPDATE fact_metric_observation SET value = value * 2 "
                "WHERE region_id = :r AND metric_id = :m AND period_start = :p"
            ),
            {"r": figure[0], "m": figure[1], "p": figure[2]},
        )
        old_release, new_release = _revisions(session, figure)[-1][2:4]
        assert old_release is not None and new_release is not None
        session.rollback()
