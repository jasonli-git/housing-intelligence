"""Metric endpoints: the observations, their definitions, and their coverage.

Every value carries the release it came from and how its geography was resolved
(ARCHITECTURE #9, #27). Provenance is a field on the response, not a separate lookup,
because a number without its source is exactly what this platform exists not to serve.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep
from hip.api.params import RegionLevel

router = APIRouter(tags=["metrics"])


class Metric(BaseModel):
    metric_id: str
    label: str
    unit: str
    frequency: str
    direction: str
    description: str
    source_id: str


class MetricCoverage(Metric):
    """A metric plus how much of the warehouse it actually covers."""

    regions: int
    observations: int
    first_period: date | None = None
    last_period: date | None = None


class Observation(BaseModel):
    metric_id: str
    period_start: date
    period_end: date
    value: float
    # Provenance travels with the value.
    source_id: str
    vintage: str
    match_method: str


class RegionMetrics(BaseModel):
    region_id: int
    name: str
    level: str
    observations: list[Observation]


@router.get("/metrics", response_model=list[MetricCoverage], summary="Metric catalog")
def list_metrics(
    session: SessionDep,
    level: Annotated[RegionLevel | None, Query()] = None,
) -> list[MetricCoverage]:
    """Every metric with its coverage, optionally for one region level.

    Coverage is the point: a metric present in the catalog but covering 12 regions is
    a different thing from one covering 564, and a caller should not have to discover
    that by querying every region.
    """
    # The level filter has to sit inside the aggregates, not in the join condition:
    # LEFT JOIN ... AND r.level = :level nulls the region but keeps the fact row, so
    # every count still included every level. Conditional aggregation also keeps
    # metrics with zero coverage at this level visible, with a count of 0, which is
    # itself worth knowing.
    # The cast on the NULL check is required: in a bare `:level IS NULL` Postgres has
    # no column context to infer the parameter type from and rejects it as ambiguous.
    params: dict[str, object] = {"level": level}
    keep = "(CAST(:level AS text) IS NULL OR r.level = CAST(:level AS region_level))"

    rows = session.execute(
        text(
            f"""
            SELECT m.metric_id, m.label, m.unit, m.frequency, m.direction,
                   m.description, m.source_id,
                   count(DISTINCT CASE WHEN {keep} THEN f.region_id END) AS regions,
                   count(*) FILTER (WHERE f.region_id IS NOT NULL AND {keep})
                       AS observations,
                   min(f.period_start) FILTER (WHERE {keep}) AS first_period,
                   max(f.period_start) FILTER (WHERE {keep}) AS last_period
            FROM metrics m
            LEFT JOIN fact_metric_observation f ON f.metric_id = m.metric_id
            LEFT JOIN regions r ON r.region_id = f.region_id
            GROUP BY m.metric_id, m.label, m.unit, m.frequency, m.direction,
                     m.description, m.source_id
            ORDER BY m.metric_id
            """
        ),
        params,
    ).mappings()
    return [MetricCoverage(**row) for row in rows]


@router.get(
    "/regions/{region_id}/metrics",
    response_model=RegionMetrics,
    summary="Observations for one region",
)
def region_metrics(
    region_id: int,
    session: SessionDep,
    metric_id: Annotated[list[str] | None, Query()] = None,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=20000)] = 5000,
) -> RegionMetrics:
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

    filters = ["f.region_id = :id"]
    params: dict[str, object] = {"id": region_id, "limit": limit}
    if metric_id:
        filters.append("f.metric_id = ANY(:metric_ids)")
        params["metric_ids"] = metric_id
    if from_:
        filters.append("f.period_start >= :from_")
        params["from_"] = from_
    if to:
        filters.append("f.period_start <= :to")
        params["to"] = to

    rows = session.execute(
        text(
            f"""
            SELECT f.metric_id, f.period_start, f.period_end, f.value,
                   sr.source_id, sr.vintage, f.match_method
            FROM fact_metric_observation f
            JOIN source_releases sr ON sr.release_id = f.release_id
            WHERE {" AND ".join(filters)}
            ORDER BY f.metric_id, f.period_start
            LIMIT :limit
            """
        ),
        params,
    ).mappings()

    return RegionMetrics(
        region_id=region["region_id"],
        name=region["name"],
        level=region["level"],
        observations=[Observation(**row) for row in rows],
    )


class UnresolvedGeography(BaseModel):
    source_id: str
    layer: str
    region_name: str
    county_name: str | None = None
    observations: int
    reason: str


@router.get(
    "/sources/unresolved",
    response_model=list[UnresolvedGeography],
    summary="Source geographies that could not be matched to a region",
)
def unresolved(session: SessionDep) -> list[UnresolvedGeography]:
    """Why a place has no data.

    A user who notices a missing municipality deserves an answer better than silence.
    Each row names the source geography and the reason it went unmatched.
    """
    rows = session.execute(
        text(
            """
            SELECT source_id, layer, region_name, county_name, observations, reason
            FROM source_match_reject
            ORDER BY observations DESC, region_name
            """
        )
    ).mappings()
    return [UnresolvedGeography(**row) for row in rows]
