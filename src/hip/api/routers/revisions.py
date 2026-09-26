"""What changed: figures this site had already published that a later refresh revised.

`fact_revision` (Milestone 29, ARCHITECTURE #194) keeps the old value whenever a
refresh moves a published figure, and nothing showed a reader those rows until
Milestone 27. They cannot be served raw: the first refresh that recorded them wrote
313,536, nearly all of them Zillow restating its own history. So this endpoint
summarises, and its size is bounded by the number of refreshes it covers rather than by
how much a publisher revised:

- **A batch is a UTC day.** `revised_at` is the loading transaction's clock, so one
  refresh's revisions share a day; two refreshes on one day merge, which a reader
  asking "what changed that day" would want anyway.
- **A figure counts once per batch**, at its net change: first old value to last new
  value, and dropped if those agree. A refresh re-run after a failure can revise a
  figure twice in a day, and counting both would inflate the batch.
- **Groups are per metric, and split by whether the period had ended.** A figure for a
  period still under way — this month's mortgage-rate average, which moves as each
  week's reading arrives (Milestone 26) — changes by design, and a reader should not
  take it for a publisher correcting a finished figure. The split is by the period's
  natural length (its metric's frequency), not by the observation's `period_end`: a
  month in progress ends on its last observed week, which has already passed.
- **Examples are one per place.** The largest changes in a group are often every month
  of one ZIP code's restated series; one row per place, its largest change, says the
  same thing and names three places rather than one.

Neither `regions` nor `metrics` is joined strictly: `fact_revision` deliberately has
no foreign keys (a revision has to outlive the region or metric it describes), so a
removed one still counts, labelled by its id.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.api.deps import SessionDep

router = APIRouter(tags=["meta"])

# Twelve refreshes is a quarter of weekly runs. The endpoint's size is this times the
# metrics a refresh can touch, never the 313,536 rows one refresh wrote.
BATCHES = 12
EXAMPLES = 3


class RevisedPlace(BaseModel):
    """One place's largest revision in a group, standing for all of that place's."""

    region_id: int
    name: str
    level: str | None = None
    # The containing county, for a municipality: "Margate City" alone is not enough to
    # find it.
    county: str | None = None
    # Whether the site has a page for this place to link to. False for a region since
    # removed, or one that no longer holds an observation.
    has_page: bool
    period_start: date
    # The observation's own end date, for labelling ("2015", not "Jan 2015", for an
    # annual figure); its start where the observation is gone.
    period_end: date
    old_value: float | None = None
    new_value: float | None = None
    # (new − old) / |old|, a fraction. None when either side is missing or old is zero.
    change: float | None = None
    # How many of this place's periods moved in this group.
    periods: int


class RevisionGroup(BaseModel):
    metric_id: str
    label: str
    unit: str
    # The metric's cadence, which names its periods: "and 29 other months".
    frequency: str | None = None
    source_id: str | None = None
    # The period had not ended when the figure changed (see the module docstring).
    under_way: bool
    figures: int
    places: int
    # End dates of the earliest and latest revised periods, for a label like
    # "Jan 2000 – Jul 2026".
    earliest_period: date
    latest_period: date
    rose: int
    fell: int
    # The median |change| across the group's figures, a fraction.
    median_change: float | None = None
    largest: list[RevisedPlace]


class RevisionBatch(BaseModel):
    revised_on: date
    figures: int
    groups: list[RevisionGroup]


class RevisionReport(BaseModel):
    generated_at: datetime
    # When the oldest recorded revision was written; None if none ever was.
    recorded_since: datetime | None = None
    # Every batch ever recorded, including those beyond `batches`.
    total_batches: int
    batches: list[RevisionBatch]


# One row per figure per UTC day, at its net change, with what a group and an example
# both need. `:days` bounds the scan to the batches being reported.
_SCORED = """
WITH figure AS (
    SELECT (r.revised_at AT TIME ZONE 'UTC')::date AS revised_on,
           r.region_id, r.metric_id, r.period_start,
           (array_agg(r.old_value ORDER BY r.revision_id))[1] AS old_value,
           (array_agg(r.new_value ORDER BY r.revision_id DESC))[1] AS new_value
    FROM fact_revision r
    WHERE (r.revised_at AT TIME ZONE 'UTC')::date = ANY(:days)
    GROUP BY 1, 2, 3, 4
),
scored AS (
    SELECT f.revised_on, f.region_id, f.metric_id, f.period_start,
           f.old_value, f.new_value,
           COALESCE(m.label, f.metric_id) AS label,
           COALESCE(m.unit, '') AS unit,
           m.frequency,
           m.source_id,
           COALESCE(o.period_end, f.period_start) AS period_end,
           (f.new_value - f.old_value) / NULLIF(abs(f.old_value), 0) AS change,
           f.revised_on < CASE m.frequency
               WHEN 'weekly' THEN f.period_start + 7
               WHEN 'monthly' THEN (f.period_start + interval '1 month')::date
               WHEN 'quarterly' THEN (f.period_start + interval '3 months')::date
               ELSE (f.period_start + interval '1 year')::date
           END AS under_way
    FROM figure f
    LEFT JOIN metrics m ON m.metric_id = f.metric_id
    LEFT JOIN fact_metric_observation o
      ON o.region_id = f.region_id
     AND o.metric_id = f.metric_id
     AND o.period_start = f.period_start
    WHERE f.old_value IS DISTINCT FROM f.new_value
)
"""

_GROUPS = (
    _SCORED
    + """
SELECT revised_on, metric_id, under_way,
       min(label) AS label, min(unit) AS unit, min(frequency) AS frequency,
       min(source_id) AS source_id,
       count(*) AS figures,
       count(DISTINCT region_id) AS places,
       min(period_end) AS earliest_period,
       max(period_end) AS latest_period,
       count(*) FILTER (WHERE new_value > old_value) AS rose,
       count(*) FILTER (WHERE new_value < old_value) AS fell,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(change)) AS median_change
FROM scored
GROUP BY revised_on, metric_id, under_way
"""
)

_EXAMPLES = (
    _SCORED
    + """,
per_place AS (
    -- Each place's largest change in its group, and how many of its periods moved.
    -- DISTINCT ON runs after the window, so `periods` counts every row first.
    SELECT DISTINCT ON (revised_on, metric_id, under_way, region_id)
           revised_on, metric_id, under_way, region_id, period_start, period_end,
           old_value, new_value, change,
           count(*) OVER (PARTITION BY revised_on, metric_id, under_way, region_id)
               AS periods
    FROM scored
    ORDER BY revised_on, metric_id, under_way, region_id,
             abs(change) DESC NULLS LAST, period_start DESC
),
ranked AS (
    SELECT p.*,
           row_number() OVER (
               PARTITION BY revised_on, metric_id, under_way
               ORDER BY abs(change) DESC NULLS LAST, region_id
           ) AS place_rank
    FROM per_place p
)
SELECT k.revised_on, k.metric_id, k.under_way, k.region_id,
       k.period_start, k.period_end, k.old_value, k.new_value, k.change, k.periods,
       g.name, g.level, c.name AS county,
       -- The same test the static build uses to decide which region pages exist.
       (g.level IS NOT NULL AND g.level <> 'state' AND EXISTS (
           SELECT 1 FROM fact_metric_observation f WHERE f.region_id = k.region_id
       )) AS has_page
FROM ranked k
LEFT JOIN regions g ON g.region_id = k.region_id
LEFT JOIN regions c ON c.region_id = g.parent_id AND c.level = 'county'
WHERE k.place_rank <= :examples
ORDER BY k.place_rank
"""
)


def revision_report(
    session: Session, batches: int = BATCHES, examples: int = EXAMPLES
) -> RevisionReport:
    summary = session.execute(
        text(
            """
            SELECT min(revised_at) AS recorded_since,
                   count(DISTINCT (revised_at AT TIME ZONE 'UTC')::date) AS total_batches
            FROM fact_revision
            """
        )
    ).one()
    days = list(
        session.execute(
            text(
                """
                SELECT DISTINCT (revised_at AT TIME ZONE 'UTC')::date AS revised_on
                FROM fact_revision
                ORDER BY revised_on DESC
                LIMIT :batches
                """
            ),
            {"batches": batches},
        ).scalars()
    )
    params: dict[str, Any] = {"days": days, "examples": examples}

    places: dict[tuple[date, str, bool], list[RevisedPlace]] = {}
    for row in session.execute(text(_EXAMPLES), params).mappings():
        places.setdefault(
            (row["revised_on"], row["metric_id"], row["under_way"]), []
        ).append(
            RevisedPlace(
                region_id=row["region_id"],
                name=row["name"]
                if row["name"] is not None
                else f"region {row['region_id']}",
                level=row["level"],
                county=row["county"],
                has_page=row["has_page"],
                period_start=row["period_start"],
                period_end=row["period_end"],
                old_value=row["old_value"],
                new_value=row["new_value"],
                change=row["change"],
                periods=row["periods"],
            )
        )

    by_day: dict[date, list[RevisionGroup]] = {day: [] for day in days}
    for row in session.execute(text(_GROUPS), params).mappings():
        key = (row["revised_on"], row["metric_id"], row["under_way"])
        by_day[row["revised_on"]].append(
            RevisionGroup(
                metric_id=row["metric_id"],
                label=row["label"],
                unit=row["unit"],
                frequency=row["frequency"],
                source_id=row["source_id"],
                under_way=row["under_way"],
                figures=row["figures"],
                places=row["places"],
                earliest_period=row["earliest_period"],
                latest_period=row["latest_period"],
                rose=row["rose"],
                fell=row["fell"],
                median_change=row["median_change"],
                largest=places.get(key, []),
            )
        )

    report = []
    for day in days:
        # Publishers' own figures before the platform's, which only follow them; then
        # the largest groups first. A day whose every revision netted out is dropped.
        groups = sorted(
            by_day[day],
            key=lambda g: (
                g.source_id == "hip_derived",
                g.under_way,
                -g.figures,
                g.label,
            ),
        )
        if groups:
            report.append(
                RevisionBatch(
                    revised_on=day, figures=sum(g.figures for g in groups), groups=groups
                )
            )

    return RevisionReport(
        generated_at=datetime.now(UTC),
        recorded_since=summary.recorded_since,
        total_batches=summary.total_batches,
        batches=report,
    )


@router.get(
    "/revisions",
    response_model=RevisionReport,
    summary="Figures already published that a later refresh revised",
)
def revisions(
    session: SessionDep,
    batches: Annotated[int, Query(ge=1, le=52)] = BATCHES,
) -> RevisionReport:
    """The most recent refreshes that moved a published figure, newest first.

    Summarised per metric with the three places that moved most, never row by row.
    """
    return revision_report(session, batches=batches)
