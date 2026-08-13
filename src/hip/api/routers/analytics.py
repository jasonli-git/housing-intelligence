"""Rankings, comparisons, and the region summary.

Everything here reads the derived tables `hip analyze` builds. Nothing is computed at
request time: a ranking recomputed per request would be both slow and non-reproducible,
and the platform's claim is that a number can be traced to a run.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep
from hip.api.params import LATEST_WINDOW, RankingBasis, RegionLevel, Window
from hip.packets import caveats_for

router = APIRouter(tags=["analytics"])


class RankedRegion(BaseModel):
    """One ranked region.

    `value` is always the quantity that was ranked — a percentage change under
    `basis=change`, the latest observed level under `basis=value`. The change-specific
    fields are null for a value ranking, because a snapshot has no window and no
    starting point.
    """

    rank: int
    of: int
    percentile: float
    region_id: int
    name: str
    level: str
    value: float
    pct_change: float | None = None
    start_value: float | None = None
    end_value: float | None = None
    window_start: date | None = None
    window_end: date | None = None


class Ranking(BaseModel):
    metric_id: str
    label: str
    unit: str
    direction: str
    basis: str
    window: str
    level: str
    items: list[RankedRegion]


@router.get("/rankings", response_model=Ranking, summary="Rank regions")
def rankings(
    session: SessionDep,
    metric_id: Annotated[str, Query()],
    level: Annotated[RegionLevel, Query()] = "county",
    window: Annotated[Window, Query()] = "5y",
    basis: Annotated[RankingBasis, Query()] = "change",
    limit: Annotated[int, Query(ge=1, le=1000)] = 25,
) -> Ranking:
    """Regions ordered best first, by change over a window or by current value.

    "Best" follows the metric's own `direction`, so rank 1 is the lowest rise in a
    lower-is-better metric and the highest in a higher-is-better one. For a `neutral`
    metric the order is by largest value, which is a presentation choice rather
    than a judgment.

    `basis=value` ignores `window` — a level has no span — and is the only basis a
    single-vintage source such as MOD-IV can be ranked on.
    """
    metric = (
        session.execute(
            text(
                "SELECT metric_id, label, unit, direction FROM metrics "
                "WHERE metric_id = :m"
            ),
            {"m": metric_id},
        )
        .mappings()
        .one_or_none()
    )
    if metric is None:
        raise HTTPException(status_code=404, detail=f"No metric {metric_id}")

    effective_window = LATEST_WINDOW if basis == "value" else window
    # A value ranking has no change row to join, and forcing one would drop every
    # snapshot metric back out of the result — the exact failure this basis exists to
    # prevent. LEFT JOIN keeps one query shape for both bases (ARCHITECTURE #8).
    rows = session.execute(
        text(
            """
            SELECT k.rank, k.of, k.percentile, k.region_id, r.name, r.level::text,
                   k.value,
                   c.pct_change, c.start_value, c.end_value,
                   c.window_start, c.window_end
            FROM region_rankings k
            JOIN regions r ON r.region_id = k.region_id
            LEFT JOIN fact_metric_change c
              ON c.region_id = k.region_id AND c.metric_id = k.metric_id
             AND c."window" = k."window"
            WHERE k.metric_id = :m AND k.level = :level
              AND k.basis = :basis AND k."window" = :w
            ORDER BY k.rank
            LIMIT :limit
            """
        ),
        {
            "m": metric_id,
            "level": level,
            "basis": basis,
            "w": effective_window,
            "limit": limit,
        },
    ).mappings()

    return Ranking(
        metric_id=metric["metric_id"],
        label=metric["label"],
        unit=metric["unit"],
        direction=metric["direction"],
        basis=basis,
        window=effective_window,
        level=level,
        items=[RankedRegion(**row) for row in rows],
    )


class SeriesPoint(BaseModel):
    period_start: date
    value: float


class ComparedRegion(BaseModel):
    region_id: int
    name: str
    level: str
    series: list[SeriesPoint]


class Comparison(BaseModel):
    metric_id: str
    label: str
    unit: str
    regions: list[ComparedRegion]


@router.get("/compare", response_model=Comparison, summary="Aligned series")
def compare(
    session: SessionDep,
    metric_id: Annotated[str, Query()],
    region_ids: Annotated[list[int], Query()],
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: Annotated[date | None, Query()] = None,
) -> Comparison:
    """One metric across several regions, on a shared time axis."""
    metric = (
        session.execute(
            text("SELECT metric_id, label, unit FROM metrics WHERE metric_id = :m"),
            {"m": metric_id},
        )
        .mappings()
        .one_or_none()
    )
    if metric is None:
        raise HTTPException(status_code=404, detail=f"No metric {metric_id}")

    filters = ["f.metric_id = :m", "f.region_id = ANY(:ids)"]
    params: dict[str, Any] = {"m": metric_id, "ids": region_ids}
    if from_:
        filters.append("f.period_start >= :from_")
        params["from_"] = from_
    if to:
        filters.append("f.period_start <= :to")
        params["to"] = to

    rows = session.execute(
        text(
            f"""
            SELECT f.region_id, r.name, r.level::text, f.period_start, f.value
            FROM fact_metric_observation f
            JOIN regions r ON r.region_id = f.region_id
            WHERE {" AND ".join(filters)}
            ORDER BY f.region_id, f.period_start
            """
        ),
        params,
    ).mappings()

    grouped: dict[int, ComparedRegion] = {}
    for row in rows:
        region = grouped.get(row["region_id"])
        if region is None:
            region = ComparedRegion(
                region_id=row["region_id"],
                name=row["name"],
                level=row["level"],
                series=[],
            )
            grouped[row["region_id"]] = region
        region.series.append(
            SeriesPoint(period_start=row["period_start"], value=row["value"])
        )

    return Comparison(
        metric_id=metric["metric_id"],
        label=metric["label"],
        unit=metric["unit"],
        # Preserve the caller's order rather than the database's.
        regions=[grouped[rid] for rid in region_ids if rid in grouped],
    )


class Headline(BaseModel):
    metric_id: str
    label: str
    unit: str
    direction: str
    window: str
    start_value: float
    end_value: float
    pct_change: float
    rank: int | None = None
    of: int | None = None


class Level(BaseModel):
    """A metric's most recent observed value, with its rank among peers.

    Separate from `Headline` because it answers a different question and exists for
    metrics that cannot answer the first: a snapshot source has a value and no change.
    """

    metric_id: str
    label: str
    unit: str
    direction: str
    value: float
    period_start: date
    period_end: date
    source_id: str
    rank: int | None = None
    of: int | None = None


class Summary(BaseModel):
    region_id: int
    name: str
    level: str
    window: str
    headlines: list[Headline]
    levels: list[Level]
    caveats: list[str]


@router.get(
    "/regions/{region_id}/summary",
    response_model=Summary,
    summary="What changed here, and how it ranks",
)
def summary(
    region_id: int,
    session: SessionDep,
    window: Annotated[Window, Query()] = "5y",
) -> Summary:
    """The dashboard landing view: headline changes with rank and relevant caveats."""
    region = (
        session.execute(
            text(
                "SELECT region_id, name, level::text FROM regions WHERE region_id = :id"
            ),
            {"id": region_id},
        )
        .mappings()
        .one_or_none()
    )
    if region is None:
        raise HTTPException(status_code=404, detail=f"No region {region_id}")

    rows = session.execute(
        text(
            """
            SELECT c.metric_id, m.label, m.unit, m.direction,
                   c.start_value, c.end_value, c.pct_change,
                   k.rank, k.of
            FROM fact_metric_change c
            JOIN metrics m ON m.metric_id = c.metric_id
            LEFT JOIN region_rankings k
              ON k.region_id = c.region_id AND k.metric_id = c.metric_id
             AND k."window" = c."window" AND k.basis = 'change'
            WHERE c.region_id = :id AND c."window" = :w
            ORDER BY c.metric_id
            """
        ),
        {"id": region_id, "w": window},
    ).mappings()

    headlines = [Headline(window=window, **row) for row in rows]

    # The latest value of every metric this region has, ranked among its peers. A
    # metric with one vintage — every MOD-IV assessment aggregate — appears only here,
    # because a change table needs two observations to say anything.
    level_rows = session.execute(
        text(
            """
            SELECT DISTINCT ON (f.metric_id)
                   f.metric_id, m.label, m.unit, m.direction, f.value,
                   f.period_start, f.period_end, sr.source_id, k.rank, k.of
            FROM fact_metric_observation f
            JOIN metrics m ON m.metric_id = f.metric_id
            JOIN source_releases sr ON sr.release_id = f.release_id
            LEFT JOIN region_rankings k
              ON k.region_id = f.region_id AND k.metric_id = f.metric_id
             AND k.basis = 'value'
            WHERE f.region_id = :id
            ORDER BY f.metric_id, f.period_end DESC
            """
        ),
        {"id": region_id},
    ).mappings()
    levels = [Level(**row) for row in level_rows]

    # The same derivation the analysis packet uses (hip.packets.caveats), so the
    # dashboard and a packet reader are told the same things about the same figures.
    match_methods = session.execute(
        text(
            "SELECT DISTINCT match_method FROM fact_metric_observation "
            "WHERE region_id = :id"
        ),
        {"id": region_id},
    ).scalars()
    caveats = caveats_for(
        level=region["level"],
        # Levels as well as headlines: a metric with no change row still carries its
        # own caveats, and MOD-IV brings several.
        metric_ids=[h.metric_id for h in headlines] + [lv.metric_id for lv in levels],
        match_methods=list(match_methods),
    )

    return Summary(
        region_id=region["region_id"],
        name=region["name"],
        level=region["level"],
        window=window,
        headlines=headlines,
        levels=levels,
        caveats=caveats,
    )
