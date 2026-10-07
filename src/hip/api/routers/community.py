"""Separately cited school, broadband, crime and health context."""

from datetime import date, datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])


class CommunityRecord(BaseModel):
    source_id: str
    kind: str
    entity_id: str
    record_id: str
    payload: dict[str, Any]
    snapshot: date | None
    release_id: int
    release_layer: str
    vintage: str
    file_sha256: str
    fetched_at: datetime


class DistrictContext(BaseModel):
    boundary: CommunityRecord
    performance: CommunityRecord | None


class CommunityContext(BaseModel):
    region_id: int
    districts: list[DistrictContext]
    health: list[CommunityRecord]
    health_area: str | None
    health_level: str | None
    crime: list[CommunityRecord]
    crime_county: str | None
    broadband_status: str = "pending_download"
    broadband: list[CommunityRecord] = Field(default_factory=list)
    broadband_area: str | None = None
    broadband_level: str | None = None


def records_for(session: SessionDep, entities: list[str]) -> list[CommunityRecord]:
    return [
        CommunityRecord(**dict(r))
        for r in session.execute(
            text("""
        SELECT c.*, sr.layer AS release_layer, sr.vintage, sr.file_sha256, sr.fetched_at
        FROM community_records c JOIN source_releases sr USING(release_id)
        WHERE c.entity_id = ANY(:entities) ORDER BY c.kind,c.entity_id,c.record_id
    """),
            {"entities": entities},
        ).mappings()
    ]


@router.get("/community/health/{level}", response_model=list[CommunityRecord])
def health_inventory(
    level: Literal["county", "tract", "zip"], session: SessionDep
) -> list[CommunityRecord]:
    """Publish tract estimates too, without inventing housing facts or tract profiles."""
    return [
        CommunityRecord(**dict(r))
        for r in session.execute(
            text("""
            SELECT c.*, sr.layer AS release_layer, sr.vintage,
                   sr.file_sha256, sr.fetched_at
            FROM community_records c JOIN source_releases sr USING(release_id)
            WHERE c.kind='health_estimate' AND c.entity_id LIKE :prefix
            ORDER BY c.entity_id,c.record_id
        """),
            {"prefix": f"{level}:%"},
        ).mappings()
    ]


@router.get("/regions/{region_id}/community", response_model=CommunityContext)
def community(region_id: int, session: SessionDep) -> CommunityContext:
    region = (
        session.execute(
            text("""
        SELECT r.geoid,r.name,r.level::text AS level,
               c.geoid AS county_geoid,c.name AS county_name
        FROM regions r LEFT JOIN regions c ON c.region_id =
            CASE WHEN r.level='county' THEN r.region_id
                 WHEN r.level='municipality' THEN r.parent_id END
        WHERE r.region_id=:id
    """),
            {"id": region_id},
        )
        .mappings()
        .first()
    )
    if region is None:
        raise HTTPException(404, "No such region")
    entity = f"{region['level']}:{region['geoid']}"
    county = f"county:{region['county_geoid']}" if region["county_geoid"] else None
    local = records_for(session, list({entity, *([county] if county else [])}))
    boundaries = [r for r in local if r.kind == "school_area" and r.entity_id == entity]
    districts = (
        records_for(
            session, list({f"district:{r.payload['district_id']}" for r in boundaries})
        )
        if boundaries
        else []
    )
    performance = {r.record_id: r for r in districts if r.kind == "school_performance"}
    # County context is explicitly labelled for towns, never silently relabelled as
    # a town estimate. ZIPs cross county boundaries and receive no county fallback.
    health_entity = county if region["level"] == "municipality" else entity
    health = [
        r for r in local if r.kind == "health_estimate" and r.entity_id == health_entity
    ]
    crime = [r for r in local if r.kind == "crime_agency" and r.entity_id == county]
    broadband_entity = county if region["level"] == "municipality" else entity
    broadband = [
        r
        for r in local
        if r.kind == "broadband_summary" and r.entity_id == broadband_entity
    ]
    return CommunityContext(
        region_id=region_id,
        districts=[
            DistrictContext(
                boundary=r, performance=performance.get(str(r.payload["district_id"]))
            )
            for r in boundaries
        ],
        health=health,
        health_area=region["county_name"]
        if region["level"] == "municipality" and health
        else region["name"]
        if health
        else None,
        health_level="county"
        if region["level"] == "municipality" and health
        else region["level"]
        if health
        else None,
        crime=crime,
        crime_county=region["county_name"] if crime else None,
        broadband=broadband,
        broadband_area=(
            region["county_name"] if region["level"] == "municipality" else region["name"]
        )
        if broadband
        else None,
        broadband_level="county"
        if region["level"] == "municipality" and broadband
        else region["level"]
        if broadband
        else None,
        broadband_status="published_summary"
        if broadband
        else "not_matched"
        if region["level"] == "zip"
        else "pending_download",
    )
