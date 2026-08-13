"""Derived analytics: change over time, affordability, and rankings.

`window` is a reserved word in Postgres. The column exists because SQLAlchemy quoted
it when creating the table, so every hand-written reference must quote it as well.

Runs in Postgres rather than DuckDB because the facts are already there and the outputs
are small — moving 330,000 rows out and back to compute a percentage would be work for
its own sake.

Every derived table is rebuilt in full. They are cheap to recompute and expensive to
reason about when stale, so `analyze` truncates rather than updating incrementally.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import Engine, text

# Change windows, as (label, years). `since_2019` is anchored rather than relative: it
# is the pre-pandemic baseline most housing analysis reaches for.
RELATIVE_WINDOWS: tuple[tuple[str, int], ...] = (
    ("1y", 1),
    ("3y", 3),
    ("5y", 5),
    ("10y", 10),
)
ANCHOR_WINDOWS: tuple[tuple[str, date], ...] = (("since_2019", date(2019, 1, 1)),)

# How far an observation may sit from the requested window start and still be used.
# Sources have different frequencies — ACS is annual, Zillow monthly, FHFA quarterly —
# so an exact date match would silently drop every annual metric. Beyond this the window
# would be a different span than its label claims, which is worse than no row.
TOLERANCE_DAYS = 400


@dataclass
class AnalyticsResult:
    changes: int = 0
    rankings: int = 0
    value_rankings: int = 0
    derived_observations: dict[str, int] = field(default_factory=dict)


def rebuild(engine: Engine) -> AnalyticsResult:
    """Recompute every derived table. Idempotent."""
    result = AnalyticsResult()
    with engine.begin() as conn:
        result.derived_observations = _affordability(conn)
        result.changes = _changes(conn)
        # One TRUNCATE for both bases, so the two ranking passes cannot half-rebuild
        # the table and leave a stale basis behind.
        conn.execute(text("TRUNCATE region_rankings"))
        result.rankings = _rankings(conn)
        result.value_rankings = _value_rankings(conn)
    return result


def _affordability(conn: object) -> dict[str, int]:
    """Write affordability ratios as ordinary facts under the `hip_derived` source.

    Zillow is monthly and ACS annual, so the Zillow side is averaged over the ACS
    vintage year. Averaging rather than picking December smooths a single odd month
    without pretending to more precision than the annual denominator supports.
    """
    release_id = conn.execute(  # type: ignore[attr-defined]
        text(
            """
            INSERT INTO source_releases
                (source_id, layer, vintage, fetched_at, file_sha256, row_count)
            VALUES ('hip_derived', 'analytics', to_char(now(), 'YYYY-MM-DD"T"HH24MISS'),
                    now(), md5(now()::text), 0)
            RETURNING release_id
            """
        )
    ).scalar_one()

    counts: dict[str, int] = {}
    # (computed metric, monthly numerator, annual denominator, multiplier).
    # price_to_ami uses HUD's published area median income rather than the ACS survey
    # estimate, so the same question can be asked against a policy benchmark.
    for metric_id, numerator, denominator, multiplier in (
        ("price_to_income", "zhvi_sfr", "acs_median_hh_income", 1.0),
        ("rent_to_income", "zori_all", "acs_median_hh_income", 12.0),
        ("price_to_ami", "zhvi_sfr", "hud_area_median_income", 1.0),
    ):
        inserted = conn.execute(  # type: ignore[attr-defined]
            text(
                """
                INSERT INTO fact_metric_observation
                    (region_id, metric_id, period_start, period_end, value,
                     release_id, match_method)
                SELECT income.region_id, :metric_id,
                       income.period_start, income.period_end,
                       (num.annual_value * :multiplier) / income.value,
                       :release_id, 'derived'
                FROM fact_metric_observation income
                JOIN (
                    SELECT region_id,
                           date_trunc('year', period_start)::date AS yr,
                           avg(value) AS annual_value
                    FROM fact_metric_observation
                    WHERE metric_id = :numerator
                    GROUP BY 1, 2
                ) num
                  ON num.region_id = income.region_id
                 AND num.yr = date_trunc('year', income.period_end)::date
                WHERE income.metric_id = :denominator
                  AND income.value > 0
                ON CONFLICT (region_id, metric_id, period_start) DO UPDATE SET
                    value = EXCLUDED.value,
                    release_id = EXCLUDED.release_id,
                    match_method = EXCLUDED.match_method
                """
            ),
            {
                "metric_id": metric_id,
                "numerator": numerator,
                "denominator": denominator,
                "multiplier": multiplier,
                "release_id": release_id,
            },
        ).rowcount
        counts[metric_id] = int(inserted)
    return counts


def _changes(conn: object) -> int:
    """Percentage change and CAGR from the latest observation back to each window."""
    conn.execute(text("TRUNCATE fact_metric_change"))  # type: ignore[attr-defined]

    relative = ", ".join(
        f"('{label}', make_interval(years => {years}))"
        for label, years in RELATIVE_WINDOWS
    )
    anchors = ", ".join(f"('{label}', DATE '{start}')" for label, start in ANCHOR_WINDOWS)

    return int(
        conn.execute(  # type: ignore[attr-defined]
            text(
                f"""
                INSERT INTO fact_metric_change
                    (region_id, metric_id, "window", window_start, window_end,
                     start_value, end_value, pct_change, cagr)
                -- Anchored on period_end, not period_start. An ACS 5-year estimate
                -- starts four years before it ends, so anchoring on period_start
                -- labels a comparison of the 2019 and 2023 vintages as "2015 to
                -- 2019" — understating the real separation and mislabelling the row.
                WITH latest AS (
                    SELECT region_id, metric_id, max(period_end) AS end_period
                    FROM fact_metric_observation GROUP BY 1, 2
                ),
                ends AS (
                    SELECT f.region_id, f.metric_id, f.period_end AS window_end,
                           f.value AS end_value
                    FROM fact_metric_observation f
                    JOIN latest l USING (region_id, metric_id)
                    WHERE f.period_end = l.end_period
                ),
                targets AS (
                    SELECT e.*, w.label, (e.window_end - w.span)::date AS target
                    FROM ends e CROSS JOIN (VALUES {relative}) w(label, span)
                    UNION ALL
                    SELECT e.*, a.label, a.target
                    FROM ends e CROSS JOIN (VALUES {anchors}) a(label, target)
                ),
                picked AS (
                    SELECT DISTINCT ON (t.region_id, t.metric_id, t.label)
                           t.region_id, t.metric_id, t.label,
                           s.period_end AS window_start, s.value AS start_value,
                           t.window_end, t.end_value
                    FROM targets t
                    JOIN fact_metric_observation s
                      ON s.region_id = t.region_id AND s.metric_id = t.metric_id
                    WHERE abs(s.period_end - t.target) <= {TOLERANCE_DAYS}
                    ORDER BY t.region_id, t.metric_id, t.label,
                             abs(s.period_end - t.target)
                )
                SELECT region_id, metric_id, label, window_start, window_end,
                       start_value, end_value,
                       100.0 * (end_value - start_value) / abs(start_value),
                       -- CAGR is only meaningful when both ends share a sign and the
                       -- span is at least a year; net migration can be negative.
                       CASE WHEN start_value > 0 AND end_value > 0
                             AND window_end - window_start >= 365
                            THEN 100.0 * (
                                power(end_value / start_value,
                                      365.0 / (window_end - window_start)) - 1
                            ) END
                FROM picked
                WHERE start_value <> 0 AND window_end > window_start
                """
            )
        ).rowcount
    )


def _rankings(conn: object) -> int:
    """Rank regions within their own level for each metric and window.

    Ranked on `pct_change`, not the raw value: "fastest rising" is the question a
    ranking answers, and comparing a county's home value to a ZIP's would be
    meaningless anyway. Direction comes from the metric, so rank 1 is always the
    better end where "better" is defined.
    """
    return int(
        conn.execute(  # type: ignore[attr-defined]
            text(
                """
                INSERT INTO region_rankings
                    (metric_id, level, basis, "window", region_id, value,
                     rank, of, percentile)
                WITH ranked AS (
                    SELECT c.metric_id, r.level::text AS level, c."window", c.region_id,
                           c.pct_change AS value,
                           rank() OVER (
                               PARTITION BY c.metric_id, r.level, c."window"
                               ORDER BY CASE WHEN m.direction = 'lower_is_better'
                                             THEN c.pct_change
                                             ELSE -c.pct_change END
                           ) AS rank,
                           count(*) OVER (
                               PARTITION BY c.metric_id, r.level, c."window"
                           ) AS of
                    FROM fact_metric_change c
                    JOIN regions r ON r.region_id = c.region_id
                    JOIN metrics m ON m.metric_id = c.metric_id
                )
                SELECT metric_id, level, 'change', "window", region_id, value, rank, of,
                       CASE WHEN of > 1
                            THEN 100.0 * (of - rank) / (of - 1)
                            ELSE 100.0 END
                FROM ranked
                -- A ranking over one region is not a ranking.
                WHERE of > 1
                """
            )
        ).rowcount
    )


def _value_rankings(conn: object) -> int:
    """Rank regions by their most recent observed value, within their own level.

    The question "which municipality has the highest assessed value" is different from
    "which rose fastest", and until Milestone 7 the warehouse could only answer the
    second. A snapshot source such as MOD-IV has no change at all, so without this its
    metrics would load correctly and then be invisible to every ranked view.

    `window` is the literal 'latest' rather than a span, because a level has no span.
    `basis` is what actually distinguishes these rows (migration 0006).
    """
    return int(
        conn.execute(  # type: ignore[attr-defined]
            text(
                """
                INSERT INTO region_rankings
                    (metric_id, level, basis, "window", region_id, value,
                     rank, of, percentile)
                WITH latest AS (
                    SELECT DISTINCT ON (f.region_id, f.metric_id)
                           f.region_id, f.metric_id, f.value
                    FROM fact_metric_observation f
                    ORDER BY f.region_id, f.metric_id, f.period_end DESC
                ),
                ranked AS (
                    SELECT l.metric_id, r.level::text AS level, l.region_id, l.value,
                           rank() OVER (
                               PARTITION BY l.metric_id, r.level
                               -- Same convention as change rankings: rank 1 is the
                               -- better end wherever the metric defines one. A
                               -- `neutral` metric ranks largest first, which is
                               -- presentation rather than judgment.
                               ORDER BY CASE WHEN m.direction = 'lower_is_better'
                                             THEN l.value ELSE -l.value END
                           ) AS rank,
                           count(*) OVER (
                               PARTITION BY l.metric_id, r.level
                           ) AS of
                    FROM latest l
                    JOIN regions r ON r.region_id = l.region_id
                    JOIN metrics m ON m.metric_id = l.metric_id
                )
                SELECT metric_id, level, 'value', 'latest', region_id, value, rank, of,
                       CASE WHEN of > 1
                            THEN 100.0 * (of - rank) / (of - 1)
                            ELSE 100.0 END
                FROM ranked
                WHERE of > 1
                """
            )
        ).rowcount
    )
