"""End-to-end PostgreSQL oracle comparison for the rank-range update."""

from pathlib import Path

import pytest
from sqlalchemy import text

from hip.analytics.compute import _rank_ranges
from hip.warehouse.db import get_engine, probe
from tests.warehouse_scratch import scratch_warehouse

REFERENCE = Path(__file__).parent / "fixtures/rank_ranges_reference.sql"


@pytest.mark.skipif(not probe().migrated, reason="needs migrated local Postgres")
@pytest.mark.parametrize("direction", ["lower_is_better", "higher_is_better", "neutral"])
def test_update_equals_original_sql_for_ties_nulls_and_nested_intervals(
    direction: str,
) -> None:
    with scratch_warehouse(get_engine()) as engine, engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE metrics SET direction=:d WHERE metric_id='acs_median_hh_income'"
            ),
            {"d": direction},
        )
        conn.execute(
            text("""
            INSERT INTO region_rankings
              (metric_id,level,basis,"window",region_id,value,rank,"of",percentile,
               ties,margin_of_error)
            SELECT 'acs_median_hh_income','county','value','latest',id,v,
              rank() OVER (ORDER BY CASE WHEN :d='lower_is_better' THEN v ELSE -v END),
              count(*) OVER (),0,count(*) OVER (PARTITION BY v),m
            FROM (VALUES (1,10.,1.),(2,10.,1.),(3,11.,10.),(4,30.,0.),
                         (5,50.,NULL),(6,0.,0.),(7,4.5,3.),(8,5.,4.)) t(id,v,m)
        """),
            {"d": direction},
        )
        conn.execute(text(REFERENCE.read_text()))
        query = text("SELECT * FROM region_rankings ORDER BY region_id")
        expected = conn.execute(query).all()
        conn.execute(text("UPDATE region_rankings SET rank_best=NULL,rank_worst=NULL"))
        assert _rank_ranges(conn) == 8
        assert conn.execute(query).all() == expected
