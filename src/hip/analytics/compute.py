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
    pruned_releases: int = 0


def rebuild(engine: Engine) -> AnalyticsResult:
    """Recompute every derived table. Idempotent."""
    result = AnalyticsResult()
    with engine.begin() as conn:
        result.derived_observations = _affordability(conn)
        result.pruned_releases = _prune_orphan_derived_releases(conn)
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

    The rows are computed into a temporary table *before* the release is created,
    because the release is content-addressed over exactly these values (#73). Writing
    the release first would mean hashing the clock instead of the data.
    """
    conn.execute(  # type: ignore[attr-defined]
        text(
            """
            CREATE TEMP TABLE derived_facts (
                region_id    bigint           NOT NULL,
                metric_id    text             NOT NULL,
                period_start date             NOT NULL,
                period_end   date             NOT NULL,
                value        double precision NOT NULL
            ) ON COMMIT DROP
            """
        )
    )

    counts: dict[str, int] = {}
    # (computed metric, monthly numerator, annual denominator, multiplier).
    # price_to_ami uses HUD's published area median income rather than the ACS survey
    # estimate, so the same question can be asked against a policy benchmark.
    #
    # fmr_to_income (Milestone 21) puts HUD's two-bedroom Fair Market Rent where
    # rent_to_income puts Zillow's observed rent. An FMR is dated as its fiscal year, so
    # the year it is grouped under is the one its 1 October start falls in: FY2024 took
    # effect in October 2023 and meets the ACS vintage ending 2023. FMRs exist only for
    # counties, so the join yields county rows and nothing is allocated downward.
    for metric_id, numerator, denominator, multiplier in (
        ("price_to_income", "zhvi_sfr", "acs_median_hh_income", 1.0),
        ("rent_to_income", "zori_all", "acs_median_hh_income", 12.0),
        ("price_to_ami", "zhvi_sfr", "hud_area_median_income", 1.0),
        ("fmr_to_income", "hud_fmr_2br", "acs_median_hh_income", 12.0),
    ):
        computed = conn.execute(  # type: ignore[attr-defined]
            text(
                """
                INSERT INTO derived_facts
                    (region_id, metric_id, period_start, period_end, value)
                SELECT income.region_id, :metric_id,
                       income.period_start, income.period_end,
                       -- Rounded, and computed in `numeric` throughout. Both halves
                       -- are required for the value to be reproducible; see the
                       -- averaging note below. Six decimal places on a ratio that
                       -- lives between about 1 and 20 is four more than the annual
                       -- denominator can support, so nothing a reader sees moves.
                       round(
                           (num.annual_value * CAST(:multiplier AS numeric))
                               / income.value::numeric,
                           6
                       )::double precision
                FROM fact_metric_observation income
                JOIN (
                    SELECT region_id,
                           date_trunc('year', period_start)::date AS yr,
                           -- `avg(value::numeric)`, not `avg(value)`. Floating-point
                           -- addition is not associative, so an average over
                           -- `double precision` depends on the order the executor
                           -- happens to aggregate rows in — which changes when `load`
                           -- rewrites the heap or the planner picks a parallel scan.
                           -- Measured on 2026-09-06: 19,027 of 24,956 (region, year)
                           -- groups differ between the two, in the last one or two
                           -- significant digits. That was enough to move the
                           -- content-addressed derived vintage on every single
                           -- pipeline run over an unchanged warehouse (four runs, four
                           -- digests), which marked all 21 explanations stale every
                           -- time and dirtied all 21 committed reports. #73 fixed the
                           -- half of this that was in `analyze`; this is the half that
                           -- was in the arithmetic. `numeric` is exact decimal, so the
                           -- sum is order-independent.
                           avg(value::numeric) AS annual_value
                    FROM fact_metric_observation
                    WHERE metric_id = :numerator
                    GROUP BY 1, 2
                ) num
                  ON num.region_id = income.region_id
                 AND num.yr = date_trunc('year', income.period_end)::date
                WHERE income.metric_id = :denominator
                  AND income.value > 0
                """
            ),
            {
                "metric_id": metric_id,
                "numerator": numerator,
                "denominator": denominator,
                "multiplier": multiplier,
            },
        ).rowcount
        counts[metric_id] = int(computed)

    release_id = _derived_release(conn)

    conn.execute(  # type: ignore[attr-defined]
        text(
            """
            INSERT INTO fact_metric_observation
                (region_id, metric_id, period_start, period_end, value,
                 release_id, match_method)
            SELECT region_id, metric_id, period_start, period_end, value,
                   :release_id, 'derived'
            FROM derived_facts
            ON CONFLICT (region_id, metric_id, period_start) DO UPDATE SET
                value = EXCLUDED.value,
                release_id = EXCLUDED.release_id,
                match_method = EXCLUDED.match_method
            """
        ),
        {"release_id": release_id},
    )
    return counts


def _derived_release(conn: object) -> int:
    """Get or create the `hip_derived` release for the rows in ``derived_facts``.

    Content-addressed, exactly like a downloaded file (ARCHITECTURE #10): the release
    is identified by a digest of the values it carries, so an `analyze` run over an
    unchanged warehouse reuses the existing row instead of minting a new one.

    That is what keeps the packet contract's central claim true. A packet carries no
    wall-clock field (#44) so that its hash changes when the data changes and at no
    other time — but the release this function returns is quoted in every packet's
    `sources[]` block and on every derived metric, so a run-stamped release made the
    hash move on every run regardless of the numbers. Every stored explanation was
    marked stale by the next pipeline run, and all 21 committed county reports showed a
    provenance diff with no figure behind it.

    `vintage` is the digest prefix rather than a date because a derived release has no
    upstream vintage to name, and the raw tier already addresses releases by
    `sha256[:16]`.
    """
    digest = str(
        conn.execute(  # type: ignore[attr-defined]
            text(
                """
                SELECT encode(sha256(convert_to(coalesce(string_agg(
                           region_id || '|' || metric_id || '|' || period_start || '|'
                               || period_end || '|' || value,
                           chr(10) ORDER BY metric_id, region_id, period_start
                       ), ''), 'UTF8')), 'hex')
                FROM derived_facts
                """
            )
        ).scalar_one()
    )
    rows = int(
        conn.execute(  # type: ignore[attr-defined]
            text("SELECT count(*) FROM derived_facts")
        ).scalar_one()
    )

    params = {"vintage": digest[:16], "digest": digest, "rows": rows}
    conn.execute(  # type: ignore[attr-defined]
        text(
            """
            INSERT INTO source_releases
                (source_id, layer, vintage, fetched_at, file_sha256, row_count)
            VALUES ('hip_derived', 'analytics', :vintage, now(), :digest, :rows)
            ON CONFLICT (source_id, layer, vintage, file_sha256) DO NOTHING
            """
        ),
        params,
    )
    return int(
        conn.execute(  # type: ignore[attr-defined]
            text(
                """
                SELECT release_id FROM source_releases
                WHERE source_id = 'hip_derived' AND layer = 'analytics'
                  AND vintage = :vintage AND file_sha256 = :digest
                """
            ),
            params,
        ).scalar_one()
    )


def _prune_orphan_derived_releases(conn: object) -> int:
    """Delete `hip_derived` releases no fact references any more.

    Derived releases are as disposable as the tables around them: one that no
    observation cites records that an `analyze` run happened and nothing else. Before
    #73 every run minted one, so they accumulated one per pipeline run forever and
    `GET /sources` listed them all.

    Scoped to `hip_derived` and to genuinely unreferenced rows, so this can never drop
    provenance a fact depends on — and it is the only DELETE in the analytics rebuild.
    """
    return int(
        conn.execute(  # type: ignore[attr-defined]
            text(
                """
                DELETE FROM source_releases sr
                WHERE sr.source_id = 'hip_derived'
                  AND NOT EXISTS (
                      SELECT 1 FROM fact_metric_observation f
                      WHERE f.release_id = sr.release_id
                  )
                """
            )
        ).rowcount
    )


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
                -- DISTINCT ON because the fact table is keyed on period_start:
                -- nothing stops two observations sharing an end date, and two rows
                -- here would carry two different end_values into every window. The
                -- packet assembler guards the same join for the same reason.
                ends AS (
                    SELECT DISTINCT ON (f.region_id, f.metric_id)
                           f.region_id, f.metric_id, f.period_end AS window_end,
                           f.value AS end_value
                    FROM fact_metric_observation f
                    JOIN latest l USING (region_id, metric_id)
                    WHERE f.period_end = l.end_period
                    ORDER BY f.region_id, f.metric_id, f.period_start DESC
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
                    -- The trailing two keys are what make this reproducible (#77).
                    -- Distance alone is not a total order: a target sitting between
                    -- two observations is equidistant from both, which is 5,606 of
                    -- the groups in New Jersey alone. `DISTINCT ON` then picked
                    -- whichever row the scan reached first, so `window_start`,
                    -- `start_value`, `pct_change` and `cagr` could all differ between
                    -- two runs over identical data — and the row count with them,
                    -- because the `window_end > window_start` filter below drops the
                    -- later candidate and not the earlier one. Ties resolve to the
                    -- older observation, so a window is never shorter than its label.
                    ORDER BY t.region_id, t.metric_id, t.label,
                             abs(s.period_end - t.target), s.period_end, s.period_start
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
