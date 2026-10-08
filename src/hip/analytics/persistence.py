"""Historical persistence facts (Milestone 52, ARCHITECTURE #348).

The descriptive answer to "is this pressure temporary or persistent?": how far a region's
price-to-income sits from its own long-run median, and how long earlier spells at
today's level lasted before it came back. Nothing here forecasts. A spell that ended in
the past says what happened then, not what will happen now, and the reading gate
refuses a forecast in a sentence that cites these figures (`hip.packets.prediction`).

The ratio is an index, not dollars: FHFA's all-transactions house price index over
Census SAIPE's median household income, each year. FHFA publishes no dollar level for a
county, so the ratio compares a region with its own other years only — never with
another region — and every figure is a distance from its own median. The range is as
long as the shorter series, and SAIPE's starts in 1989 with 1990–1992 and 1994 missing,
and 1996 for counties; a spell is never carried across a missing year.

Rebuilt whole by `hip analyze`. Numbers are rounded to six places so an unchanged
warehouse rebuilds identical rows (#73).
"""

from __future__ import annotations

import json
import statistics
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Engine, text

FACT_ID = "price_to_income_history"
# The price side by level: FHFA's county workbook for counties, its state index (an
# annual mean of the quarters) for the state.
PRICE = {"county": "fhfa_hpi_county", "state": "fhfa_hpi_all_transactions"}
INCOME = "saipe_median_hh_income"
# The dollar ratio the pages show, against which the long-run index is checked.
DOLLAR_RATIO = "price_to_income"


@dataclass(frozen=True)
class Year:
    index: float
    low: float
    high: float


def _round(value: float) -> float:
    return round(float(value), 6)


def _pct(value: float, median: float) -> float:
    return _round((value / median - 1) * 100)


def _runs(years: list[int], keep: set[int]) -> list[list[int]]:
    """Unbroken runs of consecutive calendar years in `keep`. A missing year ends a
    run: a spell is never claimed across a year nothing measured."""
    runs: list[list[int]] = []
    for year in years:
        if year in keep and runs and runs[-1][-1] == year - 1:
            runs[-1].append(year)
        elif year in keep:
            runs.append([year])
    return runs


def persistence(series: dict[int, Year]) -> dict[str, Any]:
    """Position, rank range and past spells for one region's yearly index."""
    years = sorted(series)
    if len(years) < 10:
        raise ValueError("fewer than ten years: no long-run range to speak of")
    values = {y: series[y].index for y in years}
    median = statistics.median(values.values())
    last = years[-1]
    today = series[last]
    others = [values[y] for y in years if y != last]
    rank = 1 + sum(v > today.index for v in others)
    peak = max(years, key=lambda y: values[y])

    above_median = _runs(years, {y for y in years if values[y] > median})
    current = next((r for r in above_median if r[-1] == last), None)

    at_today = _runs(years, {y for y in years if values[y] >= today.index})
    episodes = []
    for run in at_today:
        if run[-1] == last:
            continue
        back = next((y for y in years if y > run[-1] and values[y] <= median), None)
        top = max(run, key=lambda y: values[y])
        episodes.append(
            {
                "start": run[0],
                "end": run[-1],
                "years": len(run),
                "peak_year": top,
                "peak_vs_median": _pct(values[top], median),
                "back_to_median": back,
            }
        )

    return {
        "first_year": years[0],
        "last_year": last,
        "years": len(years),
        "missing_years": [y for y in range(years[0], last + 1) if y not in series],
        "vs_median": _pct(today.index, median),
        "vs_median_low": _pct(today.low, median),
        "vs_median_high": _pct(today.high, median),
        "rank": rank,
        "rank_best": 1 + sum(v > today.high for v in others),
        "rank_worst": 1 + sum(v > today.low for v in others),
        "peak_year": peak,
        "peak_vs_median": _pct(values[peak], median),
        "above_median_since": current[0] if current else None,
        "episodes": episodes,
        "series": [{"year": y, "vs_median": _pct(values[y], median)} for y in years],
    }


def agreement(series: dict[int, Year], dollar: dict[int, float]) -> dict[str, Any] | None:
    """Whether the index moved the same way as the dollar ratio the page shows, over the
    years both cover. The dollar ratio's year is its window's end. None when they share
    fewer than two years."""
    shared = sorted(set(series) & set(dollar))
    if len(shared) < 2:
        return None
    first, last = shared[0], shared[-1]
    index_change = _round((series[last].index / series[first].index - 1) * 100)
    dollar_change = _round((dollar[last] / dollar[first] - 1) * 100)
    return {
        "from": first,
        "to": last,
        "index_change": index_change,
        "dollar_change": dollar_change,
        "agrees": (index_change > 0) == (dollar_change > 0),
    }


def _moved(pct: float) -> str:
    return f"{'rose' if pct > 0 else 'fell'} {abs(pct):.1f}%"


def _observations(conn: Any) -> dict[tuple[int, str], dict[int, tuple[float, float]]]:
    rows = conn.execute(
        text(
            """
            SELECT o.region_id, r.level::text AS level, o.metric_id,
                   extract(year FROM o.period_end)::int AS year,
                   avg(o.value::numeric) AS value, max(o.margin_of_error) AS margin
            FROM fact_metric_observation o JOIN regions r USING (region_id)
            WHERE o.metric_id = ANY(:m) AND r.level IN ('county', 'state')
            GROUP BY 1, 2, 3, 4
            """
        ),
        {"m": [*PRICE.values(), INCOME, DOLLAR_RATIO]},
    )
    out: dict[tuple[int, str], dict[int, tuple[float, float]]] = defaultdict(dict)
    for r in rows:
        if r.metric_id in PRICE.values() and PRICE.get(r.level) != r.metric_id:
            continue
        key = "price" if r.metric_id in PRICE.values() else r.metric_id
        out[(int(r.region_id), key)][int(r.year)] = (
            float(r.value),
            0.0 if r.margin is None else float(r.margin),
        )
    return out


def facts(conn: Any) -> list[dict[str, Any]]:
    data = _observations(conn)
    regions = {region for region, key in data if key == "price"}
    rows = []
    for region in sorted(regions):
        price, income = data.get((region, "price"), {}), data.get((region, INCOME), {})
        series = {
            y: Year(
                index=price[y][0] / income[y][0],
                # A higher income makes the ratio lower: its upper bound is the price
                # over the income's lower bound.
                low=price[y][0] / (income[y][0] + income[y][1]),
                high=price[y][0] / max(income[y][0] - income[y][1], 1.0),
            )
            for y in price
            if y in income
        }
        if len(series) < 10:
            continue
        fact = persistence(series)
        dollar = {y: v for y, (v, _) in data.get((region, DOLLAR_RATIO), {}).items()}
        check = agreement(series, dollar)
        withheld = None
        if check is not None and not check["agrees"]:
            withheld = (
                f"From {check['from']} to {check['to']} the long-run measure "
                f"{_moved(check['index_change'])} while home value to household income "
                f"on this page {_moved(check['dollar_change'])}. The two disagree on "
                "the direction, so the long-run comparison is not shown."
            )
        rows.append(
            {
                "region_id": region,
                "fact_id": FACT_ID,
                **fact,
                "validation": check,
                "withheld": withheld,
            }
        )
    return rows


_JSON = ("missing_years", "episodes", "series", "validation")


def rebuild_persistence(engine: Engine) -> int:
    """Replace `region_persistence` whole. Returns the rows written."""
    with engine.begin() as conn:
        rows = facts(conn)
        conn.execute(text("DELETE FROM region_persistence"))
        if rows:
            columns = list(rows[0])
            conn.execute(
                text(
                    f"INSERT INTO region_persistence ({', '.join(columns)}) VALUES ("
                    + ", ".join(
                        f"CAST(:{c} AS jsonb)" if c in _JSON else f":{c}" for c in columns
                    )
                    + ")"
                ),
                [
                    {k: json.dumps(v) if k in _JSON else v for k, v in row.items()}
                    for row in rows
                ],
            )
    return len(rows)
