"""Where a place's residents work (Milestone 45, ARCHITECTURE #313).

The ten destinations holding the most of its residents' jobs in the Census Bureau's
LODES, each a New Jersey municipality (with its region, so the page can link it) or a
named place out of state. A list, never a ranking of places: it says where this place's
jobs are, not which destination is better.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])


class WorkDestination(BaseModel):
    rank: int
    name: str
    # The municipality's region, for a destination in New Jersey; None out of state.
    region_id: int | None
    jobs: int
    share: float


class WorkDestinations(BaseModel):
    region_id: int
    year: int
    total_jobs: int
    destinations: list[WorkDestination]
    release_id: int
    file_sha256: str
    fetched_at: datetime
    source: str = "U.S. Census Bureau, LEHD Origin-Destination Employment Statistics"


_SQL = text(
    """
    SELECT w.rank, w.destination_name, w.destination_region_id, w.jobs, w.share,
           w.total_jobs, w.year, w.release_id, sr.file_sha256, sr.fetched_at
    FROM work_destinations w JOIN source_releases sr USING (release_id)
    WHERE w.region_id = :region_id
    ORDER BY w.rank
    """
)


@router.get(
    "/regions/{region_id}/work-destinations",
    response_model=WorkDestinations,
    summary="Where the region's residents work: its ten leading destinations",
)
def work_destinations(region_id: int, session: SessionDep) -> WorkDestinations:
    """404 when no list is held: a place whose residents hold under 100 jobs."""
    rows = session.execute(_SQL, {"region_id": region_id}).mappings().all()
    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No work destinations for region {region_id}"
        )
    first = rows[0]
    return WorkDestinations(
        region_id=region_id,
        year=int(first["year"]),
        total_jobs=int(first["total_jobs"]),
        destinations=[
            WorkDestination(
                rank=int(r["rank"]),
                name=r["destination_name"],
                region_id=r["destination_region_id"],
                jobs=int(r["jobs"]),
                share=float(r["share"]),
            )
            for r in rows
        ],
        release_id=int(first["release_id"]),
        file_sha256=first["file_sha256"],
        fetched_at=first["fetched_at"],
    )
