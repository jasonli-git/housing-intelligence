"""The accelerated counts must equal the original sqrt test, not interval overlap."""

import math
import random

import pytest

from hip.analytics.rank_ranges import significance_counts


def reference(values: list[tuple[float, float | None]]) -> list[tuple[int, int]] | None:
    if len(values) < 2 or all(m is None for _, m in values):
        return None
    result = []
    for a, am in values:
        better = worse = 0
        if am is not None:
            for b, bm in values:
                if bm is not None:
                    gap = math.sqrt(am**2 + bm**2)
                    better += a - b > gap
                    worse += b - a > gap
        result.append((better, worse))
    return result


def test_ties_unknown_margins_and_nested_intervals() -> None:
    # The interval around 10 is inside the one around 11. Unknown ≠ zero margin.
    values = [
        (10.0, 1.0),
        (10.0, 1.0),
        (11.0, 10.0),
        (30.0, 0.0),
        (50.0, None),
        (0.0, 0.0),
    ]
    assert significance_counts(values) == reference(values)
    assert significance_counts(values)[4] == (0, 0)


def test_census_significance_is_not_nonoverlapping_intervals() -> None:
    # 0±3 and 4.5±3 overlap but 4.5 > sqrt(3²+3²): significantly different.
    assert significance_counts([(0.0, 3.0), (4.5, 3.0)]) == [(0, 1), (1, 0)]
    # Equality is not significant.
    assert significance_counts([(0.0, 3.0), (5.0, 4.0)]) == [(0, 0), (0, 0)]


@pytest.mark.parametrize("size", [0, 1, 2, 16, 17, 64, 598])
def test_tree_matches_all_pairs_with_mixed_and_extreme_margins(size: int) -> None:
    rng = random.Random(402 + size)
    values = [
        (
            float(rng.randrange(-100, 100)),
            rng.choice([None, 0.0, 0.1, 1.0, 30.0, 10000.0]),
        )
        for _ in range(size)
    ]
    assert significance_counts(values) == reference(values)
    assert significance_counts([(v, None) for v, _ in values]) is None
