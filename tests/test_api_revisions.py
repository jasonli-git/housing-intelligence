"""What changed: `fact_revision` summarised for a reader, never served row by row.

The endpoint's size must be bounded by the refreshes it covers, not by how much a
publisher revised — the first refresh that recorded revisions wrote 313,536 of them.
The synthetic tests write revisions dated 2099 so they are the newest batch, and roll
back, so nothing they write persists.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.api.main import app
from hip.api.routers.revisions import EXAMPLES, revision_report
from hip.warehouse.db import get_engine, probe

client = TestClient(app)

pytestmark = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)

DAY = "2099-01-02 12:00:00+00"


@pytest.fixture
def session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        try:
            yield session
        finally:
            session.rollback()


def _revise(
    session: Session,
    region_id: int,
    metric_id: str,
    period_start: date | str,
    old: float | None,
    new: float | None,
    at: str = DAY,
) -> None:
    session.execute(
        text(
            "INSERT INTO fact_revision "
            "(region_id, metric_id, period_start, old_value, new_value, revised_at) "
            "VALUES (:r, :m, :p, :old, :new, :at)"
        ),
        {
            "r": region_id,
            "m": metric_id,
            "p": period_start,
            "old": old,
            "new": new,
            "at": at,
        },
    )


def _counties_with(session: Session, metric_id: str, period_start: str) -> list[int]:
    ids = list(
        session.execute(
            text(
                "SELECT o.region_id FROM fact_metric_observation o "
                "JOIN regions r USING (region_id) "
                "WHERE o.metric_id = :m AND o.period_start = :p AND r.level = 'county' "
                "ORDER BY o.region_id LIMIT 2"
            ),
            {"m": metric_id, "p": period_start},
        ).scalars()
    )
    if len(ids) < 2:
        pytest.skip(f"needs two counties with {metric_id} for {period_start}")
    return ids


def test_a_batch_counts_each_figure_once_at_its_net_change(session: Session) -> None:
    first, second = _counties_with(session, "zhvi_sfr", "2020-01-01")
    # Revised twice in one day: counts once, from the first old value to the last new.
    _revise(session, first, "zhvi_sfr", "2020-01-01", 100.0, 110.0)
    _revise(session, first, "zhvi_sfr", "2020-01-01", 110.0, 120.0)
    # Revised there and back: no net change, so no revision at all.
    _revise(session, second, "zhvi_sfr", "2020-01-01", 100.0, 90.0)
    _revise(session, second, "zhvi_sfr", "2020-01-01", 90.0, 100.0)

    batch = revision_report(session, batches=1).batches[0]

    assert batch.revised_on == date(2099, 1, 2)
    assert batch.figures == 1
    (group,) = batch.groups
    assert (group.figures, group.places, group.rose, group.fell) == (1, 1, 1, 0)
    (place,) = group.largest
    assert (place.region_id, place.old_value, place.new_value) == (first, 100.0, 120.0)
    assert place.change == pytest.approx(0.2)
    # Labelled by the observation's own end, not the revision's start.
    assert place.period_end == date(2020, 1, 31)
    assert place.has_page


def test_a_period_still_under_way_is_its_own_group(session: Session) -> None:
    first, _ = _counties_with(session, "zhvi_sfr", "2020-01-01")
    _revise(session, first, "zhvi_sfr", "2020-01-01", 100.0, 101.0)
    # January 2099 had not ended on 2 January 2099: a month filling in, not a correction.
    _revise(session, first, "zhvi_sfr", "2099-01-01", 200.0, 202.0)

    groups = revision_report(session, batches=1).batches[0].groups

    assert [(g.metric_id, g.under_way, g.figures) for g in groups] == [
        ("zhvi_sfr", False, 1),
        ("zhvi_sfr", True, 1),
    ]


def test_examples_are_one_per_place_largest_first(session: Session) -> None:
    first, second = _counties_with(session, "zhvi_sfr", "2020-01-01")
    # Three months of one place, all moving more than the other place's one month.
    for month, new in (
        ("2020-01-01", 150.0),
        ("2020-02-01", 140.0),
        ("2020-03-01", 130.0),
    ):
        _revise(session, first, "zhvi_sfr", month, 100.0, new)
    _revise(session, second, "zhvi_sfr", "2020-01-01", 100.0, 95.0)

    (group,) = revision_report(session, batches=1).batches[0].groups

    assert len(group.largest) <= EXAMPLES
    assert [(p.region_id, p.periods) for p in group.largest] == [(first, 3), (second, 1)]
    assert group.largest[0].period_start == date(2020, 1, 1)
    assert group.median_change == pytest.approx(0.35)


def test_the_platform_s_own_figures_follow_the_publishers(session: Session) -> None:
    first, _ = _counties_with(session, "price_to_income", "2016-01-01")
    _revise(session, first, "price_to_income", "2016-01-01", 4.0, 4.4)
    _revise(session, first, "zhvi_sfr", "2020-01-01", 100.0, 101.0)

    groups = revision_report(session, batches=1).batches[0].groups

    assert [g.metric_id for g in groups] == ["zhvi_sfr", "price_to_income"]
    # An annual figure is labelled by its edition's end year.
    assert groups[1].latest_period == date(2020, 12, 31)


def test_a_revision_outlives_its_region_and_metric(session: Session) -> None:
    """`fact_revision` has no foreign keys on purpose; a removed one still counts."""
    _revise(session, -1, "a_retired_metric", "2020-01-01", 1.0, 2.0)

    (group,) = revision_report(session, batches=1).batches[0].groups

    assert (group.label, group.unit, group.source_id) == ("a_retired_metric", "", None)
    (place,) = group.largest
    assert (place.name, place.has_page) == ("region -1", False)


def test_older_batches_are_counted_not_listed(session: Session) -> None:
    first, _ = _counties_with(session, "zhvi_sfr", "2020-01-01")
    _revise(
        session, first, "zhvi_sfr", "2020-01-01", 100.0, 101.0, at="2099-01-01 12:00+00"
    )
    _revise(session, first, "zhvi_sfr", "2020-01-01", 101.0, 102.0)

    report = revision_report(session, batches=1)

    assert [b.revised_on for b in report.batches] == [date(2099, 1, 2)]
    assert report.total_batches >= 2


def test_the_endpoint_is_bounded_and_newest_first() -> None:
    body = client.get("/revisions").json()
    if not body["batches"]:
        pytest.skip("no revisions recorded yet")

    days = [b["revised_on"] for b in body["batches"]]
    assert days == sorted(days, reverse=True)
    assert len(days) <= 12
    for batch in body["batches"]:
        assert batch["figures"] == sum(g["figures"] for g in batch["groups"])
        for group in batch["groups"]:
            changes = [
                abs(p["change"]) for p in group["largest"] if p["change"] is not None
            ]
            assert changes == sorted(changes, reverse=True)
            assert len(group["largest"]) <= EXAMPLES
