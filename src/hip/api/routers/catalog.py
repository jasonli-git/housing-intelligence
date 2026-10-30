"""The Data Explorer's catalog (Milestone 59): metadata about the pipeline, never rows."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from hip.api.deps import SessionDep
from hip.config import REPO_ROOT, get_settings, load_metrics, load_sources
from hip.warehouse.catalog import build_catalog

router = APIRouter(tags=["meta"])


@router.get("/catalog", summary="How the data is organized and joined")
def catalog(session: SessionDep) -> dict[str, Any]:
    """Sources, models, tables and metrics, from the pipeline's own records."""
    return build_catalog(
        session.connection(),
        target=REPO_ROOT / "dbt" / "target",
        duckdb_path=get_settings().duckdb_path,
        sources=load_sources(),
        metrics=load_metrics(),
    )
