"""Exact Census significance counts, with conservative sorted-tree pruning.

This is not interval overlap. A branch is counted only when its *least* value gap
exceeds sqrt(own_margin² + largest_branch_margin²); it is excluded only when its
*largest* gap cannot exceed the smallest such threshold. Otherwise recurse, testing
the original expression at leaves. NULL-margin rivals never count as different.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from math import sqrt


@dataclass(slots=True)
class _Node:
    lo: float
    hi: float
    min_squared_margin: float
    max_squared_margin: float
    size: int
    points: list[tuple[float, float]]
    left: "_Node | None" = None
    right: "_Node | None" = None

    @classmethod
    def build(cls, points: list[tuple[float, float]]) -> "_Node":
        squares = [m**2 for _, m in points]
        node = cls(
            points[0][0],
            points[-1][0],
            min(squares),
            max(squares),
            len(points),
            points if len(points) <= 16 else [],
        )
        if not node.points:
            middle = len(points) // 2
            node.left = cls.build(points[:middle])
            node.right = cls.build(points[middle:])
        return node

    def below(self, value: float, squared_margin: float) -> int:
        if value - self.lo <= sqrt(squared_margin + self.min_squared_margin):
            return 0
        if value - self.hi > sqrt(squared_margin + self.max_squared_margin):
            return self.size
        if self.points:
            return sum(value - k > sqrt(squared_margin + m**2) for k, m in self.points)
        assert self.left is not None and self.right is not None
        return self.left.below(value, squared_margin) + self.right.below(
            value, squared_margin
        )


def significance_counts(
    values: Sequence[tuple[float, float | None]],
) -> list[tuple[int, int]] | None:
    """Return (significantly better, significantly worse) in original row order.

    Values must already be oriented so lower is better. Return None for a group with
    no margins (or no rivals), exactly as the original SQL's margined/join filters.
    Self comparisons and ties have gap zero and therefore never count.
    """
    known = [(v, m) for v, m in values if m is not None]
    if not known or len(values) < 2:
        return None
    ascending = _Node.build(sorted(known))
    descending = _Node.build(sorted((-v, m) for v, m in known))
    return [
        (0, 0) if m is None else (ascending.below(v, m**2), descending.below(-v, m**2))
        for v, m in values
    ]
