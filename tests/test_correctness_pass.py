"""The correctness pass of 2026-10-08 (#350): revision margins and pruned pointers, and
HUD's income limits named by the day they took effect."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from hip.api.main import app
from hip.warehouse.db import get_engine, probe
from hip.warehouse.determinations import INCOME_LIMITS_IN_FORCE, income_limits_in_force

warehouse = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)
client = TestClient(app)


def test_each_fiscal_year_s_limits_start_from_hud_s_notice() -> None:
    # Two late years: FY2023 waited for usable ACS data, FY2026 for the delayed 2024 ACS.
    assert income_limits_in_force(2023) == date(2023, 5, 15)
    assert income_limits_in_force(2026) == date(2026, 5, 1)
    assert income_limits_in_force(1999) is None
    assert all(d.year == fy for fy, d in INCOME_LIMITS_IN_FORCE.items())


@warehouse
def test_every_loaded_income_limit_year_has_its_notice_held() -> None:
    with get_engine().connect() as conn:
        years = {
            int(y)
            for (y,) in conn.execute(
                text(
                    "SELECT DISTINCT extract(year FROM period_start) FROM "
                    "fact_metric_observation WHERE metric_id = 'hud_area_median_income'"
                )
            )
        }
    assert years <= set(INCOME_LIMITS_IN_FORCE), sorted(
        years - set(INCOME_LIMITS_IN_FORCE)
    )


@warehouse
def test_freshness_says_when_hud_s_limits_took_effect_not_december() -> None:
    hud = next(
        s for s in client.get("/freshness").json()["sources"] if s["source_id"] == "hud"
    )
    year = int(hud["period_observed_end"][:4])
    assert hud["in_force_from"] == income_limits_in_force(year).isoformat()


@warehouse
def test_no_revision_points_at_a_release_that_does_not_exist() -> None:
    with get_engine().connect() as conn:
        dangling, pruned = conn.execute(
            text(
                """
                SELECT count(*) FILTER (WHERE old_release_id IS NOT NULL AND NOT EXISTS (
                           SELECT 1 FROM source_releases s
                           WHERE s.release_id = r.old_release_id)),
                       count(*) FILTER (WHERE old_release_pruned)
                FROM fact_revision r
                """
            )
        ).one()
    assert dangling == 0
    assert pruned == 2936


@warehouse
def test_the_trigger_keeps_a_revised_figure_s_margins() -> None:
    """Revise one survey figure inside a transaction that is rolled back."""
    engine = get_engine()
    with engine.connect() as conn:
        tx = conn.begin()
        try:
            row = conn.execute(
                text(
                    "SELECT region_id, metric_id, period_start, value, margin_of_error "
                    "FROM fact_metric_observation WHERE margin_of_error > 0 LIMIT 1"
                )
            ).one()
            conn.execute(
                text(
                    "UPDATE fact_metric_observation SET value = value * 1.1, "
                    "margin_of_error = margin_of_error * 2 WHERE region_id = :r "
                    "AND metric_id = :m AND period_start = :p"
                ),
                {"r": row.region_id, "m": row.metric_id, "p": row.period_start},
            )
            old, new = conn.execute(
                text(
                    "SELECT old_margin, new_margin FROM fact_revision "
                    "ORDER BY revision_id DESC LIMIT 1"
                )
            ).one()
            assert old == pytest.approx(row.margin_of_error)
            assert new == pytest.approx(row.margin_of_error * 2)
        finally:
            tx.rollback()
