"""Somewhere like here, but cheaper (Milestone 46, ARCHITECTURE #317).

The matching rules on towns small enough to work out by hand: likeness on four scaled
measures, cheaper by 10% on one price, a commute limit, enough sales, and a ceiling on
how unlike a match may be. No database.
"""

from __future__ import annotations

import pytest

from hip.analytics.similar import (
    COMMUTE,
    MATCHES,
    MAX_DISTANCE,
    MEASURES,
    PRICE,
    SALES,
    Town,
    distance,
    matches,
    scales,
)


def town(
    region_id: int,
    *,
    like: float = 0.5,
    price: float = 400_000,
    commute: float = 25,
    sales: float = 100,
    **overrides: float,
) -> Town:
    figures = {m: like for m in MEASURES} | {PRICE: price, COMMUTE: commute, SALES: sales}
    return Town(region_id, figures | overrides)


# A spread so each measure's scale is 0.2 wide; the subject sits in the middle.
SPREAD = [town(90, like=0.3, price=900_000), town(91, like=0.7, price=900_000)]


def found(towns: list[Town], region_id: int = 1) -> list[int]:
    return [m.match_region_id for m in matches(towns) if m.region_id == region_id]


def test_a_cheaper_town_alike_on_every_measure_is_matched_nearest_first() -> None:
    towns = [
        town(1),
        town(2, like=0.52, price=300_000),
        town(3, like=0.55, price=300_000),
    ]
    assert found(towns + SPREAD) == [2, 3]


def test_a_town_less_than_ten_percent_cheaper_is_not_cheaper() -> None:
    towns = [town(1), town(2, price=361_000), town(3, price=360_000)]
    assert found(towns + SPREAD) == [3]


def test_a_match_commutes_no_more_than_ten_minutes_longer() -> None:
    towns = [
        town(1, commute=25),
        town(2, price=300_000, commute=35),
        town(3, price=300_000, commute=35.5),
    ]
    assert found(towns + SPREAD) == [2]


def test_a_price_from_under_twenty_sales_is_no_price() -> None:
    towns = [town(1), town(2, price=300_000, sales=19)]
    assert found(towns + SPREAD) == []
    # Nor is such a town compared at all.
    assert found(towns + SPREAD, region_id=2) == []


def test_no_match_beyond_the_ceiling_rather_than_the_least_unlike() -> None:
    scale = scales([town(1)] + SPREAD)
    far = town(2, price=300_000, transit_rail_homes_share=0.5 + 1.1 * scale[MEASURES[3]])
    assert distance(town(1), far, scale) > MAX_DISTANCE
    assert found([town(1), far] + SPREAD) == []


def test_each_measure_counts_on_its_own_scale_not_its_units() -> None:
    # A step of one standard deviation on any measure is the same distance.
    base = [town(1)] + SPREAD
    scale = scales(base)
    steps = [distance(town(1), town(2, **{m: 0.5 + scale[m]}), scale) for m in MEASURES]
    assert steps == pytest.approx([1.0] * len(MEASURES))


def test_at_most_five_matches() -> None:
    towns = [town(1)] + [
        town(i, like=0.5 + i / 1000, price=300_000) for i in range(2, 10)
    ]
    assert len(found(towns + SPREAD)) == MATCHES
