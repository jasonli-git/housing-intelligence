"""Somewhere like here, but cheaper (Milestone 46, ARCHITECTURE #317).

For each New Jersey town, the towns most like it on four named measures whose homes sold
for at least 10% less, within ten minutes' longer average commute. Deterministic: the
same figures give the same list, and the page names the measures, the price and both
limits, because "like here" is a choice the platform makes for the reader and an
unnamed one cannot be checked.

**Like here.** Four measures of what a place is like to live in, each put on one scale
across the state's towns (its standard deviation) so that none outweighs another by its
units: the share of homes that are single-family detached, the homeownership rate, the
share of households with children, and the share of homes within half a mile of a rail
stop. Likeness is the straight-line distance between two towns on those four scales. A
match must be within `MAX_DISTANCE` of the town; where none is, the page says so rather
than listing the least unlike.

**Cheaper.** Every town is priced on one measure, the median recorded sale price of its
homes over SR1A's newest three-year window (the site's `sr1a_median_sale_price`, the
same window for every town), and only where at least 20 homes sold in it. Zillow's value
reaches 388 of 564 towns and the Census's is owners' own estimates over five years;
mixing measures would compare a sale with an estimate. Zillow's value is shown beside
the sale price where it exists, never ranked on.

**Commute.** A match's workers average no more than ten minutes' longer commute each way
(ACS), so a cheaper town is not one nobody here could get to work from.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from sqlalchemy import Engine, text

# The four measures of what a place is like, in the order the page lists them.
MEASURES: tuple[str, ...] = (
    "acs_share_detached",
    "acs_homeownership_rate",
    "acs_with_children_share",
    "transit_rail_homes_share",
)
PRICE = "sr1a_median_sale_price"
SALES = "sr1a_sales_count"
COMMUTE = "acs_mean_commute_minutes"
# Shown beside the matches, never matched on: what a buyer would also want to compare.
CONTEXT: tuple[str, ...] = ("zhvi_sfr", "nj_effective_tax_rate", "lodes_work_nyc_share")

# At least this many sales in the window, or the median is a handful of houses. The
# metric is already withheld below 20; this keeps the rule if that ever changes.
MIN_SALES = 20
# A match's median sale price is at most this share of the town's.
CHEAPER_BY = 0.9
# A match's average commute is at most this many minutes longer.
COMMUTE_MINUTES = 10.0
# The furthest a match may be on the four scales together. About the 90th percentile of
# towns' nearest cheaper match on 2026-10-06: a town further than this from every
# cheaper one has no match, which is the honest answer for an unusual place (Hoboken).
MAX_DISTANCE = 1.0
MATCHES = 5


@dataclass(frozen=True)
class Town:
    region_id: int
    figures: Mapping[str, float]

    def eligible(self) -> bool:
        """Whether the town can be compared at all: every measure, a price from enough
        sales, and a commute."""
        return (
            all(m in self.figures for m in MEASURES)
            and PRICE in self.figures
            and self.figures.get(SALES, 0) >= MIN_SALES
            and COMMUTE in self.figures
        )


@dataclass(frozen=True)
class Match:
    region_id: int
    rank: int
    match_region_id: int
    distance: float


def scales(towns: Sequence[Town]) -> dict[str, float]:
    """Each measure's standard deviation across the towns that have it."""
    out: dict[str, float] = {}
    for m in MEASURES:
        values = [t.figures[m] for t in towns if m in t.figures]
        mean = sum(values) / len(values)
        out[m] = math.sqrt(sum((v - mean) ** 2 for v in values) / len(values)) or 1.0
    return out


def distance(a: Town, b: Town, scale: Mapping[str, float]) -> float:
    return math.sqrt(
        sum(((a.figures[m] - b.figures[m]) / scale[m]) ** 2 for m in MEASURES)
    )


def matches(towns: Sequence[Town]) -> list[Match]:
    """Every eligible town's nearest cheaper towns within the limits, nearest first."""
    eligible = [t for t in towns if t.eligible()]
    if not eligible:
        return []
    scale = scales([t for t in towns if all(m in t.figures for m in MEASURES)])
    out: list[Match] = []
    for town in eligible:
        price = town.figures[PRICE]
        commute = town.figures[COMMUTE]
        near = sorted(
            (distance(town, other, scale), other.region_id)
            for other in eligible
            if other.region_id != town.region_id
            and other.figures[PRICE] <= CHEAPER_BY * price
            and other.figures[COMMUTE] <= commute + COMMUTE_MINUTES
        )
        near = [(d, r) for d, r in near if d <= MAX_DISTANCE][:MATCHES]
        out += [
            Match(town.region_id, rank, region_id, d)
            for rank, (d, region_id) in enumerate(near, start=1)
        ]
    return out


# Each figure at its metric's newest period across the state's towns, so every town is
# compared on the same window: a town without a price in the newest one has none.
_FIGURES = text(
    """
    WITH newest AS (
        SELECT f.metric_id, max(f.period_end) AS period_end
        FROM fact_metric_observation f JOIN regions r USING (region_id)
        WHERE r.level = 'municipality' AND f.metric_id = ANY(:metrics)
        GROUP BY f.metric_id
    )
    SELECT f.region_id, f.metric_id, f.value, f.period_start, f.period_end
    FROM fact_metric_observation f
    JOIN newest n ON n.metric_id = f.metric_id AND n.period_end = f.period_end
    JOIN regions r ON r.region_id = f.region_id
    WHERE r.level = 'municipality'
    """
)


def rebuild_similar(engine: Engine) -> int:
    """Replace `similar_places`. Returns the number of matches written.

    Each comparable town gets a row of rank 0 holding its own figures and the basis the
    page states (measures, limits, periods), then a row per match holding the match's
    figures as they were compared, so the page shows exactly what was matched on.
    """
    metrics = [*MEASURES, PRICE, SALES, COMMUTE, *CONTEXT]
    with engine.begin() as conn:
        rows = conn.execute(_FIGURES, {"metrics": metrics}).fetchall()
        figures: dict[int, dict[str, float]] = {}
        periods: dict[str, str] = {}
        starts: dict[str, str] = {}
        for region_id, metric_id, value, period_start, period_end in rows:
            figures.setdefault(region_id, {})[metric_id] = float(value)
            periods[metric_id] = period_end.isoformat()
            starts[metric_id] = period_start.isoformat()
        towns = [Town(r, f) for r, f in sorted(figures.items())]
        found = matches(towns)
        basis = {
            "measures": list(MEASURES),
            "price": PRICE,
            "commute": COMMUTE,
            "context": list(CONTEXT),
            "min_sales": MIN_SALES,
            "cheaper_by": CHEAPER_BY,
            "commute_minutes": COMMUTE_MINUTES,
            "periods": periods,
            # The sales window, which the page states: on 2026-10-06 January 2024 to
            # June 2026, the newest SR1A window, not a calendar year.
            "price_from": starts.get(PRICE),
        }
        conn.execute(text("TRUNCATE similar_places"))
        insert = text(
            "INSERT INTO similar_places (region_id, rank, place_region_id, distance, "
            "figures, basis) VALUES (:region_id, :rank, :place, :distance, "
            "CAST(:figures AS jsonb), CAST(:basis AS jsonb))"
        )
        for town in towns:
            if town.eligible():
                conn.execute(
                    insert,
                    {
                        "region_id": town.region_id,
                        "rank": 0,
                        "place": town.region_id,
                        "distance": None,
                        "figures": json.dumps(town.figures),
                        "basis": json.dumps(basis),
                    },
                )
        for m in found:
            conn.execute(
                insert,
                {
                    "region_id": m.region_id,
                    "rank": m.rank,
                    "place": m.match_region_id,
                    "distance": m.distance,
                    "figures": json.dumps(figures[m.match_region_id]),
                    "basis": None,
                },
            )
    return len(found)
