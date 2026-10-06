"""Somewhere like here, but cheaper (Milestone 46, ARCHITECTURE #317).

A town's figures on the measures it was matched on, and up to five towns most like it
whose homes sold for at least 10% less, each with the same figures, so the page can set
them side by side and say exactly what "like here" meant. Matches in no particular
standing: nearest first, with no score shown.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from hip.api.deps import SessionDep
from hip.warehouse.names import municipality_label

router = APIRouter(tags=["regions"])


class Figure(BaseModel):
    metric_id: str
    label: str
    unit: str
    period_end: str | None
    value: float | None


class SimilarPlace(BaseModel):
    region_id: int
    name: str
    figures: list[Figure]


class SimilarPlaces(BaseModel):
    region_id: int
    measures: list[str]
    price: str
    commute: str
    context: list[str]
    min_sales: int
    cheaper_by: float
    commute_minutes: float
    # The sale price's window: its first day and last.
    price_from: str | None
    price_to: str | None
    here: SimilarPlace
    matches: list[SimilarPlace]


_SQL = text(
    f"""
    SELECT s.rank, s.place_region_id, s.figures, s.basis,
           {municipality_label("t", "c")} AS name
    FROM similar_places s
    JOIN regions t ON t.region_id = s.place_region_id
    LEFT JOIN regions c ON c.region_id = t.parent_id
    WHERE s.region_id = :region_id
    ORDER BY s.rank
    """
)
_METRICS = text("SELECT metric_id, label, unit FROM metrics WHERE metric_id = ANY(:ids)")


@router.get(
    "/regions/{region_id}/similar-places",
    response_model=SimilarPlaces,
    summary="Towns most like this one whose homes sold for at least 10% less",
)
def similar_places(region_id: int, session: SessionDep) -> SimilarPlaces:
    """404 for anything but a town priced on enough sales; an empty `matches` where no
    town is near enough, which the page says."""
    rows = session.execute(_SQL, {"region_id": region_id}).mappings().all()
    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No comparison for region {region_id}"
        )
    basis: dict[str, Any] = rows[0]["basis"]
    ids = [*basis["measures"], basis["price"], basis["commute"], *basis["context"]]
    meta = {r["metric_id"]: r for r in session.execute(_METRICS, {"ids": ids}).mappings()}
    periods: dict[str, str] = basis["periods"]

    def place(row: Any) -> SimilarPlace:
        return SimilarPlace(
            region_id=row["place_region_id"],
            name=row["name"],
            figures=[
                Figure(
                    metric_id=m,
                    label=meta[m]["label"],
                    unit=meta[m]["unit"],
                    period_end=periods.get(m),
                    value=row["figures"].get(m),
                )
                for m in ids
                if m in meta
            ],
        )

    return SimilarPlaces(
        region_id=region_id,
        measures=basis["measures"],
        price=basis["price"],
        commute=basis["commute"],
        context=basis["context"],
        min_sales=int(basis["min_sales"]),
        cheaper_by=float(basis["cheaper_by"]),
        commute_minutes=float(basis["commute_minutes"]),
        price_from=basis.get("price_from"),
        price_to=periods.get(basis["price"]),
        here=place(rows[0]),
        matches=[place(r) for r in rows[1:]],
    )
