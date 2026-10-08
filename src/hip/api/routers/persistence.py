"""How today's price-to-income compares with the region's own history (Milestone 52,
ARCHITECTURE #348).

County and state only: the income side, Census SAIPE, is published for counties and
states, and FHFA's index for counties and states. A fact withheld by its validation —
the long-run index and the dollar ratio the page shows moved opposite ways — is still
served, with `withheld` set and no figures, so the page can say why it shows none.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep

router = APIRouter(tags=["regions"])


class PersistenceEpisode(BaseModel):
    start: int
    end: int
    years: int
    peak_year: int
    peak_vs_median: float
    back_to_median: int | None


class PersistencePoint(BaseModel):
    year: int
    vs_median: float


class Persistence(BaseModel):
    region_id: int
    first_year: int
    last_year: int
    years: int
    missing_years: list[int]
    vs_median: float | None
    vs_median_low: float | None
    vs_median_high: float | None
    rank: int | None
    rank_best: int | None
    rank_worst: int | None
    peak_year: int | None
    peak_vs_median: float | None
    above_median_since: int | None
    episodes: list[PersistenceEpisode]
    series: list[PersistencePoint]
    validation: dict[str, Any] | None
    withheld: str | None
    fetched_at: datetime | None
    sources: list[str] = [
        "FHFA House Price Index (all transactions)",
        "U.S. Census Bureau, Small Area Income and Poverty Estimates",
    ]


_FACT = text(
    """
    SELECT p.*, (
        SELECT max(sr.fetched_at)
        FROM fact_metric_observation o JOIN source_releases sr USING (release_id)
        WHERE o.region_id = p.region_id AND o.metric_id = ANY(:inputs)
    ) AS fetched_at
    FROM region_persistence p
    WHERE p.region_id = :id AND p.fact_id = 'price_to_income_history'
    """
)


@router.get(
    "/regions/{region_id}/persistence",
    response_model=Persistence,
    summary="Today's price-to-income against the region's own history",
)
def persistence(region_id: int, session: SessionDep) -> Persistence:
    """404 for a region with no fact: towns, ZIP codes and tracts, which have no
    yearly income estimate, and any county with too short a history."""
    row = (
        session.execute(
            _FACT,
            {
                "id": region_id,
                "inputs": [
                    "fhfa_hpi_county",
                    "fhfa_hpi_all_transactions",
                    "saipe_median_hh_income",
                ],
            },
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(
            status_code=404, detail=f"No long-run comparison for region {region_id}"
        )
    fact = dict(row)
    if fact["withheld"]:
        # The figures stay in the warehouse for review; a reader is told why, not shown
        # a comparison its own check refused.
        for name in (
            "vs_median",
            "vs_median_low",
            "vs_median_high",
            "rank",
            "rank_best",
            "rank_worst",
            "peak_year",
            "peak_vs_median",
            "above_median_since",
        ):
            fact[name] = None
        fact["episodes"], fact["series"] = [], []
    return Persistence(
        **{k: v for k, v in fact.items() if k in Persistence.model_fields},
    )
