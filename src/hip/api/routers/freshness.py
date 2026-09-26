"""How fresh each source is — public, so a reader never has to trust a number blind.

Read from `hip.warehouse.freshness`, which is what keeps this endpoint importing only
`warehouse` (ARCHITECTURE #6): `Discovery` (Milestone 26) is loaded into
`source_discoveries` at `hip load` time rather than read from `data/raw/` here.
"""

from __future__ import annotations

from fastapi import APIRouter

from hip.api.deps import SessionDep
from hip.config import get_settings, load_sources
from hip.warehouse.freshness import FreshnessReport, build_report

router = APIRouter(tags=["meta"])


@router.get(
    "/freshness",
    response_model=FreshnessReport,
    summary="How fresh each source is, and what to do when one stops answering",
)
def freshness(session: SessionDep) -> FreshnessReport:
    """Every source's status as of the last `hip load` — never re-checked here.

    *Checked today* must never read as *measured today*: `generated_at` is when this
    page was built, `checked_at` is when the publisher was actually asked, and the two
    can be days apart if a scheduled refresh has not run since.
    """
    settings = get_settings()
    sources = load_sources(settings.config_dir)
    return build_report(session, sources)
