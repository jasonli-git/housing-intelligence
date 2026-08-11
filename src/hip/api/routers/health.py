"""Health endpoint.

Reports three things a caller actually needs: is the service up, is the warehouse
reachable, and how fresh is the data. A degraded warehouse produces HTTP 200 with
``status: "degraded"`` rather than a 5xx — the API is up, its data source is not, and
those are different failures.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from hip import __version__
from hip.warehouse.db import probe

router = APIRouter(tags=["meta"])


class DatabaseHealth(BaseModel):
    connected: bool
    migrated: bool
    error: str | None = None
    last_load_at: datetime | None = None


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    database: DatabaseHealth
    detail: str | None = None


@router.get("/health", response_model=Health, summary="Service and warehouse health")
def health() -> Health:
    status = probe()
    db = DatabaseHealth(
        connected=status.connected,
        migrated=status.migrated,
        error=status.error,
        last_load_at=status.last_load_at,
    )
    if not status.connected:
        detail = "Warehouse unreachable. Is it running? `make db-up`"
    elif not status.migrated:
        detail = "Warehouse reachable but not migrated. Run `make migrate`."
    elif status.last_load_at is None:
        detail = "Warehouse migrated but empty. No source release has been loaded."
    else:
        detail = None
    return Health(
        status="ok" if status.connected and status.migrated else "degraded",
        version=__version__,
        database=db,
        detail=detail,
    )
