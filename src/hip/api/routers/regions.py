"""Region endpoints: the geography spine, queryable.

Every response is derived from `regions` and `region_crosswalk`. Levels share one table,
so `level` is a filter rather than a different code path (ARCHITECTURE #7).
"""

from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from hip.api.deps import SessionDep
from hip.api.params import RegionLevel

router = APIRouter(tags=["regions"])


# Geometry payloads are the one place this API can accidentally return 50MB. Tracts and
# ZIPs are numerous and detailed, so /geo simplifies by default; the tolerance is in
# degrees and 0 disables it.
DEFAULT_SIMPLIFY_DEG = 0.0002


class Region(BaseModel):
    region_id: int
    geoid: str
    level: str
    name: str
    state_code: str
    parent_id: int | None = None


class RegionDetail(Region):
    """A region plus its roll-up chain, outermost last (county → state)."""

    ancestors: list[Region] = Field(default_factory=list)
    child_count: int = 0


class RegionPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[Region]


@router.get("/regions", response_model=RegionPage, summary="List regions")
def list_regions(
    session: SessionDep,
    level: Annotated[RegionLevel | None, Query()] = None,
    state: Annotated[str | None, Query(max_length=2)] = None,
    parent_id: Annotated[int | None, Query()] = None,
    q: Annotated[str | None, Query(description="Case-insensitive name match.")] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RegionPage:
    filters = ["TRUE"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if level:
        filters.append("level = CAST(:level AS region_level)")
        params["level"] = level
    if state:
        filters.append("state_code = :state")
        params["state"] = state.upper()
    if parent_id is not None:
        filters.append("parent_id = :parent_id")
        params["parent_id"] = parent_id
    if q:
        filters.append("name ILIKE :q")
        params["q"] = f"%{q}%"
    where = " AND ".join(filters)

    total = session.execute(
        text(f"SELECT count(*) FROM regions WHERE {where}"), params
    ).scalar_one()
    rows = session.execute(
        text(
            f"""
            SELECT region_id, geoid, level::text, name, state_code, parent_id
            FROM regions WHERE {where}
            ORDER BY level, geoid
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    ).mappings()

    return RegionPage(
        total=int(total), limit=limit, offset=offset, items=[Region(**r) for r in rows]
    )


@router.get(
    "/regions/{region_id}", response_model=RegionDetail, summary="One region in context"
)
def get_region(region_id: int, session: SessionDep) -> RegionDetail:
    row = (
        session.execute(
            text(
                """
            SELECT region_id, geoid, level::text, name, state_code, parent_id
            FROM regions WHERE region_id = :region_id
            """
            ),
            {"region_id": region_id},
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"No region {region_id}")

    # Recursive walk up parent_id. Depth is 3 at most today, but writing it recursively
    # means adding a level later needs no change here.
    ancestors = session.execute(
        text(
            """
            WITH RECURSIVE chain AS (
                SELECT region_id, geoid, level, name, state_code, parent_id, 0 AS depth
                FROM regions WHERE region_id = :region_id
                UNION ALL
                SELECT p.region_id, p.geoid, p.level, p.name, p.state_code,
                       p.parent_id, c.depth + 1
                FROM regions p JOIN chain c ON p.region_id = c.parent_id
            )
            SELECT region_id, geoid, level::text, name, state_code, parent_id
            FROM chain WHERE depth > 0 ORDER BY depth
            """
        ),
        {"region_id": region_id},
    ).mappings()

    child_count = session.execute(
        text("SELECT count(*) FROM regions WHERE parent_id = :region_id"),
        {"region_id": region_id},
    ).scalar_one()

    return RegionDetail(
        **row, ancestors=[Region(**a) for a in ancestors], child_count=int(child_count)
    )


@router.get("/geo/{level}", summary="GeoJSON boundaries for a level")
def get_geometry(
    level: RegionLevel,
    session: SessionDep,
    state: Annotated[str | None, Query(max_length=2)] = None,
    simplify: Annotated[
        float, Query(ge=0, le=0.05, description="Douglas-Peucker tolerance in degrees.")
    ] = DEFAULT_SIMPLIFY_DEG,
) -> dict[str, Any]:
    """A FeatureCollection, ready to hand to a map library."""
    params: dict[str, Any] = {"level": level, "simplify": simplify}
    where = "level = CAST(:level AS region_level)"
    if state:
        where += " AND state_code = :state"
        params["state"] = state.upper()

    # ST_SimplifyPreserveTopology rather than ST_Simplify: the latter can produce
    # self-intersecting rings, which some map libraries render as holes.
    geometry = "geom" if simplify == 0 else "ST_SimplifyPreserveTopology(geom, :simplify)"
    rows = session.execute(
        text(
            f"""
            SELECT region_id, geoid, name, state_code,
                   ST_AsGeoJSON({geometry}) AS geojson
            FROM regions WHERE {where}
            ORDER BY geoid
            """
        ),
        params,
    ).mappings()

    features = [
        {
            "type": "Feature",
            "id": row["region_id"],
            "geometry": json.loads(row["geojson"]),
            "properties": {
                "region_id": row["region_id"],
                "geoid": row["geoid"],
                "name": row["name"],
                "state_code": row["state_code"],
                "level": level,
            },
        }
        for row in rows
    ]
    return {"type": "FeatureCollection", "features": features}
