"""Relationship facts (Milestone 51, ARCHITECTURE #336).

A closed set of connections between figures that a reading may narrate, computed from
facts the warehouse already holds, so a model can state a relationship only where one
exists as a fact — and say "because" only where the relationship is arithmetic:

- `ratio_split`: one of the platform's own ratios, over its own change window, beside
  its two sides over the same years. "Home values rose 16% while incomes rose 29%, so
  home value to income moved from 6.81 to 6.65" is true by construction, which is the
  only case causal wording may describe: the ratio moved because its sides did.
- `outpaced`: two changes of the same kind over the same survey years — rents against
  incomes, home values against incomes — and whether one outpaced the other beyond
  their margins. Faster or slower, never why.
- `supply_and_moves`: a county's net homes added per 1,000 homes beside its net moves per
  1,000 tax returns, in the same year. Side by side only: moves are one part of demand,
  and a pairing is not a shortage.

Rebuilt whole by `hip analyze`, after the change rows it reads. Every number is rounded
to six places in `numeric`, as the derived ratios are, so an unchanged warehouse
rebuilds identical rows (#73).
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from math import sqrt
from typing import Any

from sqlalchemy import Engine, text

# (ratio, numerator, denominator): the ratios `hip analyze` computes from a monthly
# series averaged over a year and an annual denominator (RATIOS in `compute`).
# `fmr_to_income` is left out: its numerator is dated by a fiscal year that begins in
# October, which a split by calendar year would misstate.
RATIO_SPLITS: tuple[tuple[str, str, str], ...] = (
    ("price_to_income", "zhvi_sfr", "acs_median_hh_income"),
    ("rent_to_income", "zori_all", "acs_median_hh_income"),
    ("price_to_ami", "zhvi_sfr", "hud_area_median_income"),
)

# (measure, against): survey changes over the same editions, in dollars both.
OUTPACED: tuple[tuple[str, str], ...] = (
    ("acs_median_gross_rent", "acs_median_hh_income"),
    ("acs_median_home_value", "acs_median_hh_income"),
)

SUPPLY = ("nj_net_units_per_1000", "irs_net_migration_per_1000")

WINDOW = "5y"


@dataclass(frozen=True)
class _Change:
    start: date
    end: date
    start_value: float
    end_value: float
    pct: float
    margin: float | None


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), 6)


def _figure(
    role: str, metric_id: str, value: float | None, unit: str, margin: float | None = None
) -> dict[str, Any]:
    return {
        "role": role,
        "metric_id": metric_id,
        "value": _round(value),
        "unit": unit,
        "margin": _round(margin),
    }


def _changes(conn: Any, metrics: set[str]) -> dict[tuple[int, str], _Change]:
    rows = conn.execute(
        text(
            """
            SELECT region_id, metric_id, window_start, window_end, start_value,
                   end_value, pct_change, pct_change_margin
            FROM fact_metric_change
            WHERE "window" = :w AND metric_id = ANY(:m)
            """
        ),
        {"w": WINDOW, "m": sorted(metrics)},
    )
    return {
        (int(r.region_id), r.metric_id): _Change(
            r.window_start,
            r.window_end,
            float(r.start_value),
            float(r.end_value),
            float(r.pct_change),
            None if r.pct_change_margin is None else float(r.pct_change_margin),
        )
        for r in rows
    }


def _annual_means(conn: Any, metrics: set[str]) -> dict[tuple[int, str, int], float]:
    """A monthly series' mean over each calendar year, as the ratios average it."""
    rows = conn.execute(
        text(
            """
            SELECT region_id, metric_id,
                   extract(year FROM period_start)::int AS year,
                   avg(value::numeric) AS mean
            FROM fact_metric_observation
            WHERE metric_id = ANY(:m)
            GROUP BY 1, 2, 3
            """
        ),
        {"m": sorted(metrics)},
    )
    return {(int(r.region_id), r.metric_id, int(r.year)): float(r.mean) for r in rows}


def _values_at(conn: Any, metrics: set[str]) -> dict[tuple[int, str, date], float]:
    rows = conn.execute(
        text(
            """
            SELECT region_id, metric_id, period_end, value
            FROM fact_metric_observation WHERE metric_id = ANY(:m)
            """
        ),
        {"m": sorted(metrics)},
    )
    return {(int(r.region_id), r.metric_id, r.period_end): float(r.value) for r in rows}


def ratio_splits(conn: Any) -> list[dict[str, Any]]:
    changes = _changes(conn, {m for split in RATIO_SPLITS for m in split})
    means = _annual_means(conn, {numerator for _, numerator, _ in RATIO_SPLITS})
    values = _values_at(conn, {denominator for _, _, denominator in RATIO_SPLITS})
    out: list[dict[str, Any]] = []
    for (region_id, metric_id), ratio in changes.items():
        for name, numerator, denominator in RATIO_SPLITS:
            if metric_id != name:
                continue
            y0, y1 = ratio.start.year, ratio.end.year
            n0 = means.get((region_id, numerator, y0))
            n1 = means.get((region_id, numerator, y1))
            d0 = values.get((region_id, denominator, ratio.start))
            d1 = values.get((region_id, denominator, ratio.end))
            if not (n0 and n1 and d0 and d1):
                continue
            # The denominator's own change row, where its window is the ratio's, so the
            # reading quotes the figure the page shows, with its margin.
            own = changes.get((region_id, denominator))
            margin = (
                own.margin
                if own and (own.start, own.end) == (ratio.start, ratio.end)
                else None
            )
            out.append(
                {
                    "region_id": region_id,
                    "relation_id": f"ratio_split:{name}",
                    "kind": "ratio_split",
                    "period_start": ratio.start,
                    "period_end": ratio.end,
                    "figures": [
                        _figure("ratio_start", name, ratio.start_value, "ratio"),
                        _figure("ratio_end", name, ratio.end_value, "ratio"),
                        _figure("numerator_start", numerator, n0, "usd"),
                        _figure("numerator_end", numerator, n1, "usd"),
                        _figure(
                            "numerator_change", numerator, (n1 - n0) / n0 * 100, "percent"
                        ),
                        _figure("denominator_start", denominator, d0, "usd"),
                        _figure("denominator_end", denominator, d1, "usd"),
                        _figure(
                            "denominator_change",
                            denominator,
                            (d1 - d0) / d0 * 100,
                            "percent",
                            margin,
                        ),
                    ],
                    "direction": None,
                    "causal": True,
                }
            )
    return out


def pace(a: float, a_margin: float, b: float, b_margin: float) -> str:
    """Whether change `a` outpaced change `b` beyond the margin of their difference."""
    gap, gap_margin = a - b, sqrt(a_margin**2 + b_margin**2)
    if gap > gap_margin:
        return "faster"
    if gap < -gap_margin:
        return "slower"
    return "indistinguishable"


def outpaced(conn: Any) -> list[dict[str, Any]]:
    """Two changes over the same editions, and whether the gap between them is larger
    than its margin: the square root of the sum of the two margins squared, which
    treats the two as independent — conservative for two figures from one survey,
    whose errors tend to move together."""
    changes = _changes(conn, {m for pair in OUTPACED for m in pair})
    out: list[dict[str, Any]] = []
    for (region_id, metric_id), a in changes.items():
        for measure, against in OUTPACED:
            if metric_id != measure:
                continue
            b = changes.get((region_id, against))
            if b is None or (a.start, a.end) != (b.start, b.end):
                continue
            if a.margin is None or b.margin is None:
                continue
            direction = pace(a.pct, a.margin, b.pct, b.margin)
            out.append(
                {
                    "region_id": region_id,
                    "relation_id": f"outpaced:{measure}",
                    "kind": "outpaced",
                    "period_start": a.start,
                    "period_end": a.end,
                    "figures": [
                        _figure("measure_change", measure, a.pct, "percent", a.margin),
                        _figure("against_change", against, b.pct, "percent", b.margin),
                    ],
                    "direction": direction,
                    "causal": False,
                }
            )
    return out


def supply_and_moves(conn: Any) -> list[dict[str, Any]]:
    """A county's newest year with both figures."""
    rows = conn.execute(
        text(
            """
            SELECT region_id, metric_id, period_start, period_end, value
            FROM fact_metric_observation WHERE metric_id = ANY(:m)
            """
        ),
        {"m": list(SUPPLY)},
    )
    by_year: dict[tuple[int, int], dict[str, Any]] = defaultdict(dict)
    for r in rows:
        by_year[(int(r.region_id), r.period_end.year)][r.metric_id] = r
    newest: dict[int, int] = {}
    for (region_id, year), found in by_year.items():
        if all(m in found for m in SUPPLY):
            newest[region_id] = max(year, newest.get(region_id, year))
    out: list[dict[str, Any]] = []
    for region_id, year in newest.items():
        homes, moves = (by_year[(region_id, year)][m] for m in SUPPLY)
        out.append(
            {
                "region_id": region_id,
                "relation_id": "supply_and_moves",
                "kind": "supply_and_moves",
                "period_start": date(year, 1, 1),
                "period_end": date(year, 12, 31),
                "figures": [
                    _figure("homes_per_1000", SUPPLY[0], homes.value, "per_1000_homes"),
                    _figure("moves_per_1000", SUPPLY[1], moves.value, "per_1000_returns"),
                ],
                "direction": None,
                "causal": False,
            }
        )
    return out


def rebuild_relationships(engine: Engine) -> int:
    """Replace `region_relationships` whole. Returns the rows written."""
    with engine.begin() as conn:
        rows = [*ratio_splits(conn), *outpaced(conn), *supply_and_moves(conn)]
        conn.execute(text("DELETE FROM region_relationships"))
        if rows:
            conn.execute(
                text(
                    """
                    INSERT INTO region_relationships
                        (region_id, relation_id, kind, period_start, period_end,
                         figures, direction, causal)
                    VALUES (:region_id, :relation_id, :kind, :period_start, :period_end,
                            CAST(:figures AS jsonb), :direction, :causal)
                    """
                ),
                [{**row, "figures": json.dumps(row["figures"])} for row in rows],
            )
    return len(rows)
