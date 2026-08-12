"""Rankings, comparisons, and the region summary.

Everything here reads the derived tables `hip analyze` builds. Nothing is computed at
request time: a ranking recomputed per request would be both slow and non-reproducible,
and the platform's claim is that a number can be traced to a run.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["analytics"])

RegionLevel = Literal["nation", "state", "county", "municipality", "zip", "tract"]
Window = Literal["1y", "3y", "5y", "10y", "since_2019"]


class RankedRegion(BaseModel):
    rank: int
    of: int
    percentile: float
    region_id: int
    name: str
    level: str
    pct_change: float
    start_value: float
    end_value: float
    window_start: date
    window_end: date


class Ranking(BaseModel):
    metric_id: str
    label: str
    direction: str
    window: str
    level: str
    items: list[RankedRegion]


@router.get("/rankings", response_model=Ranking, summary="Rank regions by change")
def rankings(
    session: SessionDep,
    metric_id: Annotated[str, Query()],
    level: Annotated[RegionLevel, Query()] = "county",
    window: Annotated[Window, Query()] = "5y",
    limit: Annotated[int, Query(ge=1, le=1000)] = 25,
) -> Ranking:
    """Regions ordered by percentage change, best first.

    "Best" follows the metric's own `direction`, so rank 1 is the lowest rise in a
    lower-is-better metric and the highest in a higher-is-better one. For a `neutral`
    metric the order is by largest increase, which is a presentation choice rather
    than a judgment.
    """
    metric = (
        session.execute(
            text("SELECT metric_id, label, direction FROM metrics WHERE metric_id = :m"),
            {"m": metric_id},
        )
        .mappings()
        .one_or_none()
    )
    if metric is None:
        raise HTTPException(status_code=404, detail=f"No metric {metric_id}")

    rows = session.execute(
        text(
            """
            SELECT k.rank, k.of, k.percentile, k.region_id, r.name, r.level::text,
                   c.pct_change, c.start_value, c.end_value,
                   c.window_start, c.window_end
            FROM region_rankings k
            JOIN regions r ON r.region_id = k.region_id
            JOIN fact_metric_change c
              ON c.region_id = k.region_id AND c.metric_id = k.metric_id
             AND c."window" = k."window"
            WHERE k.metric_id = :m AND k.level = :level AND k."window" = :w
            ORDER BY k.rank
            LIMIT :limit
            """
        ),
        {"m": metric_id, "level": level, "w": window, "limit": limit},
    ).mappings()

    return Ranking(
        metric_id=metric["metric_id"],
        label=metric["label"],
        direction=metric["direction"],
        window=window,
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


class Summary(BaseModel):
    region_id: int
    name: str
    level: str
    window: str
    headlines: list[Headline]
    caveats: list[str]


# Caveats that travel with a figure rather than living only in the docs. Keyed by what
# triggers them, so a reader sees the limitation next to the number it applies to.
_CAVEATS = {
    "acs": "ACS 5-year vintages overlap by four years, so consecutive estimates are "
    "not independent measurements.",
    "zip": "ZIP-level values are allocated from Census ZCTAs by area, not measured; "
    "a ZIP straddling several municipalities is an estimate.",
    "municipality": "Zillow municipal values are matched by name and county, not by "
    "FIPS; ACS municipal values are exact.",
    "national": "The mortgage rate is national and identical for every region.",
}


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
             AND k."window" = c."window"
            WHERE c.region_id = :id AND c."window" = :w
            ORDER BY c.metric_id
            """
        ),
        {"id": region_id, "w": window},
    ).mappings()

    headlines = [Headline(window=window, **row) for row in rows]

    caveats = []
    if any(h.metric_id.startswith("acs_") for h in headlines):
        caveats.append(_CAVEATS["acs"])
    if region["level"] == "zip":
        caveats.append(_CAVEATS["zip"])
    if region["level"] == "municipality":
        caveats.append(_CAVEATS["municipality"])
    if any(h.metric_id == "mortgage_rate_30y" for h in headlines):
        caveats.append(_CAVEATS["national"])

    return Summary(
        region_id=region["region_id"],
        name=region["name"],
        level=region["level"],
        window=window,
        headlines=headlines,
        caveats=caveats,
    )
