"""What a visual story draws beyond the published measures (#438).

A statewide count for every day, a distribution across bins, a name for a dot: the
rows of `story_points`, by story. A story reads them at build time and says how; the
endpoint only serves them, with the source each row was counted from.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["stories"])


class StoryPoint(BaseModel):
    series: str
    region_id: int | None
    x: str
    y: float
    label: str | None


class StoryPoints(BaseModel):
    story_id: str
    points: list[StoryPoint]
    # Every release the rows cite, by source and vintage.
    sources: list[str]


_SQL = text(
    """
    SELECT p.series, p.region_id, p.x, p.y, p.label,
           sr.source_id || ' ' || sr.vintage AS source
    FROM story_points p JOIN source_releases sr USING (release_id)
    WHERE p.story_id = :story_id
    ORDER BY p.series, p.x, p.region_id
    """
)


@router.get(
    "/stories/{story_id}/points",
    response_model=StoryPoints,
    summary="A visual story's rows beyond the published measures",
)
def story_points(story_id: str, session: SessionDep) -> StoryPoints:
    """404 when the story has no rows: its source has not been loaded."""
    rows = session.execute(_SQL, {"story_id": story_id}).mappings().all()
    if not rows:
        raise HTTPException(status_code=404, detail=f"No points for story {story_id}")
    return StoryPoints(
        story_id=story_id,
        points=[
            StoryPoint(
                series=r["series"],
                region_id=r["region_id"],
                x=r["x"],
                y=r["y"],
                label=r["label"],
            )
            for r in rows
        ],
        sources=sorted({r["source"] for r in rows}),
    )
