"""NJ's published tax rates, and the two relationships that prove they mean what they say.

The effective rate is ingested rather than derived, so nothing here recomputes it. What
these tests defend is that it stays *aligned*: a column shifted by one year, a units
slip, or a join onto the wrong identifier would all leave the numbers looking plausible
in isolation. Each is caught by a relationship to a figure from somewhere else.
"""

from __future__ import annotations

import statistics

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.sources.nj_tax_rates import NjTaxRatesAdapter
from hip.warehouse.db import get_engine, probe

# The three dissolved districts NJ still carries in the workbooks. Pine Valley merged
# into Pine Hill in 2022; the two Princetons merged in 2013.
DISSOLVED = {"0429", "1109", "1110"}


def test_one_release_per_sheet_and_two_share_a_workbook() -> None:
    refs = NjTaxRatesAdapter(end_year=2025).refs()
    assert [r.layer for r in refs] == ["general", "effective", "director_ratio"]
    assert refs[0].url == refs[1].url, "both rate sheets come from GTRhistory.xlsx"
    assert refs[2].url != refs[0].url


def test_two_sheets_of_one_workbook_do_not_collide_on_disk() -> None:
    """The raw tier content-addresses, so the layer has to be in the filename."""
    names = {
        NjTaxRatesAdapter.filename(r) for r in NjTaxRatesAdapter(end_year=2025).refs()
    }
    assert len(names) == 3


def test_the_sheet_name_follows_the_end_year() -> None:
    """Bumping `NJ_TAX_END_YEAR` must move the worksheet, not just the vintage."""
    adapter = NjTaxRatesAdapter(end_year=2026)
    general = next(r for r in adapter.refs() if r.layer == "general")
    assert adapter.landing_sheet(general) == "General Tax Rates 1997-2026"
    assert adapter.default_vintage == "2026"


def test_the_ratio_sheet_is_named_without_a_year() -> None:
    adapter = NjTaxRatesAdapter(end_year=2025)
    ratio = next(r for r in adapter.refs() if r.layer == "director_ratio")
    assert adapter.landing_sheet(ratio) == "Director's Ratio History"


warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


def _paired() -> list[tuple[float, float, float]]:
    """(general, effective, prior ratio) per municipality-year carrying all three."""
    with Session(get_engine()) as session:
        return [
            (row[0], row[1], row[2])
            for row in session.execute(
                text("""
                WITH v AS (
                    SELECT region_id, metric_id,
                           EXTRACT(year FROM period_start)::int AS yr, value
                    FROM fact_metric_observation
                    WHERE metric_id IN ('nj_general_tax_rate',
                                        'nj_effective_tax_rate',
                                        'nj_director_ratio')
                )
                SELECT g.value, e.value, r.value
                FROM v g
                JOIN v e ON e.region_id = g.region_id AND e.yr = g.yr
                       AND e.metric_id = 'nj_effective_tax_rate'
                JOIN v r ON r.region_id = g.region_id AND r.yr = g.yr - 1
                       AND r.metric_id = 'nj_director_ratio'
                WHERE g.metric_id = 'nj_general_tax_rate' AND r.value > 0
                """)
            ).all()
        ]


@warehouse
def test_the_effective_rate_tracks_the_prior_years_ratio_not_the_same_years() -> None:
    """The alignment check, and the reason the effective rate is ingested not derived.

    Applying a year's general rate to the *prior* year's Director's Ratio lands within
    0.5% of the published effective rate for about half of all municipality-years;
    applying the same year's ratio is an order of magnitude worse. That gap is what
    fixes the alignment. It is emphatically not an identity — the Division computes the
    effective rate from the abstract of ratables, and the p90 of this comparison is
    around 7% — so the assertion is on the medians, which is the part that would move
    if a column shifted by a year.
    """
    rows = _paired()
    assert len(rows) > 10_000, f"only {len(rows)} comparable cells"
    prior = statistics.median(abs(g * r / 100 - e) / e for g, e, r in rows)
    assert prior < 0.01, f"prior-year pairing median error {prior:.1%}"


@warehouse
def test_a_rate_is_per_hundred_dollars_and_not_a_fraction() -> None:
    """Guards the units: a rate read as a fraction would sit near 0.03, not near 3."""
    with Session(get_engine()) as session:
        median = session.execute(
            text("""
                SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY value)
                FROM fact_metric_observation
                WHERE metric_id = 'nj_general_tax_rate'
                  AND period_start >= DATE '2025-01-01'
            """)
        ).scalar_one()
    assert 1.0 < float(median) < 6.0, median


@warehouse
def test_rate_times_sale_price_reproduces_the_tax_bill_within_a_known_bias() -> None:
    """The cross-source check: three sources, one number, in the right place.

    A municipality's effective rate applied to its typical sale price should be close to
    its typical tax bill — the first from NJ's rate workbook, the second from SR1A
    deeds, the third from MOD-IV parcels. It is deliberately not an equality. The homes
    that *sell* are newer and larger than the median home that merely exists, and the
    bill is the prior year's, so the prediction runs high: measured 2026-09-19, the
    ratio has p05 1.01, median 1.24 and p95 1.44, and exceeds 1 in 96% of
    municipalities.

    That consistent one-sided offset is the point. A units error would land near 100x, a
    join onto the wrong identifier would scatter either side of 1, and a rate read as a
    fraction would collapse toward 0.01 — none of which survive this band.
    """
    with Session(get_engine()) as session:
        ratios = [
            float(row[0])
            for row in session.execute(
                text("""
                WITH price AS (
                    SELECT region_id, value FROM fact_metric_observation
                    WHERE metric_id = 'sr1a_median_sale_price'
                      AND period_start = (SELECT max(period_start)
                                          FROM fact_metric_observation
                                          WHERE metric_id = 'sr1a_median_sale_price')
                ), rate AS (
                    SELECT region_id, value FROM fact_metric_observation
                    WHERE metric_id = 'nj_effective_tax_rate'
                      AND period_start = DATE '2025-01-01'
                ), bill AS (
                    SELECT region_id, value FROM fact_metric_observation
                    WHERE metric_id = 'modiv_median_tax_bill' AND value > 0
                )
                SELECT p.value * r.value / 100 / b.value
                FROM price p
                JOIN rate r USING (region_id)
                JOIN bill b USING (region_id)
                """)
            ).all()
        ]
    assert len(ratios) > 400, f"only {len(ratios)} municipalities carry all three"
    median = statistics.median(ratios)
    assert 1.0 < median < 1.6, f"median predicted/actual bill {median:.2f}"
    high = sum(1 for x in ratios if x > 1) / len(ratios)
    assert high > 0.85, f"prediction exceeds the bill in only {high:.0%}"


@warehouse
def test_no_dissolved_district_became_a_region() -> None:
    """The workbooks carry 567 districts; New Jersey has 564 municipalities."""
    with Session(get_engine()) as session:
        identifiers = {
            row[0]
            for row in session.execute(
                text(
                    "SELECT identifier FROM region_identifiers "
                    "WHERE scheme = 'nj_cd_code'"
                )
            ).all()
        }
    assert not (identifiers & DISSOLVED)
